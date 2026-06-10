// Autenticação: login, cadastro, Google, recuperação de senha e onboarding.
//
// Correção importante feita nesta reorganização: antes, o listener
// onAuthStateChanged e o próprio fluxo de goSignup() disputavam a navegação
// ao mesmo tempo. Assim que createUserWithEmailAndPassword criava o usuário,
// o Firebase já disparava o listener sozinho, e ele chamava showApp() antes
// de goSignup() terminar de salvar os dados e chamar a tela de onboarding.
// Era essa corrida que fazia contas novas caírem direto no app principal,
// puladas do onboarding, com a tela toda vazia (e essa mesma falta de dados
// básicos é o que fazia login parecer "quebrado" depois). Agora um estado
// simples (authActionInProgress) avisa o listener para não interferir
// enquanto um login/cadastro explícito já está cuidando da navegação.
import {
    auth, db,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged,
    updateProfile, signOut, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup,
    doc, setDoc, getDoc, collection, addDoc
} from './firebase-config.js';
import { state, getLocalDateStr, isValidHeight, formatHeight } from './state.js';
import { showLogin, showSignup, showOnboardingScreen, showApp, showToast, showPrompt } from './ui.js';

let onAuthenticatedApp = async () => {};
let tempOnboardingData = {};

export function initAuth(onAuthenticatedAppCallback) {
    onAuthenticatedApp = onAuthenticatedAppCallback;
    onAuthStateChanged(auth, async (user) => {
        if (state.authActionInProgress) return;
        if (user) {
            await routeAfterAuth(user);
        } else {
            showLogin();
        }
    });
}

async function loadUserData(uid) {
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) state.userData = snap.data();
        return true;
    } catch (e) {
        console.error('Erro carregando dados do usuário', e);
        return false;
    }
}

async function routeAfterAuth(user) {
    state.currentUser = user;
    const carregou = await loadUserData(user.uid);
    if (!carregou) {
        // Correção: antes, qualquer falha ao carregar os dados (permissão do
        // Firestore ainda não publicada, conexão instável, extensão do
        // navegador bloqueando a requisição) caía direto no bloco de baixo e
        // mandava a pessoa pro onboarding, como se fosse conta nova. Pra
        // quem já tinha conta, terminar o onboarding de novo sobrescrevia
        // peso, altura e zerava a sequência de dias. Agora uma falha real
        // de carregamento não decide nada sozinha: volta pro login com um
        // aviso, em vez de arriscar apagar o progresso de quem já tem conta.
        showLogin();
        showToast('Não consegui carregar sua conta agora. Verifique sua conexão (ou uma extensão do navegador bloqueando o Firebase) e entre de novo.', 'error');
        return;
    }
    if (!state.userData.kgInicial) {
        showOnboardingScreen();
        window.showOnboardingStep('weight');
    } else {
        showApp();
        await onAuthenticatedApp();
    }
}

window.showLogin = showLogin;
window.showSignup = showSignup;

window.goLogin = async function () {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) { showToast('Preencha usuário e senha.', 'error'); return; }

    // Login sempre em minusculas: Firebase ja trata e-mail de forma
    // insensivel a maiusculas/minusculas por baixo dos panos, entao
    // isso so garante que o app monte o mesmo endereco pseudo de
    // sempre, em vez de depender de como a pessoa digitou dessa vez.
    const email = `${username.toLowerCase()}@webtreino.local`;
    state.authActionInProgress = true;
    try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        await routeAfterAuth(userCred.user);
    } catch (err) {
        showToast(friendlyAuthError(err), 'error');
    } finally {
        state.authActionInProgress = false;
    }
};

window.goSignup = async function () {
    const username = document.getElementById('signup-username').value.trim();
    const displayname = document.getElementById('signup-displayname').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-password-confirm').value;

    if (!username || !displayname || !password || !confirmPassword) {
        showToast('Preencha todos os campos.', 'error');
        return;
    }
    if (password !== confirmPassword) {
        showToast('As senhas não coincidem.', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('A senha precisa ter pelo menos 6 caracteres.', 'error');
        return;
    }

    // Mesmo motivo do login: sempre minusculas, pra combinar com o que
    // o Firebase ja faz internamente e evitar contas "quase iguais".
    const usernameLower = username.toLowerCase();
    const email = `${usernameLower}@webtreino.local`;
    state.authActionInProgress = true;
    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: displayname });
        state.currentUser = userCred.user;
        await setDoc(doc(db, 'users', userCred.user.uid), { username: usernameLower, displayname, createdAt: Date.now() }, { merge: true });
        tempOnboardingData = {};
        showOnboardingScreen();
        window.showOnboardingStep('weight');
    } catch (err) {
        showToast(friendlyAuthError(err), 'error');
    } finally {
        state.authActionInProgress = false;
    }
};

window.loginWithGoogle = async function () {
    const provider = new GoogleAuthProvider();
    state.authActionInProgress = true;
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) {
            await setDoc(doc(db, 'users', user.uid), { username: user.email, displayname: user.displayName, createdAt: Date.now() }, { merge: true });
        }
        await routeAfterAuth(user);
    } catch (err) {
        showToast(friendlyAuthError(err), 'error');
    } finally {
        state.authActionInProgress = false;
    }
};
window.loginWithGoogleSignup = window.loginWithGoogle;

