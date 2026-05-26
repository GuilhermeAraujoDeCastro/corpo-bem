// ═══════════════════════════════════════════════════════════════
//  CORPO BEM — app.js
//  ⚠️  CONFIGURE SUAS CREDENCIAIS FIREBASE ABAIXO!
// ═══════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  collection, addDoc, getDocs, deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref, uploadString, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ─────────────────────────────────────────────
//  🔥 SUBSTITUA PELOS SEUS DADOS DO FIREBASE
// ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAFyeYwj7w92L-h8wrDDwU4kP4lSiB15OM",
  authDomain: "web-treino.firebaseapp.com",
  projectId: "web-treino",
  storageBucket: "web-treino.firebasestorage.app",
  messagingSenderId: "249708014404",
  appId: "1:249708014404:web:63ed1e93a8f83a0f808511"
};
// ─────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ════════════════════════════════════════
//  GLOBAL STATE
// ════════════════════════════════════════
let currentUser = null;
let userData = null;
let currentGoal = null;
let waterMl = 0;
const WATER_GOAL = 2400;
let activeMuscles = new Set();
let goals = [];
let rewards = [];
let coins = 0;
let currentMood = null;
let obStep = 1;
const OB_TOTAL = 4;

// ════════════════════════════════════════
//  AUTH STATE LISTENER
// ════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadUserData();
  } else {
    currentUser = null;
    userData = null;
    showScreen("auth");
  }
});

// ════════════════════════════════════════
//  AUTH FUNCTIONS
// ════════════════════════════════════════
window.showLogin = () => {
  document.getElementById("form-login").classList.add("active");
  document.getElementById("form-register").classList.remove("active");
};
window.showRegister = () => {
  document.getElementById("form-register").classList.add("active");
  document.getElementById("form-login").classList.remove("active");
};

document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-password").value;
  const errEl = document.getElementById("auth-error");
  try {
    errEl.classList.add("hidden");
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    errEl.textContent = friendlyAuthError(e.code);
    errEl.classList.remove("hidden");
  }
});

document.getElementById("btn-register").addEventListener("click", async () => {
  const email = document.getElementById("reg-email").value.trim();
  const pass = document.getElementById("reg-password").value;
  const errEl = document.getElementById("auth-error-reg");
  try {
    errEl.classList.add("hidden");
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    errEl.textContent = friendlyAuthError(e.code);
    errEl.classList.remove("hidden");
  }
});

window.logout = async () => {
  await signOut(auth);
};

function friendlyAuthError(code) {
  const msgs = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/email-already-in-use": "E-mail já está em uso.",
    "auth/weak-password": "Senha muito fraca (mín. 6 caracteres).",
    "auth/invalid-credential": "E-mail ou senha inválidos.",
  };
  return msgs[code] || "Erro ao autenticar. Tente novamente.";
}

// ════════════════════════════════════════
//  LOAD USER DATA
// ════════════════════════════════════════
async function loadUserData() {
  const docRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    // new user — show onboarding
    showScreen("onboarding");
  } else {
    userData = snap.data();
    await initApp();
  }
}

// ════════════════════════════════════════
//  ONBOARDING
// ════════════════════════════════════════
window.obNext = async () => {
  if (!validateObStep()) return;
  if (obStep < OB_TOTAL) {
    obStep++;
    renderObStep();
  } else {
    await saveOnboardingData();
  }
};

window.obBack = () => {
  if (obStep > 1) {
    obStep--;
    renderObStep();
  }
};

function renderObStep() {
  document.querySelectorAll(".ob-step").forEach(s => s.classList.remove("active"));
  document.querySelector(`.ob-step[data-step="${obStep}"]`).classList.add("active");
  document.getElementById("ob-progress").style.width = `${(obStep / OB_TOTAL) * 100}%`;
  document.getElementById("ob-step-label").textContent = `${obStep} / ${OB_TOTAL}`;
  document.getElementById("ob-back").style.display = obStep > 1 ? "block" : "none";
  document.getElementById("ob-next").textContent = obStep === OB_TOTAL ? "Começar! 🚀" : "Próximo →";
}

