// Testes da function de lembretes (api/send-reminders.js) sem tocar no Firebase de verdade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { agoraEmSaoPaulo, lembretesDaHora } from '../api/send-reminders.js';

function resposta() {
  return {
    codigo: 0, corpo: null,
    status(c) { this.codigo = c; return this; },
    json(c) { this.corpo = c; return this; },
  };
}

test('agoraEmSaoPaulo converte UTC pro horário de Brasília', () => {
  assert.deepEqual(agoraEmSaoPaulo(new Date('2026-09-23T02:30:00Z')), { hora: 23, dia: '2026-09-22' });
  assert.deepEqual(agoraEmSaoPaulo(new Date('2026-09-23T15:00:00Z')), { hora: 12, dia: '2026-09-23' });
});

test('água: a cada 2h entre 8h e 22h, só pra quem ativou', () => {
  const usuario = { reminders: { water: true } };
  assert.equal(lembretesDaHora(usuario, { hora: 10, dia: 'x' }).length, 1);
  assert.equal(lembretesDaHora(usuario, { hora: 11, dia: 'x' }).length, 0);
  assert.equal(lembretesDaHora(usuario, { hora: 6, dia: 'x' }).length, 0);
  assert.equal(lembretesDaHora({ reminders: {} }, { hora: 10, dia: 'x' }).length, 0);
});

test('meta: 20h normalmente, meio-dia pra quem treina de manhã e não registrou', () => {
  const tarde = { reminders: { goal: true }, horaHabitual: 18 };
  const cedo = { reminders: { goal: true }, horaHabitual: 7 };
  assert.equal(lembretesDaHora(tarde, { hora: 20, dia: '2026-09-23' }).length, 1);
  assert.equal(lembretesDaHora(tarde, { hora: 12, dia: '2026-09-23' }).length, 0);
  assert.equal(lembretesDaHora(cedo, { hora: 12, dia: '2026-09-23' }).length, 1);
  assert.equal(lembretesDaHora({ ...cedo, ultimoRegistro: '2026-09-23' }, { hora: 12, dia: '2026-09-23' }).length, 0);
});

test('sem o segredo certo a function responde 401', async () => {
  process.env.CRON_SECRET = 'segredo-de-teste';
  const r1 = resposta();
  await handler({ headers: {} }, r1);
  assert.equal(r1.codigo, 401);
  const r2 = resposta();
  await handler({ headers: { authorization: 'Bearer errado' } }, r2);
  assert.equal(r2.codigo, 401);
  delete process.env.CRON_SECRET;
  const r3 = resposta();
  await handler({ headers: { authorization: 'Bearer ' } }, r3);
  assert.equal(r3.codigo, 401, 'sem CRON_SECRET configurado ninguém passa');
});

test('com o segredo mas sem VAPID, avisa a configuração que falta', async () => {
  process.env.CRON_SECRET = 'segredo-de-teste';
  delete process.env.VAPID_PUBLIC_KEY;
  const r = resposta();
  await handler({ headers: { authorization: 'Bearer segredo-de-teste' } }, r);
  assert.equal(r.codigo, 500);
  assert.match(r.corpo.error, /VAPID/);
  delete process.env.CRON_SECRET;
});
