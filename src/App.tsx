import React, { useState, useEffect } from 'react';
import { Destination, TripItinerary } from './types/destination';
import { 
  AuthUser, 
  getCurrentUser, 
  getStoredDestinations, 
  loadDestinations,
  loadUserFavorites,
  loadSavedItineraries,
  getUserFavorites, 
  getSavedItineraries, 
  loginWithGoogle,
  loginAdminWithEmailPassword,
  isFirebaseConfigured,
  subscribeToAuthChanges,
  logoutUser, 
  toggleFavorite 
} from './services/firebaseService';
import { Navbar } from './components/Navbar';
import { MapView } from './components/MapView';
import { DestinationModal } from './components/DestinationModal';
import { TripPlannerView } from './components/TripPlannerView';
import { ChatbotView } from './components/ChatbotView';
import { SavedItinerariesView } from './components/SavedItinerariesView';
import { AdminDashboard } from './components/AdminDashboard';
import { KeyRound, X, Check, Sparkles, UserRound, Shield, LogIn, Waves, Sun, Moon, LogOut, ArrowRight, MapPin, Heart } from 'lucide-react';

const captureResult = <T,>(promise: Promise<T>) => promise.then(
  data => ({ data }),
  error => ({ error })
);

const getStoredThemePreference = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const savedTheme = window.localStorage.getItem('pesisir_theme');
    if (savedTheme === 'dark') return true;
    if (savedTheme === 'light') return false;

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

const getStoredApiKey = (): string => {
  if (typeof window === 'undefined') return '';

  try {
    return window.localStorage.getItem('pesisir_gemini_api_key') || '';
  } catch {
    return '';
  }
};

