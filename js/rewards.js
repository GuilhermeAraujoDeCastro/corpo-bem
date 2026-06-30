// Lojinha: recompensas criadas pela própria pessoa, resgatadas com o XP das metas.
import { db, doc, setDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, writeBatch, increment } from './firebase-config.js';
import { state } from './state.js';
import { saldoXp } from './calculos.js';
import { showToast, showConfirm, closeModal, celebrate, showCelebrationBanner } from './ui.js';

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

window.showAddReward = function () {
    document.getElementById('modal-add-reward').style.display = 'block';
};

window.createReward = async function () {
    const title = document.getElementById('reward-title').value.trim();
    const goal = document.getElementById('reward-goal').value.trim();
    const custo = Math.max(0, parseInt(document.getElementById('reward-cost').value, 10) || 0);
    if (!title || !goal) { showToast('Preencha o que você ganha e o que precisa fazer.', 'error'); return; }
    if (!state.currentUser) return;

    try {
        await addDoc(collection(db, 'users', state.currentUser.uid, 'rewards'), { title, goal, custoXp: custo, createdAt: Date.now(), completed: false });
        closeModal('modal-add-reward');
        document.getElementById('reward-title').value = '';
        document.getElementById('reward-goal').value = '';
        document.getElementById('reward-cost').value = '';
        loadRewards();
    } catch (e) { console.error(e); showToast('Erro ao criar recompensa.', 'error'); }
};

function renderSaldoXp() {
    const el = document.getElementById('saldo-xp');
    if (el) el.textContent = `${saldoXp(state.userData.xp, state.userData.xpGasto)} XP pra gastar`;
}

export async function loadRewards() {
    if (!state.currentUser) return;
    const list = document.getElementById('rewards-list');
    list.innerHTML = '';
    renderSaldoXp();
    try {
        const snap = await getDocs(collection(db, 'users', state.currentUser.uid, 'rewards'));
        if (snap.empty) {
            list.innerHTML = '<p class="empty-state-hint text-center">Nenhuma recompensa criada ainda.</p>';
            return;
        }
        snap.forEach(rewardDoc => {
            const r = rewardDoc.data();
            const id = rewardDoc.id;
            const card = document.createElement('div');
            card.className = 'card neon-border';
            card.innerHTML = `
                <div class="goal-card-top">
                    <div>
                        <h4 class="${r.completed ? 'reward-done' : ''}">${escapeHtml(r.title)} ${r.completed ? '✅' : ''}</h4>
                        <p class="goal-progress-text">Se você: ${escapeHtml(r.goal)}${r.custoXp ? ` · custa ${r.custoXp} XP` : ''}</p>
                    </div>
                    ${r.completed
                        ? '<button type="button" class="btn-delete reward-remove-btn">✕</button>'
                        : '<button type="button" class="btn-small reward-claim-btn">🎁 Recolher</button>'}
                </div>
            `;
            if (r.completed) card.querySelector('.reward-remove-btn').addEventListener('click', () => deleteReward(id));
            else card.querySelector('.reward-claim-btn').addEventListener('click', () => markRewardCompleted(id, r.custoXp || 0));
            list.appendChild(card);
        });
    } catch (e) { console.error(e); }
}

async function markRewardCompleted(id, custo) {
    if (!state.currentUser) return;
    const saldo = saldoXp(state.userData.xp, state.userData.xpGasto);
    if (custo > saldo) { showToast(`Faltam ${custo - saldo} XP. Cumpra mais metas pra liberar!`, 'info'); return; }
    try {
        // Recompensa e XP gasto no mesmo lote: antes, se a segunda gravação falhasse, a recompensa saía de graça.
        // increment soma o gasto mesmo com outra aba resgatando ao mesmo tempo.
        const lote = writeBatch(db);
        lote.update(doc(db, 'users', state.currentUser.uid, 'rewards', id), { completed: true });
        if (custo) lote.set(doc(db, 'users', state.currentUser.uid), { xpGasto: increment(custo) }, { merge: true });
        await lote.commit();
        if (custo) state.userData.xpGasto = (state.userData.xpGasto || 0) + custo;
        celebrate();
        showCelebrationBanner('🎁 Recompensa recolhida! Você merece!');
        loadRewards();
    } catch (e) { console.error(e); }
}

async function deleteReward(id) {
    if (!state.currentUser) return;
    const ok = await showConfirm('Remover esta recompensa?', 'Remover');
    if (!ok) return;
    try {
        await deleteDoc(doc(db, 'users', state.currentUser.uid, 'rewards', id));
        loadRewards();
    } catch (e) { console.error(e); }
}
