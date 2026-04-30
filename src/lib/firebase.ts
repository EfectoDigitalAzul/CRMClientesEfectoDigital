import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, addDoc, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';

// Configuración de Firebase - Usamos los datos proporcionados por el usuario
const firebaseConfig = {
  apiKey: "AIzaSyDPF3HzPCU-YsuOW3X-ei_oUPpgCBwZsd4",
  authDomain: "ai-studio-applet-webapp-168f2.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-168f2",
  storageBucket: "ai-studio-applet-webapp-168f2.firebasestorage.app",
  messagingSenderId: "30932368156",
  appId: "1:30932368156:web:4da280a0493af457c198d9",
  databaseId: "ai-studio-b25dd903-6073-4870-8eb5-7ce9c93bd9f4"
};

// Intentamos leer de variables de entorno si existen (opcional, para flexibilidad)
const envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID
};

// Usamos las variables de entorno si están presentes y tienen datos reales,
// de lo contrario usamos el objeto hardcodeado de arriba.
const isEnvValid = envConfig.apiKey && envConfig.apiKey !== "PLACEHOLDER" && envConfig.apiKey !== "";
const finalConfig = isEnvValid ? { ...firebaseConfig, ...envConfig } : firebaseConfig;

export const isFirebaseConfigured = !!finalConfig.apiKey && finalConfig.apiKey !== "PLACEHOLDER";

// Inicialización de Firebase
const app = initializeApp(finalConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, finalConfig.databaseId);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
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
