import { defineConfig } from '@playwright/test';

// Testes E2E com o Firebase falso (e2e/*.spec.js), rodando no build de produção (dist/).
export default defineConfig({
    testDir: './e2e',
    reporter: 'list',
    use: { baseURL: 'http://localhost:4176', serviceWorkers: 'block' },
    webServer: {
        command: 'node scripts/servidor-dev.js',
        url: 'http://localhost:4176',
        reuseExistingServer: !process.env.CI,
        env: { PORT: '4176', PASTA: 'dist' },
    },
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
