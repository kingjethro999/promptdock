const admin = require("firebase-admin");

let app = null;

function getFirebaseApp() {
  if (app) return app;
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.FIREBASE_PRIVATE_KEY ||
    ""
  ).replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  } else {
    app = admin.apps.length
      ? admin.app()
      : admin.initializeApp({ projectId: projectId || undefined });
  }
  return app;
}

function getAuth() {
  return admin.auth(getFirebaseApp());
}

function getFirestore() {
  return admin.firestore(getFirebaseApp());
}

function configured() {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;

  // The browser Firebase config is intentionally public and cannot authenticate
  // the Admin SDK. Provider linking needs a complete server credential or ADC.
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    (projectId && clientEmail && privateKey),
  );
}

module.exports = { admin, configured, getAuth, getFirestore };
