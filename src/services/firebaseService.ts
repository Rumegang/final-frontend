import { FirebaseApp, initializeApp, getApps } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, Auth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, Firestore, collection, doc, setDoc, getDocs, getDocsFromServer, deleteDoc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
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

let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let firebaseInitializationError: unknown = null;

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey
    && firebaseConfig.authDomain
    && firebaseConfig.projectId
    && firebaseConfig.appId
  );
};

if (isFirebaseConfigured()) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

    const appCheckSiteKey = env.VITE_FIREBASE_APP_CHECK_SITE_KEY || '';
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      (window as Window & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    if (import.meta.env.DEV || appCheckSiteKey) {
      try {
        initializeAppCheck(firebaseApp, {
          provider: new ReCaptchaV3Provider(appCheckSiteKey || 'debug'),
          isTokenAutoRefreshEnabled: true
        });
      } catch (err) {
        console.error('Firebase App Check initialization failed:', err);
      }
    } else {
      console.warn('Firebase App Check is not configured. Set VITE_FIREBASE_APP_CHECK_SITE_KEY for production AI requests.');
    }

    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
  } catch (err) {
    firebaseInitializationError = err;
    console.error('Firebase initialization failed:', err);
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase AI Logic belum dapat digunakan. Periksa variabel VITE_FIREBASE_* di file .env lalu mulai ulang aplikasi.');
  }

  const reason = firebaseInitializationError instanceof Error
    ? ` ${firebaseInitializationError.message}`
    : '';
  throw new Error(`Firebase tidak berhasil diinisialisasi.${reason}`);
}

function requireFirestore(): Firestore {
  if (db) return db;
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase belum dikonfigurasi dengan lengkap. Periksa variabel VITE_FIREBASE_* di file .env lalu mulai ulang aplikasi.');
  }

  const reason = firebaseInitializationError instanceof Error
    ? ` ${firebaseInitializationError.message}`
    : '';
  throw new Error(`Firestore tidak berhasil diinisialisasi.${reason}`);
}

export function getFirestoreErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (code === 'permission-denied') {
    return 'Firestore menolak akses. Pastikan Rules sudah di-Publish dan email pada aturan admin sama dengan email akun yang sedang masuk.';
  }
  if (
    code === 'unavailable'
    || code === 'deadline-exceeded'
    || message.includes('client is offline')
    || message.includes('offline')
    || message.includes('network')
  ) {
    return 'Aplikasi tidak dapat terhubung ke Firestore. Pastikan perangkat online, lalu muat ulang atau tekan Coba lagi. Jika tetap muncul, periksa koneksi yang memblokir Firebase.';
  }
  if (error instanceof Error) return error.message;
  return 'Terjadi kesalahan yang tidak diketahui saat mengakses Firestore.';
}

export async function checkFirestoreConnection(): Promise<{ projectId: string; destinationCount: number }> {
  const firestore = requireFirestore();
  const snapshot = await getDocsFromServer(collection(firestore, 'destinations'));
  const destinationCount = snapshot.docs.filter(
    destination => destination.id !== DESTINATIONS_CATALOG_MIGRATION_ID
  ).length;

  return {
    projectId: firebaseConfig.projectId,
    destinationCount
  };
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
  'andreaserr@gmail.com'
];

