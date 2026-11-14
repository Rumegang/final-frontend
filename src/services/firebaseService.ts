import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, Firestore, collection, doc, setDoc, getDocs, deleteDoc, getDoc, query, where, writeBatch } from 'firebase/firestore';
import { Destination, DestinationReview, TripItinerary } from '../types/destination';
import { EXPANDED_DESTINATIONS, INITIAL_DESTINATIONS } from '../data/destinations';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || ''
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export const isFirebaseConfigured = (): boolean => {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
};

if (isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.warn('Firebase init error, fallback to LocalStorage mode:', err);
  }
}

// ---------------- USER AUTHENTICATION ----------------
export interface AuthUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isAdmin?: boolean;
}

const LOCAL_USER_KEY = 'pesisir_local_user';
const ADMIN_SESSION_KEY = 'pesisir_admin_session_uid';
const ADMIN_EMAILS = [
  'admin@pesisirku.id',
  'admin@gmail.com',
  'morendyyonathanrumegang@gmail.com'
];

export function getCurrentUser(): AuthUser | null {
  const saved = localStorage.getItem(LOCAL_USER_KEY);
  if (saved) {
    try {
      const user = JSON.parse(saved) as AuthUser;
      user.isAdmin = localStorage.getItem(ADMIN_SESSION_KEY) === user.uid;
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
      return user;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export async function loginWithGoogle(): Promise<AuthUser> {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  localStorage.removeItem(LOCAL_USER_KEY);

  if (auth && isFirebaseConfigured()) {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const userObj = toAuthUser(cred.user);
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(userObj));
      return userObj;
    } catch (err) {
      throw new Error('Login Google gagal. Pastikan Google Sign-In aktif di Firebase dan domain aplikasi diizinkan.', { cause: err });
    }
  }

  if (isFirebaseConfigured()) {
    throw new Error('Firebase Authentication tidak berhasil diinisialisasi. Periksa konfigurasi Firebase.');
  }

  const mockUser: AuthUser = {
    uid: 'demo-user-101',
    displayName: 'Wisatawan Kawanua',
    email: 'wisatawan@pesisirku.id',
    photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
    isAdmin: false
  };
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(mockUser));
  return mockUser;
}

function toAuthUser(user: User): AuthUser {
  const email = (user.email || '').trim().toLowerCase();
  return {
    uid: user.uid,
    displayName: user.displayName || 'Pengguna Localist',
    email,
    photoURL: user.photoURL || undefined,
    isAdmin: false
  };
}

export function subscribeToAuthChanges(onChange: (user: AuthUser | null) => void): () => void {
  if (!auth) return () => undefined;

  return onAuthStateChanged(auth, firebaseUser => {
    if (!firebaseUser) {
      localStorage.removeItem(LOCAL_USER_KEY);
      onChange(null);
      return;
    }

    const user = toAuthUser(firebaseUser);
    user.isAdmin = localStorage.getItem(ADMIN_SESSION_KEY) === user.uid;
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    onChange(user);
  }, error => {
    console.error('Firebase authentication state error:', error);
  });
}

export async function loginAdminWithEmailPassword(email: string, password: string): Promise<AuthUser> {
  if (!auth || !isFirebaseConfigured()) {
    throw new Error('Login admin belum dikonfigurasi. Hubungkan aplikasi ke Firebase terlebih dahulu.');
  }

  let credential;
  try {
    credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';
    const messages: Record<string, string> = {
      'auth/invalid-email': 'Format alamat email tidak valid.',
      'auth/invalid-credential': 'Email atau sandi tidak benar.',
      'auth/user-not-found': 'Email admin belum terdaftar di Firebase Authentication.',
      'auth/wrong-password': 'Email atau sandi tidak benar.',
      'auth/too-many-requests': 'Terlalu banyak percobaan. Silakan coba lagi nanti.',
      'auth/operation-not-allowed': 'Metode Email/Password belum diaktifkan di Firebase Console.',
      'auth/network-request-failed': 'Tidak dapat terhubung ke Firebase. Periksa koneksi internet.'
    };
    throw new Error(messages[code] || 'Gagal masuk. Periksa konfigurasi Firebase dan coba lagi.', { cause: error });
  }

  const userEmail = (credential.user.email || '').trim().toLowerCase();
  if (!ADMIN_EMAILS.includes(userEmail)) {
    await signOut(auth);
    throw new Error('Email ini belum terdaftar sebagai administrator.');
  }

  localStorage.setItem(ADMIN_SESSION_KEY, credential.user.uid);
  const user: AuthUser = {
    uid: credential.user.uid,
    displayName: credential.user.displayName || 'Administrator Localist',
    email: userEmail,
    photoURL: credential.user.photoURL || undefined,
    isAdmin: true
  };
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  return user;
}