window.goForgotPassword = async function () {
    const result = await showPrompt({
        title: 'Recuperar senha',
        fields: [{ id: 'login', label: 'Usuário ou e-mail', placeholder: 'ex: claudio' }]
    });
    if (!result || !result.login) return;
    if (!result.login.includes('@')) {
        // Contas criadas so com nome de usuario nao tem um e-mail de
        // verdade por tras (o login usa um endereco interno, tipo
        // "usuario@webtreino.local", que nao existe pra receber nada).
        // Chamar sendPasswordResetEmail nesse endereco nao da erro, mas
        // o e-mail nunca chega a lugar nenhum - entao, em vez de fingir
        // que funcionou, avisamos isso direto.
        showToast('Contas com nome de usuário (sem e-mail cadastrado) ainda não têm recuperação automática de senha. Se lembrar a senha antiga, entre normalmente; senão, crie uma nova conta.', 'info');
        return;
    }
    try {
        await sendPasswordResetEmail(auth, result.login);
        showToast('Se a conta existir, o e-mail de recuperação foi enviado.', 'success');
    } catch (err) {
        showToast(friendlyAuthError(err), 'error');
    }
};

// ===== ONBOARDING =====
window.showOnboardingStep = function (step) {
    document.querySelectorAll('.onboarding-step').forEach(el => el.style.display = 'none');
    document.getElementById(`step-${step}`).style.display = 'block';
};

window.nextOnboardingStep = function (from) {
    if (from === 'weight') {
        const weight = document.getElementById('onboard-weight').value;
        if (!weight || parseFloat(weight) <= 0) { showToast('Digite seu peso.', 'error'); return; }
        tempOnboardingData.kgInicial = parseFloat(weight);
        window.showOnboardingStep('height');
    } else if (from === 'height') {
        const height = document.getElementById('onboard-height').value;
        if (!height || !isValidHeight(height)) { showToast('Digite uma altura válida (ex: 1.80).', 'error'); return; }
        tempOnboardingData.alturaInicial = formatHeight(height);
        window.showOnboardingStep('goal');
    } else if (from === 'target-weight') {
        const targetWeight = document.getElementById('onboard-target-weight').value;
        if (!targetWeight || parseFloat(targetWeight) <= 0) { showToast('Digite um peso alvo válido.', 'error'); return; }
        tempOnboardingData.kgAlvo = parseFloat(targetWeight);
        window.showOnboardingStep('target-height');
    } else if (from === 'target-height') {
        const targetHeight = document.getElementById('onboard-target-height').value;
        if (!targetHeight || !isValidHeight(targetHeight)) { showToast('Digite uma altura válida.', 'error'); return; }
        tempOnboardingData.alturaAlvo = formatHeight(targetHeight);
        window.showOnboardingStep('phrase');
    }
};

window.selectObjective = function (obj) {
    tempOnboardingData.objetivo = obj;
    if (obj === 'perder' || obj === 'ganhar') {
        window.showOnboardingStep('target-weight');
    } else {
        window.showOnboardingStep('phrase');
    }
};

window.finishOnboarding = async function () {
    const phrase = document.getElementById('onboard-phrase').value || 'A dor de hoje é a força de amanhã.';
    tempOnboardingData.frase = phrase;
    tempOnboardingData.kgAtual = tempOnboardingData.kgInicial;
    tempOnboardingData.alturaAtual = tempOnboardingData.alturaInicial;
    // sequencia e ultimoAcesso nao sao definidos aqui: o primeiro
    // updateStreak() (chamado logo em seguida, dentro de loadAllData)
    // ja inicializa os dois corretamente pra "1 dia", como se fosse o
    // primeiro acesso de verdade. Se fixassemos sequencia=0 e
    // ultimoAcesso=hoje aqui, o updateStreak() de hoje mesmo cairia no
    // caminho de "ja acessou hoje" e nunca chegaria a 1 - a sequencia
    // ficava sempre um dia atrasada em relacao ao uso real.

    const uid = state.currentUser.uid;
    try {
        await setDoc(doc(db, 'users', uid), tempOnboardingData, { merge: true });
        await addDoc(collection(db, 'users', uid, 'weights'), { date: getLocalDateStr(), weight: tempOnboardingData.kgInicial });
        state.userData = tempOnboardingData;
        showApp();
        await onAuthenticatedApp();
    } catch (e) {
        showToast('Erro ao salvar seus dados: ' + e.message, 'error');
    }
};

window.signOutAccount = async function () {
    try {
        await signOut(auth);
        state.currentUser = null;
        state.userData = {};
        showLogin();
    } catch (e) {
        console.error(e);
        showToast('Erro ao sair da conta.', 'error');
    }
};

function friendlyAuthError(err) {
    const code = err && err.code ? err.code : '';
    const map = {
        'auth/invalid-credential': 'Usuário ou senha incorretos.',
        'auth/user-not-found': 'Usuário ou senha incorretos.',
        'auth/wrong-password': 'Usuário ou senha incorretos.',
        'auth/email-already-in-use': 'Esse nome de usuário já está em uso.',
        'auth/weak-password': 'Escolha uma senha mais forte (pelo menos 6 caracteres).',
        'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
        'auth/popup-closed-by-user': 'Login com Google cancelado.',
        'auth/unauthorized-domain': 'Este domínio não está autorizado no Firebase Authentication.'
    };
    return map[code] || ('Erro: ' + (err && err.message ? err.message : 'tente novamente.'));
}
