// Ponto de entrada: tema, login, carregamento dos dados, perfil público (?perfil=uid) e PWA.
import { state } from './state.js';
import { switchTab, switchMetasSubtab, toggleDarkMode, openModal, closeModal, aplicarTema } from './ui.js';
import { initAuth } from './auth.js';
import { loadGoals, loadCompletedGoals, resetDailyGoals } from './goals.js';
import { loadRewards } from './rewards.js';
import {
    renderProfileSummary, loadWeightHistory, updateStreak, carregarDiasAtivos,
    atualizarPerfilPublico, renderLinkPublico, mostrarPerfilPublico,
} from './profile.js';
import { restoreReminders, handleQuickActionFromUrl } from './notifications.js';
import { tryShowWeeklyRecapAuto } from './recap.js';
import { renderPlano } from './plano.js';

Object.assign(window, { switchTab, switchMetasSubtab, toggleDarkMode, openModal, closeModal });

aplicarTema();

async function loadAllData() {
    if (!state.currentUser) return;
    const hour = new Date().getHours();
    const greetWord = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const greetingEl = document.getElementById('greeting');
    if (greetingEl) greetingEl.innerText = `${greetWord}, ${state.currentUser.displayName || 'Atleta'}!`;

    await updateStreak();
    await resetDailyGoals();
    await Promise.all([loadGoals(), loadRewards(), loadWeightHistory(), loadCompletedGoals(), carregarDiasAtivos()]);
    renderProfileSummary();
    renderPlano();
    renderLinkPublico();
    restoreReminders();
    atualizarPerfilPublico();
    setTimeout(() => tryShowWeeklyRecapAuto(), 1200);
    handleQuickActionFromUrl();
}

const perfilCompartilhado = new URLSearchParams(location.search).get('perfil');
if (perfilCompartilhado) mostrarPerfilPublico(perfilCompartilhado);
else initAuth(loadAllData);

// Service worker: cache offline e notificações push.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW não registrado:', err));
    });
}