export async function logoutUser(): Promise<void> {
  if (auth) await signOut(auth);
  localStorage.removeItem(ADMIN_SESSION_KEY);
  localStorage.removeItem(LOCAL_USER_KEY);
}

// ---------------- DESTINATIONS CRUD ----------------
const DESTINATIONS_STORAGE_KEY = 'pesisir_destinations_store';
const DESTINATIONS_CATALOG_VERSION_KEY = 'pesisir_destinations_catalog_version';
const DESTINATIONS_CATALOG_VERSION = '2';

export function getStoredDestinations(): Destination[] {
  const saved = localStorage.getItem(DESTINATIONS_STORAGE_KEY);
  if (saved) {
    try {
      const destinations: Destination[] = JSON.parse(saved);
      if (localStorage.getItem(DESTINATIONS_CATALOG_VERSION_KEY) !== DESTINATIONS_CATALOG_VERSION) {
        const existingIds = new Set(destinations.map(destination => destination.id));
        const migrated = [
          ...destinations,
          ...EXPANDED_DESTINATIONS.filter(destination => !existingIds.has(destination.id))
        ];
        localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(migrated));
        localStorage.setItem(DESTINATIONS_CATALOG_VERSION_KEY, DESTINATIONS_CATALOG_VERSION);
        return migrated;
      }
      return destinations;
    } catch (err) {
      console.error('Unable to load or migrate stored destinations:', err);
    }
  }
  localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(INITIAL_DESTINATIONS));
  localStorage.setItem(DESTINATIONS_CATALOG_VERSION_KEY, DESTINATIONS_CATALOG_VERSION);
  return INITIAL_DESTINATIONS;
}

export async function loadDestinations(isAdmin = false): Promise<Destination[]> {
  if (!db) return getStoredDestinations();

  const snapshot = await getDocs(collection(db, 'destinations'));
  if (snapshot.empty) {
    if (!isAdmin) return getStoredDestinations();

    const batch = writeBatch(db);
    INITIAL_DESTINATIONS.forEach(destination => {
      batch.set(doc(db!, 'destinations', destination.id), destination);
    });
    await batch.commit();
    localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(INITIAL_DESTINATIONS));
    return INITIAL_DESTINATIONS;
  }

  const destinations = snapshot.docs.map(destination => destination.data() as Destination);
  localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(destinations));
  return destinations;
}

