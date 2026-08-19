// Lojinha: recompensas criadas pela própria pessoa, resgatadas com o XP das metas.
import { db, doc, setDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, writeBatch, increment, runTransaction } from './firebase-config.js';
import { state, captureSession, isCurrentSession } from './state.js';
import { saldoXp } from './calculos.js';
import { claimReward } from './transactions.js';
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
    const session = captureSession();
    const title = document.getElementById('reward-title').value.trim();
    const goal = document.getElementById('reward-goal').value.trim();
    const custo = Math.max(0, parseInt(document.getElementById('reward-cost').value, 10) || 0);
    if (!title || !goal) { showToast('Preencha o que você ganha e o que precisa fazer.', 'error'); return; }
    if (!state.currentUser) return;

    try {
        await addDoc(collection(db, 'users', state.currentUser.uid, 'rewards'), { title, goal, custoXp: custo, createdAt: Date.now(), completed: false });
        if (!isCurrentSession(session)) return;
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
    const session = captureSession();
    if (!session.uid) return;
    const list = document.getElementById('rewards-list');
    list.innerHTML = '';
    renderSaldoXp();
    try {
        const snap = await getDocs(collection(db, 'users', session.uid, 'rewards'));
        if (!isCurrentSession(session)) return;
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
            if (r.completed) card.querySelector('.reward-remove-btn').addEventListener('click', () => { if (isCurrentSession(session)) deleteReward(id); });
            else card.querySelector('.reward-claim-btn').addEventListener('click', event => { if (isCurrentSession(session)) markRewardCompleted(id, event.currentTarget); });
            list.appendChild(card);
        });
    } catch (e) { if (!isCurrentSession(session)) return; console.error(e); }
}

const claiming = new Set();
async function markRewardCompleted(id, button) {
    if (!state.currentUser || claiming.has(id)) return;
    if (navigator.onLine === false) { showToast('Conecte-se para resgatar. Nenhum XP foi descontado.', 'error'); return; }
    const session = captureSession(), uid = session.uid;
    claiming.add(id); button.disabled = true; button.textContent = 'Resgatando…';
    try {
        const result = await claimReward(fn => runTransaction(db, fn), doc(db, 'users', uid), doc(db, 'users', uid, 'rewards', id), doc(db, 'users', uid, 'redemptions', id));
        if (!isCurrentSession(session)) return;
        state.userData.xpGasto = result.spent;
        if (!result.repeated) { celebrate(); showCelebrationBanner('Recompensa resgatada.'); }
        else showToast('Essa recompensa já havia sido resgatada. Nenhum desconto adicional.', 'info');
        await loadRewards();
    } catch (err) { if (isCurrentSession(session)) { showToast('Resgate não confirmado: ' + err.message, 'error'); button.disabled = false; button.textContent = 'Recolher'; } }
    finally { claiming.delete(id); }
}

async function deleteReward(id) {
    const session = captureSession();
    if (!session.uid) return;
    const ok = await showConfirm('Remover esta recompensa?', 'Remover');
    if (!ok || !isCurrentSession(session)) return;
    try {
        await deleteDoc(doc(db, 'users', state.currentUser.uid, 'rewards', id));
        loadRewards();
    } catch (e) { console.error(e); }
}
