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

Untuk produksi, jalankan `npm run build`. Integrasi AI dan Firebase membutuhkan konfigurasi key masing-masing; peta OpenStreetMap tidak memerlukan Google Maps API key.

## Menghubungkan Firebase

1. Buat project di [Firebase Console](https://console.firebase.google.com/) dan daftarkan aplikasi Web.
2. Salin konfigurasi aplikasi Web ke file `.env` di folder utama, gunakan [.env.example](./.env.example) sebagai template. Ganti semua nilai contoh dengan nilai dari **Project settings → Your apps → SDK setup and configuration**. Jangan unggah `.env` ke Git.
3. Buka **Authentication → Sign-in method**, lalu aktifkan **Email/Password** untuk admin dan **Google** untuk pengguna.
4. Buka **Authentication → Users** dan buat akun dengan email `morendyyonathanrumegang@gmail.com`. Atur sandinya di Firebase Console; jangan masukkan sandi ke file proyek.
5. Buat database di **Firestore Database**. Aplikasi menggunakan koleksi `destinations`, serta data privat per pengguna di `users/{uid}/private/favorites` dan `users/{uid}/itineraries`.
6. Atur Firestore Security Rules sebelum aplikasi dipakai oleh pengguna nyata. Katalog perlu dapat dibaca pengguna, sedangkan perubahan destinasi harus dibatasi untuk admin dan data privat harus dibatasi ke pemilik akun. Ulasan saat ini disimpan bersama dokumen destinasi, sehingga aturan tulis untuk ulasan perlu dirancang agar pengguna hanya dapat menambah/menghapus ulasannya sendiri dan tidak dapat mengubah data destinasi atau ulasan pengguna lain.
7. Hentikan dan jalankan ulang `npm run dev` setelah menyimpan `.env`. Aplikasi menampilkan peringatan jika Firebase belum dikonfigurasi atau operasi cloud ditolak.

Firebase Web API key berada di aplikasi browser dan bukan pengganti Firestore Security Rules. Akses admin saat ini juga memeriksa daftar email di aplikasi; batasi operasi admin di Firestore Rules atau backend tepercaya untuk penggunaan produksi.

## Struktur

```text
src/
├── components/       # Peta, planner, chatbot, autentikasi, dan dashboard
├── data/             # Katalog destinasi awal
├── services/         # AI, cuaca, dan Firebase
└── types/            # Tipe wilayah, kategori, dan destinasi
```
