import React, { useState } from 'react';
import { DESTINATION_CATEGORIES, Destination, Region, Category, isMarineCategory, REGIONS } from '../types/destination';
import { saveDestination, deleteDestination, deleteReview } from '../services/firebaseService';
import { 
  Shield, Plus, Edit3, Trash2, CheckCircle2, 
  MapPin, Star, AlertTriangle, Layers, MessageSquare, 
  Sliders, X, Save
} from 'lucide-react';

interface AdminDashboardProps {
  destinations: Destination[];
  onUpdateDestinations: (updated: Destination[]) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  destinations,
  onUpdateDestinations
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'destinations' | 'reviews'>('destinations');
  const [isEditingModalOpen, setIsEditingModalOpen] = useState<boolean>(false);
  const [editingDest, setEditingDest] = useState<Partial<Destination> | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Form states for adding/editing destination
  const [formName, setFormName] = useState('');
  const [formRegion, setFormRegion] = useState<Region>('Manado');
  const [formCategory, setFormCategory] = useState<Category>('Pantai');
  const [formDesc, setFormDesc] = useState('');
  const [formLat, setFormLat] = useState('1.5');
  const [formLng, setFormLng] = useState('124.8');
  const [formEntryFee, setFormEntryFee] = useState('10000');
  const [formBoatFee, setFormBoatFee] = useState('0');
  const [formGearFee, setFormGearFee] = useState('0');
  const [formFamily, setFormFamily] = useState(true);
  const [formSnorkel, setFormSnorkel] = useState(false);
  const [formWave, setFormWave] = useState<'Tenang' | 'Sedang' | 'Berombak'>('Tenang');
  const [formImageUrl, setFormImageUrl] = useState('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80');
  const [formFacilities, setFormFacilities] = useState('Gazebo, Toilet, Warung Makan');