function validateObStep() {
  if (obStep === 1) {
    if (!document.getElementById("ob-username").value.trim()) { showToast("Digite seu nome!", "error"); return false; }
  }
  if (obStep === 2) {
    if (!document.getElementById("ob-weight").value || !document.getElementById("ob-height").value) {
      showToast("Preencha peso e altura!", "error"); return false;
    }
  }
  if (obStep === 3) {
    if (!currentGoal) { showToast("Escolha um objetivo!", "error"); return false; }
  }
  return true;
}

window.selectGoal = (el) => {
  document.querySelectorAll(".goal-card").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  currentGoal = el.dataset.goal;
};

async function saveOnboardingData() {
  const username = document.getElementById("ob-username").value.trim();
  const nickname = document.getElementById("ob-nickname").value.trim() || username;
  const weight = parseFloat(document.getElementById("ob-weight").value);
  const height = parseFloat(document.getElementById("ob-height").value);
  const phrase = document.getElementById("ob-phrase").value.trim() || "Cada dia é uma oportunidade de ser melhor que ontem!";

  const data = {
    username, nickname, weight_initial: weight, weight_current: weight,
    height_initial: height, height_current: height,
    goal: currentGoal || "manter", phrase,
    coins: 0, streak: 0, last_login: null,
    created_at: serverTimestamp(),
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`
  };

  await setDoc(doc(db, "users", currentUser.uid), data);
  userData = data;
  await initApp();
}

// ════════════════════════════════════════
//  INIT APP
// ════════════════════════════════════════
async function initApp() {
  showScreen("app");
  updateStreak();
  renderDashboard();
  await loadGoals();
  await loadRewards();
  renderNav("home");
  checkWeeklyCheckin();
  initTodayData();
}

function renderDashboard() {
  const name = userData.nickname || userData.username || "Usuário";
  document.getElementById("dash-name").textContent = name;
  document.getElementById("profile-username").textContent = userData.username || name;
  document.getElementById("dash-phrase").textContent = userData.phrase || "";
  document.getElementById("dash-streak").querySelector("#streak-count").textContent = userData.streak || 0;
  document.getElementById("profile-streak").textContent = `${userData.streak || 0} dias seguidos`;
  document.getElementById("profile-phrase").value = userData.phrase || "";
  document.getElementById("profile-goal-badge").textContent = `🎯 Meta: ${goalLabel(userData.goal)}`;
  document.getElementById("stat-weight-initial").textContent = userData.weight_initial || "—";
  document.getElementById("stat-weight-current").textContent = userData.weight_current || "—";
  document.getElementById("stat-height-initial").textContent = userData.height_initial || "—";
  document.getElementById("stat-height-current").textContent = userData.height_current || "—";

  const avatar = userData.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.username}`;
  document.getElementById("profile-avatar").src = avatar;
  document.getElementById("profile-avatar-large").src = avatar;

  coins = userData.coins || 0;
  document.getElementById("coin-count").textContent = coins;

  const metas_date = document.getElementById("metas-date");
  if (metas_date) metas_date.textContent = new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

function goalLabel(g) {
  return { ganhar: "Ganhar Peso", perder: "Perder Peso", manter: "Manter Peso" }[g] || "—";
}

// ════════════════════════════════════════
//  STREAK
// ════════════════════════════════════════
async function updateStreak() {
  const today = new Date().toDateString();
  const lastLogin = userData.last_login;
  if (lastLogin === today) return;

  const yesterday = new Date(Date.now() - 86400000).toDateString();
  let newStreak = lastLogin === yesterday ? (userData.streak || 0) + 1 : 1;

  await updateDoc(doc(db, "users", currentUser.uid), {
    streak: newStreak, last_login: today
  });
  userData.streak = newStreak;
  userData.last_login = today;
}

// ════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════
window.navigateTo = (page) => {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.add("active");
  renderNav(page);
};

function renderNav(page) {
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.page === page);
  });
}

// ════════════════════════════════════════
//  WATER TRACKER
// ════════════════════════════════════════
function initTodayData() {
  const key = `water_${new Date().toDateString()}_${currentUser?.uid}`;
  waterMl = parseInt(localStorage.getItem(key) || "0");
  renderWater();

  const mkey = `muscles_${new Date().toDateString()}_${currentUser?.uid}`;
  const saved = localStorage.getItem(mkey);
  if (saved) {
    activeMuscles = new Set(JSON.parse(saved));
    renderMuscles();
  }
}

