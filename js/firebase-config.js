// Inicialização do Firebase. As chaves abaixo são públicas por natureza:
// identificam o projeto, mas não concedem acesso a dados por si só. Quem
// protege os dados de verdade são as regras do Firestore (veja firestore.rules
// na raiz do projeto e as instruções no README sobre como publicá-las).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile,
    signOut,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup, connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
    increment, runTransaction, connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAFyeYwj7w92L-h8wrDDwU4kP4lSiB15OM",
    authDomain: "web-treino.firebaseapp.com",
    projectId: "web-treino",
    storageBucket: "web-treino.firebasestorage.app",
    messagingSenderId: "249708014404",
    appId: "1:249708014404:web:63ed1e93a8f83a0f808511"
};

export const IS_LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
export const app = initializeApp(IS_LOCAL ? { apiKey: 'demo-only', projectId: 'demo-auditoria-corpo', authDomain: 'localhost' } : firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
if (IS_LOCAL) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9092', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8082);
}

export {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile,
    signOut,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup,
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
    increment, runTransaction, connectFirestoreEmulator
};
