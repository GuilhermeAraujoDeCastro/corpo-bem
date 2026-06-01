// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile, signOut, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAFyeYwj7w92L-h8wrDDwU4kP4lSiB15OM",
    authDomain: "web-treino.firebaseapp.com",
    projectId: "web-treino",
    storageBucket: "web-treino.firebasestorage.app",
    messagingSenderId: "249708014404",
    appId: "1:249708014404:web:63ed1e93a8f83a0f808511"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
console.log("Firebase conectado com sucesso!");

// ===== ESTADO GLOBAL =====
let currentUser = null;
let userData = {};
let currentOnboardingStep = 'weight';
let tempOnboardingData = {};

// ===== TELAS E NAVEGAÇÃO =====
window.showLogin = function() {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('signup-screen').classList.remove('active');
    document.getElementById('onboarding-screen').classList.remove('active');
    document.getElementById('main-app').classList.remove('active');
}

window.showSignup = function() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('signup-screen').classList.add('active');
    document.getElementById('onboarding-screen').classList.remove('active');
    document.getElementById('main-app').classList.remove('active');
}

window.showOnboarding = function() {
    currentOnboardingStep = 'weight';
    tempOnboardingData = {};
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('signup-screen').classList.remove('active');
    document.getElementById('onboarding-screen').classList.add('active');
    document.getElementById('main-app').classList.remove('active');
    showOnboardingStep('weight');
}

window.showApp = function() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('signup-screen').classList.remove('active');
    document.getElementById('onboarding-screen').classList.remove('active');
    document.getElementById('main-app').classList.add('active');
}

// ===== AUTENTICAÇÃO =====
window.goLogin = async function() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if(!username || !password) { alert('Preencha usuário e senha'); return; }

    const email = `${username}@webtreino.local`;
    try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        currentUser = userCred.user;
        await loadUserData(userCred.user.uid);
        showApp();
        loadAllData();
    } catch (err) {
        alert('Erro ao entrar: ' + err.message);
    }
}

window.goSignup = async function() {
    const username = document.getElementById('signup-username').value.trim();
    const displayname = document.getElementById('signup-displayname').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-password-confirm').value;

    if(!username || !displayname || !password || !confirmPassword) {
        alert('Preencha todos os campos');
        return;
    }
    if(password !== confirmPassword) {
        alert('Senhas não coincidem');
        return;
    }

    const email = `${username}@webtreino.local`;
    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: displayname });
        currentUser = userCred.user;
        await setDoc(doc(db, 'users', userCred.user.uid), { username, displayname, createdAt: Date.now() }, { merge: true });
        showOnboarding();
    } catch (err) {
        alert('Erro ao criar conta: ' + err.message);
    }
}

window.loginWithGoogle = async function() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        currentUser = user;
        await setDoc(doc(db, 'users', user.uid), { username: user.email, displayname: user.displayName, createdAt: Date.now() }, { merge: true });
        await loadUserData(user.uid);
        showApp();
        loadAllData();
    } catch(e) { alert('Erro login Google: ' + e.message); }
}

window.loginWithGoogleSignup = window.loginWithGoogle;

window.goForgotPassword = function() {
    const val = prompt('Digite seu username ou e-mail para recuperar a senha:');
    if(!val) return;
    const email = val.includes('@') ? val : `${val}@webtreino.local`;
    sendPasswordResetEmail(auth, email).then(()=> alert('Email de recuperação enviado (simulado se @webtreino.local).')).catch(e=> alert('Erro: ' + e.message));
}

async function loadUserData(uid) {
    try {
        const doc_snap = await getDoc(doc(db, 'users', uid));
        if(doc_snap.exists()) {
            userData = doc_snap.data();
        }
    } catch(e) {
        console.error('Erro carregando dados do usuário', e);
    }
}

// ===== ONBOARDING =====
window.showOnboardingStep = function(step) {
    document.querySelectorAll('.onboarding-step').forEach(el => el.style.display = 'none');
    document.getElementById(`step-${step}`).style.display = 'block';
    currentOnboardingStep = step;
}

