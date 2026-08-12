// Estado compartilhado entre os módulos do app. Para o tamanho desse
// projeto, um objeto simples importado por quem precisa já resolve.
// Não há necessidade de uma lib de estado.
export const state = {
    currentUser: null,
    userData: {},
    sessionVersion: 0,
    readySessionVersion: null,
    authActionInProgress: false
};

export function captureSession(source = state) {
    return { uid: source.currentUser?.uid || null, version: source.sessionVersion || 0 };
}
export function isCurrentSession(session, source = state) {
    return !!session && session.uid === (source.currentUser?.uid || null) && session.version === (source.sessionVersion || 0);
}
export function beginSession(user, source = state) {
    source.sessionVersion = (source.sessionVersion || 0) + 1;
    source.currentUser = user;
    source.userData = {}; source.goals = []; source.diasAtivos = []; source.readySessionVersion = null;
    return captureSession(source);
}

export function getLocalDateStr(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function isValidHeight(h) {
    const parsed = parseFloat(h);
    return parsed >= 1.0 && parsed <= 2.5;
}

export function formatHeight(h) {
    const p = parseFloat(h);
    return isNaN(p) ? h : p.toFixed(2);
}
