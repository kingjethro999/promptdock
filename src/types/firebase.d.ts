declare module "firebase/app" {
  export type FirebaseApp = unknown;
  export function getApp(): FirebaseApp;
  export function getApps(): FirebaseApp[];
  export function initializeApp(config: Record<string, unknown>): FirebaseApp;
}

declare module "firebase/auth" {
  export type User = {
    getIdToken(forceRefresh?: boolean): Promise<string>;
    displayName?: string | null;
    photoURL?: string | null;
  };
  export type UserCredential = { user: User };
  export type Auth = {
    currentUser: User | null;
    authStateReady?(): Promise<void>;
  };
  export class GoogleAuthProvider {
    setCustomParameters?(params: Record<string, string>): this;
  }
  export class GithubAuthProvider {
    setCustomParameters?(params: Record<string, string>): this;
  }
  export function signInWithRedirect(
    auth: Auth,
    provider: unknown,
  ): Promise<never>;
  export function getRedirectResult(auth: Auth): Promise<UserCredential | null>;
  export function getAuth(app?: unknown): Auth;
  export function signInWithPopup(
    auth: Auth,
    provider: unknown,
  ): Promise<UserCredential>;
  export function linkWithPopup(
    user: User,
    provider: unknown,
  ): Promise<UserCredential>;
  export function signInWithCustomToken(
    auth: Auth,
    token: string,
  ): Promise<UserCredential>;
  export function unlink(user: User, providerId: string): Promise<User>;
}
