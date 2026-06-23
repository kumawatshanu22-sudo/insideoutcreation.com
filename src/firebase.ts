import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { initializeFirestore, doc, getDoc, setDoc, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, getDocFromServer, limit, deleteDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, getDocFromServer, limit, deleteDoc, updateDoc, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, ref, uploadBytes, getDownloadURL };
