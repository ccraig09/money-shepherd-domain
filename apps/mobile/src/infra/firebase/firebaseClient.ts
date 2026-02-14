import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
  signInAnonymously,
  type Auth,
} from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

let authSingleton: Auth | null = null;

export function getFirebase() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  // RN: must initializeAuth with AsyncStorage persistence
  if (!authSingleton) {
    authSingleton = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  }

  const db = getFirestore(app);
  return { app, auth: authSingleton, db };
}

export async function ensureAnonAuth() {
  const { auth } = getFirebase();
  if (auth.currentUser) return auth.currentUser;
  const res = await signInAnonymously(auth);
  return res.user;
}