window.addWater = (ml) => {
  waterMl = Math.min(waterMl + ml, WATER_GOAL);
  const key = `water_${new Date().toDateString()}_${currentUser?.uid}`;
  localStorage.setItem(key, waterMl);
  renderWater();
  if (waterMl >= WATER_GOAL) {
    showToast("💧 Meta de água atingida! Incrível!", "success");
    fireConfetti();
  }
};

window.resetWater = () => {
  waterMl = 0;
  const key = `water_${new Date().toDateString()}_${currentUser?.uid}`;
  localStorage.setItem(key, 0);
  renderWater();
};

function renderWater() {
  const pct = Math.round((waterMl / WATER_GOAL) * 100);
  document.getElementById("water-fill").style.height = pct + "%";
  document.getElementById("water-label").textContent = `${pct}%`;
  document.getElementById("water-ml").textContent = `${waterMl} / ${WATER_GOAL}ml`;
  document.getElementById("water-pct").textContent = `${pct}%`;
}

// ════════════════════════════════════════
//  BODY MAP
// ════════════════════════════════════════
window.toggleMuscle = (el) => {
  const muscle = el.dataset.muscle;
  // toggle all elements with same muscle group
  const allParts = document.querySelectorAll(`.muscle[data-muscle="${muscle}"]`);
  if (activeMuscles.has(muscle)) {
    activeMuscles.delete(muscle);
    allParts.forEach(p => p.classList.remove("active"));
  } else {
    activeMuscles.add(muscle);
    allParts.forEach(p => p.classList.add("active"));
  }
  const mkey = `muscles_${new Date().toDateString()}_${currentUser?.uid}`;
  localStorage.setItem(mkey, JSON.stringify([...activeMuscles]));
  renderMuscles();
};

function renderMuscles() {
  // re-sync SVG
  document.querySelectorAll(".muscle").forEach(el => {
    el.classList.toggle("active", activeMuscles.has(el.dataset.muscle));
  });
  // render tags
  const tags = document.getElementById("muscle-tags");
  const muscleNames = { ombros: "Ombros", peito: "Peito", abdomen: "Abdômen", biceps: "Bíceps", antebraco: "Antebraço", quadriceps: "Quadríceps", panturrilha: "Panturrilha", gluteos: "Glúteos" };
  tags.innerHTML = [...activeMuscles].map(m => `<span class="muscle-tag">${muscleNames[m] || m}</span>`).join("");
}

// ════════════════════════════════════════
//  GOALS
// ════════════════════════════════════════
async function loadGoals() {
  goals = [];
  const today = new Date().toDateString();
  const colRef = collection(db, "users", currentUser.uid, "goals");
  const snap = await getDocs(colRef);
  snap.forEach(d => {
    if (d.data().date === today) goals.push({ id: d.id, ...d.data() });
  });
  renderGoals();
}

window.addGoal = async () => {
  const text = document.getElementById("new-goal-text").value.trim();
  if (!text) return;
  const today = new Date().toDateString();
  const docRef = await addDoc(collection(db, "users", currentUser.uid, "goals"), {
    text, done: false, date: today, created_at: serverTimestamp()
  });
  goals.push({ id: docRef.id, text, done: false, date: today });
  document.getElementById("new-goal-text").value = "";
  renderGoals();
};

window.toggleGoal = async (id) => {
  const goal = goals.find(g => g.id === id);
  if (!goal) return;
  goal.done = !goal.done;
  await updateDoc(doc(db, "users", currentUser.uid, "goals", id), { done: goal.done });
  renderGoals();
  if (goal.done) {
    awardCoins(5);
    fireConfetti();
    showToast("🎉 Meta concluída! +5 moedas!", "success");
  }
};

window.deleteGoal = async (id) => {
  goals = goals.filter(g => g.id !== id);
  await deleteDoc(doc(db, "users", currentUser.uid, "goals", id));
  renderGoals();
};

