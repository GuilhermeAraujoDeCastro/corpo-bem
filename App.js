// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuração do Firebase conforme a sua imagem
const firebaseConfig = {
    apiKey: "AIzaSyAFyeYwj7w92L-h8wrDDwU4kP4lSiB15OM",
    authDomain: "web-treino.firebaseapp.com",
    projectId: "web-treino",
    storageBucket: "web-treino.firebasestorage.app",
    messagingSenderId: "249708014404",
    appId: "1:249708014404:web:63ed1e93a8f83a0f808511"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
console.log("Firebase conectado com sucesso!");

// ===== LÓGICA DE INTERFACE ===== //

// Simula Login e vai para o App
window.login = async function() {
    const username = document.getElementById('username').value.trim();
    const displayname = document.getElementById('displayname').value.trim() || "Atleta";
    const password = document.getElementById('password').value;
    if(!username || !password) { alert('Preencha usuário e senha'); return; }

    const email = `${username}@webtreino.local`;
    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: displayname });
        await saveUserDataToFirestore(userCred.user.uid, { username, displayname });
        await currentUserSetup(userCred.user);
    } catch (err) {
        if(err.code === 'auth/email-already-in-use') {
            try {
                const signIn = await signInWithEmailAndPassword(auth, email, password);
                await currentUserSetup(signIn.user);
            } catch(signErr) { alert('Erro ao entrar: ' + signErr.message); }
        } else {
            alert('Erro: ' + err.message);
        }
    }
}

async function saveUserDataToFirestore(uid, data) {
    try {
        await setDoc(doc(db, 'users', uid), data, { merge: true });
    } catch(e) { console.error('Erro salvando usuário', e); }
}

async function currentUserSetup(user) {
    const uid = user.uid;
    // Perguntar peso, altura e objetivo
    const kg = prompt('Qual seu peso inicial (kg)?', '80');
    const altura = prompt('Qual sua altura (m)?', '1.75');
    const objetivo = prompt('O que deseja alcançar? (mais peso / menos peso)', 'menos peso');
    const frase = prompt('Digite uma frase para motivação (ex: "Força e foco")', 'A dor de hoje é a força de amanhã.');

    await saveUserDataToFirestore(uid, { kgInicial: kg, alturaInicial: altura, objetivo, frase, sequence: 0, water: 0 });

    document.getElementById('greeting').innerText = `Bem vindo(a), ${user.displayName || 'Atleta'}!`;
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('main-app').classList.add('active');

    loadProfilePhrase(uid);
    loadGoals(uid);
    loadWater(uid);
}

// Alternar entre abas
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

// Dark/Light Mode
window.toggleDarkMode = function() {
    document.body.classList.toggle('light-mode');
}

// Lógica de beber água com barra de progresso CSS
let totalAgua = 0;
const metaAgua = 2000; // 2 litros

window.addWater = async function(quantidade) {
    totalAgua += quantidade;
    if(totalAgua > metaAgua) totalAgua = metaAgua;

    document.getElementById('water-text').innerText = totalAgua;

    let porcentagem = (totalAgua / metaAgua) * 100;
    document.getElementById('water-fill').style.width = `${porcentagem}%`;

    const user = auth.currentUser;
    if(user) {
        try { await setDoc(doc(db, 'users', user.uid), { water: totalAgua }, { merge: true }); } catch(e) { console.error(e); }
    } else {
        localStorage.setItem('water', totalAgua);
    }

    if(totalAgua === metaAgua) dispararConfetes();
}

// Salvar Foto de Perfil no LocalStorage (sem gastar banco de dados)
window.onload = function() {
    const savedPic = localStorage.getItem('profilePic');
    if(savedPic) {
        document.getElementById('profile-img').src = savedPic;
    }

    onAuthStateChanged(auth, async (user) => {
        if(user) {
            document.getElementById('greeting').innerText = `Bem vindo(a), ${user.displayName || 'Atleta'}!`;
            document.getElementById('auth-screen').classList.remove('active');
            document.getElementById('main-app').classList.add('active');
            loadProfilePhrase(user.uid);
            loadGoals(user.uid);
            loadWater(user.uid);
        }
    });
}

