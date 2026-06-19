// Fluxos principais no build de produção, com Firebase falso (testes/fake-firebase.mjs)
// e as bibliotecas de CDN trocadas por versões mínimas (os testes não dependem da internet).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fakeFirebase = readFileSync(new URL('../testes/fake-firebase.mjs', import.meta.url), 'utf8');
const STUBS = {
    'chart.js': 'window.Chart = class { constructor() { window.__graficos = (window.__graficos || 0) + 1; } destroy() {} };',
    'canvas-confetti': 'window.confetti = () => { window.__confete = (window.__confete || 0) + 1; };',
    'html2canvas': 'window.html2canvas = async () => { const c = document.createElement("canvas"); c.width = c.height = 4; return c; };',
};

async function preparar(page, { data = '2026-09-23T10:00:00' } = {}) {
    await page.clock.setFixedTime(new Date(data));
    await page.route('https://www.gstatic.com/firebasejs/**', (route) =>
        route.fulfill({ contentType: 'text/javascript', body: fakeFirebase }));
    await page.route('https://cdn.jsdelivr.net/**', (route) => {
        const chave = Object.keys(STUBS).find((k) => route.request().url().includes(k));
        route.fulfill({ contentType: 'text/javascript', body: chave ? STUBS[chave] : '' });
    });
    await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
}

async function criarConta(page, { usuario = 'claudio', nome = 'Claudinho', senha = 'segredo123' } = {}) {
    await page.goto('/');
    await page.getByRole('link', { name: 'Criar conta' }).click();
    await page.fill('#signup-username', usuario);
    await page.fill('#signup-displayname', nome);
    await page.fill('#signup-password', senha);
    await page.fill('#signup-password-confirm', senha);
    await page.locator('#signup-screen').getByRole('button', { name: 'Criar conta' }).click();

    await expect(page.locator('#onboarding-screen')).toBeVisible();
    await page.fill('#onboard-weight', '80');
    await page.locator('#step-weight').getByRole('button', { name: 'Próximo' }).click();
    await page.fill('#onboard-height', '1.80');
    await page.locator('#step-height').getByRole('button', { name: 'Próximo' }).click();
    await page.getByRole('button', { name: /Ganhar massa/ }).click();
    await page.fill('#onboard-target-weight', '85');
    await page.locator('#step-target-weight').getByRole('button', { name: 'Próximo' }).click();
    await page.fill('#onboard-target-height', '1.80');
    await page.locator('#step-target-height').getByRole('button', { name: 'Próximo' }).click();
    await expect(page.locator('#onboard-sugestoes .sugestao-item')).toHaveCount(3);
    await page.fill('#onboard-phrase', 'Bora!');
    await page.getByRole('button', { name: 'Começar!' }).click();
    await expect(page.locator('#main-app')).toBeVisible();
}

test.beforeEach(async ({ page }) => { await preparar(page); });

test('cadastro, onboarding com metas sugeridas e tela inicial preenchida', async ({ page }) => {
    await criarConta(page);
    await expect(page.locator('#greeting')).toHaveText('Bom dia, Claudinho!');
    await expect(page.locator('.quote')).toHaveText('Bora!');
    await expect(page.locator('#goals-container .goal-card')).toHaveCount(3);
    await expect(page.locator('#streak-count')).toHaveText('1');
    await expect(page.locator('#hidratacao-card')).toContainText('0 / 2.000 ml');
});

test('água rápida, plano de treino, calendário e virada do dia', async ({ page }) => {
    await criarConta(page);
    await page.locator('#hidratacao-card').getByRole('button', { name: '+250 ml' }).click();
    await expect(page.locator('#hidratacao-card')).toContainText('250 / 2.000 ml');
    await expect(page.locator('#sequencia-calendario .calendario-dia.ativo')).toHaveCount(1);

    await page.locator('#plano-card').getByRole('button', { name: 'ABC' }).click();
    await expect(page.locator('#plano-card')).toContainText('A · Peito e tríceps');
    await page.getByRole('button', { name: '✅ Fiz esse treino' }).click();
    await expect(page.locator('#plano-card button.btn-primary')).toBeDisabled();
    await expect(page.locator('#plano-card')).toContainText('Treino de hoje feito!');

    // Dia seguinte: meta diária zera, sequência sobe e o plano passa pro treino B.
    await page.clock.setFixedTime(new Date('2026-09-24T09:00:00'));
    await page.reload();
    await expect(page.locator('#main-app')).toBeVisible();
    await expect(page.locator('#streak-count')).toHaveText('2');
    await expect(page.locator('#hidratacao-card')).toContainText('0 / 2.000 ml');
    await expect(page.locator('#plano-card')).toContainText('B · Costas e bíceps');
});

