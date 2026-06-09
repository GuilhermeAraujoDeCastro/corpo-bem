// Lojinha de recompensas: criar, resgatar e remover recompensas pessoais.
import { db, doc, collection, addDoc, getDocs, updateDoc, deleteDoc } from './firebase-config.js';
import { state } from './state.js';
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
    if (!title || !goal) { showToast('Preencha todos os campos.', 'error'); return; }
    if (!state.currentUser) return;

    try {
        await addDoc(collection(db, 'users', state.currentUser.uid, 'rewards'), { title, goal, createdAt: Date.now(), completed: false });
        closeModal('modal-add-reward');
        document.getElementById('reward-title').value = '';
        document.getElementById('reward-goal').value = '';
        loadRewards();
    } catch (e) { console.error(e); showToast('Erro ao criar recompensa.', 'error'); }
};

export async function loadRewards() {
    if (!state.currentUser) return;
    const list = document.getElementById('rewards-list');
    list.innerHTML = '';
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
                        <p class="goal-progress-text">Se você: ${escapeHtml(r.goal)}</p>
                    </div>
                    ${r.completed
                        ? '<button type="button" class="btn-delete reward-remove-btn">✕</button>'
                        : '<button type="button" class="btn-small reward-claim-btn">🎁 Recolher</button>'}
                </div>
            `;
            if (r.completed) card.querySelector('.reward-remove-btn').addEventListener('click', () => deleteReward(id));
            else card.querySelector('.reward-claim-btn').addEventListener('click', () => markRewardCompleted(id));
            list.appendChild(card);
        });
    } catch (e) { console.error(e); }
}

async function markRewardCompleted(id) {
    if (!state.currentUser) return;
    try {
        await updateDoc(doc(db, 'users', state.currentUser.uid, 'rewards', id), { completed: true });
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
