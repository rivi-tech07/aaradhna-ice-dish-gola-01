const admin = require("firebase-admin");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getServiceAccountFromJsonEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: String(parsed.private_key || "").replace(/\\n/g, "\n")
  };
}

function getApp() {
  if (admin.apps.length) return admin.app();

  const fromJson = getServiceAccountFromJsonEnv();
  const projectId = fromJson?.projectId || requiredEnv("FIREBASE_PROJECT_ID");
  const clientEmail = fromJson?.clientEmail || requiredEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = fromJson?.privateKey || requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

function getDb() {
  return getApp().firestore();
}

module.exports = {
  getDb
};
