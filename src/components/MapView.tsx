import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { DESTINATION_CATEGORIES, Destination, Category, isMarineCategory, REGIONS } from '../types/destination';
import { 
  Navigation, Search, Star, Car, Ship, Info, MapPin, LoaderCircle,
  List, Map as MapIcon, ChevronLeft, Heart, ExternalLink
} from 'lucide-react';

type Coordinates = [number, number];

function getCurrentCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Browser ini tidak mendukung geolokasi. Coba gunakan browser lain.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve([position.coords.latitude, position.coords.longitude]),
      error => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Izin lokasi ditolak. Izinkan akses lokasi untuk situs ini dari pengaturan browser, lalu coba lagi.'));
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          reject(new Error('Posisi GPS belum tersedia. Aktifkan layanan lokasi perangkat dan coba lagi.'));
        } else if (error.code === error.TIMEOUT) {
          reject(new Error('Pencarian GPS terlalu lama. Coba lagi di area dengan sinyal lokasi yang lebih baik.'));
        } else {
          reject(new Error('Lokasi saat ini tidak dapat diperoleh.'));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

interface MapViewProps {
  destinations: Destination[];
  onSelectDestination: (dest: Destination) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

// Controller component to zoom/pan programmatically
const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
};

// Resizer hook component to invalidate size when sidebar opens/closes
const MapResizer: React.FC<{ isSidebarOpen: boolean; mobileTab: 'map' | 'list' }> = ({ isSidebarOpen, mobileTab }) => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [isSidebarOpen, mobileTab, map]);
  return null;
};