export function App() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'map' | 'planner' | 'chatbot' | 'saved'>('map');
  const [destinations, setDestinations] = useState<Destination[]>(() => getStoredDestinations());
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginStage, setLoginStage] = useState<'welcome' | 'login'>('welcome');
  const [adminEmail, setAdminEmail] = useState('morendyyonathanrumegang@gmail.com');
  const [adminPassword, setAdminPassword] = useState('');
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  // User & Data Persistence State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getCurrentUser());
  const [favorites, setFavorites] = useState<string[]>(() => getUserFavorites(getCurrentUser()?.uid));
  const [savedItineraries, setSavedItineraries] = useState<TripItinerary[]>(() => getSavedItineraries(getCurrentUser()?.uid));

  // Dark Mode State
  const [isDark, setIsDark] = useState<boolean>(getStoredThemePreference);

  // Settings Modal State (for optional custom Gemini API Key)
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(getStoredApiKey);
  const [isKeySavedFeedback, setIsKeySavedFeedback] = useState<boolean>(false);

  // Sync dark mode class
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('pesisir_theme', isDark ? 'dark' : 'light');
      }
    } catch {
      // Ignore storage quota errors in private browsing or restricted environments.
    }
  }, [isDark]);

  useEffect(() => subscribeToAuthChanges(setCurrentUser), []);

  useEffect(() => {
    let active = true;
    const user = currentUser;

    Promise.all([
      captureResult(loadDestinations(user?.isAdmin === true)),
      captureResult(user ? loadUserFavorites(user.uid) : Promise.resolve<string[]>([])),
      captureResult(user ? loadSavedItineraries(user.uid) : Promise.resolve<TripItinerary[]>([]))
    ]).then(([destinationsResult, favoritesResult, itinerariesResult]) => {
      if (!active) return;

      const failures: unknown[] = [];
      if ('data' in destinationsResult) setDestinations(destinationsResult.data);
      else failures.push(destinationsResult.error);
      if ('data' in favoritesResult) setFavorites(favoritesResult.data);
      else failures.push(favoritesResult.error);
      if ('data' in itinerariesResult) setSavedItineraries(itinerariesResult.data);
      else failures.push(itinerariesResult.error);

      if (failures.length > 0) {
        console.error('Firebase data loading failed:', failures);
        setFirebaseError(failures.map(error => error instanceof Error ? error.message : 'Gagal memuat data Firebase.').join(' '));
      } else {
        setFirebaseError(null);
      }
    });

    return () => {
      active = false;
    };
  }, [currentUser]);

  // Auth handlers
  const handleLogin = async () => {
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const user = await loginWithGoogle();
      setCurrentUser(user);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Gagal masuk. Silakan coba lagi.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const user = await loginAdminWithEmailPassword(adminEmail, adminPassword);
      setCurrentUser(user);
      setActiveTab('map');
      setAdminPassword('');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Gagal masuk sebagai admin. Silakan coba lagi.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setActiveTab('map');
    } catch (error) {
      console.error('Unable to sign out:', error);
      setFirebaseError(error instanceof Error ? error.message : 'Gagal keluar dari akun.');
    }
  };

  // Favorites handler
  const handleToggleFavorite = async (id: string) => {
    try {
      const updated = await toggleFavorite(id, currentUser?.uid);
      setFavorites(updated);
      setFirebaseError(null);
    } catch (error) {
      console.error('Favorite sync failed:', error);
      setFirebaseError(error instanceof Error ? error.message : 'Gagal menyinkronkan favorit.');
    }
  };

  // Update single destination (e.g. from review submission)
  const handleUpdateSingleDestination = (updated: Destination) => {
    setDestinations(prev => prev.map(d => d.id === updated.id ? updated : d));
    setSelectedDestination(updated);
  };

  // Refresh saved data
  const handleRefreshSaved = () => {
    setSavedItineraries(getSavedItineraries(currentUser?.uid));
    setFavorites(getUserFavorites(currentUser?.uid));
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('pesisir_gemini_api_key', apiKeyInput.trim());
      }
    } catch {
      // Ignore storage errors in restricted environments.
    }

    setIsKeySavedFeedback(true);
    setTimeout(() => {
      setIsKeySavedFeedback(false);
      setIsApiKeyModalOpen(false);
    }, 800);
  };

  if (!currentUser) {
    return (
      <div className="login-scene relative isolate flex min-h-screen flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="login-glow login-glow-one" aria-hidden="true" />
        <div className="login-glow login-glow-two" aria-hidden="true" />
        <div className="login-bubble login-bubble-one" aria-hidden="true" />
        <div className="login-bubble login-bubble-two" aria-hidden="true" />
        <div className="login-bubble login-bubble-three" aria-hidden="true" />
        <div className="login-waves" aria-hidden="true">
          <svg className="login-wave login-wave-back" viewBox="0 0 1440 220" preserveAspectRatio="none">
            <path d="M0,96 C180,150 330,35 520,82 C720,132 850,185 1050,105 C1220,37 1330,54 1440,99 L1440,220 L0,220 Z" />
          </svg>
          <svg className="login-wave login-wave-front" viewBox="0 0 1440 220" preserveAspectRatio="none">
            <path d="M0,125 C190,65 300,170 500,130 C700,90 820,54 1010,118 C1180,176 1320,166 1440,116 L1440,220 L0,220 Z" />
          </svg>
        </div>
        <header className="relative z-10 flex items-center justify-between border-b border-slate-200/70 bg-white/70 px-4 py-3 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-900/60 sm:px-8">
          <div className="login-brand flex items-center gap-3">
            <div className="login-brand-icon flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 text-white shadow-lg shadow-cyan-600/25">
              <Waves className="h-6 w-6" />
            </div>
            <span className="text-xl font-extrabold text-cyan-700 dark:text-cyan-400">Localist</span>
          </div>
          <button
            onClick={() => setIsDark(!isDark)}
            title={isDark ? 'Gunakan mode terang' : 'Gunakan mode gelap'}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
          </button>
        </header>
        <main className="relative z-10 flex flex-1 items-center justify-center p-4 py-12 sm:p-8">
          {loginStage === 'welcome' ? (
            <section className="welcome-content w-full max-w-4xl text-center">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/70 px-4 py-1.5 text-xs font-bold tracking-wide text-cyan-800 shadow-sm backdrop-blur dark:border-cyan-900 dark:bg-slate-900/70 dark:text-cyan-300">
                <Waves className="h-4 w-4" />
                JELAJAHI SULAWESI UTARA
              </span>
              <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
                Selamat datang di{' '}
                <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-teal-500 bg-clip-text text-transparent">
                  Localist
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
                Temukan pesona Sulawesi Utara dari pantai dan pulau hingga gunung, danau, air terjun, budaya, dan kulinernya. Rencanakan perjalananmu dan ciptakan cerita yang tak terlupakan.
              </p>
              <button
                onClick={() => {
                  setLoginError(null);
                  setLoginStage('login');
                }}
                className="welcome-cta mt-8 inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-600/25 transition-all hover:-translate-y-1 hover:bg-cyan-700 hover:shadow-xl sm:px-8 sm:text-base"
              >
                <LogIn className="h-5 w-5" />
                Masuk untuk Memulai
                <ArrowRight className="h-4 w-4" />
              </button>
              <div className="welcome-highlights mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-3">
                <div className="welcome-highlight flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-200">
                  <MapPin className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  Destinasi pilihan
                </div>
                <div className="welcome-highlight flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-200">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Rencana perjalanan AI
                </div>
                <div className="welcome-highlight flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-200">
                  <Heart className="h-4 w-4 text-rose-500" />
                  Simpan tempat favorit
                </div>
              </div>
            </section>
          ) : (
            <div className="login-content w-full max-w-4xl">
              <button
                onClick={() => {
                  setLoginError(null);
                  setLoginStage('welcome');
                }}
                className="mb-6 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white/60 hover:text-cyan-700 dark:text-slate-300 dark:hover:bg-slate-900/60 dark:hover:text-cyan-300"
              >
                ← Kembali ke sambutan
              </button>
              <div className="login-heading mb-8 text-center">
                <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/70 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-800 shadow-sm backdrop-blur dark:border-cyan-900 dark:bg-slate-900/70 dark:text-cyan-300">
                  <Waves className="h-3.5 w-3.5" />
                  PILIH JALUR MASUK
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Lanjutkan ke Localist</h1>
                <p className="mx-auto mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
                  Masuk untuk melanjutkan ke dashboard sesuai peran Anda.
                </p>
              </div>
              {!isFirebaseConfigured() && (
                <p className="mx-auto mb-6 max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  Firebase belum dikonfigurasi. Login cloud dan sinkronisasi belum aktif; isi file <code>.env</code> memakai konfigurasi Firebase Web App.
                </p>
              )}
              {loginError && (
                <p role="alert" className="mx-auto mb-6 max-w-xl rounded-xl bg-rose-50 p-3 text-center text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {loginError}
                </p>
              )}
              <div className="grid gap-5 md:grid-cols-2">
                <section className="login-card login-card-user rounded-3xl border border-cyan-100/80 bg-white/85 p-6 shadow-xl shadow-cyan-950/5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/85 sm:p-8">
                  <div className="login-card-icon mb-5 inline-flex rounded-2xl bg-cyan-100 p-3 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-bold">Pengguna</h2>
                  <p className="mt-2 min-h-12 text-sm text-slate-600 dark:text-slate-400">
                    Jelajahi destinasi, susun rencana perjalanan, dan simpan favorit Anda.
                  </p>
                  <button
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-cyan-600/20 transition-all hover:-translate-y-0.5 hover:bg-cyan-700 hover:shadow-lg disabled:cursor-wait disabled:opacity-60"
                  >
                    <LogIn className="h-4 w-4" />
                    {isLoggingIn ? 'Memproses...' : 'Masuk'}
                  </button>
                </section>
                <form onSubmit={handleAdminLogin} className="login-card login-card-admin rounded-3xl border border-amber-100/80 bg-white/85 p-6 shadow-xl shadow-cyan-950/5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/85 sm:p-8">
                  <div className="login-card-icon mb-5 inline-flex rounded-2xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    <Shield className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-bold">Administrator</h2>
                  <p className="mt-2 min-h-12 text-sm text-slate-600 dark:text-slate-400">
                    Masuk menggunakan email dan sandi akun administrator Localist.
                  </p>
                  <label htmlFor="admin-email" className="mt-5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Alamat email
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={adminEmail}
                    onChange={event => setAdminEmail(event.target.value)}
                    placeholder="nama@email.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <label htmlFor="admin-password" className="mt-4 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sandi
                  </label>
                  <input
                    id="admin-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={adminPassword}
                    onChange={event => setAdminPassword(event.target.value)}
                    placeholder="Masukkan sandi akun admin"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white shadow-md shadow-slate-900/15 transition-all hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-lg disabled:cursor-wait disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    <LogIn className="h-4 w-4" />
                    {isLoggingIn ? 'Memproses...' : 'Masuk sebagai Admin'}
                  </button>
                  <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Akun harus dibuat di Firebase Authentication dan emailnya harus terdaftar sebagai administrator.
                  </p>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {currentUser.isAdmin ? (
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white dark:bg-slate-700">
              <Shield className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="font-extrabold">Localist Admin</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser.displayName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              title={isDark ? 'Gunakan mode terang' : 'Gunakan mode gelap'}
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </div>
        </header>
      ) : (
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          onLogout={handleLogout}
          isDark={isDark}
          setIsDark={setIsDark}
          destinationsCount={destinations.length}
        />
      )}

      {!isFirebaseConfigured() && (
        <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Firebase belum dikonfigurasi — data hanya tersimpan di browser ini. Isi file <code>.env</code> memakai konfigurasi Firebase Web App.
        </div>
      )}
      {firebaseError && (
        <div role="alert" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Firebase: {firebaseError}
        </div>
      )}

      {currentUser.isAdmin ? (
        <AdminDashboard
          destinations={destinations}
          onUpdateDestinations={setDestinations}
        />
      ) : (
      <main className="flex-1 flex flex-col">
        {activeTab === 'map' && (
          <MapView
            destinations={destinations}
            onSelectDestination={setSelectedDestination}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {activeTab === 'planner' && (
          <TripPlannerView
            destinations={destinations}
            currentUser={currentUser}
            onLoginRequest={handleLogin}
            onSelectDestination={setSelectedDestination}
            onItinerarySaved={handleRefreshSaved}
          />
        )}

        {activeTab === 'chatbot' && (
          <ChatbotView
            destinations={destinations}
            onSelectDestination={setSelectedDestination}
          />
        )}

        {activeTab === 'saved' && (
          <SavedItinerariesView
            itineraries={savedItineraries}
            destinations={destinations}
            favorites={favorites}
            userId={currentUser.uid}
            onSelectDestination={setSelectedDestination}
            onRefreshSaved={handleRefreshSaved}
            onNavigateToPlanner={() => setActiveTab('planner')}
          />
        )}

      </main>
      )}

      {/* Floating API Key Settings Pill */}
      <div className="fixed bottom-4 left-4 z-40">
        <button
          onClick={() => setIsApiKeyModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 shadow-md border border-slate-200 dark:border-slate-800 backdrop-blur-md transition-colors"
          title="Konfigurasi Kunci API Gemini (Opsional)"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Konfigurasi AI / API</span>
        </button>
      </div>

      {/* Destination Detail & Realtime Marine Modal */}
      {!currentUser.isAdmin && <DestinationModal
        destination={selectedDestination}
        onClose={() => setSelectedDestination(null)}
        currentUser={currentUser}
        onLoginRequest={handleLogin}
        onUpdateDestination={handleUpdateSingleDestination}
        isFavorite={selectedDestination ? favorites.includes(selectedDestination.id) : false}
        onToggleFavorite={handleToggleFavorite}
      />}

      {/* API Key Modal */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-600" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                  Pengaturan Google Gemini API Key
                </h3>
              </div>
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Sistem telah dilengkapi mesin sintesis grounded otomatis. Jika Anda ingin menghubungkan langsung dengan model Google Gemini 1.5 Flash untuk penalaran LLM live tambahan, masukkan API Key Anda di bawah:
            </p>

            <form onSubmit={handleSaveApiKey} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsApiKeyModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm"
                >
                  {isKeySavedFeedback ? <Check className="w-4 h-4" /> : null}
                  <span>{isKeySavedFeedback ? 'Tersimpan!' : 'Simpan Kunci'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
