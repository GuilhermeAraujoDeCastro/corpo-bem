// Ponto de entrada: tema, login, carregamento dos dados, perfil público (?perfil=uid) e PWA.
import { state, getLocalDateStr, captureSession, isCurrentSession } from './state.js';
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
import { renderWorkouts } from './workouts-ui.js';
import { renderRoutine, installDayWatch } from './routine-ui.js';
import { IS_LOCAL } from './firebase-config.js';

Object.assign(window, { switchTab, switchMetasSubtab, toggleDarkMode, openModal, closeModal });

aplicarTema();

async function loadAllData() {
    const session = captureSession();
    if (!session.uid) return;
    const hour = new Date().getHours();
    const greetWord = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const greetingEl = document.getElementById('greeting');
    if (greetingEl) greetingEl.innerText = `${greetWord}, ${state.currentUser.displayName || 'Atleta'}!`;

    await updateStreak();
    if (!isCurrentSession(session)) return;
    await resetDailyGoals();
    if (!isCurrentSession(session)) return;
    await Promise.all([loadGoals(), loadRewards(), loadWeightHistory(), loadCompletedGoals(), carregarDiasAtivos()]);
    if (!isCurrentSession(session)) return;
    renderProfileSummary();
    renderPlano();
    await Promise.all([renderWorkouts(), renderRoutine()]);
    if (!isCurrentSession(session)) return;
    renderLinkPublico();
    if (!IS_LOCAL) restoreReminders();
    atualizarPerfilPublico();
    setTimeout(() => { if (isCurrentSession(session)) tryShowWeeklyRecapAuto(); }, 1200);
    handleQuickActionFromUrl();
}

const perfilCompartilhado = new URLSearchParams(location.search).get('perfil');
if (perfilCompartilhado) mostrarPerfilPublico(perfilCompartilhado);
else initAuth(loadAllData);
installDayWatch(async () => {
    const session = captureSession();
    if (!session.uid || state.readySessionVersion !== session.version || state.userData.ultimoResetDiario === getLocalDateStr()) return;
    await updateStreak(); if (!isCurrentSession(session)) return;
    await resetDailyGoals(); if (!isCurrentSession(session)) return;
    await loadGoals(); if (!isCurrentSession(session)) return;
    renderPlano(); await renderRoutine();
});

// Service worker: cache offline e notificações push.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW não registrado:', err));
    });
}
