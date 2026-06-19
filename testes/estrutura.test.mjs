// Checagens estáticas: handlers do HTML expostos em window, IDs que o JS procura e regras do Firestore.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFileSync(new URL(caminho, raiz), 'utf8');
const arquivosJs = readdirSync(new URL('js/', raiz)).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
const html = ler('index.html');
const IGNORAR = new Set(['if', 'return', 'event', 'this', 'window', 'document', 'setTimeout', 'String']);

test('toda função usada em onclick/onchange/onkeydown está exposta em window', () => {
  const atributo = /\bon(?:click|change|input|keydown|submit)\s*=\s*(["'])([\s\S]*?)\1/g;
  const chamada = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
  const chamadas = new Set();
  for (const arquivo of ['index.html', ...arquivosJs]) {
    for (const m of ler(arquivo).matchAll(atributo)) {
      // ${...} roda no template JS, não no clique: fica fora da checagem.
      for (const c of m[2].replace(/\$\{[^}]*\}/g, '').matchAll(chamada)) if (!IGNORAR.has(c[1])) chamadas.add(c[1]);
    }
  }
  const expostas = new Set();
  for (const arquivo of arquivosJs) {
    const codigo = ler(arquivo);
    for (const m of codigo.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) expostas.add(m[1]);
    for (const m of codigo.matchAll(/Object\.assign\(window,\s*\{([^}]*)\}/g)) {
      m[1].split(',').map((n) => n.trim()).filter(Boolean).forEach((n) => expostas.add(n));
    }
  }
  assert.deepEqual([...chamadas].filter((n) => !expostas.has(n)), []);
});

test('todo getElementById do JS encontra o elemento no HTML (ou é criado pelo próprio JS)', () => {
  const criadosNoJs = new Set();
  const procurados = new Set();
  for (const arquivo of arquivosJs) {
    const codigo = ler(arquivo);
    for (const m of codigo.matchAll(/\.id = '([\w-]+)'/g)) criadosNoJs.add(m[1]);
    for (const m of codigo.matchAll(/id="([\w-]+)"/g)) criadosNoJs.add(m[1]);
    for (const m of codigo.matchAll(/getElementById\('([\w-]+)'\)/g)) procurados.add(m[1]);
  }
  const faltando = [...procurados].filter((id) => !html.includes(`id="${id}"`) && !criadosNoJs.has(id));
  assert.deepEqual(faltando, []);
});

test('IDs do HTML não se repetem', () => {
  const ids = [...html.matchAll(/\sid="([\w-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});

test('regras do Firestore: dados só do dono e resumo público limitado', () => {
  const regras = ler('firestore.rules');
  assert.match(regras, /match \/users\/\{userId\}/);
  assert.match(regras, /request\.auth\.uid == userId/);
  assert.doesNotMatch(regras, /allow (read|write)[^;]*: if true/, 'nada pode ser liberado geral');
  assert.match(regras, /match \/publico\/\{userId\}[\s\S]*allow get: if true;/);
  assert.match(regras, /hasOnly\(\['nome', 'sequencia', 'nivel', 'xp', 'diasAtivos', 'metas', 'atualizadoEm'\]\)/);
  assert.doesNotMatch(regras.split('match /publico')[1], /allow (list|read)/, 'o público só pode ser lido por get (sem listar todo mundo)');
});

test('nada aponta mais pra Netlify', () => {
  const codigo = ['index.html', 'sw.js', 'vercel.json', 'package.json', ...arquivosJs].map(ler).join('\n');
  assert.doesNotMatch(codigo, /netlify/i);
  assert.equal(existsSync(new URL('netlify.toml', raiz)), false);
  assert.equal(existsSync(new URL('netlify', raiz)), false);
});

test('vercel.json publica o dist e protege o cron', () => {
  const config = JSON.parse(ler('vercel.json'));
  assert.equal(config.outputDirectory, 'dist');
  assert.equal(config.buildCommand, 'npm run build');
  assert.ok(config.crons.some((c) => c.path === '/api/send-reminders'));
  assert.match(ler('api/send-reminders.js'), /CRON_SECRET/);
});

test('service worker tem o marcador de versão trocado no build', () => {
  assert.match(ler('sw.js'), /__BUILD_ID__/);
  assert.match(ler('build.js'), /replaceAll\('__BUILD_ID__'/);
});
