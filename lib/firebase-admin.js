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
  try {
    // Handle both direct JSON and stringified JSON
    let parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: String(parsed.private_key || "").replace(/\\n/g, "\n")
    };
  } catch (error) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", error.message);
    return null;
  }
}

function getApp() {
  if (admin.apps.length) return admin.app();

  const fromJson = getServiceAccountFromJsonEnv();
  if (fromJson) {
    try {
      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId: fromJson.projectId,
          clientEmail: fromJson.clientEmail,
          privateKey: fromJson.privateKey
        })
      });
    } catch (error) {
      console.error("Failed to initialize Firebase with JSON:", error.message);
    }
  }

  // Fallback to individual environment variables
  const projectId = requiredEnv("FIREBASE_PROJECT_ID");
  const clientEmail = requiredEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

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
