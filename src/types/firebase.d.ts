declare module "firebase/app" {
  export type FirebaseApp = unknown;
  export function getApp(): FirebaseApp;
  export function getApps(): FirebaseApp[];
  export function initializeApp(config: Record<string, unknown>): FirebaseApp;
}

declare module "firebase/auth" {
  export type User = { getIdToken(forceRefresh?: boolean): Promise<string> };
  export type UserCredential = { user: User };
  export type Auth = { currentUser: User | null };
  export class GoogleAuthProvider {}
  export class GithubAuthProvider {}
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
