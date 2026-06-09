// Notificações via Service Worker (funcionam mesmo com o app fechado, ao
// contrário do antigo new Notification() direto, que só disparava com a aba
// aberta), prompt de instalação do PWA e atalhos de tela inicial em 1 toque.
//
// O envio de verdade com o app fechado depende de um back-end mínimo: uma
// função agendada da Netlify que dispara os pushes nos horários certos
// (netlify/functions/send-reminders.js). Os detalhes de como ativar isso
// estão no README.
import { db, doc, setDoc, collection, getDocs } from './firebase-config.js';
import { state } from './state.js';
import { showToast } from './ui.js';

// Chave pública VAPID (a privada fica só na função da Netlify, nunca no front-end).
const VAPID_PUBLIC_KEY = 'BNwmfRk-h1xnK9_2GbPm8c7hmWUq3WZepmYP7i5NABdeMLFX3mDXPjz8eXEKdosHwn8Ks5mlYCj3ZtrdEVbkN6I';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.startsWith('REPLACE_WITH')) {
        console.warn('VAPID_PUBLIC_KEY não configurada ainda. Veja o README.');
        return null;
    }
    try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }
        if (state.currentUser) {
            await setDoc(doc(db, 'users', state.currentUser.uid), { pushSubscription: subscription.toJSON() }, { merge: true });
        }
        return subscription;
    } catch (e) {
        console.warn('Não foi possível assinar as notificações push:', e);
        return null;
    }
}

async function showLocalNotification(title, body) {
    if (Notification.permission !== 'granted') return;
    try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, { body, icon: 'assets/icons/icon-192.svg', badge: 'assets/icons/icon-192.svg' });
    } catch (e) {
        new Notification(title, { body });
    }
}

window.toggleReminder = async function (type, enabled) {
    if (enabled) {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
            showToast('Permissão de notificações negada. Ative nas configurações do navegador.', 'error');
            document.getElementById(`toggle-${type}-reminder`).checked = false;
            return;
        }
        await subscribeToPush();
    }
    try { localStorage.setItem(`reminder_${type}`, enabled ? '1' : '0'); } catch (e) {}
    if (state.currentUser) {
        try { await setDoc(doc(db, 'users', state.currentUser.uid), { reminders: { [type]: enabled } }, { merge: true }); }
        catch (e) { console.error(e); }
    }
    if (enabled) {
        showLocalNotification(
            type === 'water' ? '💧 Lembretes de água ativados' : '🎯 Lembretes de meta ativados',
            type === 'water' ? 'Vamos te lembrar de beber água de tempos em tempos, mesmo com o app fechado.' : 'Vamos te lembrar das suas metas às 20h, mesmo com o app fechado.'
        );
    }
};

export function restoreReminders() {
    let water = false, goal = false;
    try {
        water = localStorage.getItem('reminder_water') === '1';
        goal = localStorage.getItem('reminder_goal') === '1';
    } catch (e) {}
    const waterEl = document.getElementById('toggle-water-reminder');
    const goalEl = document.getElementById('toggle-goal-reminder');
    if (waterEl) waterEl.checked = water;
    if (goalEl) goalEl.checked = goal;
}

// ===== INSTALAÇÃO DO PWA (beforeinstallprompt) =====
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('install-app-btn');
    if (btn) btn.hidden = false;
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById('install-app-btn');
    if (btn) btn.hidden = true;
    showToast('App instalado! Agora é só abrir direto da tela inicial. 💪', 'success');
});

window.installApp = async function () {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    const btn = document.getElementById('install-app-btn');
    if (btn) btn.hidden = true;
};

// ===== ATALHOS DE TELA INICIAL (manifest "shortcuts") =====
// Abre direto no registro rápido de água/treino, sem precisar navegar pelo app.
export async function handleQuickActionFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (!action) return;
    window.history.replaceState({}, '', window.location.pathname);
    if (!state.currentUser) return;

    const targetUnit = action === 'quick-water' ? 'ml' : action === 'quick-workout' ? 'reps' : null;
    if (!targetUnit) return;

    try {
        const snap = await getDocs(collection(db, 'users', state.currentUser.uid, 'goals'));
        let match = null;
        snap.forEach(s => { if (!match && s.data().unit === targetUnit) match = { id: s.id, ...s.data() }; });
        if (typeof window.switchTab === 'function') window.switchTab('metas');
        if (match && typeof window.openProgressModal === 'function') {
            window.openProgressModal(match.id, match.text, match.target, match.current, match.unit, !!match.isDaily);
        } else {
            showToast('Crie uma meta de ' + (targetUnit === 'ml' ? 'água' : 'treino') + ' para usar o atalho rápido.', 'info');
        }
    } catch (e) { console.error(e); }
}
