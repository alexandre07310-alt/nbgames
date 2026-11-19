import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Capacitor } from "@capacitor/core";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Dans une WebView Capacitor (origine capacitor://localhost), getAuth() reste
// bloqué : il embarque le résolveur de popup/redirection, qui tente de charger
// une iframe depuis authDomain. onAuthStateChanged ne se déclenche alors jamais.
// En natif on passe donc par initializeAuth, sans ce résolveur.
// Sur le web, getAuth() reste le bon choix.
export const auth = Capacitor.isNativePlatform()
  // Tous les stockages sont listés : Firebase ne cherche une session existante
  // QUE parmi ceux-ci. « Rester connecté » range la session dans localStorage
  // (setPersistence) ; avec IndexedDB seul, elle était introuvable au relancement
  // et l'utilisateur se retrouvait déconnecté à chaque ouverture de l'app.
  ? initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    })
  : getAuth(app);

export const db = getFirestore(app);
export const storage = getStorage(app);
