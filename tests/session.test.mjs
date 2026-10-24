import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { beginSession, captureSession, isCurrentSession } from '../js/state.js';
import { isRestDay, validateRoutine, trainingVolume } from '../js/routine-domain.js';
const read = name => readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
const pick = (source, start, end) => source.slice(source.indexOf(start), end ? source.indexOf(end, source.indexOf(start)) : undefined).replaceAll('export ', '');
const defer = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
class Node {
  constructor(content = '') { this.content = content; this.style = {}; this.attrs = {}; this.width = 320; this.children = new Map(); const active = new Set(); this.classList = { add: x => active.add(x), remove: x => active.delete(x), contains: x => active.has(x) }; }
  get innerHTML() { return this.content; } set innerHTML(v) { this.content = String(v); }
  get textContent() { return this.content; } set textContent(v) { this.content = String(v); }
  get innerText() { return this.content; } set innerText(v) { this.content = String(v); }
  replaceChildren() { this.content = ''; } removeAttribute(name) { delete this.attrs[name]; } remove() { this.removed = true; }
  querySelector(selector) { if (!this.children.has(selector)) this.children.set(selector, new Node()); return this.children.get(selector); }
  querySelectorAll() { return []; }
}
function setup(overrides = {}) {
  const state = { currentUser: { uid: 'A' }, sessionVersion: 1, readySessionVersion: 1, userData: { kgInicial: 70, displayname: 'A' }, goals: [{ id: 'A' }], diasAtivos: ['A-date'] };
  const screens = ['login-screen','signup-screen','onboarding-screen','main-app','session-loading-screen'];
  const nodes = new Map([...screens, 'workouts-card','routine-card','greeting','goals-container','goals-list','completed-goals-list','rewards-list','weight-chart','sequencia-calendario'].map(id => [id, new Node('Privado de A')]));
  nodes.get('main-app').classList.add('active');
  const quote = new Node('Frase privada de A'), messages = [], timers = [];
  const page = { getElementById: id => nodes.get(id) || null, querySelector: selector => selector === '.quote' ? quote : null, querySelectorAll: selector => selector === '.screen' ? screens.map(id => nodes.get(id)) : [] };
  const noop = () => {};
  const ctx = vm.createContext({ state, document: page, window: { _weightChart: null, showOnboardingStep: noop }, console: { error: noop }, db: {}, doc: (_, collection, uid) => uid, getDoc: async uid => ({ exists: () => true, data: () => ({ kgInicial: 75, displayname: uid }) }), beginSession: user => beginSession(user, state), captureSession: () => captureSession(state), isCurrentSession: stamp => isCurrentSession(stamp, state), onAuthenticatedApp: async () => {}, showToast: message => messages.push(message), updateStreak: noop, resetDailyGoals: noop, loadGoals: noop, loadRewards: noop, loadWeightHistory: noop, loadCompletedGoals: noop, carregarDiasAtivos: noop, renderProfileSummary: noop, renderPlano: noop, renderWorkouts: noop, renderRoutine: noop, renderLinkPublico: noop, IS_LOCAL: true, atualizarPerfilPublico: noop, setTimeout: fn => timers.push(fn), handleQuickActionFromUrl: noop, tryShowWeeklyRecapAuto: noop, getLocalDateStr: () => '2026-11-02', isRestDay, validateRoutine, trainingVolume, ...overrides });
  vm.runInContext(pick(read('ui.js'), 'export function showLogin()', 'export function switchTab('), ctx);
  vm.runInContext(pick(read('auth.js'), 'async function loadUserData(', 'window.showLogin ='), ctx);
  return { ctx, state, nodes, messages, timers };
}
test('sessão: carregamento lento e erro de B nunca exibem cards privados de A', async () => {
  const query = defer(); let requested = false;
  const { ctx, state, nodes, messages } = setup({ loadGoals: () => { requested = true; return query.promise; } });
  vm.runInContext(pick(read('main.js'), 'async function loadAllData()', 'const perfilCompartilhado'), ctx);
  ctx.onAuthenticatedApp = () => ctx.loadAllData();
  const attempt = ctx.routeAfterAuth({ uid: 'B' }); await tick();
  assert.equal(requested, true); assert.equal(state.currentUser.uid, 'B');
  assert.equal(nodes.get('main-app').classList.contains('active'), false); assert.equal(nodes.get('session-loading-screen').classList.contains('active'), true);
  assert.ok(!nodes.get('workouts-card').innerHTML.includes('Privado de A')); assert.ok(!nodes.get('routine-card').innerHTML.includes('Privado de A'));
  query.reject(new Error('API fictícia indisponível')); await attempt;
  assert.equal(nodes.get('main-app').classList.contains('active'), false); assert.equal(nodes.get('login-screen').classList.contains('active'), true);
  assert.equal(state.readySessionVersion, null); assert.ok(messages.some(m => m.includes('Não consegui carregar')));
  assert.ok(!nodes.get('workouts-card').innerHTML.includes('Privado de A'));
});
test('sessão: perfil A atrasado não sobrescreve o perfil nem a agenda de B', async () => {
  const old = defer();
  const { ctx, state, nodes } = setup({ getDoc: uid => uid === 'A' ? old.promise : Promise.resolve({ exists: () => true, data: () => ({ kgInicial: 75, displayname: 'B', routine: { restWeekdays: [], pauseStart: '2026-11-02', pauseEnd: '2026-11-03' } }) }) });
  vm.runInContext(pick(read('routine-ui.js'), 'export async function renderRoutine()'), ctx);
  ctx.onAuthenticatedApp = () => ctx.renderRoutine();
  const a = ctx.routeAfterAuth({ uid: 'A' }); await ctx.routeAfterAuth({ uid: 'B' });
  old.resolve({ exists: () => true, data: () => ({ kgInicial: 70, displayname: 'A', routine: { restWeekdays: [], pauseStart: '2025-01-01', pauseEnd: '2025-01-02' } }) }); await a;
  assert.equal(state.currentUser.uid, 'B'); assert.equal(state.userData.displayname, 'B');
  assert.ok(nodes.get('routine-card').innerHTML.includes('2026-11-02')); assert.ok(!nodes.get('routine-card').innerHTML.includes('2025-01-01'));
  assert.equal(nodes.get('main-app').classList.contains('active'), true);
});
test('sessão: consulta de treino antiga não reentra após A → B → A', async () => {
  const old = defer(); const { ctx, state, nodes } = setup({ collection: (...parts) => parts.slice(1).join('/'), getDocs: () => old.promise });
  vm.runInContext(pick(read('workouts-ui.js'), 'export async function renderWorkouts()', 'function openEditor('), ctx);
  const pending = ctx.renderWorkouts(); beginSession({ uid: 'B' }, state); beginSession({ uid: 'A' }, state); nodes.get('workouts-card').innerHTML = 'Dados atuais da nova sessão A';
  old.resolve({ docs: [], size: 0, empty: true }); await pending;
  assert.equal(nodes.get('workouts-card').innerHTML, 'Dados atuais da nova sessão A');
});
test('sessão: respostas e erros antigos dos loaders não alteram a vista de B', async t => {
  const cases = [
    ['goals.js','export async function loadGoals()', 'function createGoalCard(', 'loadGoals'],
    ['goals.js','export async function loadCompletedGoals()', 'async function deleteCompletedGoal(', 'loadCompletedGoals'],
    ['rewards.js','export async function loadRewards()', 'const claiming', 'loadRewards'],
    ['profile.js','export async function loadWeightHistory()', 'let ultimoGrafico', 'loadWeightHistory'],
    ['profile.js','export async function carregarDiasAtivos()', 'export function renderSequenciaCalendario(', 'carregarDiasAtivos'],
    ['recap.js','export async function generateWeeklyRecap()', 'window.generateWeeklyRecap', 'generateWeeklyRecap']
  ];
  for (const [file,start,end,name] of cases) await t.test(name, async () => {
    for (const fail of [false,true]) {
      const old = defer(); const { ctx, state, nodes } = setup({ collection: (...parts) => parts.slice(1).join('/'), getDocs: () => old.promise, renderSaldoXp() {}, query: value => value, where() {} });
      vm.runInContext(pick(read(file), start, end), ctx);
      const pending = ctx[name](); beginSession({ uid: 'B' }, state); state.goals = [{ id: 'B' }]; state.diasAtivos = ['B-date'];
      for (const node of nodes.values()) node.innerHTML = 'Dados atuais de B';
      if (fail) old.reject(new Error('Erro antigo de A')); else old.resolve({ forEach() { throw new Error('Não deve processar dados antigos.'); }, docs: [], empty: false });
      await pending;
      assert.equal(state.goals[0].id, 'B'); assert.equal(state.diasAtivos[0], 'B-date');
      assert.ok([...nodes.values()].every(node => node.innerHTML === 'Dados atuais de B'));
    }
  });
});
test('sessão: conclusão de logout antigo não encerra uma nova sessão B', async () => {
  const logout = defer(); const { ctx, state, nodes } = setup({ auth: {}, signOut: () => logout.promise });
  vm.runInContext(pick(read('auth.js'), 'window.signOutAccount =', 'function friendlyAuthError('), ctx);
  const pending = ctx.window.signOutAccount(); assert.equal(state.currentUser, null);
  await ctx.routeAfterAuth({ uid: 'B' }); logout.resolve(); await pending;
  assert.equal(state.currentUser.uid, 'B'); assert.equal(state.userData.displayname, 'B'); assert.equal(nodes.get('main-app').classList.contains('active'), true);
});
test('sessão: uma consulta atual de treino continua renderizando os dados certos', async () => {
  const { ctx, nodes } = setup({ collection: (...parts) => parts.slice(1).join('/'), getDocs: async ref => ({ docs: ref.endsWith('/workouts') ? [{ id: 'w', data: () => ({ name: 'Treino atual A', exercises: [{ name: 'Exemplo', sets: 3, reps: 10, load: 10 }], createdAt: 1 }) }] : [] }) });
  ctx.esc = value => String(value); vm.runInContext(pick(read('workouts-ui.js'), 'export async function renderWorkouts()', 'function openEditor('), ctx);
  assert.equal(await ctx.renderWorkouts(), true); assert.ok(nodes.get('workouts-card').innerHTML.includes('Treino atual A'));
});
