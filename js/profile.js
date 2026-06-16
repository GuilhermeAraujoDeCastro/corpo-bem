// Perfil: peso/altura, IMC, gráfico, sequência (com congelador semanal), conquistas,
// calendário de dias ativos, hidratação, exportações e perfil público só leitura.
import { db, doc, setDoc, getDoc, collection, addDoc, getDocs, deleteDoc, updateProfile } from './firebase-config.js';
import { csvPesos, formatarNumero, gradeSequencia, saldoXp } from './calculos.js';
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
    setText('saldo-xp', `${saldoXp(xp, state.userData.xpGasto)} XP pra gastar`); // lojinha acompanha o XP ganho

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

function _comprimirFotoPerfil(file, maxDimensao = 320, qualidade = 0.75) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.onerror = reject;
        img.onload = () => {
            let { width, height } = img;
            if (width > height && width > maxDimensao) { height *= maxDimensao / width; width = maxDimensao; }
            else if (height > maxDimensao) { width *= maxDimensao / height; height = maxDimensao; }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            canvas.toBlob(blob => {
                if (!blob) { reject(new Error('Falha ao comprimir imagem')); return; }
                const outReader = new FileReader();
                outReader.onload = () => resolve(outReader.result);
                outReader.onerror = reject;
                outReader.readAsDataURL(blob);
            }, 'image/jpeg', qualidade);
        };
        img.onerror = reject;
        reader.readAsDataURL(file);
    });
}

window.salvarFoto = async function (event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { showToast('Escolha uma imagem de até 8MB.', 'error'); return; }

    try {
        const base64 = await _comprimirFotoPerfil(file);
        document.getElementById('profile-img').src = base64;
        if (state.currentUser) {
            try { localStorage.setItem(`profilePic_${state.currentUser.uid}`, base64); } catch (err) {}
            try { await setDoc(doc(db, 'users', state.currentUser.uid), { profilePic: base64 }, { merge: true }); }
            catch (err) { console.error(err); }
        }
    } catch (err) {
        console.error(err);
        showToast('Não consegui processar essa imagem. Tente outra.', 'error');
    }
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

let ultimoGrafico = null;

// Cores vêm das variáveis do tema, então o gráfico é redesenhado quando o tema muda.
function renderWeightChart(labels, weights) {
    ultimoGrafico = { labels, weights };
    const ctx = document.getElementById('weight-chart');
    if (!ctx || typeof window.Chart === 'undefined') return;
    const altura = parseFloat(state.userData.alturaAtual || state.userData.alturaInicial) || null;
    const imcData = altura ? weights.map(w => +(w / (altura * altura)).toFixed(1)) : null;
    const corPeso = getCssVar('--accent');
    const corImc = getCssVar('--fire');
    const corTexto = getCssVar('--text-muted');
    const corGrade = getCssVar('--border');

    if (window._weightChart) window._weightChart.destroy();
    const datasets = [{
        label: 'Peso (kg)', data: weights, borderColor: corPeso,
        backgroundColor: 'transparent', tension: 0.3, yAxisID: 'y'
    }];
    if (imcData) {
        datasets.push({
            label: 'IMC (com a altura atual)', data: imcData, borderColor: corImc,
            backgroundColor: 'transparent', borderDash: [5, 4], tension: 0.3, yAxisID: 'y1'
        });
    }
    const scales = {
        x: { ticks: { color: corTexto }, grid: { color: corGrade } },
        y: { beginAtZero: false, position: 'left', ticks: { color: corPeso }, grid: { color: corGrade } },
    };
    if (imcData) scales.y1 = { beginAtZero: false, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: corImc } };

    window._weightChart = new window.Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: { responsive: true, plugins: { legend: { labels: { color: getCssVar('--text-color') } } }, scales }
    });
}

document.addEventListener('temamudou', () => { if (ultimoGrafico) renderWeightChart(ultimoGrafico.labels, ultimoGrafico.weights); });

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
    const dias = state.userData.sequencia || 0;
    setText('streak-count', dias);
    setText('streak-unidade', dias === 1 ? 'dia' : 'dias');
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
        // A saudacao do dashboard (#greeting) e preenchida uma unica vez no
        // carregamento inicial (loadAllData, em main.js) usando o nome de
        // exibicao de entao. Sem isto, editar o nome aqui so refletia na
        // saudacao depois de recarregar a pagina inteira.
        const greetingEl = document.getElementById('greeting');
        if (greetingEl) {
            const hour = new Date().getHours();
            const greetWord = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
            greetingEl.innerText = `${greetWord}, ${state.currentUser.displayName || 'Atleta'}!`;
        }
    } catch (e) { console.error(e); showToast('Erro ao salvar alterações.', 'error'); }
};

