import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported, logEvent as fbLogEvent, Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyCgnO0PER7Kz3BiQ7ruMSigTRqw8PAmhb8",
  authDomain: "survivor-daw.firebaseapp.com",
  projectId: "survivor-daw",
  storageBucket: "survivor-daw.firebasestorage.app",
  messagingSenderId: "988329798270",
  appId: "1:988329798270:web:917f01def33f1d0025462f",
  measurementId: "G-CCKCS0JL5Q"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export let analytics: Analytics | null = null;
const pendingEvents: Array<{ eventName: string; params?: Record<string, any> }> = [];

if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
        while (pendingEvents.length > 0) {
          const item = pendingEvents.shift();
          if (item) {
            try {
              fbLogEvent(analytics, item.eventName, item.params);
            } catch {
              // ignore
            }
          }
        }
      }
    })
    .catch(() => {
      // Safe fallback if analytics is blocked or unsupported in iframe/sandbox
    });
}

export function logAnalyticsEvent(eventName: string, params?: Record<string, any>): void {
  if (analytics) {
    try {
      fbLogEvent(analytics, eventName, params);
    } catch {
      // Safe fallback
    }
  } else {
    // Queue until isSupported() resolves
    pendingEvents.push({ eventName, params });
  }
}

