import { db, doc, setDoc } from './firebase-config.js';
import { state, getLocalDateStr, captureSession, isCurrentSession } from './state.js';
import { validateRoutine, isRestDay } from './routine-domain.js';
import { loadGoals } from './goals.js';
import { showToast } from './ui.js';
export { installDayWatch } from './day-watch.js';
export async function renderRoutine() {
  const session = captureSession();
  const box = document.getElementById('routine-card'); if (!box || !state.currentUser) return;
  const routine = state.userData.routine || { restWeekdays: [], pauseStart: '', pauseEnd: '' };
  box.innerHTML = `<h3>Descanso e pausas</h3><p id="routine-status" role="status">${isRestDay(getLocalDateStr(), routine) ? 'Hoje é descanso planejado. A sequência é preservada e as metas diárias reabrem no próximo dia ativo.' : 'Hoje é um dia ativo. As datas seguem o fuso deste aparelho.'}</p>
    <form id="routine-form"><fieldset><legend>Dias de descanso na semana</legend>${['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map((name, i) => `<label><input type="checkbox" name="rest-day" value="${i}" ${routine.restWeekdays.includes(i) ? 'checked' : ''}> ${name}</label>`).join('')}</fieldset>
    <label for="pause-start">Pausa: início (opcional)</label><input id="pause-start" type="date" value="${routine.pauseStart || ''}">
    <label for="pause-end">Pausa: fim, inclusive</label><input id="pause-end" type="date" value="${routine.pauseEnd || ''}">
    <p>Limpe as duas datas para encerrar a pausa. Descanso não concede XP. Você ainda pode registrar um treino personalizado opcional.</p>
    <button class="btn-primary" type="submit">Salvar agenda</button></form>`;
  box.querySelector('form').onsubmit = async event => {
    event.preventDefault(); if (!isCurrentSession(session)) return; const uid = state.currentUser?.uid; if (!uid) return;
    const button = event.submitter; button.disabled = true;
    try {
      if (navigator.onLine === false) throw new Error('Conecte-se para salvar a agenda.');
      const next = validateRoutine({ restWeekdays: [...box.querySelectorAll('[name="rest-day"]:checked')].map(input => Number(input.value)), pauseStart: box.querySelector('#pause-start').value, pauseEnd: box.querySelector('#pause-end').value });
      await setDoc(doc(db, 'users', uid), { routine: next }, { merge: true });
      if (!isCurrentSession(session)) return;
      state.userData.routine = next; await loadGoals(); await renderRoutine(); showToast('Agenda salva.', 'success');
    } catch (err) { if (isCurrentSession(session)) { showToast(err.message, 'error'); button.disabled = false; } }
  };
}
