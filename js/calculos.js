// Contas do app sem DOM nem Firebase (testadas em testes/*.test.mjs).

// Nome de usuário vira e-mail interno (usuario@webtreino.local): só letras sem acento, números, ponto, _ e -.
export function usuarioValido(nome) {
  return /^[a-z0-9._-]{3,20}$/.test(String(nome || '').trim().toLowerCase());
}

// Número com no máximo 2 casas (evita 0.30000000000000004 km na tela).
export function formatarNumero(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

// Mediana das horas em que a pessoa costuma registrar treino (null sem dados suficientes).
export function horaHabitual(horas) {
  const lista = (horas || []).filter((h) => Number.isInteger(h)).sort((a, b) => a - b);
  if (lista.length < 3) return null;
  const meio = Math.floor(lista.length / 2);
  return lista.length % 2 ? lista[meio] : Math.round((lista[meio - 1] + lista[meio]) / 2);
}

// Guarda só as últimas N horas registradas.
export function adicionarHora(horas, hora, limite = 14) {
  return [...(horas || []), hora].slice(-limite);
}

function dataLocal(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

// Grade estilo "contribuições do GitHub": colunas = semanas, linhas = dom..sáb, terminando hoje.
export function gradeSequencia(diasAtivos, hoje = new Date(), semanas = 12) {
  const ativos = new Set(diasAtivos);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - fim.getDay() - (semanas - 1) * 7);
  const colunas = [];
  for (let s = 0; s < semanas; s++) {
    const coluna = [];
    for (let d = 0; d < 7; d++) {
      const dia = new Date(inicio);
      dia.setDate(inicio.getDate() + s * 7 + d);
      const texto = dataLocal(dia);
      coluna.push({ data: texto, ativo: ativos.has(texto), futuro: dia > fim });
    }
    colunas.push(coluna);
  }
  return colunas;
}

// Planos prontos: a sequência se repete (A, B, C, A...).
export const PLANOS = {
  abc: { nome: 'ABC', treinos: [
    { nome: 'A · Peito e tríceps', exercicios: ['Supino 4x10', 'Crucifixo 3x12', 'Tríceps corda 3x12', 'Flexão 3x até falhar'] },
    { nome: 'B · Costas e bíceps', exercicios: ['Puxada 4x10', 'Remada 3x12', 'Rosca direta 3x12', 'Prancha 3x40s'] },
    { nome: 'C · Pernas e ombros', exercicios: ['Agachamento 4x10', 'Leg press 3x12', 'Desenvolvimento 3x10', 'Elevação lateral 3x12'] },
  ] },
  ppl: { nome: 'Push / Pull / Legs', treinos: [
    { nome: 'Push · empurrar', exercicios: ['Supino 4x8', 'Desenvolvimento 3x10', 'Paralelas 3x10', 'Tríceps 3x12'] },
    { nome: 'Pull · puxar', exercicios: ['Barra fixa 4x8', 'Remada curvada 3x10', 'Face pull 3x15', 'Rosca 3x12'] },
    { nome: 'Legs · pernas', exercicios: ['Agachamento 4x8', 'Stiff 3x10', 'Afundo 3x12', 'Panturrilha 4x15'] },
  ] },
  fullbody: { nome: 'Corpo inteiro (3x por semana)', treinos: [
    { nome: 'Full body · dia 1', exercicios: ['Agachamento 3x10', 'Flexão 3x12', 'Remada 3x12', 'Prancha 3x30s'] },
    { nome: 'Full body · dia 2', exercicios: ['Levantamento terra 3x8', 'Desenvolvimento 3x10', 'Afundo 3x10', 'Abdominal 3x15'] },
  ] },
};

export function treinoDaVez(chave, indice = 0) {
  const plano = PLANOS[chave];
  if (!plano) return null;
  const posicao = ((indice % plano.treinos.length) + plano.treinos.length) % plano.treinos.length;
  return { ...plano.treinos[posicao], posicao, total: plano.treinos.length };
}

// Metas que o onboarding sugere pra cada objetivo.
export function metasSugeridas(objetivo) {
  const agua = { text: 'Beber água', target: 2000, unit: 'ml', isDaily: true };
  const sono = { text: 'Dormir bem', target: 8, unit: 'sono', isDaily: true };
  const porObjetivo = {
    perder: [{ text: 'Caminhar ou correr', target: 5, unit: 'km', isDaily: true }, agua, sono],
    ganhar: [{ text: 'Flexões', target: 50, unit: 'reps', isDaily: true }, agua, sono],
    manter: [{ text: 'Caminhar', target: 3, unit: 'km', isDaily: true }, agua, sono],
  };
  return porObjetivo[objetivo] || [agua];
}

export function imc(peso, altura) {
  const p = parseFloat(peso);
  const a = parseFloat(altura);
  return p > 0 && a > 0 ? +(p / (a * a)).toFixed(1) : null;
}

// Histórico de peso em CSV (separado por ";", abre direto no Excel em português).
export function csvPesos(pesos, altura) {
  const linhas = [...pesos]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((p) => [p.date, String(p.weight).replace('.', ','), String(imc(p.weight, altura) ?? '').replace('.', ',')]);
  return [['Data', 'Peso (kg)', 'IMC'], ...linhas].map((l) => l.join(';')).join('\r\n');
}

// XP que ainda dá pra gastar na lojinha.
export function saldoXp(xp, gasto) {
  return Math.max(0, (xp || 0) - (gasto || 0));
}

// Tema "automático": escuro das 19h às 6h.
export function temaPorHorario(hora) {
  return hora >= 19 || hora < 6 ? 'dark' : 'light';
}