// ===== CALENDÁRIO DE SEQUÊNCIA (estilo contribuições do GitHub) =====
export async function carregarDiasAtivos() {
    if (!state.currentUser) return;
    try {
        const snap = await getDocs(collection(db, 'users', state.currentUser.uid, 'progressLogs'));
        const dias = new Set();
        snap.forEach(s => { if (s.data().date) dias.add(s.data().date); });
        state.diasAtivos = [...dias];
    } catch (e) { console.error(e); state.diasAtivos = []; }
    renderSequenciaCalendario();
}

export function renderSequenciaCalendario(alvoId = 'sequencia-calendario', dias = state.diasAtivos) {
    const caixa = document.getElementById(alvoId);
    if (!caixa) return;
    const grade = gradeSequencia(dias || []);
    const total = grade.flat().filter(d => d.ativo).length;
    caixa.innerHTML = `
        <div class="calendario-grade" role="img" aria-label="${total} dias com registro nas últimas 12 semanas">
            ${grade.map(semana => `<div class="calendario-semana">${semana.map(d =>
                `<span class="calendario-dia ${d.ativo ? 'ativo' : ''} ${d.futuro ? 'futuro' : ''}" title="${d.data}"></span>`).join('')}</div>`).join('')}
        </div>
        <p class="calendario-legenda">${total} dia${total === 1 ? '' : 's'} com registro nas últimas 12 semanas</p>`;
}

// ===== HIDRATAÇÃO (atalho na tela inicial pra meta diária de água) =====
export function renderHidratacao() {
    const caixa = document.getElementById('hidratacao-card');
    if (!caixa) return;
    const agua = (state.goals || []).find(g => g.unit === 'ml' && g.isDaily);
    if (!agua) {
        caixa.innerHTML = `<p class="card-title">💧 Água</p><p class="empty-state-hint">Crie uma meta diária em ml pra acompanhar a hidratação aqui.</p>`;
        return;
    }
    const pct = Math.min(100, Math.round((agua.current / agua.target) * 100));
    caixa.innerHTML = `
        <div class="hidratacao-topo"><p class="card-title">💧 Água hoje</p><span>${formatarNumero(agua.current)} / ${formatarNumero(agua.target)} ml</span></div>
        <div class="progress-bar"><div class="fill fill-agua" style="width:${pct}%"></div></div>
        <div class="hidratacao-botoes">
            ${[250, 500].map(ml => `<button type="button" class="btn-small" onclick="adicionarAguaRapido(${ml})" ${pct >= 100 ? 'disabled' : ''}>+${ml} ml</button>`).join('')}
        </div>`;
}

window.adicionarAguaRapido = async function (ml) {
    const agua = (state.goals || []).find(g => g.unit === 'ml' && g.isDaily);
    if (!agua) return;
    const { registrarProgresso } = await import('./goals.js');
    await registrarProgresso(agua, ml);
};