window.nextOnboardingStep = function(from) {
    if(from === 'weight') {
        const weight = document.getElementById('onboard-weight').value;
        if(!weight) { alert('Digite seu peso'); return; }
        tempOnboardingData.kgInicial = parseFloat(weight);
        showOnboardingStep('height');
    } else if(from === 'height') {
        const height = document.getElementById('onboard-height').value;
        if(!height || !isValidHeight(height)) { alert('Digite uma altura válida (ex: 1.80)'); return; }
        tempOnboardingData.alturaInicial = formatHeight(height);
        showOnboardingStep('goal');
    } else if(from === 'target-weight') {
        const targetWeight = document.getElementById('onboard-target-weight').value;
        if(!targetWeight) { alert('Digite seu peso alvo'); return; }
        tempOnboardingData.kgAlvo = parseFloat(targetWeight);
        showOnboardingStep('target-height');
    } else if(from === 'target-height') {
        const targetHeight = document.getElementById('onboard-target-height').value;
        if(!targetHeight || !isValidHeight(targetHeight)) { alert('Digite uma altura válida'); return; }
        tempOnboardingData.alturaAlvo = formatHeight(targetHeight);
        showOnboardingStep('phrase');
    }
}

window.selectObjective = function(obj) {
    tempOnboardingData.objetivo = obj;
    if(obj === 'perder') {
        showOnboardingStep('target-weight');
    } else if(obj === 'ganhar') {
        showOnboardingStep('target-weight');
    } else {
        // manter: pula para frase
        showOnboardingStep('phrase');
    }
}

window.finishOnboarding = async function() {
    const phrase = document.getElementById('onboard-phrase').value || 'A dor de hoje é a força de amanhã.';
    tempOnboardingData.frase = phrase;
    tempOnboardingData.kgAtual = tempOnboardingData.kgInicial;
    tempOnboardingData.alturaAtual = tempOnboardingData.alturaInicial;
    tempOnboardingData.sequencia = 0;
    tempOnboardingData.ultimoAcesso = new Date().toISOString().split('T')[0];

    const uid = currentUser.uid;
    try {
        await setDoc(doc(db, 'users', uid), tempOnboardingData, { merge: true });
        // salva peso inicial como entrada no subcollection 'weights'
        await addDoc(collection(db, 'users', uid, 'weights'), { date: new Date().toISOString().split('T')[0], weight: tempOnboardingData.kgInicial });
        userData = tempOnboardingData;
        showApp();
        loadAllData();
    } catch(e) {
        alert('Erro ao salvar dados: ' + e.message);
    }
}

function isValidHeight(h) {
    const parsed = parseFloat(h);
    return parsed >= 1.0 && parsed <= 2.5;
}

function formatHeight(h) {
    const p = parseFloat(h);
    if(!isNaN(p)) {
        return p.toFixed(2);
    }
    return h;
}

// ===== CARREGAMENTO INICIAL =====
window.onload = function() {
    onAuthStateChanged(auth, async (user) => {
        if(user) {
            currentUser = user;
            await loadUserData(user.uid);
            showApp();
            loadAllData();
        } else {
            showLogin();
        }
    });

    const savedPic = localStorage.getItem('profilePic');
    if(savedPic && document.getElementById('profile-img')) {
        document.getElementById('profile-img').src = savedPic;
    }
}

// ===== METAS (GOALS) =====
window.addGoal = async function() {
    const text = document.getElementById('new-goal-input').value.trim();
    const target = parseFloat(document.getElementById('new-goal-target').value);
    const unit = document.getElementById('new-goal-unit').value;
    if(!text || !target || isNaN(target)) return alert('Preencha a descrição e a quantidade alvo');

    const isDaily = document.getElementById('new-goal-daily').checked;
    const goal = { text, createdAt: Date.now(), target: target, current: 0, unit, isDaily };
    if(currentUser) {
        try {
            await addDoc(collection(db, 'users', currentUser.uid, 'goals'), goal);
            document.getElementById('new-goal-input').value = '';
            document.getElementById('new-goal-target').value = '';
            document.getElementById('new-goal-daily').checked = false;
            loadGoals();
        } catch(e) { console.error(e); alert('Erro ao adicionar meta'); }
    } else {
        alert('Faça login para salvar metas');
    }
}

