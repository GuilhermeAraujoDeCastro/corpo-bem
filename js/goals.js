// Metas: CRUD, progresso, reset diário das metas "diárias" e concessão de XP.
import { db, doc, setDoc, getDoc, collection, addDoc, getDocs, updateDoc, deleteDoc } from './firebase-config.js';
import { state, getLocalDateStr } from './state.js';
import { showToast, showConfirm, showPrompt, closeModal, showCelebrationBanner, celebrate } from './ui.js';
import { renderProfileSummary } from './profile.js';

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

window.addGoal = async function () {
    const text = document.getElementById('new-goal-input').value.trim();
    const target = parseFloat(document.getElementById('new-goal-target').value);
    const unit = document.getElementById('new-goal-unit').value;
    if (!text || !target || isNaN(target)) { showToast('Preencha a descrição e a quantidade alvo.', 'error'); return; }
    if (!state.currentUser) { showToast('Faça login para salvar metas.', 'error'); return; }

    const isDaily = document.getElementById('new-goal-daily').checked;
    const deadlineVal = document.getElementById('new-goal-deadline').value;
    const goal = { text, createdAt: Date.now(), target, current: 0, unit, isDaily };
    if (deadlineVal) goal.deadline = deadlineVal;

    try {
        await addDoc(collection(db, 'users', state.currentUser.uid, 'goals'), goal);
        document.getElementById('new-goal-input').value = '';
        document.getElementById('new-goal-target').value = '';
        document.getElementById('new-goal-daily').checked = false;
        const dlField = document.getElementById('new-goal-deadline');
        if (dlField) dlField.value = '';
        loadGoals();
    } catch (e) {
        console.error(e);
        showToast('Erro ao adicionar meta.', 'error');
    }
};

