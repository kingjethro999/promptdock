import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  getAuth,
  linkWithPopup,
  signInWithCustomToken,
  signInWithPopup,
  unlink,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
export const firebaseApp = firebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export function getFirebaseAuth() {
  if (!firebaseApp) throw new Error("Firebase sign-in is not configured.");
  return getAuth(firebaseApp);
}

export type FirebaseProvider = "google" | "github";

export function providerFor(name: FirebaseProvider) {
  return name === "google"
    ? new GoogleAuthProvider()
    : new GithubAuthProvider();
}

export async function signInWithProvider(name: FirebaseProvider) {
  return signInWithPopup(getFirebaseAuth(), providerFor(name));
}

export async function linkProvider(name: FirebaseProvider) {
  const auth = getFirebaseAuth();
  if (!auth.currentUser)
    throw new Error("Sign in before connecting an account.");
  return linkWithPopup(auth.currentUser, providerFor(name));
}

export async function signInWithFirebaseCustomToken(token: string) {
  return signInWithCustomToken(getFirebaseAuth(), token);
}

export async function disconnectProvider(name: FirebaseProvider) {
  const auth = getFirebaseAuth();
  if (!auth.currentUser)
    throw new Error("Sign in before disconnecting an account.");
  return unlink(
    auth.currentUser,
    name === "google" ? "google.com" : "github.com",
  );
}
