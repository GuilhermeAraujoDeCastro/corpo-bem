export function targetValue(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value).trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return null;
  const result = Number(text.replace(',', '.'));
  return Number.isFinite(result) && result > 0 && result <= 1e6 ? result : null;
}
export function calendarDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text || '')) return null;
  const date = new Date(text + 'T12:00:00');
  return !Number.isNaN(date.getTime()) && `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` === text ? date : null;
}
export function isRestDay(day, routine = {}) {
  const date = calendarDate(day); if (!date) throw new Error('Data inválida.');
  return (routine.restWeekdays || []).includes(date.getDay()) || !!(routine.pauseStart && routine.pauseEnd && day >= routine.pauseStart && day <= routine.pauseEnd);
}
export function validateRoutine(routine) {
  if (!routine || !Array.isArray(routine.restWeekdays) || routine.restWeekdays.length > 7 || routine.restWeekdays.some(n => !Number.isInteger(n) || n < 0 || n > 6)) throw new Error('Dias de descanso inválidos.');
  if (routine.pauseStart || routine.pauseEnd) {
    if (!calendarDate(routine.pauseStart) || !calendarDate(routine.pauseEnd) || routine.pauseEnd < routine.pauseStart) throw new Error('Informe início e fim válidos para a pausa.');
  }
  return { restWeekdays: [...new Set(routine.restWeekdays)].sort(), pauseStart: routine.pauseStart || '', pauseEnd: routine.pauseEnd || '' };
}
export function nextStreak(user, today) {
  const last = calendarDate(user.ultimoAcesso), now = calendarDate(today);
  if (!now) throw new Error('Data inválida.');
  if (user.ultimoAcesso === today) return { count: user.sequencia || 0, usedFreeze: false };
  if (last && last > now) return { count: user.sequencia || 0, usedFreeze: false };
  if (!last) return { count: isRestDay(today, user.routine) ? 0 : 1, usedFreeze: false };
  let missed = 0;
  const day = new Date(last);
  for (let i = 0; i < 3660; i++) {
    day.setDate(day.getDate() + 1); if (day >= now) break;
    const key = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
    if (!isRestDay(key, user.routine)) missed++;
  }
  const freeze = calendarDate(user.streakFreezeUsedEm);
  const canFreeze = !freeze || (now - freeze) / 86400000 >= 7;
  const usedFreeze = missed === 1 && canFreeze && (user.sequencia || 0) > 0;
  const kept = missed === 0 || usedFreeze;
  return { count: (kept ? (user.sequencia || 0) : 0) + (isRestDay(today, user.routine) ? 0 : 1), usedFreeze };
}
export function validateWorkout(workout) {
  const name = String(workout.name || '').trim();
  if (!name || name.length > 80 || !Array.isArray(workout.exercises) || !workout.exercises.length || workout.exercises.length > 8) throw new Error('Informe nome e de 1 a 8 exercícios.');
  const exercises = workout.exercises.map(e => {
    const title = String(e.name || '').trim(), sets = Number(e.sets), reps = Number(e.reps), load = Number(String(e.load).replace(',', '.'));
    if (!title || title.length > 80 || !Number.isInteger(sets) || sets < 1 || sets > 100 || !Number.isInteger(reps) || reps < 1 || reps > 1000 || !Number.isFinite(load) || load < 0 || load > 2000) throw new Error('Exercício inválido: séries 1 a 100, repetições 1 a 1000 e carga 0 a 2000 kg.');
    return { name: title, sets, reps, load };
  });
  return { name, exercises };
}
export const trainingVolume = exercises => exercises.reduce((total, e) => total + e.sets * e.reps * e.load, 0);