  // Stats
  const totalReviews = destinations.reduce((sum, d) => sum + (d.reviews?.length || 0), 0);
  const topRegions = REGIONS
    .map(region => ({ region, count: destinations.filter(destination => destination.region === region).length }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const handleOpenAdd = () => {
    setEditingDest(null);
    setFormName('');
    setFormRegion('Manado');
    setFormCategory('Pantai');
    setFormDesc('');
    setFormLat('1.5000');
    setFormLng('124.8500');
    setFormEntryFee('10000');
    setFormBoatFee('0');
    setFormGearFee('0');
    setFormFamily(true);
    setFormSnorkel(false);
    setFormWave('Tenang');
    setFormFacilities('Toilet, Gazebo, Warung');
    setIsEditingModalOpen(true);
  };

  const handleOpenEdit = (dest: Destination) => {
    setEditingDest(dest);
    setFormName(dest.name);
    setFormRegion(dest.region);
    setFormCategory(dest.category);
    setFormDesc(dest.description);
    setFormLat(dest.coordinates.lat.toString());
    setFormLng(dest.coordinates.lng.toString());
    setFormEntryFee(dest.entryFee?.toString() ?? '');
    setFormBoatFee(dest.boatFee.toString());
    setFormGearFee(dest.gearRentFee.toString());
    setFormFamily(dest.isFamilyFriendly);
    setFormSnorkel(dest.isSnorkelingSpot);
    setFormWave(dest.waveConditionDefault);
    setFormImageUrl(dest.imageUrl);
    setFormFacilities(dest.facilities.join(', '));
    setIsEditingModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const destId = editingDest?.id || `dest-${Date.now()}`;
    const newDest: Destination = {
      id: destId,
      name: formName,
      region: formRegion,
      category: formCategory,
      description: formDesc,
      coordinates: {
        lat: parseFloat(formLat) || 1.5,
        lng: parseFloat(formLng) || 124.8
      },
      entryFee: formEntryFee.trim() ? parseInt(formEntryFee, 10) : undefined,
      boatFee: parseInt(formBoatFee) || 0,
      gearRentFee: parseInt(formGearFee) || 0,
      isFamilyFriendly: formFamily,
      isSnorkelingSpot: formSnorkel,
      isDivingSpot: false,
      waveConditionDefault: formWave,
      bestTimeToVisit: '08:00 - 17:00 WITA',
      facilities: formFacilities.split(',').map(s => s.trim()).filter(Boolean),
      imageUrl: formImageUrl || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
      rating: editingDest?.rating || 4.5,
      reviewCount: editingDest?.reviewCount || 0,
      reviews: editingDest?.reviews || []
    };

    try {
      const updated = await saveDestination(newDest);
      onUpdateDestinations(updated);
      setStorageError(null);
      setIsEditingModalOpen(false);
    } catch (error) {
      console.error('Unable to save destination:', error);
      setStorageError('Destinasi gagal disimpan ke Firebase. Periksa koneksi dan aturan akses.');
    }
  };

  const handleDeleteDest = async (id: string, name: string) => {
    if (window.confirm(`Yakin ingin menghapus objek wisata "${name}"?`)) {
      try {
        const updated = await deleteDestination(id);
        onUpdateDestinations(updated);
        setStorageError(null);
      } catch (error) {
        console.error('Unable to delete destination:', error);
        setStorageError('Destinasi gagal dihapus dari Firebase. Periksa koneksi dan aturan akses.');
      }
    }
  };

  const handleModerateReview = async (destId: string, reviewId: string) => {
    if (window.confirm('Hapus ulasan ini dari moderasi publik?')) {
      try {
        const updated = await deleteReview(destId, reviewId);
        onUpdateDestinations(updated);
        setStorageError(null);
      } catch (error) {
        console.error('Unable to moderate review:', error);
        setStorageError('Ulasan gagal dihapus dari Firebase. Periksa koneksi dan aturan akses.');
      }
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {storageError && (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {storageError}
          </p>
        )}
        
        {/* Header & Admin Role Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-slate-800 text-white rounded-xl">
                <Shield className="w-5 h-5 text-amber-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                Dashboard Admin Dinas Pariwisata
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manajemen katalog destinasi Sulawesi Utara & moderasi ulasan pengguna
            </p>
          </div>

        </div>

        {/* Overview Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-slate-400 text-xs font-semibold block">Total Objek Wisata</span>
            <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1 block">
              {destinations.length}
            </span>
            <span className="text-[10px] text-slate-500">Tercatat di Sistem</span>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-slate-400 text-xs font-semibold block">Total Ulasan Publik</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
              {totalReviews}
            </span>
            <span className="text-[10px] text-slate-500">Ulasan Pengunjung</span>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-slate-400 text-xs font-semibold block">Sebaran Wilayah</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block">
              {topRegions.map(({ region, count }) => `${region}: ${count}`).join(' • ') || 'Belum ada data'}
            </span>
            <span className="text-[10px] text-slate-500">Destinasi per wilayah</span>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-slate-400 text-xs font-semibold block">Status Sinkronisasi</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Realtime Aktif</span>
            </span>
            <span className="text-[10px] text-slate-500">Firestore & Cache</span>
          </div>
        </div>

        {/* Tab Switcher: Destinasi vs Moderasi Review */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <button
            onClick={() => setActiveSubTab('destinations')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'destinations'
                ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Daftar Objek Wisata ({destinations.length})
          </button>

          <button
            onClick={() => setActiveSubTab('reviews')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'reviews'
                ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Moderasi Review Pengguna
          </button>

          {activeSubTab === 'destinations' && (
            <button
              onClick={handleOpenAdd}
              className="ml-auto px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Wisata Baru</span>
            </button>
          )}
        </div>

        {/* SUBTAB 1: CRUD DESTINATIONS TABLE */}
        {activeSubTab === 'destinations' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Nama & Wilayah</th>
                    <th className="p-3.5">Kategori</th>
                    <th className="p-3.5">Tiket / Biaya</th>
                    <th className="p-3.5">Karakter</th>
                    <th className="p-3.5">Rating</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {destinations.map(dest => (
                    <tr key={dest.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800 dark:text-white">
                          {dest.name}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {dest.region} • ({dest.coordinates.lat.toFixed(3)}, {dest.coordinates.lng.toFixed(3)})
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300">
                          {dest.category}
                        </span>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-700 dark:text-slate-300">
                        {dest.entryFee == null ? 'Cek pengelola' : dest.entryFee === 0 ? 'Gratis' : `Rp ${dest.entryFee.toLocaleString('id-ID')}`}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1 text-[10px]">
                          {dest.isFamilyFriendly && <span title="Ramah Anak">👶</span>}
                          {dest.isSnorkelingSpot && <span title="Spot Snorkeling">🤿</span>}
                          {isMarineCategory(dest.category) && (
                            <span className="text-slate-400">({dest.waveConditionDefault})</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1 font-bold text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>{dest.rating}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        <button
                          onClick={() => handleOpenEdit(dest)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Wisata"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDest(dest.id, dest.name)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Hapus Wisata"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBTAB 2: REVIEW MODERATION */}
        {activeSubTab === 'reviews' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Admin dapat memoderasi ulasan yang tidak pantas, spam, atau melanggar etika.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {destinations.flatMap(dest => 
                (dest.reviews || []).map(rev => ({
                  ...rev,
                  destinationName: dest.name,
                  destinationId: dest.id
                }))
              ).map(revItem => (
                <div 
                  key={revItem.id}
                  className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold block">
                        Destinasi: {revItem.destinationName}
                      </span>
                      <span className="font-extrabold text-slate-800 dark:text-white">
                        {revItem.userName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center text-amber-400">
                        {Array.from({ length: revItem.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-current" />
                        ))}
                      </div>
                      <button
                        onClick={() => handleModerateReview(revItem.destinationId, revItem.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Hapus Ulasan (Moderasi)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-600 dark:text-slate-300 italic">
                    "{revItem.comment}"
                  </p>
                  <span className="text-[10px] text-slate-400 block">
                    Tanggal: {revItem.createdAt}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODAL EDIT / TAMBAH DESTINASI */}
        {isEditingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-6">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {editingDest ? 'Edit Objek Wisata' : 'Tambah Objek Wisata Pesisir Baru'}
                </h3>
                <button
                  onClick={() => setIsEditingModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveForm} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Objek Wisata
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Wilayah
                    </label>
                    <select
                      value={formRegion}
                      onChange={e => setFormRegion(e.target.value as Region)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      {REGIONS.map(region => (
                        <option key={region} value={region}>{region}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Kategori
                    </label>
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value as Category)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      {DESTINATION_CATEGORIES.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Deskripsi Singkat
                  </label>
                  <textarea
                    rows={2}
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Latitude
                    </label>
                    <input
                      type="text"
                      value={formLat}
                      onChange={e => setFormLat(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Longitude
                    </label>
                    <input
                      type="text"
                      value={formLng}
                      onChange={e => setFormLng(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tiket (Rp)
                    </label>
                    <input
                      type="number"
                      value={formEntryFee}
                      onChange={e => setFormEntryFee(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Perahu (Rp)
                    </label>
                    <input
                      type="number"
                      value={formBoatFee}
                      onChange={e => setFormBoatFee(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Kondisi Ombak
                    </label>
                    <select
                      value={formWave}
                      onChange={e => setFormWave(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      <option value="Tenang">Tenang</option>
                      <option value="Sedang">Sedang</option>
                      <option value="Berombak">Berombak</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 py-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formFamily}
                      onChange={e => setFormFamily(e.target.checked)}
                      className="w-4 h-4 text-cyan-600 rounded"
                    />
                    <span>Ramah Anak</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formSnorkel}
                      onChange={e => setFormSnorkel(e.target.checked)}
                      className="w-4 h-4 text-cyan-600 rounded"
                    />
                    <span>Spot Snorkeling</span>
                  </label>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Fasilitas (Pisahkan dengan koma)
                  </label>
                  <input
                    type="text"
                    value={formFacilities}
                    onChange={e => setFormFacilities(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    URL Gambar
                  </label>
                  <input
                    type="text"
                    value={formImageUrl}
                    onChange={e => setFormImageUrl(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