function parseGoalTarget(text) {
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

function detectGoalUnit(text) {
    const lower = text.toLowerCase();
    if(lower.includes('água') || lower.includes('ml') || lower.includes('litro')) return 'ml';
    if(lower.includes('flexão') || lower.includes('abdominais') || lower.includes('séries')) return 'reps';
    if(lower.includes('km') || lower.includes('correr')) return 'km';
    return 'qty';
}

async function loadGoals() {
    if(!currentUser) return;
    const container = document.getElementById('goals-container');
    const list = document.getElementById('goals-list');
    
    try {
        const snap = await getDocs(collection(db, 'users', currentUser.uid, 'goals'));
        if(snap.empty) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-color); margin-top: 30px;"><p>Nenhuma meta adicionada ainda.</p><p style="font-size: 12px; color: var(--neon-dark);">Vá para <strong>Metas</strong> para adicionar!</p></div>';
            list.innerHTML = '';
            return;
        }

        container.innerHTML = '';
        list.innerHTML = '';
        const goals = [];
        snap.forEach(s => goals.push({ id: s.id, ...s.data() }));
        goals.forEach(g => {
            const el = createGoalCard(g);
            container.appendChild(el);
            list.appendChild(el.cloneNode(true));
        });
    } catch(e) { console.error(e); }
}

