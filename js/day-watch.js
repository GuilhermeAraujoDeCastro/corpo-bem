export function installDayWatch(callback, { win = window, page = document, interval = setInterval } = {}) {
  let busy = false;
  const check = async () => {
    if (busy || page.visibilityState === 'hidden') return;
    busy = true;
    try { await callback(); }
    catch { const status = page.getElementById?.('routine-status'); if (status) status.textContent = 'Não foi possível renovar o dia. Conecte-se antes de registrar progresso.'; }
    finally { busy = false; }
  };
  win.addEventListener('focus', check); page.addEventListener('visibilitychange', check);
  const timer = interval(check, 30000);
  return () => { win.removeEventListener('focus', check); page.removeEventListener('visibilitychange', check); clearInterval(timer); };
}
