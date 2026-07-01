// Resumo dos últimos 7 dias: card que vira imagem pra baixar ou compartilhar.
import { db, collection, getDocs, query, where } from './firebase-config.js';
import { state, getLocalDateStr } from './state.js';
import { showToast } from './ui.js';

export async function generateWeeklyRecap() {
    if (!state.currentUser) return;
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // hoje e os 6 dias antes: 7 datas, não 8
        const since = getLocalDateStr(sevenDaysAgo);

        // Só os registros da semana, em vez de baixar o histórico inteiro a cada resumo.
        const snap = await getDocs(query(collection(db, 'users', state.currentUser.uid, 'progressLogs'), where('date', '>=', since)));
        const logs = [];
        snap.forEach(s => logs.push(s.data()));
        const recent = logs.filter(l => l.date >= since);

        let waterTotal = 0, kmTotal = 0, repsTotal = 0;
        const cumpridas = new Set(); // meta + dia (bater a mesma meta diária 7 vezes conta 7)
        recent.forEach(r => {
            if (r.unit === 'ml') waterTotal += (r.amount || 0);
            else if (r.unit === 'km') kmTotal += (r.amount || 0);
            else if (r.unit === 'reps') repsTotal += (r.amount || 0);
            if (r.completed) cumpridas.add(`${r.goalId}|${r.date}`);
        });

        setText('recap-water', `${(waterTotal / 1000).toFixed(2)} L`);
        setText('recap-km', `${kmTotal.toFixed(2)} km`);
        setText('recap-reps', `${repsTotal}`);
        setText('recap-percent', `${cumpridas.size}`);
        const seq = state.userData.sequencia || 0;
        setText('recap-streak', `${seq} ${seq === 1 ? 'dia' : 'dias'}`);

        document.getElementById('modal-weekly-recap').style.display = 'block';
    } catch (e) { console.error(e); showToast('Não consegui montar seu resumo agora.', 'error'); }
}
window.generateWeeklyRecap = generateWeeklyRecap;

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

// Abre sozinho só uma vez no domingo (antes abria a cada vez que o app carregava).
export function tryShowWeeklyRecapAuto() {
    if (new Date().getDay() !== 0) return;
    const hoje = getLocalDateStr();
    // Com o uid na chave, duas contas no mesmo navegador não dividem a marca de "já vi".
    const chave = `corpo-resumo-visto:${state.currentUser ? state.currentUser.uid : ''}`;
    try {
        if (localStorage.getItem(chave) === hoje) return;
        localStorage.setItem(chave, hoje);
    } catch (e) { /* sem localStorage: abre mesmo assim */ }
    generateWeeklyRecap();
}

async function gerarImagemResumo() {
    const cardEl = document.getElementById('weekly-recap-card');
    if (!cardEl || typeof window.html2canvas !== 'function') throw new Error('html2canvas indisponível');
    return window.html2canvas(cardEl, { backgroundColor: null, scale: 2 });
}

// Compartilha a imagem direto (WhatsApp, Instagram...) quando o aparelho deixa; senão baixa.
window.compartilharResumo = async function () {
    try {
        const canvas = await gerarImagemResumo();
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const arquivo = new File([blob], 'corpo-bem-resumo-semanal.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
            await navigator.share({ files: [arquivo], title: 'Minha semana no Corpo Bem', text: 'Olha minha semana de treino 💪' });
            return;
        }
        await exportRecapCard();
    } catch (e) {
        if (e && e.name === 'AbortError') return; // pessoa fechou a janela de compartilhar
        console.error(e);
        showToast('Não consegui compartilhar agora.', 'error');
    }
};

export async function exportRecapCard() {
    const cardEl = document.getElementById('weekly-recap-card');
    if (!cardEl || typeof window.html2canvas !== 'function') {
        showToast('Não consegui gerar a imagem agora.', 'error');
        return;
    }
    try {
        const canvas = await window.html2canvas(cardEl, { backgroundColor: null, scale: 2 });
        const link = document.createElement('a');
        link.download = 'corpo-bem-resumo-semanal.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (e) {
        console.error(e);
        showToast('Não consegui gerar a imagem agora.', 'error');
    }
}
window.exportRecapCard = exportRecapCard;