// ===== EXPORTAÇÕES =====
function baixarArquivo(conteudo, nome, tipo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function lerColecao(nome) {
    const snap = await getDocs(collection(db, 'users', state.currentUser.uid, nome));
    const itens = [];
    snap.forEach(s => itens.push({ id: s.id, ...s.data() }));
    return itens;
}

window.exportarPesosCsv = async function () {
    if (!state.currentUser) return;
    try {
        const pesos = await lerColecao('weights');
        if (!pesos.length) { showToast('Ainda não tem peso registrado.', 'info'); return; }
        const altura = state.userData.alturaAtual || state.userData.alturaInicial;
        // BOM no começo faz o Excel reconhecer os acentos.
        baixarArquivo(String.fromCharCode(0xFEFF) + csvPesos(pesos, altura), 'corpo-bem-peso-imc.csv', 'text/csv;charset=utf-8');
    } catch (e) { console.error(e); showToast('Não consegui exportar agora.', 'error'); }
};

// Tudo da conta num JSON, pra levar o histórico pra outro app se quiser.
window.exportarDadosJson = async function () {
    if (!state.currentUser) return;
    try {
        const [goals, completedGoals, progressLogs, rewards, weights] = await Promise.all(
            ['goals', 'completedGoals', 'progressLogs', 'rewards', 'weights'].map(lerColecao));
        const { pushSubscription, ...perfil } = state.userData;
        const dados = { exportadoEm: new Date().toISOString(), perfil, goals, completedGoals, progressLogs, rewards, weights };
        baixarArquivo(JSON.stringify(dados, null, 2), 'corpo-bem-meus-dados.json', 'application/json');
    } catch (e) { console.error(e); showToast('Não consegui exportar agora.', 'error'); }
};

// ===== PERFIL PÚBLICO (só leitura, pra personal ou amigo acompanhar) =====
// Grava um resumo em publico/{uid}; peso e foto nunca vão pra lá.
export async function atualizarPerfilPublico() {
    if (!state.currentUser || !state.userData.perfilPublico) return;
    const metas = (state.goals || []).map(g => ({ text: g.text, current: g.current, target: g.target, unit: g.unit, isDaily: !!g.isDaily }));
    try {
        await setDoc(doc(db, 'publico', state.currentUser.uid), {
            nome: String(state.userData.displayname || state.currentUser.displayName || 'Atleta').slice(0, 60), // limite das regras
            sequencia: state.userData.sequencia || 0,
            nivel: state.userData.level || 1,
            xp: state.userData.xp || 0,
            diasAtivos: (state.diasAtivos || []).slice(-120),
            metas,
            atualizadoEm: getLocalDateStr(),
        });
    } catch (e) { console.error('Erro ao atualizar perfil público:', e); }
}

window.alternarPerfilPublico = async function (ligado) {
    if (!state.currentUser) return;
    try {
        await setDoc(doc(db, 'users', state.currentUser.uid), { perfilPublico: ligado }, { merge: true });
        state.userData.perfilPublico = ligado;
        if (ligado) await atualizarPerfilPublico();
        else await deleteDoc(doc(db, 'publico', state.currentUser.uid));
        renderLinkPublico();
    } catch (e) { console.error(e); showToast('Não consegui mudar o compartilhamento.', 'error'); }
};

export function renderLinkPublico() {
    const caixa = document.getElementById('link-publico');
    const chave = document.getElementById('toggle-perfil-publico');
    if (chave) chave.checked = !!state.userData.perfilPublico;
    if (!caixa) return;
    if (!state.userData.perfilPublico || !state.currentUser) { caixa.hidden = true; return; }
    const link = `${location.origin}${location.pathname}?perfil=${encodeURIComponent(state.currentUser.uid)}`;
    caixa.hidden = false;
    caixa.innerHTML = `<input type="text" readonly value="${link}" onclick="this.select()"><button type="button" class="btn-small" onclick="compartilharLink('${link}')">Compartilhar</button>`;
}

window.compartilharLink = async function (link) {
    if (navigator.share) {
        try { await navigator.share({ title: 'Meu progresso no Corpo Bem', url: link }); return; } catch (e) { /* cancelado */ }
    }
    try { await navigator.clipboard.writeText(link); showToast('Link copiado!', 'success'); } catch (e) { showToast('Copie o link na caixinha.', 'info'); }
};

function esc(texto) {
    const div = document.createElement('div');
    div.textContent = texto == null ? '' : String(texto);
    return div.innerHTML;
}

// Tela pública (?perfil=uid): mostra o resumo sem precisar de login.
export async function mostrarPerfilPublico(uid) {
    document.querySelectorAll('.screen').forEach(t => t.classList.remove('active'));
    document.getElementById('public-screen').classList.add('active');
    const caixa = document.getElementById('public-content');
    try {
        const snap = await getDoc(doc(db, 'publico', uid));
        if (!snap.exists()) throw new Error('não compartilhado');
        const p = snap.data();
        const unidade = (u) => (u === 'sono' ? 'h' : u === 'qty' ? '' : u);
        caixa.innerHTML = `
            <p class="public-badge">Progresso compartilhado</p>
            <h2 class="greeting-large">${esc(p.nome)}</h2>
            <div class="stats-row">
                <div class="stat-card"><span class="stat-label">Sequência</span><strong>🔥 ${esc(p.sequencia)} ${p.sequencia === 1 ? 'dia' : 'dias'}</strong></div>
                <div class="stat-card"><span class="stat-label">Nível</span><strong>⚡ ${esc(p.nivel)}</strong></div>
            </div>
            <div class="card"><p class="card-title">Dias ativos</p><div id="public-calendario"></div></div>
            <div class="card"><p class="card-title">Metas</p>${(p.metas || []).map(m => {
                const pct = Math.min(100, Math.round((m.current / m.target) * 100));
                return `<div class="public-meta"><span>${esc(m.text)}</span><span>${formatarNumero(m.current)} / ${formatarNumero(m.target)} ${esc(unidade(m.unit))}</span></div><div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>`;
            }).join('') || '<p class="empty-state-hint">Nenhuma meta ativa.</p>'}</div>
            <p class="empty-state-hint">Atualizado em ${esc(p.atualizadoEm)}.</p>`;
        renderSequenciaCalendario('public-calendario', p.diasAtivos || []);
    } catch (e) {
        caixa.innerHTML = '<h2>Perfil não encontrado</h2><p class="empty-state-hint">Esse link não está mais compartilhado.</p>';
    }
}
