// Firebase Admin SDK is intentionally disabled for this MVP.
// The current project runs without service account keys because some Google
// organizations block service account key creation by policy.

export function isFirebaseAdminConfigured() {
  return false;
}

export function getFirebaseAdminDb(): never {
  throw new Error("Firebase Admin SDK is disabled. Use Firebase Client SDK instead.");
}
