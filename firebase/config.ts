/**
 * @file Arquivo de configuração e inicialização do Firebase.
 * Este módulo configura e exporta as instâncias do Firebase App, Auth e Firestore,
 * alternando entre configurações de desenvolvimento e produção com base na variável de ambiente.
 */
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

/**
 * A instância principal do aplicativo Firebase. A inicialização é protegida
 * para evitar erros de reinicialização em ambientes de hot-reloading.
 * @type {import('firebase/app').FirebaseApp}
 */
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/**
 * A instância do serviço Firebase Authentication.
 * @type {import('firebase/auth').Auth}
 */
export const auth = getAuth(app);

/**
 * A instância do serviço Cloud Firestore.
 * @type {import('firebase/firestore').Firestore}
 */
export const db = getFirestore(app);
