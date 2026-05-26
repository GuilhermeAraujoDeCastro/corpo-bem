// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
// Adicione outras importações aqui depois (ex: auth, firestore)

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
console.log("Firebase conectado com sucesso!");

// ===== LÓGICA DE INTERFACE ===== //

// Simula Login e vai para o App
window.login = function() {
    const nome = document.getElementById('displayname').value || "Atleta";
    document.getElementById('greeting').innerText = `Bem vindo(a), ${nome}!`;
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('main-app').classList.add('active');
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

window.addWater = function(quantidade) {
    totalAgua += quantidade;
    if(totalAgua > metaAgua) totalAgua = metaAgua;
    
    document.getElementById('water-text').innerText = totalAgua;
    
    let porcentagem = (totalAgua / metaAgua) * 100;
    document.getElementById('water-fill').style.width = `${porcentagem}%`;

    if(totalAgua === metaAgua) {
        dispararConfetes();
    }
}

// Salvar Foto de Perfil no LocalStorage (sem gastar banco de dados)
window.onload = function() {
    const savedPic = localStorage.getItem('profilePic');
    if(savedPic) {
        document.getElementById('profile-img').src = savedPic;
    }
}

window.salvarFoto = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Image = e.target.result;
            document.getElementById('profile-img').src = base64Image;
            localStorage.setItem('profilePic', base64Image); // Salva no dispositivo
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