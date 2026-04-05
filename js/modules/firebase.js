// ─── FIREBASE ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDopX9hVDEx3c-_uXyce6LLDdAjIeeynNQ",
  authDomain: "coachhours-49524.firebaseapp.com",
  projectId: "coachhours-49524",
  storageBucket: "coachhours-49524.firebasestorage.app",
  messagingSenderId: "727995088282",
  appId: "1:727995088282:web:120efebd8dc2f072690e23"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();
db.settings({ experimentalAutoDetectLongPolling: true, merge: true });
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
