// Interface compartilhada: telas, abas, modais, toast, confirmação e tema.
// Substitui alert()/confirm()/prompt() do navegador, que fugiam do visual do app.
import { temaPorHorario } from './calculos.js';

function escapeHtmlPrompt(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

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

// ===== TEMA: sistema, claro, escuro ou automático (escuro das 19h às 6h) =====
// Quem usava a versão antiga tinha 'darkMode' ('true' = claro, 'false' = escuro): a escolha é mantida.
export function modoTema() {
    try {
        const antigo = localStorage.getItem('darkMode');
        return localStorage.getItem('corpo-tema') || (antigo === 'true' ? 'claro' : antigo === 'false' ? 'escuro' : 'sistema');
    } catch (e) { return 'sistema'; }
}

export function aplicarTema(modo = modoTema()) {
    const escuro = modo === 'escuro' || (modo === 'auto' && temaPorHorario(new Date().getHours()) === 'dark')
        || (modo === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = escuro ? 'dark' : 'light';
    const seletor = document.getElementById('tema-select');
    if (seletor) seletor.value = modo;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = escuro ? '#0b0f14' : '#f4f7f5';
    document.dispatchEvent(new Event('temamudou'));
}

export function definirTema(modo) {
    try { localStorage.setItem('corpo-tema', modo); } catch (e) {}
    aplicarTema(modo);
}

// Botão do topo: alterna direto entre claro e escuro.
export function toggleDarkMode() {
    definirTema(document.documentElement.dataset.theme === 'dark' ? 'claro' : 'escuro');
}

// No modo automático, confere de novo a cada 10 min (vira escuro sozinho às 19h).
setInterval(() => { if (modoTema() === 'auto') aplicarTema('auto'); }, 10 * 60 * 1000);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (modoTema() === 'sistema') aplicarTema('sistema'); });
window.definirTema = definirTema;

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
                <p>${escapeHtmlPrompt(message)}</p>
                <div class="confirm-actions">
                    <button type="button" class="btn-secondary confirm-cancel">Cancelar</button>
                    <button type="button" class="btn-primary confirm-ok">${escapeHtmlPrompt(confirmLabel)}</button>
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
        // Escapado porque "editar meta" reusa esse modal com o texto da
        // propria meta (dado que a pessoa digitou antes) como valor
        // inicial do campo - sem isso, um texto com aspas quebraria pra
        // fora do atributo value="".
        const fieldsHtml = fields.map(f => `
            <label class="prompt-label">${escapeHtmlPrompt(f.label)}</label>
            <input type="${f.type || 'text'}" id="prompt-${f.id}" value="${escapeHtmlPrompt(f.value ?? '')}" placeholder="${escapeHtmlPrompt(f.placeholder ?? '')}">
        `).join('');
        overlay.innerHTML = `
            <div class="confirm-box">
                <h3>${escapeHtmlPrompt(title)}</h3>
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
            colors: ['#c6f24e', '#ff7a45', '#5cc8ff', '#ffffff']
        });
    }
}
