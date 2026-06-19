// Firebase "de mentira" pros testes E2E: Auth + Firestore modulares em memória, salvos no
// localStorage (sobrevivem a recarregar a página, como a sessão do Firebase de verdade).
// O Playwright serve este arquivo no lugar de firebase-app.js, firebase-auth.js e firebase-firestore.js.
// Os três URLs viram três módulos separados, então o estado fica compartilhado em globalThis.
const CHAVE = '__fakeFirebase';
const compartilhado = globalThis.__fakeFb || (globalThis.__fakeFb = (() => {
  let salvo = {};
  try { salvo = JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { /* vazio */ }
  const banco = { contas: salvo.contas || {}, docs: salvo.docs || {}, atual: salvo.atual || null, proximo: salvo.proximo || 1 };
  return { banco, ouvintes: [], authObj: { currentUser: null } };
})());
const { banco, ouvintes, authObj } = compartilhado;
const persistir = () => localStorage.setItem(CHAVE, JSON.stringify(banco));
const falha = (code) => Promise.reject(Object.assign(new Error(code), { code }));

function usuario(email) {
  const conta = banco.contas[email];
  return conta ? { uid: conta.uid, email, displayName: conta.nome || null } : null;
}
function trocarUsuario(email) {
  banco.atual = email;
  persistir();
  const u = usuario(email);
  authObj.currentUser = u;
  ouvintes.forEach((fn) => setTimeout(() => fn(u), 0));
  return u;
}

// ===== App =====
export function initializeApp(config) { return { options: config }; }

// ===== Auth =====
if (banco.atual && !authObj.currentUser) authObj.currentUser = usuario(banco.atual);
export function getAuth() { return authObj; }
export function onAuthStateChanged(auth, fn) {
  ouvintes.push(fn);
  setTimeout(() => fn(authObj.currentUser), 0);
  return () => {};
}
export async function createUserWithEmailAndPassword(auth, email, senha) {
  if (banco.contas[email]) return falha('auth/email-already-in-use');
  if (senha.length < 6) return falha('auth/weak-password');
  banco.contas[email] = { uid: 'uid' + banco.proximo++, senha, nome: null };
  return { user: trocarUsuario(email) };
}
export async function signInWithEmailAndPassword(auth, email, senha) {
  const conta = banco.contas[email];
  if (!conta || conta.senha !== senha) return falha('auth/invalid-credential');
  return { user: trocarUsuario(email) };
}
export async function updateProfile(user, dados) {
  banco.contas[user.email].nome = dados.displayName;
  user.displayName = dados.displayName;
  persistir();
}
export async function signOut() { trocarUsuario(null); }
export async function sendPasswordResetEmail() { window.__resetEnviado = true; }
export class GoogleAuthProvider {}
export async function signInWithPopup() { return falha('auth/popup-closed-by-user'); }

// ===== Firestore (mesmas regras do firestore.rules) =====
export function getFirestore() { return {}; }
const caminhoDe = (partes) => partes.filter((p) => typeof p === 'string').join('/');
export function doc(base, ...partes) {
  const caminho = base && base.caminho ? [base.caminho, ...partes].join('/') : caminhoDe(partes);
  return { caminho, id: caminho.split('/').pop() };
}
export function collection(base, ...partes) {
  const caminho = base && base.caminho ? [base.caminho, ...partes].join('/') : caminhoDe(partes);
  return { caminho, colecao: true };
}
export function query(colecao) { return colecao; }
export function where() { return null; }

function dono() { return authObj.currentUser && authObj.currentUser.uid; }
function podeLer(caminho) {
  const p = caminho.split('/');
  if (p[0] === 'publico') return p.length === 2; // só get de um resumo, sem listar
  return p[0] === 'users' && p[1] === dono();
}
function podeGravar(caminho) {
  const p = caminho.split('/');
  return (p[0] === 'users' || p[0] === 'publico') && p[1] === dono();
}
function snapshot(caminho) {
  const dados = banco.docs[caminho];
  return { id: caminho.split('/').pop(), exists: () => dados !== undefined, data: () => (dados ? structuredClone(dados) : undefined), ref: { caminho } };
}

export async function getDoc(ref) {
  if (!podeLer(ref.caminho)) return falha('permission-denied');
  return snapshot(ref.caminho);
}
export async function setDoc(ref, dados, opcoes = {}) {
  if (!podeGravar(ref.caminho)) return falha('permission-denied');
  banco.docs[ref.caminho] = opcoes.merge ? { ...(banco.docs[ref.caminho] || {}), ...structuredClone(dados) } : structuredClone(dados);
  persistir();
}
export async function updateDoc(ref, dados) {
  if (!podeGravar(ref.caminho)) return falha('permission-denied');
  if (!banco.docs[ref.caminho]) return falha('not-found');
  banco.docs[ref.caminho] = { ...banco.docs[ref.caminho], ...structuredClone(dados) };
  persistir();
}
export async function deleteDoc(ref) {
  if (!podeGravar(ref.caminho)) return falha('permission-denied');
  delete banco.docs[ref.caminho];
  persistir();
}
export async function addDoc(colecao, dados) {
  const ref = doc(colecao, 'doc' + banco.proximo++);
  await setDoc(ref, dados);
  return ref;
}
export async function getDocs(colecao) {
  if (!podeLer(colecao.caminho + '/x')) return falha('permission-denied');
  const profundidade = colecao.caminho.split('/').length + 1;
  const lista = Object.keys(banco.docs)
    .filter((k) => k.startsWith(colecao.caminho + '/') && k.split('/').length === profundidade)
    .map(snapshot);
  return { docs: lista, size: lista.length, empty: !lista.length, forEach: (fn) => lista.forEach(fn) };
}