function renderGoals() {
  const list = document.getElementById("goals-list");
  const preview = document.getElementById("goals-preview-home");
  if (goals.length === 0) {
    list.innerHTML = `<p class="empty-state">Nenhuma meta para hoje. Adicione uma acima! 💪</p>`;
    preview.innerHTML = `<p class="empty-state">Vá até Metas para adicionar objetivos!</p>`;
    return;
  }

  const html = goals.map(g => `
    <div class="goal-item ${g.done ? "done" : ""}">
      <div class="goal-check" onclick="toggleGoal('${g.id}')">${g.done ? "✓" : ""}</div>
      <span class="goal-text">${g.text}</span>
      <button class="goal-delete" onclick="deleteGoal('${g.id}')">✕</button>
    </div>
  `).join("");
  list.innerHTML = html;

  // preview on home
  const previewHtml = goals.slice(0, 3).map(g => `
    <div class="goal-item ${g.done ? "done" : ""}">
      <div class="goal-check">${g.done ? "✓" : ""}</div>
      <span class="goal-text">${g.text}</span>
    </div>
  `).join("");
  preview.innerHTML = previewHtml + (goals.length > 3 ? `<p class="empty-state">+${goals.length - 3} mais...</p>` : "");
}

// ════════════════════════════════════════
//  REWARDS / LOJINHA
// ════════════════════════════════════════
async function loadRewards() {
  rewards = [];
  const colRef = collection(db, "users", currentUser.uid, "rewards");
  const snap = await getDocs(colRef);
  snap.forEach(d => rewards.push({ id: d.id, ...d.data() }));
  renderRewards();
}

window.addReward = async () => {
  const name = document.getElementById("reward-name").value.trim();
  const cost = parseInt(document.getElementById("reward-cost").value);
  if (!name || !cost || cost < 1) { showToast("Preencha nome e custo!", "error"); return; }
  const docRef = await addDoc(collection(db, "users", currentUser.uid, "rewards"), {
    name, cost, redeemed: false
  });
  rewards.push({ id: docRef.id, name, cost, redeemed: false });
  document.getElementById("reward-name").value = "";
  document.getElementById("reward-cost").value = "";
  renderRewards();
};

window.redeemReward = async (id) => {
  const r = rewards.find(r => r.id === id);
  if (!r || r.redeemed) return;
  if (coins < r.cost) { showToast("Moedas insuficientes! 🪙", "error"); return; }
  coins -= r.cost;
  r.redeemed = true;
  await updateDoc(doc(db, "users", currentUser.uid, "rewards", id), { redeemed: true });
  await updateDoc(doc(db, "users", currentUser.uid), { coins });
  userData.coins = coins;
  document.getElementById("coin-count").textContent = coins;
  renderRewards();
  fireConfetti();
  showToast(`🎉 ${r.name} resgatado!`, "success");
};

function renderRewards() {
  const list = document.getElementById("rewards-list");
  if (rewards.length === 0) {
    list.innerHTML = `<p class="empty-state">Adicione seus desejos acima! 🎁</p>`;
    return;
  }
  list.innerHTML = rewards.map(r => `
    <div class="reward-item ${r.redeemed ? "redeemed" : ""}">
      <div class="reward-info">
        <strong>${r.name}</strong>
        <small>🪙 ${r.cost} moedas</small>
      </div>
      ${r.redeemed
        ? `<span class="redeemed-badge">✓ Resgatado</span>`
        : `<button class="btn-redeem" onclick="redeemReward('${r.id}')" ${coins < r.cost ? "disabled" : ""}>Resgatar</button>`
      }
    </div>
  `).join("");
}

async function awardCoins(amount) {
  coins += amount;
  await updateDoc(doc(db, "users", currentUser.uid), { coins });
  userData.coins = coins;
  document.getElementById("coin-count").textContent = coins;
  renderRewards(); // refresh button disabled states
}

// ════════════════════════════════════════
//  PROFILE
// ════════════════════════════════════════
window.savePhrase = async () => {
  const phrase = document.getElementById("profile-phrase").value.trim();
  if (!phrase) return;
  await updateDoc(doc(db, "users", currentUser.uid), { phrase });
  userData.phrase = phrase;
  document.getElementById("dash-phrase").textContent = phrase;
  showToast("✓ Frase atualizada!", "success");
};