export async function saveDestination(dest: Destination): Promise<Destination[]> {
  const all = getStoredDestinations();
  const index = all.findIndex(d => d.id === dest.id);
  let updated: Destination[];
  if (index >= 0) {
    updated = all.map(d => d.id === dest.id ? dest : d);
  } else {
    updated = [dest, ...all];
  }
  if (db) await setDoc(doc(db, 'destinations', dest.id), dest);
  localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function deleteDestination(destId: string): Promise<Destination[]> {
  const all = getStoredDestinations();
  const updated = all.filter(d => d.id !== destId);
  if (db) await deleteDoc(doc(db, 'destinations', destId));
  localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

// ---------------- FAVORITES & SAVED ITINERARIES ----------------
const FAVORITES_KEY = 'pesisir_user_favorites';
const ITINERARIES_KEY = 'pesisir_user_itineraries';

function userStorageKey(baseKey: string, userId?: string): string {
  return userId ? `${baseKey}_${userId}` : baseKey;
}

export function getUserFavorites(userId?: string): string[] {
  const key = userStorageKey(FAVORITES_KEY, userId);
  let saved = localStorage.getItem(key);
  if (!saved && userId) {
    saved = localStorage.getItem(FAVORITES_KEY);
    if (saved) {
      localStorage.setItem(key, saved);
      localStorage.removeItem(FAVORITES_KEY);
    }
  }
  return saved ? JSON.parse(saved) : [];
}

export async function loadUserFavorites(userId: string): Promise<string[]> {
  if (!db) return getUserFavorites(userId);

  const snapshot = await getDoc(doc(db, 'users', userId, 'private', 'favorites'));
  if (!snapshot.exists()) {
    const localFavorites = getUserFavorites(userId);
    if (localFavorites.length > 0) {
      await setDoc(doc(db, 'users', userId, 'private', 'favorites'), { destinationIds: localFavorites });
    }
    return localFavorites;
  }

  const favorites = snapshot.exists() && Array.isArray(snapshot.data().destinationIds)
    ? snapshot.data().destinationIds as string[]
    : [];
  localStorage.setItem(userStorageKey(FAVORITES_KEY, userId), JSON.stringify(favorites));
  return favorites;
}

export async function toggleFavorite(destId: string, userId?: string): Promise<string[]> {
  const key = userStorageKey(FAVORITES_KEY, userId);
  const favs = getUserFavorites(userId);
  const next = favs.includes(destId) ? favs.filter(id => id !== destId) : [...favs, destId];
  if (db && userId) {
    await setDoc(doc(db, 'users', userId, 'private', 'favorites'), { destinationIds: next });
  }
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}

export function getSavedItineraries(userId?: string): TripItinerary[] {
  const key = userStorageKey(ITINERARIES_KEY, userId);
  let saved = localStorage.getItem(key);
  if (!saved && userId) {
    saved = localStorage.getItem(ITINERARIES_KEY);
    if (saved) {
      localStorage.setItem(key, saved);
      localStorage.removeItem(ITINERARIES_KEY);
    }
  }
  return saved ? JSON.parse(saved) : [];
}

export async function loadSavedItineraries(userId: string): Promise<TripItinerary[]> {
  if (!db) return getSavedItineraries(userId);

  const snapshot = await getDocs(collection(db, 'users', userId, 'itineraries'));
  if (snapshot.empty) {
    const localItineraries = getSavedItineraries(userId).map(itinerary => ({ ...itinerary, userId }));
    await Promise.all(localItineraries.map(itinerary =>
      setDoc(doc(db, 'users', userId, 'itineraries', itinerary.id), itinerary)
    ));
    localStorage.setItem(userStorageKey(ITINERARIES_KEY, userId), JSON.stringify(localItineraries));
    return localItineraries;
  }

  const itineraries = snapshot.docs.map(item => item.data() as TripItinerary);
  localStorage.setItem(userStorageKey(ITINERARIES_KEY, userId), JSON.stringify(itineraries));
  return itineraries;
}

export async function saveItinerary(itinerary: TripItinerary): Promise<TripItinerary[]> {
  const key = userStorageKey(ITINERARIES_KEY, itinerary.userId);
  const list = getSavedItineraries(itinerary.userId);
  const updated = [itinerary, ...list.filter(item => item.id !== itinerary.id)];
  if (db && itinerary.userId) {
    await setDoc(doc(db, 'users', itinerary.userId, 'itineraries', itinerary.id), itinerary);
  }
  localStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

export async function deleteItinerary(id: string, userId?: string): Promise<TripItinerary[]> {
  const key = userStorageKey(ITINERARIES_KEY, userId);
  const list = getSavedItineraries(userId);
  const updated = list.filter(item => item.id !== id);
  if (db && userId) {
    await deleteDoc(doc(db, 'users', userId, 'itineraries', id));
  }
  localStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

// ---------------- USER REVIEWS CRUD ----------------
export async function addDestinationReview(
  destId: string,
  user: AuthUser,
  rating: number,
  comment: string
): Promise<Destination[]> {
  const all = getStoredDestinations();
  const dest = all.find(d => d.id === destId);
  if (!dest) return all;

  const newReview: DestinationReview = {
    id: 'rev-' + Date.now(),
    userId: user.uid,
    userName: user.displayName,
    rating,
    comment,
    createdAt: new Date().toISOString().split('T')[0]
  };

  const existingReviews = dest.reviews || [];
  const updatedReviews = [newReview, ...existingReviews];
  const newRating = Math.round((updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length) * 10) / 10;

  const updatedDest: Destination = {
    ...dest,
    rating: newRating,
    reviewCount: updatedReviews.length,
    reviews: updatedReviews
  };

  return saveDestination(updatedDest);
}

export async function deleteReview(destId: string, reviewId: string): Promise<Destination[]> {
  const all = getStoredDestinations();
  const dest = all.find(d => d.id === destId);
  if (!dest || !dest.reviews) return all;

  const updatedReviews = dest.reviews.filter(r => r.id !== reviewId);
  const newRating = updatedReviews.length > 0 
    ? Math.round((updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length) * 10) / 10
    : 4.5;

  const updatedDest: Destination = {
    ...dest,
    rating: newRating,
    reviewCount: updatedReviews.length,
    reviews: updatedReviews
  };

  return saveDestination(updatedDest);
}
