import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const ENVIRONMENT: 'development' | 'production' = 'production'; 

const configs = {
  development: {
    firebaseConfig: {
      apiKey: "AIzaSyBjQ-dt5ixpxzV84G8Gke8zK3-yAqg7Mqc",
      authDomain: "cataratas-pls---dev.firebaseapp.com",
      projectId: "cataratas-pls---dev",
      storageBucket: "cataratas-pls---dev.appspot.com",
      messagingSenderId: "880021575999",
      appId: "1:880021575999:web:901899ffcabb2604549b8a"
    },
  },
  production: {
    firebaseConfig: {
      apiKey: "AIzaSyDqcgWSnSY4ap_XSdvhZQk27koEVNGgYXI",
      authDomain: "catarataspls.firebaseapp.com",
      projectId: "catarataspls",
      storageBucket: "catarataspls.appspot.com",
      messagingSenderId: "13623312981",
      appId: "1:13623312981:web:623c571a2ef53759cccadc"
    },
  }
};

const appConfig = configs[ENVIRONMENT];
const firebaseConfig = appConfig.firebaseConfig;

// Initialize Firebase robustly to prevent re-initialization errors.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);