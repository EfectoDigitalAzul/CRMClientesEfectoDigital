import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, addDoc, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';

// Placeholder config - will be replaced by firebase-applet-config.json if it exists
const firebaseConfig = {
  apiKey: "PLACEHOLDER",
  authDomain: "PLACEHOLDER",
  projectId: "PLACEHOLDER",
  storageBucket: "PLACEHOLDER",
  messagingSenderId: "PLACEHOLDER",
  appId: "PLACEHOLDER"
};

// Import real config if available
import configData from '../../firebase-applet-config.json';
const config = configData || firebaseConfig;

export const isFirebaseConfigured = config && config.apiKey && config.apiKey !== "PLACEHOLDER";

// Initialize with safe fallback if not configured
const app = initializeApp(isFirebaseConfigured ? config : { ...firebaseConfig, apiKey: "dummy-key-for-init" });
export const auth = getAuth(app);
export const db = getFirestore(app, (config as any).firestoreDatabaseId);
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

export async function createFirebaseAuthUser(email: string, pass: string): Promise<string> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase configuration is missing or PLACEHOLDER");
  }
  
  // Choose config
  const activeConfig = configData || firebaseConfig;
  
  // Create unique secondary application name to prevent conflicts
  const tempAppName = `temp-app-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const tempApp = initializeApp(activeConfig, tempAppName);
  const tempAuth = getAuth(tempApp);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(tempAuth, email, pass);
    if (!userCredential.user) {
      throw new Error("No user object returned from Firebase Auth creation.");
    }
    return userCredential.user.uid;
  } finally {
    // Delete the temporary app so that it clears connections and memory
    await deleteApp(tempApp);
  }
}
