import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, addDoc, query, where, getDocs, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Configuración de Firebase
const finalConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  databaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId
};

console.log("🚀 CRM Conectado a Firebase!");
console.log("Proyecto:", finalConfig.projectId);
console.log("Base de datos:", finalConfig.databaseId || "(default)");

export const isFirebaseConfigured = !!finalConfig.apiKey && finalConfig.apiKey !== "PLACEHOLDER";

// Inicialización de Firebase
const app = initializeApp(finalConfig);
export const auth = getAuth(app);

// ID de la base de datos
const dbId = finalConfig.databaseId || "(default)";
export const db = getFirestore(app, dbId);

console.log("🔥 Firestore instanciado con DB:", dbId);

export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('El usuario cerró la ventana de inicio de sesión.');
      return;
    }
    console.error('Error al iniciar sesión:', error);
    throw error;
  }
};

export const ensureAuth = async () => {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
      console.log("🔑 Sesión anónima iniciada para operaciones básicas");
    } catch (e) {
      console.error("Error en sesión anónima:", e);
    }
  }
};

export const logout = () => signOut(auth);

// Error handling helper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
