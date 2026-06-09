// Resumo semanal: estatísticas dos últimos 7 dias, com um card exportável
// como imagem, pra aproveitar o momento de conquista e divulgar o app.
import { db, collection, getDocs } from './firebase-config.js';
import { state, getLocalDateStr } from './state.js';
import { showToast } from './ui.js';

export async function generateWeeklyRecap() {
    if (!state.currentUser) return;
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const since = getLocalDateStr(sevenDaysAgo);

        const snap = await getDocs(collection(db, 'users', state.currentUser.uid, 'progressLogs'));
        const logs = [];
        snap.forEach(s => logs.push(s.data()));
        const recent = logs.filter(l => l.date >= since);

        let waterTotal = 0, kmTotal = 0, repsTotal = 0, completedCount = 0;
        recent.forEach(r => {
            if (r.unit === 'ml') waterTotal += (r.amount || 0);
            else if (r.unit === 'km') kmTotal += (r.amount || 0);
            else if (r.unit === 'reps') repsTotal += (r.amount || 0);
            if (r.completed) completedCount += 1;
        });
        const totalLogs = recent.length || 1;
        const percentCompleted = Math.round((completedCount / totalLogs) * 100);

        setText('recap-water', `${(waterTotal / 1000).toFixed(2)} L`);
        setText('recap-km', `${kmTotal.toFixed(2)} km`);
        setText('recap-reps', `${repsTotal}`);
        setText('recap-percent', `${percentCompleted}%`);
        setText('recap-streak', `${state.userData.sequencia || 0} dias`);

        document.getElementById('modal-weekly-recap').style.display = 'block';
    } catch (e) { console.error(e); showToast('Não consegui montar seu resumo agora.', 'error'); }
}
window.generateWeeklyRecap = generateWeeklyRecap;

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

export function tryShowWeeklyRecapAuto() {
    if (new Date().getDay() === 0) generateWeeklyRecap();
}

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
