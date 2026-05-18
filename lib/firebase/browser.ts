import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

function hasFirebaseConfig() {
  return Object.values(firebaseConfig).every((value) => typeof value === "string" && value.trim().length > 0);
}

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let cachedStorage: FirebaseStorage | null = null;

export function isFirebaseConfigured() {
  return hasFirebaseConfig();
}

export function getFirebaseBrowserApp() {
  if (!hasFirebaseConfig()) {
    throw new Error("Firebase 환경변수가 설정되지 않았습니다. Vercel Environment Variables를 확인해주세요.");
  }

  if (cachedApp) return cachedApp;
  cachedApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return cachedApp;
}

export function getFirebaseBrowserDb() {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getFirebaseBrowserApp());
  return cachedDb;
}

export function getFirebaseBrowserAuth() {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getFirebaseBrowserApp());
  return cachedAuth;
}

export function getFirebaseBrowserStorage() {
  if (cachedStorage) return cachedStorage;
  cachedStorage = getStorage(getFirebaseBrowserApp());
  return cachedStorage;
}