export async function loadGoals() {
    if (!state.currentUser) return;
    const container = document.getElementById('goals-container');
    const list = document.getElementById('goals-list');

    try {
        const snap = await getDocs(collection(db, 'users', state.currentUser.uid, 'goals'));
        if (snap.empty) {
            container.innerHTML = '<div class="empty-state"><p>Nenhuma meta adicionada ainda.</p><p class="empty-state-hint">Vá para <strong>Metas</strong> para adicionar!</p></div>';
            list.innerHTML = '';
            return;
        }

        container.innerHTML = '';
        list.innerHTML = '';
        const goals = [];
        snap.forEach(s => goals.push({ id: s.id, ...s.data() }));
        goals.sort((a, b) => {
            const pa = (a.current / a.target) || 0;
            const pb = (b.current / b.target) || 0;
            if (pa >= 1 && pb < 1) return 1;
            if (pb >= 1 && pa < 1) return -1;
            return pb - pa;
        });
        goals.forEach(g => {
            container.appendChild(createGoalCard(g));
            list.appendChild(createGoalCard(g));
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="empty-state"><p>Não consegui carregar suas metas agora.</p></div>';
    }
}

function createGoalCard(g) {
    const card = document.createElement('div');
    card.className = 'card neon-border goal-card';
    const percent = Math.min(100, (g.current / g.target) * 100);
    const unit = g.unit === 'ml' ? 'ml' : g.unit === 'reps' ? 'reps' : g.unit === 'km' ? 'km' : g.unit === 'sono' ? 'h' : '';
    let fillColor = 'var(--accent)';
    if (percent >= 100) fillColor = 'var(--success)';
    else if (percent >= 50) fillColor = 'var(--warning)';

    let deadlineHtml = '';
    if (g.deadline) {
        // Comparacao por data de calendario local, nao por instante UTC:
        // "new Date(g.deadline)" sozinho e interpretado como meia-noite
        // UTC, enquanto "new Date()" e o instante local agora. No fuso
        // de Brasilia isso fazia o prazo parecer vencer ate 3h mais cedo
        // do que deveria, perto da virada do dia.
        const todayLocal = new Date(getLocalDateStr() + 'T00:00:00');
        const deadlineLocal = new Date(g.deadline + 'T00:00:00');
        const daysLeft = Math.round((deadlineLocal - todayLocal) / (1000 * 60 * 60 * 24));
        const dColor = daysLeft < 3 ? 'var(--danger)' : daysLeft < 7 ? 'var(--warning)' : 'var(--text-muted)';
        const dText = daysLeft < 0 ? '⚠️ Prazo expirado' : daysLeft === 0 ? '⚠️ Hoje é o prazo!' : `⏳ ${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`;
        deadlineHtml = `<span class="goal-deadline" style="color:${dColor};">${dText}</span>`;
    }

    card.innerHTML = `
        <div class="goal-card-top">
            <div>
                <h4>${escapeHtml(g.text)} ${g.isDaily ? '<span class="badge-pill">Diária</span>' : ''}${deadlineHtml}</h4>
                <p class="goal-progress-text">${g.current} ${unit} / ${g.target} ${unit}</p>
            </div>
            <div class="goal-card-actions">
                <button type="button" class="btn-small goal-edit-btn">Editar</button>
                <button type="button" class="btn-delete goal-delete-btn">✕</button>
            </div>
        </div>
        <div class="progress-container">
            <div class="progress-bar"><div class="fill" style="width: ${percent}%; background: ${fillColor}; box-shadow: 0 0 10px ${fillColor};"></div></div>
        </div>
        <button type="button" class="btn-small goal-add-progress-btn">+</button>
    `;
    card.querySelector('.goal-edit-btn').addEventListener('click', () => editGoal(g.id));
    card.querySelector('.goal-delete-btn').addEventListener('click', () => deleteGoalConfirm(g.id));
    card.querySelector('.goal-add-progress-btn').addEventListener('click', () => openProgressModal(g.id, g.text, g.target, g.current, g.unit, !!g.isDaily));
    return card;
}

async function deleteGoalConfirm(id) {
    const ok = await showConfirm('Deletar essa meta?', 'Deletar');
    if (!ok || !state.currentUser) return;
    try {
        await deleteDoc(doc(db, 'users', state.currentUser.uid, 'goals', id));
        loadGoals();
    } catch (e) { console.error(e); showToast('Erro ao deletar meta.', 'error'); }
}

export async function loadCompletedGoals() {
    if (!state.currentUser) return;
    const list = document.getElementById('completed-goals-list');
    if (!list) return;
    list.innerHTML = '';
    try {
        const snap = await getDocs(collection(db, 'users', state.currentUser.uid, 'completedGoals'));
        if (snap.empty) {
            list.innerHTML = '<p class="empty-state-hint text-center">Nenhuma meta concluída ainda. Continue assim! 💪</p>';
            return;
        }
        const arr = [];
        snap.forEach(s => arr.push({ id: s.id, ...s.data() }));
        arr.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
        arr.forEach(g => {
            const card = document.createElement('div');
            card.className = 'card neon-border goal-card-completed';
            card.innerHTML = `
                <div class="goal-card-top">
                    <div>
                        <h4 class="completed-title">✅ ${escapeHtml(g.text)}</h4>
                        <p class="goal-progress-text">${g.target} ${g.unit} · Concluída em ${g.completedAt || '?'}</p>
                    </div>
                    <button type="button" class="btn-delete completed-delete-btn">✕</button>
                </div>
            `;
            card.querySelector('.completed-delete-btn').addEventListener('click', () => deleteCompletedGoal(g.id));
            list.appendChild(card);
        });
    } catch (e) { console.error(e); }
}

async function deleteCompletedGoal(id) {
    if (!state.currentUser) return;
    try {
        await deleteDoc(doc(db, 'users', state.currentUser.uid, 'completedGoals', id));
        loadCompletedGoals();
    } catch (e) { console.error(e); }
}

async function editGoal(id) {
    if (!state.currentUser) return;
    const docRef = doc(db, 'users', state.currentUser.uid, 'goals', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) { showToast('Meta não encontrada.', 'error'); return; }
    const g = snap.data();
    const result = await showPrompt({
        title: 'Editar meta',
        fields: [
            { id: 'text', label: 'Descrição', value: g.text },
            { id: 'target', label: 'Alvo', value: g.target, type: 'number' },
            { id: 'unit', label: 'Unidade (ml, reps, km, qty, sono)', value: g.unit }
        ]
    });
    if (!result) return;
    try {
        await updateDoc(docRef, {
            text: result.text || g.text,
            target: parseFloat(result.target) || g.target,
            unit: result.unit || g.unit
        });
        loadGoals();
    } catch (e) { console.error(e); showToast('Erro ao editar meta.', 'error'); }
}

let currentGoalData = {};
function openProgressModal(id, text, target, current, unit, isDaily) {
    currentGoalData = { id, text, target, current, unit, isDaily };
    document.getElementById('modal-goal-title').innerText = `Adicionar a "${text}"`;
    document.getElementById('modal-progress-input').value = '';
    document.getElementById('modal-progress-input').placeholder = `Digite a quantidade em ${unit}`;
    const quick = document.getElementById('modal-quick-buttons');
    quick.innerHTML = '';
    const addQuick = (label, amount) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn-small'; b.innerText = label;
        b.addEventListener('click', () => {
            const input = document.getElementById('modal-progress-input');
            input.value = (parseFloat(input.value) || 0) + amount;
        });
        quick.appendChild(b);
    };
    if (unit === 'ml') { [250, 500, 1000].forEach(v => addQuick('+' + v + 'ml', v)); }
    else if (unit === 'reps') { [1, 5, 10].forEach(v => addQuick('+' + v, v)); }
    else if (unit === 'km') { addQuick('+1km', 1); }
    else if (unit === 'sono') {
        [6, 7, 8, 9].forEach(v => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'btn-small'; b.innerText = v + 'h';
            b.addEventListener('click', () => { document.getElementById('modal-progress-input').value = v; });
            quick.appendChild(b);
        });
    }
    document.getElementById('modal-add-progress').style.display = 'block';
}
window.openProgressModal = openProgressModal;

