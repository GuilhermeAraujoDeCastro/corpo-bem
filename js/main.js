// Ponto de entrada do app: importa os módulos, define o carregamento
// agregado de dados (loadAllData) e conecta ao window as funções que o
// HTML ainda usa via onclick (switchTab, toggleDarkMode, etc).
import { state } from './state.js';
import { switchTab, switchMetasSubtab, toggleDarkMode, openModal, closeModal } from './ui.js';
import { initAuth } from './auth.js';
import { loadGoals, loadCompletedGoals, resetDailyGoals } from './goals.js';
import { loadRewards } from './rewards.js';
import { renderProfileSummary, loadWeightHistory, updateStreak } from './profile.js';
import { restoreReminders, handleQuickActionFromUrl } from './notifications.js';
import { tryShowWeeklyRecapAuto } from './recap.js';

window.switchTab = switchTab;
window.switchMetasSubtab = switchMetasSubtab;
window.toggleDarkMode = toggleDarkMode;
window.openModal = openModal;
window.closeModal = closeModal;

async function loadAllData() {
    if (!state.currentUser) return;
    const hour = new Date().getHours();
    const greetWord = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const greetingEl = document.getElementById('greeting');
    if (greetingEl) greetingEl.innerText = `${greetWord}, ${state.currentUser.displayName || 'Atleta'}!`;

    await updateStreak();
    await resetDailyGoals();
    await Promise.all([
        loadGoals(),
        loadRewards(),
        loadWeightHistory(),
        loadCompletedGoals()
    ]);
    renderProfileSummary();
    restoreReminders();
    setTimeout(() => tryShowWeeklyRecapAuto(), 1200);
    handleQuickActionFromUrl();
}

initAuth(loadAllData);

// Registra o Service Worker (cache offline + notificações push).
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registrado:', reg.scope))
            .catch(err => console.warn('SW não registrado:', err));
    });
}