window.salvarFoto = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Image = e.target.result;
            document.getElementById('profile-img').src = base64Image;
            localStorage.setItem('profilePic', base64Image); // Salva no dispositivo
            const user = auth.currentUser;
            if(user) { setDoc(doc(db, 'users', user.uid), { profilePic: base64Image }, { merge: true }).catch(e=>console.error(e)); }
        };
        reader.readAsDataURL(file);
    }
}

// Efeito Confete usando a biblioteca canvas-confetti importada no HTML
window.concluirMetas = function() {
    dispararConfetes();
}

function dispararConfetes() {
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00e5ff', '#005bb5', '#ffffff'] // Cores combinando com o tema
    });
}

// --- Metas (Goals) ---
window.addGoal = async function() {
    const input = document.getElementById('new-goal-input');
    const text = input.value.trim();
    if(!text) return alert('Digite uma meta.');
    const target = parseTargetFromText(text) || 1;
    const goal = { text, target, current: 0, createdAt: Date.now() };
    const user = auth.currentUser;
    if(user) {
        try {
            await addDoc(collection(db, 'users', user.uid, 'goals'), goal);
            input.value = '';
            loadGoals(user.uid);
        } catch(e) { console.error(e); }
    } else {
        // fallback local
        const local = JSON.parse(localStorage.getItem('localGoals') || '[]');
        local.push(goal);
        localStorage.setItem('localGoals', JSON.stringify(local));
        input.value = '';
        renderLocalGoals(local);
    }
}

function parseTargetFromText(text) {
    const m = text.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

async function loadGoals(uid) {
    const goalsList = document.getElementById('goals-list');
    goalsList.innerHTML = '';
    try {
        const snap = await getDocs(collection(db, 'users', uid, 'goals'));
        snap.forEach(docSnap => {
            const g = docSnap.data();
            const id = docSnap.id;
            const el = createGoalElement(id, g);
            goalsList.appendChild(el);
        });
    } catch(e) { console.error(e); }
}

function createGoalElement(id, g) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card neon-border';
    wrapper.innerHTML = `<h4>${g.text}</h4>
        <div class="progress-container"><div class="progress-bar"><div class="fill" style="width:${(g.current/g.target)*100}%"></div></div></div>
        <div style="display:flex;gap:8px;align-items:center;"> <span>${g.current}/${g.target}</span> <button onclick="incrementGoal('${id}', ${g.current}, ${g.target})">+1</button></div>`;
    return wrapper;
}

window.incrementGoal = async function(id, current, target) {
    const user = auth.currentUser;
    const newCurrent = Math.min(current + 1, target);
    if(user) {
        try { await updateDoc(doc(db, 'users', user.uid, 'goals', id), { current: newCurrent });
            if(newCurrent >= target) dispararConfetes();
            loadGoals(user.uid);
        } catch(e) { console.error(e); }
    }
}

function renderLocalGoals(list) {
    const goalsList = document.getElementById('goals-list');
    goalsList.innerHTML = '';
    list.forEach((g, idx) => {
        const el = document.createElement('div'); el.className = 'card neon-border';
        el.innerHTML = `<h4>${g.text}</h4><p>${g.current||0}/${g.target}</p>`;
        goalsList.appendChild(el);
    });
}

// --- Perfil: frase e carregamento ---
window.editPhrase = async function() {
    const user = auth.currentUser;
    const frase = prompt('Digite sua frase de motivação:');
    if(!frase) return;
    if(user) await setDoc(doc(db, 'users', user.uid), { frase }, { merge: true });
    document.querySelector('.quote').innerText = frase;
}

async function loadProfilePhrase(uid) {
    try {
        const d = await getDoc(doc(db, 'users', uid));
        if(d.exists()) {
            const data = d.data();
            if(data.frase) document.querySelector('.quote').innerText = data.frase;
        }
    } catch(e) { console.error(e); }
}

async function loadWater(uid) {
    try {
        const d = await getDoc(doc(db, 'users', uid));
        if(d.exists()) {
            const data = d.data();
            totalAgua = data.water || 0;
            document.getElementById('water-text').innerText = totalAgua;
            let porcentagem = (totalAgua / metaAgua) * 100;
            document.getElementById('water-fill').style.width = `${porcentagem}%`;
        }
    } catch(e) { console.error(e); }
}