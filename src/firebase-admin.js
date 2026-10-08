const {
  initializeApp,
  cert,
  getApps,
  getApp,
  applicationDefault,
} = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

let app = null;

function getFirebaseApp() {
  if (app) return app;
  const apps = getApps();
  if (apps.length) {
    app = getApp();
    return app;
  }

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
    app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = initializeApp({
      credential: applicationDefault(),
      projectId: projectId || undefined,
    });
  } else {
    app = initializeApp({ projectId: projectId || undefined });
  }
  return app;
}

function getAuthInstance() {
  return getAuth(getFirebaseApp());
}

function getFirestoreInstance() {
  return getFirestore(getFirebaseApp());
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

const admin = {
  firestore: {
    FieldValue,
  },
};

module.exports = {
  admin,
  configured,
  getAuth: getAuthInstance,
  getFirestore: getFirestoreInstance,
  FieldValue,
};

