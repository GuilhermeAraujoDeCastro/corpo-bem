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
    if (state.currentUser?.uid !== user.uid) { state.userData = {}; state.goals = []; }
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

