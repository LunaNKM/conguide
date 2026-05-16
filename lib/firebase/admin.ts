import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  return key ? key.replace(/\\n/g, "\n") : undefined;
}

export function isFirebaseAdminConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

export function getFirebaseAdminApp(): App {
  if (!isFirebaseAdminConfigured()) {
    throw new Error("Firebase admin environment variables are not configured.");
  }

  if (getApps().length > 0) return getApps()[0];

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getPrivateKey()
    })
  });
}

export function getFirebaseAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}
