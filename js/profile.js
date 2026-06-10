// Perfil: dados pessoais, peso/altura, IMC, gráfico de evolução (peso + IMC
// na mesma linha do tempo), sequência com "congelador" semanal e badges.
import { db, doc, setDoc, getDoc, collection, addDoc, getDocs, updateProfile } from './firebase-config.js';
import { state, getLocalDateStr, isValidHeight } from './state.js';
import { showToast } from './ui.js';

const STREAK_BADGES = [
    { days: 7, key: 'streak_7', label: 'Uma Semana de Fogo', icon: '🔥' },
    { days: 30, key: 'streak_30', label: 'Um Mês Imparável', icon: '⚡' },
    { days: 100, key: 'streak_100', label: 'Lenda dos 100 Dias', icon: '👑' }
];

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function getCssVar(name) {
    return (getComputedStyle(document.body).getPropertyValue(name) || '#ffffff').trim();
}

export function calcularIMC() {
    const peso = parseFloat(state.userData.kgAtual || state.userData.kgInicial);
    const altura = parseFloat(state.userData.alturaAtual || state.userData.alturaInicial);
    if (!peso || !altura) return;

    const imc = peso / (altura * altura);
    setText('imc-value', imc.toFixed(1));

    let label = '', color = '', pct = 0;
    if (imc < 18.5) { label = '⚠️ Abaixo do peso'; color = 'var(--info)'; pct = Math.max(2, ((imc - 10) / 8.5) * 25); }
    else if (imc < 25) { label = '✅ Peso normal'; color = 'var(--success)'; pct = 25 + ((imc - 18.5) / 6.5) * 25; }
    else if (imc < 30) { label = '⚠️ Sobrepeso'; color = 'var(--warning)'; pct = 50 + ((imc - 25) / 5) * 25; }
    else { label = '🔴 Obesidade'; color = 'var(--danger)'; pct = Math.min(98, 75 + ((imc - 30) / 10) * 25); }

    const labelEl = document.getElementById('imc-label');
    if (labelEl) { labelEl.innerText = label; labelEl.style.borderColor = color; labelEl.style.color = color; }
    const markerEl = document.getElementById('imc-marker');
    if (markerEl) markerEl.style.left = pct.toFixed(1) + '%';
}

export function renderProfileSummary() {
    const w = state.userData.kgInicial || '--';
    const h = state.userData.alturaInicial || '--';
    const wa = state.userData.kgAtual || w;
    const ha = state.userData.alturaAtual || h;
    const obj = state.userData.objetivo
        ? (state.userData.objetivo === 'perder' ? '📉 Perder Peso' : state.userData.objetivo === 'ganhar' ? '📈 Ganhar Peso' : '⚖️ Manter')
        : '--';

    setText('profile-weight-initial', `${w} kg`);
    setText('profile-height', `${ha} m`);
    setText('profile-weight-current', `${wa} kg`);
    setText('profile-objetivo', obj);
    const quoteEl = document.querySelector('.quote');
    if (quoteEl) quoteEl.innerText = state.userData.frase || 'A dor de hoje é a força de amanhã.';

    const xp = state.userData.xp || 0;
    const level = state.userData.level || 1;
    const xpForThisLevel = (level - 1) * 100;
    const xpForNextLevel = level * 100;
    const xpInLevel = xp - xpForThisLevel;
    const xpNeeded = xpForNextLevel - xpForThisLevel;
    const xpPct = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));

    setText('profile-level', level);
    setText('profile-xp', `${xp} XP`);

    const homeXpBar = document.getElementById('home-xp-bar');
    const homeXpLabel = document.getElementById('home-xp-label');
    if (homeXpBar) homeXpBar.style.width = xpPct + '%';
    if (homeXpLabel) homeXpLabel.innerText = `Nível ${level} · ${xpInLevel}/${xpNeeded} XP`;

    renderAvatar();
    renderBadges();
    calcularIMC();
}

function renderAvatar() {
    const profileImg = document.getElementById('profile-img');
    if (!profileImg) return;
    // A foto vem primeiro do Firestore (state.userData.profilePic), que
    // ja esta carregado nesse ponto e e o dado certo da conta logada.
    // O cache em localStorage e so um plano B, com chave por conta
    // (evita vazar a foto de uma conta pra outra num navegador
    // compartilhado por mais de uma conta).
    let savedPic = state.userData.profilePic || null;
    if (!savedPic && state.currentUser) {
        try { savedPic = localStorage.getItem(`profilePic_${state.currentUser.uid}`); } catch (e) {}
    }
    if (savedPic) {
        profileImg.src = savedPic;
    } else {
        const name = state.userData.displayname || state.currentUser?.displayName || 'A';
        const initial = name.charAt(0).toUpperCase();
        const colors = ['#33D17A', '#FF8A3D', '#4FC3F7', '#B388FF', '#FF6B6B'];
        const color = colors[initial.charCodeAt(0) % colors.length];
        profileImg.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='${color}'/><text x='50' y='65' font-size='42' text-anchor='middle' fill='white' font-family='Segoe UI,sans-serif' font-weight='bold'>${initial}</text></svg>`)}`;
    }
}

