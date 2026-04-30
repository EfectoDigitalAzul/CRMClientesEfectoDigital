import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, addDoc, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';

// Placeholder config - will be replaced by firebase-applet-config.json if it exists
const firebaseConfig = {
  apiKey: "AIzaSyDPF3HzPCU-YsuOW3X-ei_oUPpgCBwZsd4",
  authDomain: "ai-studio-applet-webapp-168f2.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-168f2",
  storageBucket: "ai-studio-applet-webapp-168f2.firebasestorage.app",
  messagingSenderId: "30932368156",
  appId: "1:30932368156:web:4da280a0493af457c198d9"
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

// This is a robust check for Firebase configuration
// Priority: 1. Environment Variables, 2. Hardcoded Fallback (for easy Vercel deploy)
const isEnvConfigured = config.apiKey && config.apiKey !== "PLACEHOLDER" && config.apiKey !== "";
const finalConfig = isEnvConfigured ? config : firebaseConfig;

export const isFirebaseConfigured = finalConfig && finalConfig.apiKey && finalConfig.apiKey !== "PLACEHOLDER";

// Initialize with safe fallback if not configured
const app = initializeApp(isFirebaseConfigured ? finalConfig : { ...firebaseConfig, apiKey: "dummy-key-for-init" });
export const auth = getAuth(app);
// Support both standard and AI Studio specific database ID fields
// For standard Firebase projects, the database ID is often "(default)"
// @ts-ignore
const dbId = finalConfig.firestoreDatabaseId || finalConfig.databaseId;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
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
