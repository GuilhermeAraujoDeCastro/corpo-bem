// Plano de treino pronto (ABC, Push/Pull/Legs, corpo inteiro): mostra o treino da vez
// e avança a sequência quando a pessoa marca que treinou.
import { db, doc, setDoc, collection, addDoc } from './firebase-config.js';
import { state, getLocalDateStr } from './state.js';
import { showToast, showCelebrationBanner, celebrate } from './ui.js';
import { PLANOS, treinoDaVez } from './calculos.js';
import { registrarHabito } from './goals.js';

export function renderPlano() {
  const caixa = document.getElementById('plano-card');
  if (!caixa) return;
  const plano = state.userData.plano;
  if (!plano || !PLANOS[plano.tipo]) {
    caixa.innerHTML = `
      <p class="card-title">🏋️ Plano de treino</p>
      <p class="empty-state-hint">Escolha um plano e o app sugere o treino do dia, na ordem.</p>
      <div class="plano-opcoes">
        ${Object.entries(PLANOS).map(([chave, p]) => `<button type="button" class="btn-small" onclick="escolherPlano('${chave}')">${p.nome}</button>`).join('')}
      </div>`;
    return;
  }
  const treino = treinoDaVez(plano.tipo, plano.indice || 0);
  const treinouHoje = plano.ultimoTreino === getLocalDateStr();
  caixa.innerHTML = `
    <div class="plano-topo">
      <p class="card-title">🏋️ ${treinouHoje ? 'Treino de hoje feito!' : 'Treino da vez'}</p>
      <button type="button" class="btn-link" onclick="trocarPlano()">Trocar plano</button>
    </div>
    <p class="plano-nome">${treino.nome} <span class="badge-pill">${treino.posicao + 1}/${treino.total}</span></p>
    <ul class="plano-exercicios">${treino.exercicios.map(e => `<li>${e}</li>`).join('')}</ul>
    <button type="button" class="btn-primary" onclick="concluirTreino()" ${treinouHoje ? 'disabled' : ''}>${treinouHoje ? 'Volte amanhã pro próximo' : '✅ Fiz esse treino'}</button>`;
}

async function salvarPlano(plano) {
  state.userData.plano = plano;
  await setDoc(doc(db, 'users', state.currentUser.uid), { plano }, { merge: true });
  renderPlano();
}

window.escolherPlano = async function (tipo) {
  if (!state.currentUser || !PLANOS[tipo]) return;
  try {
    await salvarPlano({ tipo, indice: 0, ultimoTreino: null });
    showToast(`Plano ${PLANOS[tipo].nome} escolhido!`, 'success');
  } catch (e) { console.error(e); showToast('Não consegui salvar o plano.', 'error'); }
};

window.trocarPlano = async function () {
  if (!state.currentUser) return;
  state.userData.plano = null;
  await setDoc(doc(db, 'users', state.currentUser.uid), { plano: null }, { merge: true });
  renderPlano();
};

// Marca o treino como feito: entra no histórico (conta pro calendário e pro resumo) e avança a vez.
window.concluirTreino = async function () {
  const plano = state.userData.plano;
  if (!state.currentUser || !plano) return;
  const hoje = getLocalDateStr();
  if (plano.ultimoTreino === hoje) return;
  const treino = treinoDaVez(plano.tipo, plano.indice || 0);
  try {
    await addDoc(collection(db, 'users', state.currentUser.uid, 'progressLogs'), {
      goalId: 'plano', text: treino.nome, amount: 1, unit: 'treino', date: hoje, hora: new Date().getHours(), completed: true,
    });
    await salvarPlano({ ...plano, indice: (plano.indice || 0) + 1, ultimoTreino: hoje });
    await registrarHabito(new Date().getHours()); // também atualiza o calendário
    celebrate();
    showCelebrationBanner('💪 Treino registrado!');
  } catch (e) { console.error(e); showToast('Não consegui registrar o treino.', 'error'); }
};