window.saveProgress = async function () {
    const amount = parseFloat(document.getElementById('modal-progress-input').value);
    if (isNaN(amount) || amount <= 0) { showToast('Digite uma quantidade válida.', 'error'); return; }
    if (!state.currentUser) return;

    const newCurrent = Math.min(currentGoalData.current + amount, currentGoalData.target);
    try {
        await updateDoc(doc(db, 'users', state.currentUser.uid, 'goals', currentGoalData.id), { current: newCurrent });
        await addDoc(collection(db, 'users', state.currentUser.uid, 'progressLogs'), {
            goalId: currentGoalData.id, text: currentGoalData.text, amount,
            unit: currentGoalData.unit, date: getLocalDateStr(), completed: newCurrent >= currentGoalData.target
        });

        if (newCurrent >= currentGoalData.target) {
            celebrate();
            await grantXPForGoal(currentGoalData);
            closeModal('modal-add-progress');

            if (currentGoalData.isDaily) {
                await updateDoc(doc(db, 'users', state.currentUser.uid, 'goals', currentGoalData.id), { current: currentGoalData.target });
                loadGoals();
                showCelebrationBanner('🎉 Meta diária cumprida! Parabéns!');
            } else {
                showCelebrationBanner('🏆 Meta concluída! Incrível!');
                try {
                    await addDoc(collection(db, 'users', state.currentUser.uid, 'completedGoals'), { ...currentGoalData, completedAt: getLocalDateStr() });
                    await deleteDoc(doc(db, 'users', state.currentUser.uid, 'goals', currentGoalData.id));
                } catch (e) { console.error(e); }
                loadGoals();
                loadCompletedGoals();
            }
            return;
        }

        closeModal('modal-add-progress');
        loadGoals();
    } catch (e) { console.error(e); showToast('Erro ao salvar progresso.', 'error'); }
};

async function grantXPForGoal(goal) {
    try {
        let xpGain;
        if (goal.isDaily) xpGain = Math.min(50, Math.max(5, Math.round(goal.target / 100) + 10));
        else xpGain = Math.min(200, Math.max(10, Math.round(goal.target * 2)));

        const userRef = doc(db, 'users', state.currentUser.uid);
        const snap = await getDoc(userRef);
        let xp = snap.exists() ? (snap.data().xp || 0) : 0;
        xp += xpGain;
        const level = Math.floor(xp / 100) + 1;
        await setDoc(userRef, { xp, level }, { merge: true });
        state.userData.xp = xp;
        state.userData.level = level;
        renderProfileSummary();
    } catch (e) { console.error(e); }
}

export async function resetDailyGoals() {
    if (!state.currentUser) return;
    const today = getLocalDateStr();
    const storageKey = 'lastDailyReset_' + state.currentUser.uid;
    let lastReset = null;
    try { lastReset = localStorage.getItem(storageKey); } catch (e) {}
    if (lastReset === today) return;

    try {
        const snap = await getDocs(collection(db, 'users', state.currentUser.uid, 'goals'));
        const batch = [];
        snap.forEach(s => {
            const g = s.data();
            if (g.isDaily && g.current > 0) {
                batch.push(updateDoc(doc(db, 'users', state.currentUser.uid, 'goals', s.id), { current: 0 }));
            }
        });
        await Promise.all(batch);
        try { localStorage.setItem(storageKey, today); } catch (e) {}
        if (batch.length > 0) loadGoals();
    } catch (e) { console.error('Erro no reset diário:', e); }
}
