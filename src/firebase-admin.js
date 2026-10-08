const fs = require("node:fs");
function getAppModule() {
  return require("firebase-admin/app");
}

function getAuthModule() {
  return require("firebase-admin/auth");
}

function getFirestoreModule() {
  return require("firebase-admin/firestore");
}

let app = null;

function formatPrivateKey(raw) {
  if (!raw || typeof raw !== "string") return "";
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  } else if (key.endsWith('"') || key.endsWith("'")) {
    key = key.slice(0, -1);
  } else if (key.startsWith('"') || key.startsWith("'")) {
    key = key.slice(1);
  }
  return key.replace(/\\n/g, "\n").trim();
}

function loadServiceAccount() {
  const inline =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (inline && typeof inline === "string") {
    try {
      const trimmed = inline.trim();
      const decoded = trimmed.startsWith("{")
        ? trimmed
        : Buffer.from(trimmed, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch {
      // Fall through to other resolution strategies
    }
  }

  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    "/home/king/Downloads/thepromptdockauth-firebase-adminsdk-fbsvc-8f2559b21d.json";
  if (
    filePath &&
    typeof filePath === "string" &&
    fs.existsSync(/*turbopackIgnore: true*/ filePath)
  ) {
    try {
      return JSON.parse(
        fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8"),
      );
    } catch {
      // Fall through to other resolution strategies
    }
  }

  return null;
}

function getFirebaseApp() {
  if (app) return app;
  const { initializeApp, cert, getApps, getApp, applicationDefault } =
    getAppModule();
  const apps = getApps();
  if (apps.length) {
    app = getApp();
    return app;
  }

  const serviceAccount = loadServiceAccount();
  if (serviceAccount?.project_id && serviceAccount?.private_key) {
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    return app;
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = formatPrivateKey(
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
      process.env.FIREBASE_PRIVATE_KEY ||
      "",
  );

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
  const { getAuth } = getAuthModule();
  return getAuth(getFirebaseApp());
}

function getFirestoreInstance() {
  const { getFirestore } = getFirestoreModule();
  return getFirestore(getFirebaseApp());
}

function configured() {
  if (loadServiceAccount()) return true;

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

const FieldValue = {
  serverTimestamp() {
    return getFirestoreModule().FieldValue.serverTimestamp();
  },
  delete() {
    return getFirestoreModule().FieldValue.delete();
  },
};

const admin = {
  get firestore() {
    return {
      FieldValue,
    };
  },
};

module.exports = {
  admin,
  configured,
  getAuth: getAuthInstance,
  getFirestore: getFirestoreInstance,
  FieldValue,
  loadServiceAccount,
};