window.handleAvatarChange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    try {
      const storageRef = ref(storage, `avatars/${currentUser.uid}`);
      await uploadString(storageRef, dataUrl, "data_url");
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "users", currentUser.uid), { avatar: url });
      userData.avatar = url;
      document.getElementById("profile-avatar").src = url;
      document.getElementById("profile-avatar-large").src = url;
      showToast("📷 Foto atualizada!", "success");
    } catch {
      // Fallback: use base64 in Firestore (limited size)
      document.getElementById("profile-avatar").src = dataUrl;
      document.getElementById("profile-avatar-large").src = dataUrl;
      showToast("📷 Foto atualizada localmente!", "success");
    }
  };
  reader.readAsDataURL(file);
};

// ════════════════════════════════════════
//  DARK MODE
// ════════════════════════════════════════
window.toggleDarkMode = () => {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  document.documentElement.setAttribute("data-theme", isLight ? "dark" : "light");
  document.getElementById("btn-darkmode").textContent = isLight ? "🌙" : "☀️";
  localStorage.setItem("theme", isLight ? "dark" : "light");
};

// Apply saved theme
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light") {
  document.documentElement.setAttribute("data-theme", "light");
  document.getElementById("btn-darkmode").textContent = "☀️";
}

// ════════════════════════════════════════
//  WEEKLY CHECK-IN
// ════════════════════════════════════════
function checkWeeklyCheckin() {
  const key = `checkin_week_${currentUser.uid}`;
  const lastWeek = localStorage.getItem(key);
  const thisWeek = getWeekNumber();
  if (lastWeek === String(thisWeek)) return;
  setTimeout(() => {
    document.getElementById("modal-checkin").classList.remove("hidden");
  }, 2000);
}

window.closeCheckin = () => {
  document.getElementById("modal-checkin").classList.add("hidden");
  const key = `checkin_week_${currentUser.uid}`;
  localStorage.setItem(key, getWeekNumber());
};

window.saveCheckin = async () => {
  const weight = parseFloat(document.getElementById("ci-weight").value);
  const height = parseFloat(document.getElementById("ci-height").value);
  const updates = {};
  if (weight) updates.weight_current = weight;
  if (height) updates.height_current = height;
  if (Object.keys(updates).length > 0) {
    await updateDoc(doc(db, "users", currentUser.uid), updates);
    Object.assign(userData, updates);
    renderDashboard();
  }
  closeCheckin();
  showToast("✓ Check-in salvo!", "success");
};

window.selectMood = (el) => {
  document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("selected"));
  el.classList.add("selected");
  currentMood = el.dataset.mood;
};

function getWeekNumber() {
  const d = new Date();
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
}

// ════════════════════════════════════════
//  CONFETTI
// ════════════════════════════════════════
function fireConfetti() {
  if (typeof confetti === "undefined") return;
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 },
    colors: ["#00e5ff", "#7c3aed", "#f97316", "#10b981", "#fbbf24"]
  });
}

// ════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════
function showToast(msg, type = "") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("show"));
  });
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
window.showToast = showToast;

// ════════════════════════════════════════
//  SCREEN HELPER
// ════════════════════════════════════════
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const screenEl = document.getElementById(`screen-${name}`);
  if (screenEl) screenEl.classList.add("active");
}

// ════════════════════════════════════════
//  SERVICE WORKER REGISTRATION
// ════════════════════════════════════════
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// ════════════════════════════════════════
//  FIREBASE CLOUD MESSAGING (Opcional)
// ════════════════════════════════════════
// Para habilitar notificações, descomente o bloco abaixo
// e adicione sua VAPID key do Firebase Console.
//
// import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
// const messaging = getMessaging(app);
// async function requestNotificationPermission() {
//   const permission = await Notification.requestPermission();
//   if (permission === 'granted') {
//     const token = await getToken(messaging, { vapidKey: 'SUA_VAPID_KEY' });
//     await updateDoc(doc(db, 'users', currentUser.uid), { fcm_token: token });
//   }
// }
// // Chame após login: requestNotificationPermission();