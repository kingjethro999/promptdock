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

type AuthModule = typeof import("firebase/auth");
// Kept once loaded so a sign-in click can open the provider popup without
// waiting. Browsers only allow a popup while handling the click itself;
// awaiting a module load first is what made them report auth/popup-blocked.
let loadedAuth: AuthModule | null = null;

async function authModule() {
  if (!firebaseApp) throw new Error("Firebase sign-in is not configured.");
  loadedAuth ??= await import("firebase/auth");
  return loadedAuth;
}

if (typeof window !== "undefined" && firebaseConfigured) {
  authModule().catch(() => {});
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

function providerFrom(firebase: AuthModule, name: FirebaseProvider) {
  const provider =
    name === "google"
      ? new firebase.GoogleAuthProvider()
      : new firebase.GithubAuthProvider();
  // Always show the account chooser, so a shared browser does not silently
  // reuse whoever signed in last.
  if (name === "google")
    provider.setCustomParameters?.({ prompt: "select_account" });
  return provider;
}

function isPopupBlocked(error: unknown) {
  const code = (error as { code?: string } | null)?.code || "";
  const message = error instanceof Error ? error.message : "";
  return (
    code === "auth/popup-blocked" ||
    code === "auth/operation-not-supported-in-this-environment" ||
    message.includes("popup-blocked")
  );
}

/** Thrown when sign-in continues on the provider's page after a redirect. */
export class RedirectingError extends Error {
  constructor() {
    super("Redirecting to the provider");
  }
}

/**
 * Signs in with Google or GitHub. Call it directly from a click handler: the
 * popup opens synchronously when the auth module is ready. If the module is
 * still loading, or the browser blocks the popup anyway, the page moves to
 * the provider instead and `completeRedirectSignIn` finishes on return.
 */
export function signInWithProvider(name: FirebaseProvider) {
  if (!firebaseApp) throw new Error("Firebase sign-in is not configured.");
  const redirect = async () => {
    const firebase = await authModule();
    await firebase.signInWithRedirect(
      firebase.getAuth(firebaseApp),
      providerFrom(firebase, name),
    );
    throw new RedirectingError();
  };
  if (!loadedAuth) return redirect();
  const firebase = loadedAuth;
  return firebase
    .signInWithPopup(
      firebase.getAuth(firebaseApp),
      providerFrom(firebase, name),
    )
    .catch((error: unknown) => {
      if (isPopupBlocked(error)) return redirect();
      throw error;
    });
}

/** Finishes a sign-in that went through the provider's page, if any. */
export async function completeRedirectSignIn() {
  if (!firebaseApp) return null;
  const firebase = await authModule();
  return firebase.getRedirectResult(firebase.getAuth(firebaseApp));
}

export async function linkProvider(name: FirebaseProvider) {
  const firebase = await authModule();
  const auth = firebase.getAuth(firebaseApp);
  if (!auth.currentUser)
    throw new Error("Sign in before connecting an account.");
  const providerKey = `${name}.com`;
  const isLinked = (user: unknown) => {
    const list = (user as { providerData?: Array<{ providerId?: string }> })
      ?.providerData;
    return Boolean(list?.some((entry) => entry.providerId === providerKey));
  };
  if (isLinked(auth.currentUser)) {
    return { user: auth.currentUser };
  }
  try {
    return await firebase.linkWithPopup(
      auth.currentUser,
      await providerFor(name),
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("provider-already-linked") ||
      message.includes("credential-already-in-use")
    ) {
      const reloadFn = (
        firebase as { reload?: (user: unknown) => Promise<void> }
      ).reload;
      if (typeof reloadFn === "function") {
        await reloadFn(auth.currentUser).catch(() => {});
      } else {
        const userWithReload = auth.currentUser as unknown as {
          reload?: () => Promise<void>;
        };
        if (typeof userWithReload?.reload === "function") {
          await userWithReload.reload().catch(() => {});
        }
      }
      if (isLinked(auth.currentUser)) {
        return { user: auth.currentUser };
      }
    }
    throw error;
  }
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

/**
 * The name and picture from the Google or GitHub account used to sign in, if
 * this browser still holds that provider session. Used only to pre-fill the
 * profile setup; nothing is sent anywhere.
 */
export async function providerProfile(): Promise<{
  name: string | null;
  photoUrl: string | null;
} | null> {
  if (!firebaseConfigured) return null;
  try {
    const auth = await getFirebaseAuth();
    await auth.authStateReady?.();
    const user = auth.currentUser;
    if (!user) return null;
    return { name: user.displayName || null, photoUrl: user.photoURL || null };
  } catch {
    return null;
  }
}
