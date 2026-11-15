# Localist

Localist membantu wisatawan menjelajahi destinasi di Sulawesi Utara, dari wisata pesisir hingga gunung, danau, air terjun, budaya, dan kuliner. Katalog awal mencakup Manado, Bitung, Tomohon, Minahasa, Minahasa Utara, Minahasa Tenggara, Bolaang Mongondow Timur, dan Kepulauan Sangihe; pilihan wilayah pada peta dan dashboard admin mencakup seluruh kabupaten/kota di provinsi ini.

## Fitur

- Peta interaktif Leaflet/OpenStreetMap dengan filter wilayah dan kategori.
- Rute jalan menggunakan OSRM; destinasi yang memerlukan perahu menampilkan rekomendasi perjalanan darat-laut.
- AI trip planner dan chatbot dengan konteks dari katalog destinasi.
- Cuaca dan informasi keselamatan laut untuk destinasi pesisir.
- Favorit, itinerary tersimpan, ulasan, dan dashboard admin untuk mengelola katalog.
- Mode gelap dan terang.

Biaya masuk dan fasilitas destinasi baru ditandai perlu dikonfirmasi jika belum terverifikasi. Status gunung api, akses, cuaca, dan aturan pengelola perlu diperiksa sebelum perjalanan.

## Menjalankan aplikasi

```bash
npm install
npm run dev
```

Untuk produksi, jalankan `npm run build`. AI menggunakan Firebase AI Logic dan konfigurasi Firebase; pengguna tidak perlu memasukkan Gemini API key. Peta OpenStreetMap tidak memerlukan Google Maps API key.

## Menghubungkan Firebase

1. Buat project di [Firebase Console](https://console.firebase.google.com/) dan daftarkan aplikasi Web.
2. Salin konfigurasi aplikasi Web ke file `.env` di folder utama, gunakan [.env.example](./.env.example) sebagai template. Ganti semua nilai contoh dengan nilai dari **Project settings → Your apps → SDK setup and configuration**. Jangan unggah `.env` ke Git.
3. Buka **Authentication → Sign-in method**, lalu aktifkan **Email/Password** untuk admin dan **Google** untuk pengguna.
4. Buka **Authentication → Users** dan buat akun dengan email admin yang diizinkan aplikasi (`andreaserr@gmail.com` pada konfigurasi saat ini). Atur sandinya di Firebase Console; jangan masukkan sandi ke file proyek.
5. Buat database di **Firestore Database**. Aplikasi menggunakan koleksi `destinations` dan `destinationReviews`, serta data privat per pengguna di `users/{uid}/private/favorites` dan `users/{uid}/itineraries`.
6. Salin aturan dari [firestore.rules](./firestore.rules) ke **Firestore Database → Rules**, sesuaikan email admin bila perlu, lalu klik **Publish**. Aturan mengizinkan pengguna masuk membuat ulasan atas nama akun sendiri, sementara perubahan katalog tetap dibatasi untuk admin.
7. Login melalui form Administrator. Saat admin membuka aplikasi, katalog bawaan akan ditambahkan ke Firestore untuk destinasi yang belum ada; destinasi yang sudah ada tidak ditimpa. Setelah menambah tempat, pastikan dokumennya muncul di **Firestore Database → Data → destinations**.
8. Hentikan dan jalankan ulang `npm run dev` setelah menyimpan `.env`. Aplikasi menampilkan kesalahan Firestore jika inisialisasi atau aturan akses gagal.

Firebase Web API key berada di aplikasi browser dan bukan pengganti Firestore Security Rules. Email admin di Firestore Rules harus sama dengan email yang diizinkan di `src/services/firebaseService.ts`.

## Menghubungkan Firebase AI Logic

1. Di Firebase Console, buka **AI Services → AI Logic → Get started**, pilih **Gemini Developer API**, lalu selesaikan penyiapan untuk project dan aplikasi Web yang sama.
2. AI Logic menggunakan App Check. Saat menjalankan aplikasi lokal (`npm run dev`), buka browser developer console, salin debug token yang dicetak, lalu daftarkan di **Security → App Check → Apps → aplikasi Web → Manage debug tokens**. Jangan masukkan token ini ke `.env` atau commit ke Git.
3. Untuk production, daftarkan aplikasi Web dengan provider reCAPTCHA v3 di App Check dan tambahkan site key-nya ke environment build sebagai `VITE_FIREBASE_APP_CHECK_SITE_KEY`.
4. Jalankan ulang aplikasi. Trip planner, chatbot, ringkasan ulasan, dan analisis cuaca akan menggunakan Firebase AI Logic. Jika layanan belum aktif atau permintaan gagal, fitur AI menggunakan fallback lokal.

Tidak diperlukan `VITE_GEMINI_API_KEY` maupun API key Gemini di menu pengguna.

## Struktur

```text
src/
├── components/       # Peta, planner, chatbot, autentikasi, dan dashboard
├── data/             # Katalog destinasi awal
├── services/         # AI, cuaca, dan Firebase
└── types/            # Tipe wilayah, kategori, dan destinasi
```
