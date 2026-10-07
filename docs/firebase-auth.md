# Firebase authentication setup

PromptDock keeps its existing cookie session and Postgres application records. Firebase Authentication verifies Google and GitHub identities, while Firestore mirrors the application user's Firebase-facing identity metadata.

## Firebase Console

The Firebase project is `thepromptdockauth` and already has the `promptdock` web app registered. In Authentication → Sign-in method, enable:

- Email/password
- Google
- GitHub

Add `localhost` and the deployed PromptDock hostname to Authentication → Settings → Authorized domains. Configure the GitHub OAuth app callback URL shown by Firebase for the GitHub provider.

## Environment

The browser-safe web configuration uses the `NEXT_PUBLIC_FIREBASE_*` variables in `.env.local` or deployment settings. Server verification and Firestore mirroring require the server-only Admin variables from `.env.example`:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Never put Admin credentials under `NEXT_PUBLIC_*`, commit `.env.local`, or log token/key values.

## Account behavior

Provider login first resolves the `(provider, provider_uid)` identity. A linked identity signs into the existing PromptDock user. If the verified provider email belongs to a password-only user and the provider is not linked, login is blocked with an instruction to sign in with the existing password and connect the provider in Settings. A provider is only linked from an authenticated Settings session, and a provider already attached to another account is rejected.