function renderBadges() {
    const container = document.getElementById('badges-list');
    if (!container) return;
    const earned = new Set(state.userData.badges || []);
    container.innerHTML = STREAK_BADGES.map(b => `
        <div class="badge-item ${earned.has(b.key) ? 'badge-earned' : 'badge-locked'}" title="${b.days} dias de sequência">
            <span class="badge-icon">${b.icon}</span>
            <span class="badge-label">${b.label}</span>
        </div>
    `).join('');
}

window.salvarFoto = function (event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Escolha uma imagem de até 2MB.', 'error'); return; }

    const reader = new FileReader();
    reader.onload = async function (e) {
        const base64 = e.target.result;
        document.getElementById('profile-img').src = base64;
        if (state.currentUser) {
            try { localStorage.setItem(`profilePic_${state.currentUser.uid}`, base64); } catch (err) {}
        }
        if (state.currentUser) {
            try { await setDoc(doc(db, 'users', state.currentUser.uid), { profilePic: base64 }, { merge: true }); }
            catch (err) { console.error(err); }
        }
    };
    reader.readAsDataURL(file);
};

window.addMeasurements = async function () {
    if (!state.currentUser) { showToast('Faça login.', 'error'); return; }
    const pesoVal = document.getElementById('profile-new-weight').value;
    const alturaVal = document.getElementById('profile-new-height').value.trim();

    const peso = pesoVal ? parseFloat(pesoVal) : null;
    const altura = alturaVal ? parseFloat(alturaVal) : null;

    if (peso === null && altura === null) { showToast('Preencha pelo menos o peso ou a altura.', 'error'); return; }
    if (peso !== null && (isNaN(peso) || peso <= 0)) { showToast('Peso inválido.', 'error'); return; }
    if (altura !== null && !isValidHeight(String(altura))) { showToast('Altura inválida. Use o formato 1.80.', 'error'); return; }

    try {
        const uid = state.currentUser.uid;
        const date = getLocalDateStr();
        const updates = {};

        if (peso !== null) {
            await addDoc(collection(db, 'users', uid, 'weights'), { date, weight: peso });
            updates.kgAtual = peso;
            state.userData.kgAtual = peso;
            setText('profile-weight-current', `${peso} kg`);
        }
        if (altura !== null) {
            const alturaFmt = parseFloat(altura).toFixed(2);
            updates.alturaAtual = alturaFmt;
            state.userData.alturaAtual = alturaFmt;
            setText('profile-height', `${alturaFmt} m`);
        }
        if (Object.keys(updates).length > 0) {
            await setDoc(doc(db, 'users', uid), updates, { merge: true });
        }

        document.getElementById('profile-new-weight').value = '';
        document.getElementById('profile-new-height').value = '';
        calcularIMC();
        loadWeightHistory();
    } catch (e) { console.error(e); showToast('Erro ao salvar: ' + e.message, 'error'); }
};

export async function loadWeightHistory() {
    if (!state.currentUser) return;
    try {
        const snap = await getDocs(collection(db, 'users', state.currentUser.uid, 'weights'));
        const arr = [];
        snap.forEach(s => arr.push(s.data()));
        arr.sort((a, b) => new Date(a.date) - new Date(b.date));
        renderWeightChart(arr.map(x => x.date), arr.map(x => parseFloat(x.weight)));
    } catch (e) { console.error(e); }
}

function renderWeightChart(labels, weights) {
    const ctx = document.getElementById('weight-chart');
    if (!ctx || typeof window.Chart === 'undefined') return;
    const altura = parseFloat(state.userData.alturaAtual || state.userData.alturaInicial) || null;
    const imcData = altura ? weights.map(w => +(w / (altura * altura)).toFixed(1)) : null;

    if (window._weightChart) window._weightChart.destroy();
    const datasets = [{
        label: 'Peso (kg)', data: weights, borderColor: '#33D17A',
        backgroundColor: 'rgba(51,209,122,0.08)', tension: 0.3, yAxisID: 'y'
    }];
    if (imcData) {
        datasets.push({
            label: 'IMC (com a altura atual)', data: imcData, borderColor: '#FF8A3D',
            backgroundColor: 'transparent', borderDash: [5, 4], tension: 0.3, yAxisID: 'y1'
        });
    }
    const scales = { y: { beginAtZero: false, position: 'left', ticks: { color: '#33D17A' } } };
    if (imcData) scales.y1 = { beginAtZero: false, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#FF8A3D' } };

    window._weightChart = new window.Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: { responsive: true, plugins: { legend: { labels: { color: getCssVar('--text-color') } } }, scales }
    });
}

