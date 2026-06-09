// Elementos de interface compartilhados: troca de telas/abas, modais,
// toast e confirmação. Isso substitui os alert()/confirm()/prompt()
// nativos do navegador, que quebravam a identidade visual do app.
export function showLogin() {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('signup-screen').classList.remove('active');
    document.getElementById('onboarding-screen').classList.remove('active');
    document.getElementById('main-app').classList.remove('active');
}

export function showSignup() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('signup-screen').classList.add('active');
    document.getElementById('onboarding-screen').classList.remove('active');
    document.getElementById('main-app').classList.remove('active');
}

export function showOnboardingScreen() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('signup-screen').classList.remove('active');
    document.getElementById('onboarding-screen').classList.add('active');
    document.getElementById('main-app').classList.remove('active');
}

export function showApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('signup-screen').classList.remove('active');
    document.getElementById('onboarding-screen').classList.remove('active');
    document.getElementById('main-app').classList.add('active');
}

export function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.add('active');
    document.querySelectorAll('.bottom-nav button').forEach(btn => {
        btn.classList.toggle('nav-active', btn.dataset.tab === tabId);
    });
}

export function switchMetasSubtab(tab) {
    document.getElementById('subtab-ativas').style.display = tab === 'ativas' ? 'block' : 'none';
    document.getElementById('subtab-concluidas').style.display = tab === 'concluidas' ? 'block' : 'none';
    document.getElementById('subtab-ativas-btn').className = tab === 'ativas' ? 'btn-small btn-primary' : 'btn-small btn-secondary';
    document.getElementById('subtab-concluidas-btn').className = tab === 'concluidas' ? 'btn-small btn-primary' : 'btn-small btn-secondary';
}

export function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.style.display = 'block';
}

export function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.style.display = 'none';
}

document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

export function toggleDarkMode() {
    document.documentElement.classList.toggle('light-mode');
    const isLight = document.documentElement.classList.contains('light-mode');
    try { localStorage.setItem('darkMode', isLight ? 'true' : 'false'); } catch (e) {}
}

// ===== TOAST (substitui alert()) =====
let toastTimeout = null;
export function showToast(message, type = 'info') {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `app-toast app-toast-${type} show`;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ===== CONFIRMAÇÃO (substitui confirm()) =====
export function showConfirm(message, confirmLabel = 'Confirmar') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-box">
                <p>${message}</p>
                <div class="confirm-actions">
                    <button type="button" class="btn-secondary confirm-cancel">Cancelar</button>
                    <button type="button" class="btn-primary confirm-ok">${confirmLabel}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));
        const cleanup = (result) => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 200); resolve(result); };
        overlay.querySelector('.confirm-cancel').addEventListener('click', () => cleanup(false));
        overlay.querySelector('.confirm-ok').addEventListener('click', () => cleanup(true));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    });
}

// ===== PROMPT (substitui prompt()), usado em "editar meta" e "recuperar senha" =====
export function showPrompt({ title, fields }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        const fieldsHtml = fields.map(f => `
            <label class="prompt-label">${f.label}</label>
            <input type="${f.type || 'text'}" id="prompt-${f.id}" value="${f.value ?? ''}" placeholder="${f.placeholder ?? ''}">
        `).join('');
        overlay.innerHTML = `
            <div class="confirm-box">
                <h3>${title}</h3>
                ${fieldsHtml}
                <div class="confirm-actions">
                    <button type="button" class="btn-secondary prompt-cancel">Cancelar</button>
                    <button type="button" class="btn-primary prompt-ok">Salvar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));
        const cleanup = (result) => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 200); resolve(result); };
        overlay.querySelector('.prompt-cancel').addEventListener('click', () => cleanup(null));
        overlay.querySelector('.prompt-ok').addEventListener('click', () => {
            const result = {};
            fields.forEach(f => { result[f.id] = document.getElementById(`prompt-${f.id}`).value.trim(); });
            cleanup(result);
        });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
    });
}

export function showCelebrationBanner(msg) {
    let banner = document.getElementById('celebration-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'celebration-banner';
        document.body.appendChild(banner);
    }
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(banner._timeout);
    banner._timeout = setTimeout(() => banner.classList.remove('show'), 3000);
}

// ===== CONFETE (celebração visual ao bater uma meta) =====
export function celebrate() {
    if (typeof window.confetti === 'function') {
        window.confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#33D17A', '#FF8A3D', '#ffffff']
        });
    }
}
