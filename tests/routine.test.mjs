import test from 'node:test';
import assert from 'node:assert/strict';
import { targetValue, calendarDate, isRestDay, nextStreak, validateRoutine, validateWorkout, trainingVolume } from '../js/routine-domain.js';
import { claimReward } from '../js/transactions.js';
import { installDayWatch } from '../js/day-watch.js';
test('P06 alvo estrito para criar e editar', () => {
  for (const invalid of [0, -100, Infinity, NaN, '10abc', '1e309', '', '  ', null, true]) assert.equal(targetValue(invalid), null, String(invalid));
  assert.equal(targetValue('2,5'), 2.5); assert.equal(targetValue('8'), 8);
});
function storeFixture(initial) {
  const data = new Map(Object.entries(initial)); let queue = Promise.resolve();
  return { data, run: fn => {
    const execution = queue.then(async () => {
      const writes = [];
      const result = await fn({ get: async ref => ({ exists: () => data.has(ref.id), data: () => structuredClone(data.get(ref.id)) }), update: (ref, value) => writes.push(() => data.set(ref.id, { ...data.get(ref.id), ...value })), set: (ref, value, opts) => writes.push(() => data.set(ref.id, opts?.merge ? { ...data.get(ref.id), ...value } : value)) });
      writes.forEach(fn => fn()); return result;
    }); queue = execution.catch(() => {}); return execution;
  } };
}
test('P07 duas requisições da mesma recompensa descontam uma única vez', async () => {
  const db = storeFixture({ user: { xp: 100, xpGasto: 0 }, reward: { custoXp: 30, completed: false } });
  const call = () => claimReward(db.run, { id: 'user' }, { id: 'reward' }, { id: 'receipt' }, () => 1);
  const result = await Promise.all([call(), call()]);
  assert.equal(db.data.get('user').xpGasto, 30); assert.equal(db.data.get('reward').completed, true); assert.equal(db.data.get('receipt').cost, 30); assert.equal(result.filter(r => r.repeated).length, 1);
});
test('P07 saldo fresco insuficiente não grava parcialmente', async () => {
  const db = storeFixture({ user: { xp: 20, xpGasto: 0 }, reward: { custoXp: 30, completed: false } });
  await assert.rejects(claimReward(db.run, { id: 'user' }, { id: 'reward' }, { id: 'receipt' }), /XP insuficiente/);
  assert.equal(db.data.get('user').xpGasto, 0); assert.equal(db.data.get('reward').completed, false); assert.ok(!db.data.has('receipt'));
});
test('P07 disputa de recibo negada pelas regras reconcilia o resgate já confirmado', async () => {
  let attempts = 0, writes = 0;
  const data = { user: { xp: 100, xpGasto: 30 }, reward: { completed: true }, receipt: { cost: 30 } };
  const run = async fn => {
    if (++attempts === 1) throw Object.assign(new Error('Receipt race'), { code: 'permission-denied' });
    return fn({ get: async ref => ({ exists: () => true, data: () => data[ref.id] }), set: () => writes++, update: () => writes++ });
  };
  const result = await claimReward(run, { id: 'user' }, { id: 'reward' }, { id: 'receipt' });
  assert.equal(result.repeated, true); assert.equal(result.spent, 30); assert.equal(writes, 0); assert.equal(attempts, 2);
});
test('P08 verificações de retomada e relógio existem e são serializadas', async () => {
  const windowHandlers = {}, pageHandlers = {}; let tick, count = 0;
  const win = { addEventListener: (n, f) => windowHandlers[n] = f, removeEventListener() {} };
  const page = { visibilityState: 'visible', addEventListener: (n, f) => pageHandlers[n] = f, removeEventListener() {} };
  installDayWatch(async () => { count++; }, { win, page, interval: fn => { tick = fn; return 0; } });
  await windowHandlers.focus(); await pageHandlers.visibilitychange(); await tick(); assert.equal(count, 3);
  page.visibilityState = 'hidden'; await tick(); assert.equal(count, 3);
});
test('M08 datas inválidas não viram pausa e dias programados preservam sequência', () => {
  assert.equal(calendarDate('2026-02-31'), null);
  assert.throws(() => validateRoutine({ restWeekdays: [8] }));
  assert.throws(() => validateRoutine({ restWeekdays: [], pauseStart: '2026-11-03', pauseEnd: '2026-11-01' }));
  const routine = validateRoutine({ restWeekdays: [0, 6], pauseStart: '', pauseEnd: '' });
  assert.ok(isRestDay('2026-11-01', routine));
  assert.equal(nextStreak({ ultimoAcesso: '2026-10-30', sequencia: 5, routine }, '2026-11-02').count, 6);
  assert.equal(nextStreak({ ultimoAcesso: '2026-10-30', sequencia: 5, routine }, '2026-11-01').count, 5);
});
test('M08 pausa com início e fim não premia descanso e retoma no próximo dia ativo', () => {
  const routine = validateRoutine({ restWeekdays: [], pauseStart: '2026-11-01', pauseEnd: '2026-11-05' });
  assert.equal(nextStreak({ ultimoAcesso: '2026-10-31', sequencia: 4, routine }, '2026-11-04').count, 4);
  assert.equal(nextStreak({ ultimoAcesso: '2026-10-31', sequencia: 4, routine }, '2026-11-06').count, 5);
});
test('M07 treino estruturado guarda séries/repetições/carga e permite comparar sessões', () => {
  const first = validateWorkout({ name: 'Treino fictício', exercises: [{ name: 'Remada', sets: 3, reps: 10, load: '12,5' }] });
  const second = validateWorkout({ ...first, exercises: [{ ...first.exercises[0], load: 15 }] });
  assert.equal(trainingVolume(first.exercises), 375); assert.equal(trainingVolume(second.exercises), 450); assert.equal(first.exercises[0].load, 12.5);
  for (const exercise of [{ sets: 0 }, { reps: Infinity }, { load: -1 }]) assert.throws(() => validateWorkout({ ...first, exercises: [{ ...first.exercises[0], ...exercise }] }));
  assert.throws(() => validateWorkout({ name: 'Vazio', exercises: [] }));
  assert.equal(validateWorkout({ name: 'Limite', exercises: Array(8).fill(first.exercises[0]) }).exercises.length, 8);
  assert.throws(() => validateWorkout({ name: 'Acima do limite', exercises: Array(9).fill(first.exercises[0]) }));
});