// ===== SEQUÊNCIA (com congelador de 1 dia por semana) =====
export async function updateStreak() {
    if (!state.currentUser) return;
    try {
        const today = getLocalDateStr();
        const lastAccess = state.userData.ultimoAcesso;
        if (lastAccess === today) { renderStreakDisplay(); return; }

        const oneDay = 24 * 60 * 60 * 1000;
        const todayDate = new Date(today + 'T00:00:00');
        const lastDate = lastAccess ? new Date(lastAccess + 'T00:00:00') : null;
        const daysGap = lastDate ? Math.round((todayDate - lastDate) / oneDay) : null;

        const lastFreezeStr = state.userData.streakFreezeUsedEm;
        const daysSinceFreeze = lastFreezeStr ? Math.round((todayDate - new Date(lastFreezeStr + 'T00:00:00')) / oneDay) : Infinity;
        const freezeDisponivel = daysSinceFreeze >= 7;

        let usouCongelador = false;
        if (daysGap === 1) {
            state.userData.sequencia = (state.userData.sequencia || 0) + 1;
        } else if (daysGap === 2 && freezeDisponivel && (state.userData.sequencia || 0) > 0) {
            // Faltou exatamente 1 dia e ainda não usou o congelador essa semana: mantém a sequência.
            state.userData.sequencia = (state.userData.sequencia || 0) + 1;
            usouCongelador = true;
        } else {
            state.userData.sequencia = 1;
        }
        state.userData.ultimoAcesso = today;

        const updates = { sequencia: state.userData.sequencia, ultimoAcesso: today };
        if (usouCongelador) { state.userData.streakFreezeUsedEm = today; updates.streakFreezeUsedEm = today; }

        const newBadge = checkStreakBadges();
        if (newBadge) updates.badges = state.userData.badges;

        await setDoc(doc(db, 'users', state.currentUser.uid), updates, { merge: true });

        renderStreakDisplay();
        if (usouCongelador) showToast('🧊 Você faltou um dia, mas o congelador de sequência te salvou!', 'info');
        if (newBadge) showToast(`${newBadge.icon} Nova conquista: ${newBadge.label}!`, 'success');
    } catch (e) { console.error(e); }
}

function checkStreakBadges() {
    const earned = new Set(state.userData.badges || []);
    let newlyEarned = null;
    STREAK_BADGES.forEach(b => {
        if ((state.userData.sequencia || 0) >= b.days && !earned.has(b.key)) {
            earned.add(b.key);
            newlyEarned = b;
        }
    });
    if (newlyEarned) state.userData.badges = Array.from(earned);
    return newlyEarned;
}

function renderStreakDisplay() {
    setText('streak-count', state.userData.sequencia || 0);
}

window.showEditProfile = function () {
    document.getElementById('edit-displayname').value = state.userData.displayname || state.currentUser?.displayName || '';
    document.getElementById('edit-phrase').value = state.userData.frase || '';
    document.getElementById('modal-edit-profile').style.display = 'block';
};

window.saveProfileChanges = async function () {
    // Antes esse campo editava "username", um dado que nunca aparecia
    // em lugar nenhum do app (o login usa um valor fixo, definido so na
    // criacao da conta, e nao le esse campo de volta). Agora edita o
    // nome de exibicao de verdade: o que aparece na saudacao da tela de
    // inicio e no avatar quando nao ha foto.
    const newDisplayname = document.getElementById('edit-displayname').value.trim();
    const newPhrase = document.getElementById('edit-phrase').value.trim();
    if (!state.currentUser) return;
    try {
        const updates = {};
        if (newDisplayname) updates.displayname = newDisplayname;
        if (newPhrase) updates.frase = newPhrase;
        if (Object.keys(updates).length > 0) {
            await setDoc(doc(db, 'users', state.currentUser.uid), updates, { merge: true });
            state.userData = { ...state.userData, ...updates };
            if (newDisplayname) await updateProfile(state.currentUser, { displayName: newDisplayname });
        }
        document.getElementById('modal-edit-profile').style.display = 'none';
        renderProfileSummary();
    } catch (e) { console.error(e); showToast('Erro ao salvar alterações.', 'error'); }
};