// Create custom category-specific colored SVG marker icons
function createCategoryIcon(category: Category, isSelected: boolean = false) {
  let bgColor = '#0284c7'; // cyan
  let iconSvg = '🏖️';

  if (category === 'Spot Diving/Snorkeling') {
    bgColor = '#4f46e5'; // indigo
    iconSvg = '🤿';
  } else if (category === 'Ekowisata Mangrove') {
    bgColor = '#059669'; // emerald
    iconSvg = '🌿';
  } else if (category === 'Pulau & Bawah Laut') {
    bgColor = '#0891b2'; // teal
    iconSvg = '🏝️';
  } else if (category === 'Kuliner Pesisir') {
    bgColor = '#ea580c'; // orange
    iconSvg = '🐟';
  } else if (category === 'Gunung & Pendakian') {
    bgColor = '#475569';
    iconSvg = '⛰️';
  } else if (category === 'Air Terjun') {
    bgColor = '#0284c7';
    iconSvg = '💧';
  } else if (category === 'Danau') {
    bgColor = '#0f766e';
    iconSvg = '🌊';
  } else if (category === 'Budaya & Sejarah') {
    bgColor = '#a16207';
    iconSvg = '🏛️';
  }

  const size = isSelected ? 46 : 36;
  const ring = isSelected ? 'ring-4 ring-amber-400 scale-110 shadow-2xl' : 'ring-2 ring-white shadow-lg';

  const html = `
    <div style="
      background-color: ${bgColor};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${size * 0.45}px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.2s ease;
    " class="${ring}">
      ${iconSvg}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
}

// User location marker icon
const userLocationIcon = L.divIcon({
  html: `
    <div style="
      background-color: #ef4444;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.4);
      animation: pulse 1.5s infinite;
    "></div>
  `,
  className: 'user-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const CATEGORY_ICONS: Record<Category, string> = {
  'Pantai': '🏖️',
  'Pulau & Bawah Laut': '🏝️',
  'Ekowisata Mangrove': '🌿',
  'Spot Diving/Snorkeling': '🤿',
  'Kuliner Pesisir': '🐟',
  'Gunung & Pendakian': '⛰️',
  'Air Terjun': '💧',
  'Danau': '🌊',
  'Budaya & Sejarah': '🏛️'
};

const CATEGORIES: { label: string; value: string; icon: string }[] = [
  { label: 'Semua', value: 'Semua', icon: '✨' },
  ...DESTINATION_CATEGORIES.map(category => ({
    label: category,
    value: category,
    icon: CATEGORY_ICONS[category]
  }))
];

export const MapView: React.FC<MapViewProps> = ({
  destinations,
  onSelectDestination,
  favorites,
  onToggleFavorite
}) => {
  const defaultCenter: [number, number] = [1.75, 124.6];
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);
  const [mapZoom, setMapZoom] = useState<number>(7);

  // Filters
  const [selectedRegion, setSelectedRegion] = useState<string>('Semua');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [filterFamily, setFilterFamily] = useState<boolean>(false);
  const [filterSnorkel, setFilterSnorkel] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // UI View States
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [mobileActiveTab, setMobileActiveTab] = useState<'map' | 'list'>('map');
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // Refs for auto-scroll and markers
  const markerRefs = useRef<Record<string, L.Marker | null>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Routing State
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [activeRoute, setActiveRoute] = useState<[number, number][] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number; destName: string; boatFee: number } | null>(null);
  const [isRoutingLoading, setIsRoutingLoading] = useState<boolean>(false);
  const [isLocationLoading, setIsLocationLoading] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Request the browser's GPS position; never present the fallback map center as the user's location.
  useEffect(() => {
    let active = true;
    getCurrentCoordinates().then(location => {
      if (!active) return;
      setUserLocation(location);
      setLocationError(null);
    }).catch(error => {
      if (active) setLocationError(error instanceof Error ? error.message : 'Lokasi tidak dapat diperoleh.');
    });

    return () => {
      active = false;
    };
  }, []);

  // Filtered destinations
  const filtered = destinations.filter(d => {
    if (selectedRegion !== 'Semua' && d.region !== selectedRegion) return false;
    if (selectedCategory !== 'Semua' && d.category !== selectedCategory) return false;
    if (filterFamily && !d.isFamilyFriendly) return false;
    if (filterSnorkel && !d.isSnorkelingSpot) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = d.name.toLowerCase().includes(q);
      const matchDesc = d.description.toLowerCase().includes(q);
      const matchRegion = d.region.toLowerCase().includes(q);
      const matchCategory = d.category.toLowerCase().includes(q);
      const matchFac = d.facilities.some(f => f.toLowerCase().includes(q));
      if (!matchName && !matchDesc && !matchRegion && !matchCategory && !matchFac) return false;
    }
    return true;
  });

  // Calculate route using OSRM Free Routing Service
  const calculateRoute = async (dest: Destination) => {
    setIsRoutingLoading(true);
    setRouteError(null);
    setActiveRoute(null);
    setRouteInfo(null);
    try {
      const currentLocation = await getCurrentCoordinates();
      setUserLocation(currentLocation);
      setLocationError(null);
      setRouteError(null);
      const [startLat, startLng] = currentLocation;
      const { lat: endLat, lng: endLng } = dest.coordinates;

      if (dest.boatFee > 0) {
        setActiveRoute(null);
        setRouteInfo({
          distanceKm: 0,
          durationMin: 0,
          destName: dest.name,
          boatFee: dest.boatFee
        });
        setMapCenter([endLat, endLng]);
        setMapZoom(12);
        return;
      }
      
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const res = await fetch(osrmUrl);
      if (!res.ok) throw new Error(`Layanan rute mengembalikan status ${res.status}.`);
      const data = await res.json();

      if (data.code === 'Ok' && data.routes?.[0]) {
        const route = data.routes[0];
        const coordinates: [number, number][] = route.geometry.coordinates.map(
          (coord: [number, number]) => [coord[1], coord[0]]
        );
        setActiveRoute(coordinates);
        setRouteInfo({
          distanceKm: Math.round((route.distance / 1000) * 10) / 10,
          durationMin: Math.round(route.duration / 60),
          destName: dest.name,
          boatFee: dest.boatFee
        });
        setMapCenter([(startLat + endLat) / 2, (startLng + endLng) / 2]);
        setMapZoom(11);
      } else {
        setRouteInfo(null);
        setActiveRoute([[startLat, startLng], [endLat, endLng]]);
        setRouteError('Rute jalan tidak tersedia. Garis pada peta hanya menunjukkan arah langsung, bukan jalur jalan.');
      }
    } catch (error) {
      console.warn('Route request failed:', error);
      if (error instanceof Error && /izin lokasi|gps|posisi|browser ini|lokasi saat ini/i.test(error.message)) {
        setLocationError(error.message);
        setRouteError(error.message);
        setActiveRoute(null);
        setRouteInfo(null);
      } else {
        setRouteError('Rute jalan gagal dimuat. Periksa koneksi internet, lalu coba lagi.');
        if (userLocation) setActiveRoute([[userLocation[0], userLocation[1]], [dest.coordinates.lat, dest.coordinates.lng]]);
        setRouteInfo(null);
      }
    } finally {
      setIsRoutingLoading(false);
    }
  };

  const handleLocateMe = async () => {
    setIsLocationLoading(true);
    setLocationError(null);
    try {
      const location = await getCurrentCoordinates();
      setUserLocation(location);
      setLocationError(null);
      setRouteError(null);
      setMapCenter(location);
      setMapZoom(14);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Lokasi tidak dapat diperoleh.');
    } finally {
      setIsLocationLoading(false);
    }
  };

  const clearRoute = () => {
    setActiveRoute(null);
    setRouteInfo(null);
    setRouteError(null);
  };

  // Focus on destination from list card
  const handleFocusDestination = (dest: Destination) => {
    setActiveCardId(dest.id);
    setMapCenter([dest.coordinates.lat, dest.coordinates.lng]);
    setMapZoom(13);

    // Switch to map view on mobile so user sees the pin
    setMobileActiveTab('map');

    setTimeout(() => {
      const marker = markerRefs.current[dest.id];
      if (marker) {
        marker.openPopup();
      }
    }, 300);
  };

  // Handle marker click on map
  const handleMarkerClick = (dest: Destination) => {
    setActiveCardId(dest.id);
    if (cardRefs.current[dest.id]) {
      cardRefs.current[dest.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex overflow-hidden bg-slate-100 dark:bg-slate-950">
      
      {/* ========================================================= */}
      {/* LEFT PANEL: DAFTAR LOKASI & FILTER (Desktop Sidebar / Mobile View) */}
      {/* ========================================================= */}
      <aside
        className={`
          flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-20 transition-all duration-300
          ${isSidebarOpen ? 'w-full md:w-[380px] lg:w-[420px]' : 'w-0 -ml-full md:-ml-[380px] lg:-ml-[420px] overflow-hidden'}
          ${mobileActiveTab === 'list' ? 'block fixed inset-0 top-16 md:static' : 'hidden md:flex'}
        `}
      >
        {/* Sidebar Header: Title, Search & Filters */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5 bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-md">
          {/* Title & Close / Collapse Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-cyan-100 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 rounded-xl">
                <List className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">Daftar Lokasi Pesisir</h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {filtered.length} dari {destinations.length} destinasi ditemukan
                </p>
              </div>
            </div>

            {/* Desktop Collapse Button */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="hidden md:flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Sembunyikan panel daftar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Mobile Close to Map */}
            <button
              onClick={() => setMobileActiveTab('map')}
              className="md:hidden flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-600 text-white"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Lihat Peta</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex items-center bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 px-2.5 py-1.5">
            <Search className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Cari pantai, pulau, diving, fasilitas..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-400 hover:text-slate-600 px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Kategori Destinasi
              </span>
              {selectedCategory !== 'Semua' && (
                <button
                  onClick={() => setSelectedCategory('Semua')}
                  className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES.map(category => (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === category.value
                      ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-500'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Region Tabs & Quick Toggles */}
          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/60 dark:border-slate-800">
            {/* Region Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {['Semua', ...REGIONS].map(reg => (
                <button
                  key={reg}
                  onClick={() => setSelectedRegion(reg)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-all ${
                    selectedRegion === reg
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {reg === 'Minahasa Utara' ? 'Minut' : reg}
                </button>
              ))}
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setFilterFamily(!filterFamily)}
                className={`p-1 rounded-md text-[10px] font-semibold flex items-center gap-0.5 border ${
                  filterFamily
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
                title="Filter Ramah Anak"
              >
                <span>👶</span>
              </button>

              <button
                onClick={() => setFilterSnorkel(!filterSnorkel)}
                className={`p-1 rounded-md text-[10px] font-semibold flex items-center gap-0.5 border ${
                  filterSnorkel
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
                title="Filter Spot Snorkeling"
              >
                <span>🤿</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Location List Cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
          {filtered.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-slate-400 dark:text-slate-500">
              <MapPin className="w-8 h-8 mx-auto stroke-1" />
              <p className="text-xs font-semibold">Tidak ada destinasi yang cocok</p>
              <button
                onClick={() => {
                  setSelectedCategory('Semua');
                  setSelectedRegion('Semua');
                  setSearchQuery('');
                  setFilterFamily(false);
                  setFilterSnorkel(false);
                }}
                className="text-xs text-cyan-600 dark:text-cyan-400 underline font-medium"
              >
                Reset Semua Filter
              </button>
            </div>
          ) : (
            filtered.map(dest => {
              const isFav = favorites.includes(dest.id);
              const isHighlighted = activeCardId === dest.id;

              return (
                <div
                  key={dest.id}
                  ref={el => { cardRefs.current[dest.id] = el; }}
                  className={`pt-2.5 first:pt-0 rounded-2xl transition-all ${
                    isHighlighted 
                      ? 'ring-2 ring-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/30 p-2 shadow-md' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-850 p-2'
                  }`}
                >
                  <div className="flex gap-2.5">
                    {/* Thumbnail Image */}
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0">
                      <img
                        src={dest.imageUrl}
                        alt={dest.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onToggleFavorite(dest.id);
                        }}
                        className={`absolute top-1 right-1 p-1 rounded-full backdrop-blur-sm transition-transform active:scale-75 ${
                          isFav ? 'bg-rose-500 text-white' : 'bg-black/50 text-white hover:text-rose-400'
                        }`}
                        title={isFav ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                      >
                        <Heart className="w-2.5 h-2.5 fill-current" />
                      </button>
                    </div>

                    {/* Card Content */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        {/* Badges */}
                        <div className="flex items-center justify-between text-[10px] gap-1">
                          <span className="font-bold text-cyan-600 dark:text-cyan-400 truncate">
                            {dest.category}
                          </span>
                          <div className="flex items-center gap-0.5 font-bold text-amber-500 flex-shrink-0">
                            <Star className="w-3 h-3 fill-current" />
                            <span>{dest.rating}</span>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate mt-0.5">
                          {dest.name}
                        </h3>

                        {/* Region & Entry Fee */}
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>📍 {dest.region}</span>
                          <span>•</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {dest.entryFee == null ? 'Cek pengelola' : dest.entryFee === 0 ? 'Gratis' : `Rp ${dest.entryFee.toLocaleString('id-ID')}`}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          onClick={() => handleFocusDestination(dest)}
                          className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-[10px] font-bold bg-cyan-600 hover:bg-cyan-700 text-white transition-colors"
                          title="Lihat penanda di peta"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>Peta</span>
                        </button>

                        <button
                          onClick={() => onSelectDestination(dest)}
                          className="flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                          title="Detail informasi lengkap"
                        >
                          <Info className="w-3 h-3" />
                          <span>Detail</span>
                        </button>

                        <button
                          onClick={() => calculateRoute(dest)}
                          disabled={isRoutingLoading}
                          className="flex items-center justify-center p-1 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                          title="Rute perjalanan OSRM"
                        >
                          {isRoutingLoading
                            ? <LoaderCircle className="w-3 h-3 animate-spin text-cyan-600 dark:text-cyan-400" />
                            : <Navigation className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* RIGHT PANEL: INTERACTIVE LEAFLET MAP VIEW */}
      {/* ========================================================= */}
      <section className="flex-1 h-full relative overflow-hidden">
        {/* Floating Controls Over Map */}
        <div className="absolute top-3 left-3 right-3 z-30 pointer-events-none flex items-center justify-between gap-2">
          {/* Button to restore/open sidebar when collapsed */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all active:scale-95"
            >
              <List className="w-4 h-4 text-cyan-600" />
              <span>Daftar Lokasi ({filtered.length})</span>
            </button>
          )}

          {/* Active Count Pill */}
          <div className="ml-auto pointer-events-auto px-3 py-1.5 rounded-xl bg-slate-900/85 text-white backdrop-blur-md shadow text-xs font-bold flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>{filtered.length} Destinasi</span>
          </div>
        </div>

        <div className="absolute top-14 right-3 z-30 flex max-w-[min(24rem,calc(100%-1.5rem))] flex-col items-end gap-2">
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocationLoading}
            className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-lg backdrop-blur-md transition hover:text-cyan-700 disabled:cursor-wait disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:text-cyan-300"
            title="Gunakan posisi GPS saat ini"
          >
            {isLocationLoading
              ? <LoaderCircle className="h-4 w-4 animate-spin" />
              : <Navigation className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
            <span>{isLocationLoading ? 'Mencari lokasi…' : 'Lokasi saya'}</span>
          </button>
          {(routeError || locationError) && (
            <p role="status" className="pointer-events-auto rounded-xl border border-amber-300 bg-amber-50/95 p-3 text-xs text-amber-950 shadow-lg backdrop-blur-md dark:border-amber-800 dark:bg-amber-950/90 dark:text-amber-100">
              {routeError || locationError}
            </p>
          )}
        </div>

        {/* Active Route Floating Card */}
        {routeInfo && (
          <div className="absolute bottom-5 left-4 right-4 md:left-6 md:right-auto md:w-96 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-cyan-500/30">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 rounded-xl">
                  {routeInfo.boatFee > 0 ? <Ship className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-xs text-slate-500 dark:text-slate-400 font-medium">Rekomendasi Perjalanan</h4>
                  <p className="text-sm font-bold text-slate-800 dark:text-white line-clamp-1">{routeInfo.destName}</p>
                </div>
              </div>
              <button 
                onClick={clearRoute}
                className="text-xs text-slate-400 hover:text-rose-500 p-1"
              >
                Tutup
              </button>
            </div>
            {routeInfo.boatFee > 0 ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="flex items-center gap-1.5 font-bold"><Ship className="h-4 w-4" /> Akses darat + laut</p>
                <p className="mt-1.5 leading-relaxed">
                  Destinasi ini memerlukan perjalanan darat ke dermaga, lalu dilanjutkan dengan perahu/kapal. Biaya perahu yang tercatat: <strong>Rp {routeInfo.boatFee.toLocaleString('id-ID')}</strong>.
                </p>
                <p className="mt-1 leading-relaxed">Konfirmasi dermaga, jadwal dan harga terbaru kepada pengelola. Periksa cuaca serta kondisi ombak sebelum menyeberang. Garis rute hanya menampilkan jalur darat, bukan jalur laut.</p>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${mapCenter[0]}&mlon=${mapCenter[1]}#map=13/${mapCenter[0]}/${mapCenter[1]}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 font-bold text-cyan-800 hover:underline dark:text-cyan-300"
                >
                  Lihat lokasi destinasi <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">Jarak Estimasi</span>
                  <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">{routeInfo.distanceKm} km</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Waktu Tempuh Darat</span>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">~{routeInfo.durationMin} Menit</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Titik Awal</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Lokasi Anda</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leaflet Interactive Map Container */}
        <MapContainer
          center={defaultCenter}
          zoom={10}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          <MapController center={mapCenter} zoom={mapZoom} />
          <MapResizer isSidebarOpen={isSidebarOpen} mobileTab={mobileActiveTab} />

          {/* Clean OpenStreetMap Tile Layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* User Location Marker */}
          {userLocation && (
            <Marker position={userLocation} icon={userLocationIcon}>
              <Popup>
                <div className="p-2 text-center">
                  <span className="text-xs font-bold text-slate-800">Lokasi GPS Anda (Titik Awal)</span>
                  <p className="text-[11px] text-slate-500">Posisi diperoleh dari perangkat Anda</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* OSRM Route Polyline */}
          {activeRoute && (
            <Polyline
              positions={activeRoute}
              color="#06b6d4"
              weight={5}
              opacity={0.85}
              dashArray="2, 6"
            />
          )}

          {/* Destination Markers */}
          {filtered.map(dest => {
            const isFav = favorites.includes(dest.id);
            const isSelected = activeCardId === dest.id;

            return (
              <Marker
                key={dest.id}
                ref={el => { markerRefs.current[dest.id] = el; }}
                position={[dest.coordinates.lat, dest.coordinates.lng]}
                icon={createCategoryIcon(dest.category, isSelected)}
                eventHandlers={{
                  click: () => handleMarkerClick(dest)
                }}
              >
                <Popup>
                  <div className="w-64 overflow-hidden rounded-xl">
                    {/* Image banner */}
                    <div className="relative h-28 w-full bg-slate-200">
                      <img 
                        src={dest.imageUrl} 
                        alt={dest.name} 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 text-white backdrop-blur-sm">
                        {dest.region}
                      </div>
                      <button
                        onClick={() => onToggleFavorite(dest.id)}
                        className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-sm transition-transform active:scale-90 ${
                          isFav ? 'bg-rose-500 text-white' : 'bg-black/50 text-white hover:text-rose-400'
                        }`}
                      >
                        ♥
                      </button>
                    </div>

                    {/* Body Content */}
                    <div className="p-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-cyan-600 dark:text-cyan-400 tracking-wider">
                          {dest.category}
                        </span>
                        <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>{dest.rating}</span>
                        </div>
                      </div>

                      <h3 className="font-bold text-sm mt-0.5 line-clamp-1">{dest.name}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                        {dest.description}
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[9px]">Tiket Masuk</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {dest.entryFee == null ? 'Cek pengelola' : dest.entryFee === 0 ? 'Gratis' : `Rp ${dest.entryFee.toLocaleString('id-ID')}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">
                            {isMarineCategory(dest.category) ? 'Karakter Ombak' : 'Wilayah'}
                          </span>
                          <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                            {isMarineCategory(dest.category) ? dest.waveConditionDefault : dest.region}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-3 grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => calculateRoute(dest)}
                          disabled={isRoutingLoading}
                          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5 text-cyan-600" />
                          <span>Rute</span>
                        </button>

                        <button
                          onClick={() => onSelectDestination(dest)}
                          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 text-white transition-colors"
                        >
                          <Info className="w-3.5 h-3.5" />
                          <span>Detail</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Mobile View Switcher Pill at Bottom */}
        <div className="md:hidden absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
          <div className="flex items-center p-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full shadow-2xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setMobileActiveTab('map')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                mobileActiveTab === 'map'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Peta</span>
            </button>
            <button
              onClick={() => setMobileActiveTab('list')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                mobileActiveTab === 'list'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Daftar ({filtered.length})</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
