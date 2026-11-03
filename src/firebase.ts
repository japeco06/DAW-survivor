import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCgn00PER7Kz3BiQ7ruMSigTRqw8PAmhb8",
  authDomain: "survivor-daw.firebaseapp.com",
  projectId: "survivor-daw",
  storageBucket: "survivor-daw.firebasestorage.app",
  messagingSenderId: "988329798270",
  appId: "1:988329798270:web:917f01def33f1d0025462f"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