test('meta cumprida dá XP e a lojinha desconta o custo da recompensa', async ({ page }) => {
    await criarConta(page);
    const agua = page.locator('#goals-container .goal-card', { hasText: 'Beber água' });
    await agua.locator('.goal-add-progress-btn').click();
    await page.fill('#modal-progress-input', '2000');
    await page.locator('#modal-add-progress').getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.locator('#celebration-banner')).toContainText('Meta diária cumprida');
    await expect(page.locator('#home-xp-label')).toContainText('30');

    await page.locator('.bottom-nav').getByRole('button', { name: /Lojinha/ }).click();
    await expect(page.locator('#saldo-xp')).toHaveText('30 XP pra gastar');
    await page.getByRole('button', { name: '+ Criar recompensa' }).click();
    await page.fill('#reward-title', 'Pizza');
    await page.fill('#reward-goal', 'Bater a água 1 dia');
    await page.fill('#reward-cost', '20');
    await page.locator('#modal-add-reward').getByRole('button', { name: 'Criar' }).click();
    await expect(page.locator('#rewards-list')).toContainText('custa 20 XP');
    await page.getByRole('button', { name: '🎁 Recolher' }).click();
    await expect(page.locator('#saldo-xp')).toHaveText('10 XP pra gastar');
    await expect(page.locator('#rewards-list .reward-done')).toHaveCount(1);
});

test('tema: botão do topo, seletor do perfil e preferência do sistema', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await criarConta(page);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.locator('.dark-toggle-btn').click();
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.locator('.bottom-nav').getByRole('button', { name: /Perfil/ }).click();
    await expect(page.locator('#tema-select')).toHaveValue('claro');
    await page.selectOption('#tema-select', 'escuro');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.selectOption('#tema-select', 'auto'); // 10h da manhã: claro
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#tema-select')).toHaveValue('auto');
});

test('perfil público: link só leitura sem peso e desligar some com ele', async ({ page, context }) => {
    await criarConta(page);
    await page.locator('.bottom-nav').getByRole('button', { name: /Perfil/ }).click();
    await page.locator('#toggle-perfil-publico').check();
    const campo = page.locator('#link-publico input');
    await expect(campo).toHaveValue(/\?perfil=uid/);
    const link = await campo.inputValue();

    const visitante = await context.newPage();
    await preparar(visitante);
    await visitante.goto(link);
    await expect(visitante.locator('#public-screen')).toBeVisible();
    await expect(visitante.locator('#public-content')).toContainText('Claudinho');
    await expect(visitante.locator('#public-content')).toContainText('Beber água');
    await expect(visitante.locator('#public-content')).not.toContainText('kg');

    await page.locator('#toggle-perfil-publico').uncheck();
    await expect(page.locator('#link-publico')).toBeHidden();
    await visitante.reload();
    await expect(visitante.locator('#public-content')).toContainText('Perfil não encontrado');
});

test('sair, senha errada e entrar de novo mantendo os dados', async ({ page }) => {
    await criarConta(page);
    await page.locator('.bottom-nav').getByRole('button', { name: /Perfil/ }).click();
    await page.getByRole('button', { name: 'Sair da conta' }).click();
    await expect(page.locator('#login-screen')).toBeVisible();

    await page.fill('#login-username', 'Claudio');
    await page.fill('#login-password', 'errada1');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.locator('#app-toast')).toHaveText('Usuário ou senha incorretos.');

    await page.fill('#login-password', 'segredo123');
    await page.locator('#login-password').press('Enter');
    await expect(page.locator('#main-app')).toBeVisible();
    await expect(page.locator('#goals-container .goal-card')).toHaveCount(3);
});

test('cadastro recusa usuário com acento ou espaço', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Criar conta' }).click();
    await page.fill('#signup-username', 'joão silva');
    await page.fill('#signup-displayname', 'João');
    await page.fill('#signup-password', 'segredo123');
    await page.fill('#signup-password-confirm', 'segredo123');
    await page.locator('#signup-screen').getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.locator('#app-toast')).toContainText('só letras sem acento');
    await expect(page.locator('#signup-screen')).toBeVisible();
});

test('exporta peso em CSV com BOM e tudo em JSON', async ({ page }) => {
    await criarConta(page);
    await page.locator('.bottom-nav').getByRole('button', { name: /Perfil/ }).click();
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Peso e IMC (CSV)' }).click()]);
    const textoCsv = readFileSync(await csv.path(), 'utf8');
    expect(textoCsv.charCodeAt(0)).toBe(0xFEFF);
    expect(textoCsv).toContain('2026-09-23;80;24,7');

    const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tudo (JSON)' }).click()]);
    const dados = JSON.parse(readFileSync(await json.path(), 'utf8'));
    expect(dados.goals).toHaveLength(3);
    expect(dados.perfil.kgInicial).toBe(80);
    expect(dados.perfil.pushSubscription).toBeUndefined();
});

for (const [nome, tamanho] of [['celular', { width: 375, height: 812 }], ['desktop', { width: 1280, height: 900 }]]) {
    test(`layout sem rolagem horizontal no ${nome}`, async ({ page }) => {
        await page.setViewportSize(tamanho);
        await criarConta(page);
        for (const aba of ['Início', 'Metas', 'Lojinha', 'Perfil']) {
            await page.locator('.bottom-nav').getByRole('button', { name: new RegExp(aba) }).click();
            const larguras = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
            expect(larguras[0], `aba ${aba}`).toBeLessThanOrEqual(larguras[1]);
        }
    });
}

test.describe('offline', () => {
    test.use({ serviceWorkers: 'allow' });

    test('depois da primeira visita, o app abre sem internet', async ({ page, context }) => {
        await page.goto('/');
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.reload(); // agora a página já passa pelo service worker
        await expect(page.locator('#login-screen')).toBeVisible();
        await context.setOffline(true);
        await page.reload();
        await expect(page.locator('#login-screen')).toBeVisible();
        await expect(page.locator('#login-screen h1')).toHaveText('Corpo Bem');
        await context.setOffline(false);
    });
});