function createGoalCard(g) {
    const card = document.createElement('div');
    card.className = 'card neon-border goal-card';
    const percent = (g.current / g.target) * 100;
    const unit = g.unit === 'ml' ? 'ml' : g.unit === 'reps' ? 'reps' : g.unit === 'km' ? 'km' : '';
    let fillColor = '#00e5ff';
    if(percent >= 100) fillColor = '#00ff66';
    else if(percent >= 50) fillColor = '#ffd700';

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
                <h4>${g.text} ${g.isDaily ? '<span style="font-size:10px;background:rgba(0,229,255,0.15);border:1px solid var(--neon-blue);color:var(--neon-blue);padding:2px 7px;border-radius:10px;">Diária</span>' : ''}</h4>
                <p style="font-size: 12px; color: var(--neon-dark);">${g.current} ${unit} / ${g.target} ${unit}</p>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
                <button onclick="editGoal('${g.id}')" class="btn-small">Editar</button>
                <button onclick="deleteGoal('${g.id}')" class="btn-delete">✕</button>
            </div>
        </div>
        <div class="progress-container">
            <div class="progress-bar"><div class="fill" style="width: ${percent}%; background: ${fillColor}; box-shadow: 0 0 10px ${fillColor};"></div></div>
        </div>
        <button onclick="openProgressModal('${g.id}', '${g.text}', ${g.target}, ${g.current}, '${g.unit}')" class="btn-small">+</button>
    `;
    return card;
}

window.deleteGoal = async function(id) {
    if(!confirm('Deletar essa meta?')) return;
    if(!currentUser) return;
    try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'goals', id));
        loadGoals();
    } catch(e) { console.error(e); }
}

window.editGoal = async function(id) {
    if(!currentUser) return;
    const docRef = doc(db, 'users', currentUser.uid, 'goals', id);
    const snap = await getDoc(docRef);
    if(!snap.exists()) return alert('Meta não encontrada');
    const g = snap.data();
    const newText = prompt('Editar descrição', g.text) || g.text;
    const newTarget = parseFloat(prompt('Editar alvo', g.target) || g.target);
    const newUnit = prompt('Editar unidade (ml, reps, km, qty)', g.unit) || g.unit;
    try {
        await updateDoc(docRef, { text: newText, target: newTarget, unit: newUnit });
        loadGoals();
    } catch(e) { console.error(e); }
}

let currentGoalData = {};
window.openProgressModal = function(id, text, target, current, unit) {
    currentGoalData = { id, text, target, current, unit };
    document.getElementById('modal-goal-title').innerText = `Adicionar a "${text}"`;
    document.getElementById('modal-progress-input').value = '';
    document.getElementById('modal-progress-input').placeholder = `Digite a quantidade em ${unit}`;
    const quick = document.getElementById('modal-quick-buttons');
    quick.innerHTML = '';
    if(unit === 'ml') {
        ['250','500','1000'].forEach(v=>{
            const b=document.createElement('button'); b.className='btn-small'; b.innerText='+'+v+'ml'; b.onclick=()=>{ document.getElementById('modal-progress-input').value = parseFloat(document.getElementById('modal-progress-input').value||0)+parseFloat(v); };
            quick.appendChild(b);
        });
    } else if(unit === 'reps') {
        ['1','5','10'].forEach(v=>{ const b=document.createElement('button'); b.className='btn-small'; b.innerText='+'+v; b.onclick=()=>{ document.getElementById('modal-progress-input').value = parseFloat(document.getElementById('modal-progress-input').value||0)+parseFloat(v); }; quick.appendChild(b); });
    } else if(unit === 'km') {
        const b=document.createElement('button'); b.className='btn-small'; b.innerText='+1km'; b.onclick=()=>{ document.getElementById('modal-progress-input').value = parseFloat(document.getElementById('modal-progress-input').value||0)+1; }; quick.appendChild(b);
    }
    document.getElementById('modal-add-progress').style.display = 'block';
}

window.saveProgress = async function() {
    const amount = parseFloat(document.getElementById('modal-progress-input').value);
    if(isNaN(amount) || amount <= 0) {
        alert('Digite uma quantidade válida');
        return;
    }

    const newCurrent = Math.min(currentGoalData.current + amount, currentGoalData.target);
    if(!currentUser) return;

    try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'goals', currentGoalData.id), {
            current: newCurrent
        });

        // log de progresso (para resumo semanal)
        await addDoc(collection(db, 'users', currentUser.uid, 'progressLogs'), {
            goalId: currentGoalData.id,
            text: currentGoalData.text,
            amount: amount,
            unit: currentGoalData.unit,
            date: new Date().toISOString().split('T')[0],
            completed: newCurrent >= currentGoalData.target
        });

        if(newCurrent >= currentGoalData.target) {
            dispararConfetes();
            alert('🎉 Meta cumprida! Parabéns!');
            // ganhar XP e apagar meta
            await grantXPForGoal(currentUser.uid, currentGoalData);
            // remove após breve atraso
            setTimeout(async ()=>{ try{ await deleteDoc(doc(db, 'users', currentUser.uid, 'goals', currentGoalData.id)); loadGoals(); } catch(e){console.error(e);} }, 1200);
        }

        closeModal('modal-add-progress');
        loadGoals();
    } catch(e) { console.error(e); }
}

async function grantXPForGoal(uid, goal) {
    try {
        // XP simples: base 10 * target
        const xpGain = Math.max(5, Math.round(goal.target * 10));
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);
        let xp = 0;
        if(snap.exists()) xp = snap.data().xp || 0;
        xp += xpGain;
        const level = Math.floor(xp / 100) + 1;
        await setDoc(userRef, { xp, level }, { merge: true });
        userData.xp = xp; userData.level = level;
        loadProfileData();
    } catch(e) { console.error(e); }
}

// ===== RECOMPENSAS (REWARDS) =====
window.showAddReward = function() {
    document.getElementById('modal-add-reward').style.display = 'block';
}

window.createReward = async function() {
    const title = document.getElementById('reward-title').value.trim();
    const goal = document.getElementById('reward-goal').value.trim();
    if(!title || !goal) { alert('Preencha todos os campos'); return; }

    const reward = { title, goal, createdAt: Date.now(), completed: false };
    if(!currentUser) return;

    try {
        await addDoc(collection(db, 'users', currentUser.uid, 'rewards'), reward);
        closeModal('modal-add-reward');
        loadRewards();
    } catch(e) { console.error(e); }
}

async function loadRewards() {
    if(!currentUser) return;
    const list = document.getElementById('rewards-list');
    list.innerHTML = '';

    try {
        const snap = await getDocs(collection(db, 'users', currentUser.uid, 'rewards'));
        if(snap.empty) {
            list.innerHTML = '<p style="text-align: center; color: var(--neon-dark);">Nenhuma recompensa criada ainda.</p>';
            return;
        }

        snap.forEach(doc => {
            const r = doc.data();
            const card = document.createElement('div');
            card.className = 'card neon-border';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h4>${r.title}</h4>
                        <p style="font-size: 12px; color: var(--neon-dark);">Se você: ${r.goal}</p>
                    </div>
                    <button onclick="markRewardCompleted('${doc.id}')" class="btn-small">${r.completed ? '✓' : 'Marcar'}</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch(e) { console.error(e); }
}

window.markRewardCompleted = async function(id) {
    if(!currentUser) return;
    try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'rewards', id), {
            completed: true
        });
        dispararConfetes();
        loadRewards();
    } catch(e) { console.error(e); }
}

// ===== PERFIL =====
window.showEditProfile = function() {
    document.getElementById('edit-username').value = userData.username || '';
    document.getElementById('edit-phrase').value = userData.frase || '';
    document.getElementById('modal-edit-profile').style.display = 'block';
}

window.saveProfileChanges = async function() {
    const newUsername = document.getElementById('edit-username').value.trim();
    const newPhrase = document.getElementById('edit-phrase').value.trim();

    if(!currentUser) return;
    try {
        const updates = {};
        if(newUsername) updates.username = newUsername;
        if(newPhrase) updates.frase = newPhrase;

        if(Object.keys(updates).length > 0) {
            await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
            userData = { ...userData, ...updates };
        }

        closeModal('modal-edit-profile');
        loadProfileData();
    } catch(e) { console.error(e); }
}

window.salvarFoto = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64 = e.target.result;
        document.getElementById('profile-img').src = base64;
        localStorage.setItem('profilePic', base64);

        if(currentUser) {
            try {
                await setDoc(doc(db, 'users', currentUser.uid), { profilePic: base64 }, { merge: true });
            } catch(e) { console.error(e); }
        }
    };
    reader.readAsDataURL(file);
}

function loadProfileData() {
    const w = userData.kgInicial || '--';
    const h = userData.alturaInicial || '--';
    const wa = userData.kgAtual || w;
    const ha = userData.alturaAtual || h;
    const obj = userData.objetivo ? (userData.objetivo === 'perder' ? '📉 Perder Peso' : userData.objetivo === 'ganhar' ? '📈 Ganhar Peso' : '⚖️ Manter') : '--';

    document.getElementById('profile-weight-initial').innerText = `${w} kg`;
    document.getElementById('profile-height').innerText = `${h} m`;
    document.getElementById('profile-weight-current').innerText = `${wa} kg`;
    document.getElementById('profile-objetivo').innerText = obj;
    document.querySelector('.quote').innerText = userData.frase || 'A dor de hoje é a força de amanhã.';
    document.getElementById('profile-level').innerText = userData.level || 1;
    document.getElementById('profile-xp').innerText = (userData.xp || 0) + ' XP';
    calcularIMC();
}

// ===== SEQUÊNCIA E DADOS =====
async function updateStreak() {
    if(!currentUser) return;
    try {
        const today = new Date().toISOString().split('T')[0];
        const lastAccess = userData.ultimoAcesso;

        if(lastAccess !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if(lastAccess === yesterdayStr) {
                // Continua sequência
                userData.sequencia = (userData.sequencia || 0) + 1;
            } else {
                // Reset sequência
                userData.sequencia = 1;
            }

            userData.ultimoAcesso = today;
            await setDoc(doc(db, 'users', currentUser.uid), { sequencia: userData.sequencia, ultimoAcesso: today }, { merge: true });
        }

        document.getElementById('streak-count').innerText = userData.sequencia || 0;
    } catch(e) { console.error(e); }
}

async function loadAllData() {
    if(!currentUser) return;
    const uid = currentUser.uid;

    document.getElementById('greeting').innerText = `Bem vindo(a), ${currentUser.displayName || 'Atleta'}!`;
    
    await loadUserData(uid);
    await updateStreak();
    await resetDailyGoals();
    loadGoals();
    loadRewards();
    loadProfileData();
    loadWeightHistory();
    restoreReminders();
}

// ===== HISTÓRICO DE PESO e GRÁFICO =====
window.addMeasurements = async function() {
    if(!currentUser) return alert('Faça login');
    const pesoVal = document.getElementById('profile-new-weight').value;
    const alturaVal = document.getElementById('profile-new-height').value.trim();

    const peso = pesoVal ? parseFloat(pesoVal) : null;
    const altura = alturaVal ? parseFloat(alturaVal) : null;

    if(peso === null && altura === null) return alert('Preencha pelo menos o peso ou a altura.');
    if(peso !== null && (isNaN(peso) || peso <= 0)) return alert('Peso inválido.');
    if(altura !== null && !isValidHeight(String(altura))) return alert('Altura inválida. Use o formato 1.80');

    try {
        const uid = currentUser.uid;
        const date = new Date().toISOString().split('T')[0];
        const updates = {};

        if(peso !== null) {
            await addDoc(collection(db, 'users', uid, 'weights'), { date, weight: peso });
            updates.kgAtual = peso;
            userData.kgAtual = peso;
            document.getElementById('profile-weight-current').innerText = `${peso} kg`;
        }

        if(altura !== null) {
            const alturaFmt = parseFloat(altura).toFixed(2);
            updates.alturaAtual = alturaFmt;
            userData.alturaAtual = alturaFmt;
            document.getElementById('profile-height').innerText = `${alturaFmt} m`;
        }

        if(Object.keys(updates).length > 0) {
            await setDoc(doc(db, 'users', uid), updates, { merge: true });
        }

        document.getElementById('profile-new-weight').value = '';
        document.getElementById('profile-new-height').value = '';
        calcularIMC();
        loadWeightHistory();
    } catch(e) { console.error(e); alert('Erro ao salvar: ' + e.message); }
}

// Mantido por compatibilidade interna
window.addWeightEntry = window.addMeasurements;

async function loadWeightHistory() {
    if(!currentUser) return;
    try {
        const snap = await getDocs(collection(db, 'users', currentUser.uid, 'weights'));
        const arr = [];
        snap.forEach(s => arr.push(s.data()));
        // ordenar por date asc
        arr.sort((a,b)=> new Date(a.date) - new Date(b.date));
        const labels = arr.map(x=>x.date);
        const data = arr.map(x=>parseFloat(x.weight));
        renderWeightChart(labels, data);
    } catch(e) { console.error(e); }
}

// ===== RESUMO SEMANAL =====
async function generateWeeklyRecap() {
    if(!currentUser) return;
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const since = sevenDaysAgo.toISOString().split('T')[0];

        const snap = await getDocs(collection(db, 'users', currentUser.uid, 'progressLogs'));
        const logs = [];
        snap.forEach(s => logs.push(s.data()));

        const recent = logs.filter(l => l.date >= since);
        let waterTotal = 0; let kmTotal = 0; let repsTotal = 0; let completedCount = 0;
        recent.forEach(r=>{
            if(r.unit === 'ml') waterTotal += (r.amount || 0);
            else if(r.unit === 'km') kmTotal += (r.amount || 0);
            else if(r.unit === 'reps') repsTotal += (r.amount || 0);
            if(r.completed) completedCount += 1;
        });

        const totalLogs = recent.length || 1;
        const percentCompleted = Math.round((completedCount / totalLogs) * 100);

        const content = document.getElementById('weekly-summary-content');
        content.innerHTML = `
            <p style="font-size:16px;">Esta semana:</p>
            <ul style="list-style:none; padding-left:0;">
                <li>• Bebeste <strong>${(waterTotal/1000).toFixed(2)} L</strong> de água</li>
                <li>• Correste <strong>${kmTotal.toFixed(2)} km</strong></li>
                <li>• Fizeste <strong>${repsTotal}</strong> repetições</li>
                <li>• Completaste <strong>${percentCompleted}%</strong> das metas registradas</li>
            </ul>
        `;
        document.getElementById('modal-weekly-recap').style.display = 'block';
    } catch(e) { console.error(e); }
}

// Mostrar recap automaticamente aos domingos
function tryShowWeeklyRecapAuto() {
    const today = new Date();
    // 0 = domingo em JS
    if(today.getDay() === 0) {
        generateWeeklyRecap();
    }
}

// chamar após carregar dados
setTimeout(()=>{ tryShowWeeklyRecapAuto(); }, 1200);

function renderWeightChart(labels, data) {
    const ctx = document.getElementById('weight-chart');
    if(!ctx) return;
    // remove existing chart instance
    if(window._weightChart) { window._weightChart.destroy(); }
    window._weightChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Peso (kg)', data, borderColor: '#00e5ff', backgroundColor: 'rgba(0,229,255,0.08)', tension: 0.3 }] },
        options: { responsive: true, scales: { y: { beginAtZero: false } } }
    });
}

// ===== Sair =====
window.signOutAccount = async function() {
    try {
        await signOut(auth);
        currentUser = null; userData = {};
        showLogin();
    } catch(e) { console.error(e); }
}

// ===== INTERFACE =====
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

window.toggleDarkMode = function() {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('light-mode') ? 'true' : 'false');
}

window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Fechar modal ao clicar fora
document.addEventListener('click', function(e) {
    if(e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

// ===== CONFETE =====
function dispararConfetes() {
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00e5ff', '#005bb5', '#ffffff']
    });
}

// Recuperar dark mode
window.addEventListener('load', function() {
    const isDarkMode = localStorage.getItem('darkMode') === 'false';
    if(!isDarkMode) {
        document.body.classList.add('light-mode');
    }
});

// ===== IMC =====
function calcularIMC() {
    const peso = parseFloat(userData.kgAtual || userData.kgInicial);
    const altura = parseFloat(userData.alturaAtual || userData.alturaInicial);
    if(!peso || !altura || altura === 0) return;

    const imc = peso / (altura * altura);
    document.getElementById('imc-value').innerText = imc.toFixed(1);

    let label = '', color = '', pct = 0;
    if(imc < 18.5)      { label = '⚠️ Abaixo do peso'; color = '#4fc3f7'; pct = Math.max(2, ((imc - 10) / 8.5) * 25); }
    else if(imc < 25)   { label = '✅ Peso normal';     color = '#66bb6a'; pct = 25 + ((imc - 18.5) / 6.5) * 25; }
    else if(imc < 30)   { label = '⚠️ Sobrepeso';       color = '#ffa726'; pct = 50 + ((imc - 25) / 5) * 25; }
    else                { label = '🔴 Obesidade';        color = '#ef5350'; pct = Math.min(98, 75 + ((imc - 30) / 10) * 25); }

    const labelEl = document.getElementById('imc-label');
    labelEl.innerText = label;
    labelEl.style.borderColor = color;
    labelEl.style.color = color;
    document.getElementById('imc-marker').style.left = pct.toFixed(1) + '%';
}

// ===== RESET METAS DIÁRIAS =====
async function resetDailyGoals() {
    if(!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    const lastReset = localStorage.getItem('lastDailyReset_' + currentUser.uid);
    if(lastReset === today) return; // já resetou hoje

    try {
        const snap = await getDocs(collection(db, 'users', currentUser.uid, 'goals'));
        const batch = [];
        snap.forEach(s => {
            const g = s.data();
            if(g.isDaily && g.current > 0) {
                batch.push(updateDoc(doc(db, 'users', currentUser.uid, 'goals', s.id), { current: 0 }));
            }
        });
        await Promise.all(batch);
        localStorage.setItem('lastDailyReset_' + currentUser.uid, today);
        if(batch.length > 0) loadGoals();
    } catch(e) { console.error('Erro no reset diário:', e); }
}

// ===== NOTIFICAÇÕES / LEMBRETES =====
let waterReminderInterval = null;
let goalReminderTimeout = null;

window.toggleReminder = async function(type, enabled) {
    if(enabled) {
        const perm = await Notification.requestPermission();
        if(perm !== 'granted') {
            alert('Permissão de notificações negada. Ative nas configurações do navegador.');
            document.getElementById(`toggle-${type}-reminder`).checked = false;
            return;
        }
    }
    localStorage.setItem(`reminder_${type}`, enabled ? '1' : '0');

    if(type === 'water') {
        clearInterval(waterReminderInterval);
        waterReminderInterval = null;
        if(enabled) {
            // Envia agora e depois a cada 2 horas
            sendNotification('💧 Hora de beber água!', 'Não esqueça de se manter hidratado(a).');
            waterReminderInterval = setInterval(() => {
                sendNotification('💧 Hora de beber água!', 'Você já bebeu água hoje? Mantenha a hidratação!');
            }, 2 * 60 * 60 * 1000);
        }
    } else if(type === 'goal') {
        clearTimeout(goalReminderTimeout);
        goalReminderTimeout = null;
        if(enabled) scheduleGoalReminder();
    }
}

function sendNotification(title, body) {
    if(Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
    }
}

function scheduleGoalReminder() {
    const now = new Date();
    const target = new Date();
    target.setHours(20, 0, 0, 0);
    if(now >= target) target.setDate(target.getDate() + 1);
    const ms = target - now;
    goalReminderTimeout = setTimeout(() => {
        sendNotification('🎯 Suas metas te esperam!', 'Ainda dá tempo de cumprir suas metas de hoje!');
        scheduleGoalReminder(); // agenda pro dia seguinte
    }, ms);
}

function restoreReminders() {
    const water = localStorage.getItem('reminder_water') === '1';
    const goal = localStorage.getItem('reminder_goal') === '1';
    const waterEl = document.getElementById('toggle-water-reminder');
    const goalEl = document.getElementById('toggle-goal-reminder');
    if(waterEl) waterEl.checked = water;
    if(goalEl) goalEl.checked = goal;
    if(water && Notification.permission === 'granted') {
        waterReminderInterval = setInterval(() => {
            sendNotification('💧 Hora de beber água!', 'Você já bebeu água hoje? Mantenha a hidratação!');
        }, 2 * 60 * 60 * 1000);
    }
    if(goal && Notification.permission === 'granted') scheduleGoalReminder();
}