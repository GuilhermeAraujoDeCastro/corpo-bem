// Testes das contas puras do app (js/calculos.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  usuarioValido, formatarNumero, horaHabitual, adicionarHora, gradeSequencia,
  PLANOS, treinoDaVez, metasSugeridas, imc, csvPesos, saldoXp, temaPorHorario,
} from '../js/calculos.js';

test('usuarioValido aceita só o que vira e-mail interno válido', () => {
  assert.equal(usuarioValido('claudio'), true);
  assert.equal(usuarioValido('Ana.Silva_1'), true);
  assert.equal(usuarioValido('jo'), false);
  assert.equal(usuarioValido('joão'), false);
  assert.equal(usuarioValido('com espaço'), false);
  assert.equal(usuarioValido(''), false);
  assert.equal(usuarioValido(null), false);
});

test('formatarNumero corta o ruído de ponto flutuante', () => {
  assert.equal(formatarNumero(0.1 + 0.2), '0,3');
  assert.equal(formatarNumero(2500), '2.500');
  assert.equal(formatarNumero('abc'), '0');
});

test('horaHabitual usa a mediana e pede pelo menos 3 registros', () => {
  assert.equal(horaHabitual([7, 8]), null);
  assert.equal(horaHabitual([7, 8, 22]), 8);
  assert.equal(horaHabitual([6, 7, 9, 10]), 8);
  assert.equal(horaHabitual([7, 'x', 8, 9.5, 9]), 8);
});

test('adicionarHora guarda só as últimas N', () => {
  assert.deepEqual(adicionarHora(undefined, 7), [7]);
  assert.deepEqual(adicionarHora([1, 2, 3], 4, 3), [2, 3, 4]);
});

test('gradeSequencia monta 12 semanas terminando hoje', () => {
  const hoje = new Date(2026, 8, 23); // quarta, 23/09/2026
  const grade = gradeSequencia(['2026-09-23', '2026-09-20', '2020-01-01'], hoje);
  assert.equal(grade.length, 12);
  grade.forEach((semana) => assert.equal(semana.length, 7));
  const dias = grade.flat();
  assert.equal(dias[0].data, '2026-07-05'); // domingo, 11 semanas antes
  assert.equal(dias.filter((d) => d.ativo).length, 2);
  const ultima = grade[11];
  assert.equal(ultima[3].data, '2026-09-23');
  assert.equal(ultima[3].futuro, false);
  assert.equal(ultima[4].futuro, true);
});

test('treinoDaVez gira pela sequência do plano', () => {
  assert.equal(treinoDaVez('abc', 0).nome, PLANOS.abc.treinos[0].nome);
  assert.equal(treinoDaVez('abc', 3).posicao, 0);
  assert.equal(treinoDaVez('ppl', 4).nome, PLANOS.ppl.treinos[1].nome);
  assert.equal(treinoDaVez('fullbody', 1).total, 2);
  assert.equal(treinoDaVez('inexistente', 0), null);
});

test('metasSugeridas muda com o objetivo e sempre inclui água', () => {
  for (const objetivo of ['perder', 'ganhar', 'manter', undefined]) {
    const metas = metasSugeridas(objetivo);
    assert.ok(metas.some((m) => m.unit === 'ml' && m.isDaily));
  }
  assert.ok(metasSugeridas('ganhar').some((m) => m.unit === 'reps'));
  assert.ok(metasSugeridas('perder').some((m) => m.unit === 'km'));
});

test('imc arredonda em 1 casa e rejeita valores inválidos', () => {
  assert.equal(imc(80, 1.8), 24.7);
  assert.equal(imc('70', '1.75'), 22.9);
  assert.equal(imc(0, 1.8), null);
  assert.equal(imc(80, ''), null);
});

test('csvPesos ordena por data e usa vírgula decimal', () => {
  const csv = csvPesos([{ date: '2026-09-10', weight: 79.5 }, { date: '2026-09-01', weight: 81 }], 1.8);
  const linhas = csv.split('\r\n');
  assert.equal(linhas[0], 'Data;Peso (kg);IMC');
  assert.equal(linhas[1], '2026-09-01;81;25');
  assert.equal(linhas[2], '2026-09-10;79,5;24,5');
  assert.equal(csvPesos([{ date: '2026-09-01', weight: 81 }], null).split('\r\n')[1], '2026-09-01;81;');
});

test('saldoXp nunca fica negativo', () => {
  assert.equal(saldoXp(500, 200), 300);
  assert.equal(saldoXp(100, 300), 0);
  assert.equal(saldoXp(undefined, undefined), 0);
});

test('temaPorHorario escurece das 19h às 6h', () => {
  assert.equal(temaPorHorario(18), 'light');
  assert.equal(temaPorHorario(19), 'dark');
  assert.equal(temaPorHorario(5), 'dark');
  assert.equal(temaPorHorario(6), 'light');
});
