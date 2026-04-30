import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, addDoc, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';

// Placeholder config - will be replaced by firebase-applet-config.json if it exists
const firebaseConfig = {
  apiKey: "AIzaSyDFfzu5Iyy-kLgFLRRzUEfSybHf-tEq90E",
  authDomain: "gen-lang-client-0099722167.firebaseapp.com",
  projectId: "gen-lang-client-0099722167",
  storageBucket: "gen-lang-client-0099722167.firebasestorage.app",
  messagingSenderId: "561223078351",
  appId: "1:561223078351:web:93c043bcc57fefa334c2ba",
  firestoreDatabaseId: "ai-studio-b25dd903-6073-4870-8eb5-7ce9c93bd9f4"
};

// Import real config if available (only in development)
// In production, we use environment variables
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID
};

// This is a local-only hack for AI Studio environment
// If the env vars are missing, we try to use the fallback config if available
const finalConfig = (config.apiKey && config.apiKey !== "PLACEHOLDER") ? config : firebaseConfig;

export const isFirebaseConfigured = finalConfig && finalConfig.apiKey && finalConfig.apiKey !== "PLACEHOLDER" && finalConfig.apiKey !== "dummy-key-for-init";

// Initialize with safe fallback if not configured
const app = initializeApp(isFirebaseConfigured ? finalConfig : { ...firebaseConfig, apiKey: "dummy-key-for-init" });
export const auth = getAuth(app);
// @ts-ignore - databaseId may exist in finalConfig
export const db = getFirestore(app, finalConfig.databaseId || finalConfig.firestoreDatabaseId);
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
