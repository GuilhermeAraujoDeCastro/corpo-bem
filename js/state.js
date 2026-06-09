// Estado compartilhado entre os módulos do app. Para o tamanho desse
// projeto, um objeto simples importado por quem precisa já resolve.
// Não há necessidade de uma lib de estado.
export const state = {
    currentUser: null,
    userData: {},
    authActionInProgress: false
};

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
