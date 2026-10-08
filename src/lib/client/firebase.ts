import { getApp, getApps, initializeApp } from "firebase/app";

const requiredFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(requiredFirebaseConfig).every(
  Boolean,
);

const firebaseConfig = {
  ...requiredFirebaseConfig,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

export const firebaseApp = firebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export type FirebaseProvider = "google" | "github";

async function authModule() {
  if (!firebaseApp) throw new Error("Firebase sign-in is not configured.");
  return import("firebase/auth");
}

export async function getFirebaseAuth() {
  const firebase = await authModule();
  return firebase.getAuth(firebaseApp);
}

async function providerFor(name: FirebaseProvider) {
  const firebase = await authModule();
  return name === "google"
    ? new firebase.GoogleAuthProvider()
    : new firebase.GithubAuthProvider();
}

export async function signInWithProvider(name: FirebaseProvider) {
  const firebase = await authModule();
  const auth = firebase.getAuth(firebaseApp);
  return firebase.signInWithPopup(auth, await providerFor(name));
}

export async function linkProvider(name: FirebaseProvider) {
  const firebase = await authModule();
  const auth = firebase.getAuth(firebaseApp);
  if (!auth.currentUser)
    throw new Error("Sign in before connecting an account.");
  return firebase.linkWithPopup(auth.currentUser, await providerFor(name));
}

export async function signInWithFirebaseCustomToken(token: string) {
  const firebase = await authModule();
  const auth = firebase.getAuth(firebaseApp);
  return firebase.signInWithCustomToken(auth, token);
}

export async function disconnectProvider(name: FirebaseProvider) {
  const firebase = await authModule();
  const auth = firebase.getAuth(firebaseApp);
  if (!auth.currentUser)
    throw new Error("Sign in before disconnecting an account.");
  return firebase.unlink(
    auth.currentUser,
    name === "google" ? "google.com" : "github.com",
  );
}
