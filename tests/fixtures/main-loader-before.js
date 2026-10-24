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
    await Promise.all([renderWorkouts(), renderRoutine()]);
    renderLinkPublico();
    if (!IS_LOCAL) restoreReminders();
    atualizarPerfilPublico();
    setTimeout(() => tryShowWeeklyRecapAuto(), 1200);
    handleQuickActionFromUrl();
}

