import { db, doc, collection, getDocs, setDoc, runTransaction } from './firebase-config.js';
import { state, getLocalDateStr, captureSession, isCurrentSession } from './state.js';
import { validateWorkout, trainingVolume } from './routine-domain.js';
import { registrarHabito, resetDailyGoals } from './goals.js';
import { showToast } from './ui.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let editingId = null, editingCreated = null;
export async function renderWorkouts() {
  const session = captureSession(), uid = session.uid, box = document.getElementById('workouts-card'); if (!uid || !box) return;
  try {
    const [templates, sessions] = await Promise.all([getDocs(collection(db, 'users', uid, 'workouts')), getDocs(collection(db, 'users', uid, 'workoutSessions'))]);
    if (!isCurrentSession(session)) return;
    const workouts = templates.docs.map(s => ({ id: s.id, ...s.data() }));
    const history = sessions.docs.map(s => ({ id: s.id, ...s.data() })).sort((a, b) => b.createdAt - a.createdAt);
    box.innerHTML = `<h3>Meus treinos</h3><p>Crie exercícios com séries, repetições e carga em kg. Os modelos prontos continuam disponíveis acima.</p>
      <div class="custom-workout-list">${workouts.map(w => `<button class="btn-small" data-edit-workout="${esc(w.id)}">${esc(w.name)}</button>`).join('') || '<p>Nenhum treino personalizado salvo.</p>'}<button class="btn-secondary" id="new-workout">Novo treino</button></div><div id="workout-editor"></div>
      <h4>Evolução registrada</h4><p>Volume = séries × repetições × carga. Cada registro mantém os exercícios e cargas usados naquele dia.</p><div class="table-scroll"><table><thead><tr><th>Data</th><th>Treino e exercícios</th><th>Volume (kg)</th><th>Registro anterior do treino</th></tr></thead><tbody>${history.slice(0, 30).map((session, i) => {
        const previous = history.slice(i + 1).find(s => s.workoutId === session.workoutId);
        const volume = trainingVolume(session.exercises);
        return `<tr><td>${esc(session.date)}</td><td>${esc(session.name)}<ul>${session.exercises.map(e => `<li>${esc(e.name)}: ${e.sets} × ${e.reps}, ${e.load} kg</li>`).join('')}</ul></td><td>${volume.toLocaleString('pt-BR')}</td><td>${previous ? `${previous.date}: ${trainingVolume(previous.exercises).toLocaleString('pt-BR')} kg` : 'Primeiro registro'}</td></tr>`;
      }).join('') || '<tr><td colspan="4">Nenhum treino registrado.</td></tr>'}</tbody></table></div>`;
    box.querySelectorAll('[data-edit-workout]').forEach(button => { button.onclick = () => { if (isCurrentSession(session)) openEditor(workouts.find(w => w.id === button.dataset.editWorkout)); }; });
    box.querySelector('#new-workout').onclick = () => { if (isCurrentSession(session)) openEditor(); };
    return true;
  } catch { if (isCurrentSession(session)) box.textContent = 'Não foi possível carregar seus treinos. Confira a conexão e tente entrar novamente.'; return false; }
}
function openEditor(workout) {
  const session = captureSession();
  editingId = workout?.id || null; editingCreated = workout?.createdAt || null;
  const box = document.getElementById('workout-editor');
  box.innerHTML = `<form id="custom-workout-form"><h4>${workout ? 'Editar ou repetir treino' : 'Novo treino personalizado'}</h4><label for="workout-name">Nome do treino</label><input id="workout-name" maxlength="80" required value="${esc(workout?.name || '')}"><div id="exercise-rows"></div><button type="button" class="btn-secondary" id="add-exercise">Adicionar exercício</button><p id="workout-message" aria-live="polite">Altere as cargas antes de registrar a sessão. Salvar modelo não registra treino.</p><button class="btn-primary" type="submit">Salvar modelo</button> <button class="btn-secondary" id="record-workout" type="button" ${editingId ? '' : 'disabled'}>Registrar treino de hoje</button></form>`;
  const initial = workout?.exercises || [{ name: '', sets: 3, reps: 10, load: 0 }];
  initial.forEach(addExercise);
  box.querySelector('#add-exercise').onclick = () => { if (box.querySelectorAll('.exercise-row').length < 8) addExercise({ name: '', sets: 3, reps: 10, load: 0 }); else showToast('Máximo de 8 exercícios por treino.', 'info'); };
  box.querySelector('form').onsubmit = event => { if (isCurrentSession(session)) return saveTemplate(event); event.preventDefault(); };
  box.querySelector('#record-workout').onclick = event => { if (isCurrentSession(session)) return recordSession(event); };
  box.querySelector('#workout-name').focus();
}
function addExercise(exercise) {
  const box = document.getElementById('exercise-rows'), row = document.createElement('fieldset'); row.className = 'exercise-row';
  const id = crypto.randomUUID();
  row.innerHTML = `<legend>Exercício</legend><label for="name-${id}">Nome</label><input id="name-${id}" data-field="name" maxlength="80" required value="${esc(exercise.name)}"><div class="workout-numbers">${[['sets','Séries',1,100,exercise.sets],['reps','Repetições',1,1000,exercise.reps],['load','Carga (kg)',0,2000,exercise.load]].map(([field,label,min,max,value]) => `<label for="${field}-${id}">${label}<input id="${field}-${id}" data-field="${field}" type="number" min="${min}" max="${max}" step="${field === 'load' ? '0.1' : '1'}" value="${value}" required></label>`).join('')}</div><button class="btn-small" type="button" aria-label="Remover exercício">Remover exercício</button>`;
  row.querySelector('button').onclick = () => row.remove(); box.appendChild(row);
}
function formWorkout() {
  return validateWorkout({ name: document.getElementById('workout-name').value, exercises: [...document.querySelectorAll('.exercise-row')].map(row => Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input => [input.dataset.field, input.value]))) });
}
function busyControls(busy) {
  document.querySelectorAll('#workout-editor input, #workout-editor button, .custom-workout-list button').forEach(control => { control.disabled = busy; });
  const record = document.getElementById('record-workout');
  if (record) record.disabled = busy || !editingId;
}
async function saveTemplate(event) {
  event.preventDefault(); const session = captureSession(), uid = session.uid; if (!uid) return;
  const button = event.submitter; busyControls(true); button.textContent = 'Salvando modelo…';
  try {
    if (navigator.onLine === false) throw new Error('Conecte-se para salvar.');
    const data = formWorkout(), id = editingId || crypto.randomUUID(), createdAt = editingCreated || Date.now();
    await setDoc(doc(db, 'users', uid, 'workouts', id), { ...data, createdAt, updatedAt: Date.now() });
    if (!isCurrentSession(session)) return;
    editingId = id; editingCreated = createdAt;
    const loaded = await renderWorkouts();
    if (!isCurrentSession(session)) return;
    if (!loaded) { showToast('Modelo salvo, mas a lista não carregou. Reabra a página para consultar o treino.', 'info'); return; }
    openEditor({ ...data, id, createdAt });
    document.getElementById('workout-message').textContent = 'Modelo salvo. Você pode registrar a sessão com os valores preenchidos.';
  } catch (err) { if (isCurrentSession(session)) showToast(err.message, 'error'); }
  finally { if (isCurrentSession(session)) { busyControls(false); button.textContent = 'Salvar modelo'; } }
}
let recording = false;
async function recordSession(event) {
  if (recording || !editingId || !state.currentUser) return;
  const session = captureSession(), uid = session.uid, workoutId = editingId, button = event.currentTarget;
  recording = true; busyControls(true); button.textContent = 'Registrando treino…';
  try {
    if (navigator.onLine === false) throw new Error('Conecte-se para registrar o treino.');
    const data = formWorkout(), date = getLocalDateStr(), sessionRef = doc(collection(db, 'users', uid, 'workoutSessions'));
    await resetDailyGoals();
    await runTransaction(db, async tx => {
      const template = await tx.get(doc(db, 'users', uid, 'workouts', workoutId));
      if (!template.exists()) throw new Error('Salve o modelo antes de registrar.');
      tx.set(sessionRef, { ...data, workoutId, date, createdAt: Date.now() });
      tx.set(doc(db, 'users', uid, 'progressLogs', sessionRef.id), { goalId: workoutId, text: data.name, amount: 1, unit: 'treino', date, hora: new Date().getHours(), completed: true });
    });
    if (!isCurrentSession(session)) return;
    await registrarHabito(new Date().getHours()); if (!isCurrentSession(session)) return; await renderWorkouts(); showToast('Treino registrado com exercícios e cargas de hoje.', 'success');
  } catch (err) { if (isCurrentSession(session)) showToast('Treino não confirmado: ' + err.message, 'error'); }
  finally { recording = false; if (isCurrentSession(session)) { busyControls(false); button.textContent = 'Registrar treino de hoje'; } }
}
