/// <reference types="vite/client" />

declare module 'firebase/app' {
  export interface FirebaseApp {
    name: string;
    options: Record<string, any>;
  }
  export function initializeApp(options: Record<string, any>): FirebaseApp;
}

declare module 'firebase/auth' {
  export interface User {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  }
  export interface Auth {
    currentUser: User | null;
  }
  export class GoogleAuthProvider {
    constructor();
    setCustomParameters(customOAuthParameters: Record<string, any>): void;
  }
  export function getAuth(app?: any): Auth;
  export function onAuthStateChanged(
    auth: Auth,
    nextOrObserver: (user: User | null) => void,
    error?: (error: any) => void,
    completed?: () => void
  ): () => void;
  export function signInWithPopup(auth: Auth, provider: any): Promise<any>;
  export function signInWithRedirect(auth: Auth, provider: any): Promise<any>;
  export function signOut(auth: Auth): Promise<void>;
}

declare module 'firebase/firestore' {
  export interface Firestore {
    type: string;
  }
  export interface DocumentData {
    [field: string]: any;
  }
  export interface DocumentSnapshot<T = DocumentData> {
    exists(): boolean;
    data(): T | undefined;
    id: string;
  }
  export interface QueryDocumentSnapshot<T = DocumentData> extends DocumentSnapshot<T> {
    data(): T;
  }
  export interface QuerySnapshot<T = DocumentData> {
    docs: QueryDocumentSnapshot<T>[];
    empty: boolean;
    size: number;
    forEach(callback: (result: QueryDocumentSnapshot<T>) => void): void;
  }
  export function getFirestore(app?: any): Firestore;
  export function collection(firestore: any, path: string, ...pathSegments: string[]): any;
  export function doc(firestore: any, path: string, ...pathSegments: string[]): any;
  export function getDoc(reference: any): Promise<DocumentSnapshot>;
  export function getDocs(query: any): Promise<QuerySnapshot>;
  export function setDoc(reference: any, data: any, options?: any): Promise<void>;
  export function query(collection: any, ...queryConstraints: any[]): any;
  export function orderBy(fieldPath: string, directionStr?: 'asc' | 'desc'): any;
  export function limit(limitCount: number): any;
}

declare module 'firebase/analytics' {
  export interface Analytics {
    app: any;
  }
  export function getAnalytics(app?: any): Analytics;
  export function isSupported(): Promise<boolean>;
  export function logEvent(analytics: Analytics, eventName: string, eventParams?: Record<string, any>): void;
}
