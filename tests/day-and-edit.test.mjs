import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { targetValue, isRestDay } from '../js/routine-domain.js';
import { captureSession, isCurrentSession } from '../js/state.js';
const source = readFileSync(new URL('../js/goals.js', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), end ? source.indexOf(end, source.indexOf(start)) : undefined).replaceAll('export ', '');
test('P06 função de edição real rejeita alvo negativo, zero e texto, e limita progresso ao novo alvo', async () => {
  const writes = []; let answer = '-100';
  const context = vm.createContext({ state: { currentUser: { uid: 'A' } }, db: {}, doc() {}, getDoc: async () => ({ exists: () => true, data: () => ({ text: 'Teste', unit: 'qty', target: 10, current: 8 }) }), showPrompt: async () => ({ text: 'Teste', unit: 'qty', target: answer }), targetValue, UNIDADES: ['qty'], updateDoc: async (_, value) => writes.push(value), showToast() {}, loadGoals() {} });
  context.captureSession = () => captureSession(context.state); context.isCurrentSession = stamp => isCurrentSession(stamp, context.state);
  vm.runInContext(section('async function editGoal(', 'let currentGoalData'), context);
  for (answer of ['-100', '0', 'NaN', '10abc', '1e309']) await context.editGoal('g'); assert.equal(writes.length, 0);
  answer = '6'; await context.editGoal('g'); assert.equal(writes[0].target, 6); assert.equal(writes[0].current, 6);
});
test('P08 reset real preserva progresso novo de outro aparelho e mutação usa dia/saldo frescos', async () => {
  const data = new Map([['users/A', { xp: 0, ultimoResetDiario: '2026-10-31' }], ['users/A/goals/g', { text: 'Diária', target: 10, current: 10, unit: 'qty', isDaily: true, progressDay: '2026-10-31', createdAt: 1 }]]);
  let today = '2026-11-01', queue = Promise.resolve(), auto = 0;
  const doc = (...args) => args.length === 1 ? `${args[0]}/auto${++auto}` : args.slice(1).join('/');
  const collection = (_, ...parts) => parts.join('/');
  const transaction = (_, fn) => {
    const result = queue.then(async () => { const writes = [];
      const value = await fn({ get: async ref => ({ exists: () => data.has(ref), data: () => structuredClone(data.get(ref)) }), set: (ref, value, options) => writes.push(() => data.set(ref, options?.merge ? { ...data.get(ref), ...value } : value)), update: (ref, value) => writes.push(() => data.set(ref, { ...data.get(ref), ...value })), delete: ref => writes.push(() => data.delete(ref)) });
      writes.forEach(write => write()); return value;
    }); queue = result.catch(() => {}); return result;
  };
  const make = () => {
    const state = { currentUser: { uid: 'A' }, userData: { ultimoResetDiario: '2026-10-31' } };
    const context = vm.createContext({ state, db: {}, doc, collection, getLocalDateStr: () => today, getDocs: async () => ({ size: 1, docs: [{ ref: 'users/A/goals/g' }] }), runTransaction: transaction, isRestDay, navigator: { onLine: true }, console, Date, showToast() {}, registrarHabito: async () => {}, closeModal() {}, loadGoals() {}, loadCompletedGoals() {}, renderProfileSummary() {}, celebrate() {}, showCelebrationBanner() {} });
    context.captureSession = () => captureSession(state); context.isCurrentSession = stamp => isCurrentSession(stamp, state);
    vm.runInContext(section('let resettingDay ='), context);
    vm.runInContext(section('async function _registrarProgresso(', '// Guarda o dia e a hora'), context);
    return context;
  };
  const a = make(), b = make(); await a.resetDailyGoals(); assert.equal(data.get('users/A/goals/g').current, 0);
  data.set('users/A/goals/g', { ...data.get('users/A/goals/g'), current: 4 });
  await b.resetDailyGoals(); assert.equal(data.get('users/A/goals/g').current, 4);
  const staleMeta = { id: 'g', current: 10, target: 10, isDaily: true };
  await a._registrarProgresso(staleMeta, 6); await b._registrarProgresso(staleMeta, 6);
  assert.equal(data.get('users/A/goals/g').current, 10); assert.equal(data.get('users/A').xp, 10); assert.equal([...data.keys()].filter(k => k.includes('/progressLogs/')).length, 1);
  today = '2026-11-02'; await a._registrarProgresso(staleMeta, 2);
  assert.equal(data.get('users/A/goals/g').current, 2); assert.equal(data.get('users/A/goals/g').progressDay, today); assert.equal(data.get('users/A').xp, 10);
});
test('ambiente local não pede permissão nem registra ou envia push', async () => {
  const source = readFileSync(new URL('../js/notifications.js', import.meta.url), 'utf8');
  const start = source.indexOf('window.toggleReminder ='), end = source.indexOf('// A conta (Firestore)', start);
  const toggle = { checked: true }; let requests = 0, writes = 0;
  const ctx = vm.createContext({ window: {}, IS_LOCAL: true, document: { getElementById: () => toggle }, showToast() {}, Notification: { requestPermission: () => { requests++; throw new Error('Não deve chamar serviço real.'); } }, setDoc: () => writes++ });
  vm.runInContext(source.slice(start, end), ctx); await ctx.window.toggleReminder('water', true);
  assert.equal(requests, 0); assert.equal(writes, 0); assert.equal(toggle.checked, false);
});