export function getCurrentUser(): AuthUser | null {
  const saved = localStorage.getItem(LOCAL_USER_KEY);
  if (saved) {
    try {
      const user = JSON.parse(saved) as AuthUser;
      user.isAdmin = localStorage.getItem(ADMIN_SESSION_KEY) === user.uid;
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
      return user;
    } catch {
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
const DESTINATIONS_CATALOG_MIGRATION_ID = 'localist_catalog_seed_v1';
const DESTINATION_REVIEWS_COLLECTION = 'destinationReviews';

interface StoredDestinationReview extends DestinationReview {
  destinationId: string;
}

async function loadDestinationReviews(
  firestore: Firestore,
  destinations: Destination[]
): Promise<Destination[]> {
  const snapshot = await getDocs(collection(firestore, DESTINATION_REVIEWS_COLLECTION));
  const reviewsByDestination = new Map<string, DestinationReview[]>();

  snapshot.docs.forEach(reviewDoc => {
    const review = {
      ...reviewDoc.data(),
      id: reviewDoc.id
    } as StoredDestinationReview;
    if (typeof review.destinationId !== 'string') return;

    const reviews = reviewsByDestination.get(review.destinationId) || [];
    reviews.push(review);
    reviewsByDestination.set(review.destinationId, reviews);
  });

  const merged = destinations.map(destination => {
    const existingReviews = destination.reviews || [];
    const existingReviewIds = new Set(existingReviews.map(review => review.id));
    const storedReviews = (reviewsByDestination.get(destination.id) || [])
      .filter(review => !existingReviewIds.has(review.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (storedReviews.length === 0) return destination;

    const baseReviewCount = Math.max(destination.reviewCount, existingReviews.length);
    const reviewCount = baseReviewCount + storedReviews.length;
    const totalRating = destination.rating * baseReviewCount
      + storedReviews.reduce((sum, review) => sum + review.rating, 0);

    return {
      ...destination,
      rating: Math.round((totalRating / reviewCount) * 10) / 10,
      reviewCount,
      reviews: [...storedReviews, ...existingReviews]
    };
  });

  localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

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
  if (!db) {
    if (isFirebaseConfigured()) requireFirestore();
    return getStoredDestinations();
  }

  let destinations: Destination[];
  if (isAdmin) {
    const result = await seedInitialDestinations();
    destinations = result.destinations;
  } else {
    const snapshot = await getDocsFromServer(collection(db, 'destinations'));
    destinations = snapshot.docs
      .filter(destination => destination.id !== DESTINATIONS_CATALOG_MIGRATION_ID)
      .map(destination => destination.data() as Destination);
    if (destinations.length === 0) return getStoredDestinations();
  }

  return loadDestinationReviews(db, destinations);
}

export async function seedInitialDestinations(): Promise<{ destinations: Destination[]; addedCount: number }> {
  const firestore = requireFirestore();
  let snapshot = await getDocsFromServer(collection(firestore, 'destinations'));
  const migration = snapshot.docs.find(destination => destination.id === DESTINATIONS_CATALOG_MIGRATION_ID);
  let addedCount = 0;

  if (!migration) {
    const existingIds = new Set(snapshot.docs.map(destination => destination.id));
    const missingDestinations = INITIAL_DESTINATIONS.filter(destination => !existingIds.has(destination.id));
    const batch = writeBatch(firestore);

    missingDestinations.forEach(destination => {
      batch.set(doc(firestore, 'destinations', destination.id), destination);
    });
    batch.set(doc(firestore, 'destinations', DESTINATIONS_CATALOG_MIGRATION_ID), {
      catalogSeedVersion: 1,
      seededAt: new Date().toISOString()
    });
    await batch.commit();
    addedCount = missingDestinations.length;
    snapshot = await getDocsFromServer(collection(firestore, 'destinations'));
  }

  const destinations = snapshot.docs
    .filter(destination => destination.id !== DESTINATIONS_CATALOG_MIGRATION_ID)
    .map(destination => destination.data() as Destination);
  localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(destinations));
  return { destinations, addedCount };
}

export async function saveDestination(
  dest: Destination,
  currentDestinations: Destination[] = getStoredDestinations()
): Promise<Destination[]> {
  const firestore = requireFirestore();
  const destinationRef = doc(firestore, 'destinations', dest.id);
  const existingSnapshot = await getDoc(destinationRef);
  if (existingSnapshot.exists()) {
    const storedData = existingSnapshot.data();
    const storedReviews = Array.isArray(storedData.reviews)
      ? storedData.reviews as DestinationReview[]
      : [];
    const storedReviewIds = new Set(storedReviews.map(review => review.id));
    await setDoc(destinationRef, {
      ...dest,
      rating: typeof storedData.rating === 'number' ? storedData.rating : dest.rating,
      reviewCount: typeof storedData.reviewCount === 'number' ? storedData.reviewCount : dest.reviewCount,
      reviews: (dest.reviews || []).filter(review => storedReviewIds.has(review.id))
    });
  } else {
    await setDoc(destinationRef, dest);
  }
  const index = currentDestinations.findIndex(destination => destination.id === dest.id);
  const updated = index >= 0
    ? currentDestinations.map(destination => destination.id === dest.id ? dest : destination)
    : [dest, ...currentDestinations];
  localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function deleteDestination(
  destId: string,
  currentDestinations: Destination[] = getStoredDestinations()
): Promise<Destination[]> {
  const firestore = requireFirestore();
  const destinationRef = doc(firestore, 'destinations', destId);
  await deleteDoc(destinationRef);
  const updated = currentDestinations.filter(destination => destination.id !== destId);
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
  if (!dest) throw new Error('Destinasi tidak ditemukan saat menyimpan ulasan.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating ulasan harus berupa angka 1 sampai 5.');
  }
  const trimmedComment = comment.trim();
  if (!trimmedComment) throw new Error('Komentar ulasan tidak boleh kosong.');

  const firestore = requireFirestore();
  const reviewRef = doc(collection(firestore, DESTINATION_REVIEWS_COLLECTION));
  const newReview: DestinationReview = {
    id: reviewRef.id,
    userId: user.uid,
    userName: user.displayName,
    rating,
    comment: trimmedComment,
    createdAt: new Date().toISOString().split('T')[0]
  };
  await setDoc(reviewRef, { ...newReview, destinationId: destId });

  const existingReviews = dest.reviews || [];
  const updatedReviews = [newReview, ...existingReviews];
  const baseReviewCount = Math.max(dest.reviewCount, existingReviews.length);
  const reviewCount = baseReviewCount + 1;
  const newRating = Math.round(
    ((dest.rating * baseReviewCount + rating) / reviewCount) * 10
  ) / 10;

  const updatedDest: Destination = {
    ...dest,
    rating: newRating,
    reviewCount,
    reviews: updatedReviews
  };

  const updatedDestinations = all.map(destination =>
    destination.id === destId ? updatedDest : destination
  );
  localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(updatedDestinations));
  return updatedDestinations;
}

export async function deleteReview(destId: string, reviewId: string): Promise<Destination[]> {
  const all = getStoredDestinations();
  const dest = all.find(d => d.id === destId);
  if (!dest || !dest.reviews) return all;

  const review = dest.reviews.find(item => item.id === reviewId);
  if (!review) return all;

  const updatedReviews = dest.reviews.filter(r => r.id !== reviewId);
  const reviewCount = Math.max(0, dest.reviewCount - 1);
  const newRating = reviewCount > 0
    ? Math.round(((dest.rating * dest.reviewCount - review.rating) / reviewCount) * 10) / 10
    : 4.5;

  const updatedDest: Destination = {
    ...dest,
    rating: newRating,
    reviewCount,
    reviews: updatedReviews
  };

  const firestore = requireFirestore();
  const reviewRef = doc(firestore, DESTINATION_REVIEWS_COLLECTION, reviewId);
  const reviewSnapshot = await getDoc(reviewRef);
  if (reviewSnapshot.exists()) {
    if (reviewSnapshot.data().destinationId !== destId) {
      throw new Error('Ulasan tidak cocok dengan destinasi yang dipilih.');
    }
    await deleteDoc(reviewRef);
  } else {
    const destinationRef = doc(firestore, 'destinations', destId);
    const destinationSnapshot = await getDoc(destinationRef);
    if (!destinationSnapshot.exists()) {
      throw new Error('Destinasi tidak ditemukan saat menghapus ulasan.');
    }

    const storedData = destinationSnapshot.data();
    const storedReviews = Array.isArray(storedData.reviews)
      ? storedData.reviews as DestinationReview[]
      : [];
    if (!storedReviews.some(storedReview => storedReview.id === reviewId)) {
      throw new Error('Ulasan tidak ditemukan di Firestore.');
    }

    const storedReviewCount = typeof storedData.reviewCount === 'number' ? storedData.reviewCount : 0;
    const storedRating = typeof storedData.rating === 'number' ? storedData.rating : 4.5;
    const storedReviewCountAfterDelete = Math.max(0, storedReviewCount - 1);
    const storedRatingAfterDelete = storedReviewCountAfterDelete > 0
      ? Math.round(((storedRating * storedReviewCount - review.rating) / storedReviewCountAfterDelete) * 10) / 10
      : 4.5;

    await updateDoc(destinationRef, {
      reviews: storedReviews.filter(storedReview => storedReview.id !== reviewId),
      reviewCount: storedReviewCountAfterDelete,
      rating: storedRatingAfterDelete
    });
  }

  const updatedDestinations = all.map(destination =>
    destination.id === destId ? updatedDest : destination
  );
  localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(updatedDestinations));
  return updatedDestinations;
}
