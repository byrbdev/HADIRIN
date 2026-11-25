# HADIRIN By RB — sisi Admin (Spark Admin + Supabase)

## Jalankan lokal (tanpa Vercel)
1. `npm install`
2. Edit `.env`: isi `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `QR_SECRET`.
   - Cloud: proyek Supabase gratis, atau lokal penuh: `npx supabase start` (URL `http://127.0.0.1:54321`, key tampil di terminal).
3. Jalankan `supabase/schema.sql` di Supabase SQL Editor (tanpa baris komentar terakhir).
4. `npm run seed` → membuat admin default + 3 karyawan contoh.
5. `npm run dev` (dev-server.js) → buka http://localhost:3000

Akun default (dari `.env`): admin `admin@hadirin.test` / `admin12345`; karyawan `karyawan1..3@hadirin.test` / `karyawan123`.
Di mode dev, form login terisi otomatis.

## Deploy ke Vercel
Set env `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `QR_SECRET` di Vercel, lalu deploy.
Untuk produksi: ganti password default / hapus akun contoh, dan jangan set `HADIRIN_DEV`
(kredensial default hanya dikirim ke browser pada mode dev lokal).

## Aturan jam kerja (kerja bersih)
- Jam masuk bebas; sistem hanya mencatat scan masuk. Istirahat (dzuhur, ashar, dst.) dicatat lewat scan keluar/kembali
  (di app: pilih **Istirahat** lalu scan; scan berikutnya = kembali). Durasi = selisih scan; tidak ada batas minimal.
- **Jendela scan istirahat (dicek di server, WIB):** keluar istirahat ke-1 dibuka 11:40, ke-2 dibuka 14:40; scan masuk setelah
  istirahat ke-1 dibuka 12:40, ke-2 dibuka 15:40. Tiap istirahat hanya sekali. Angka ini bawaan; admin mengubahnya di **Setting > Jam Istirahat**
  (disimpan di `settings.break_slots`; **database lama:** jalankan `supabase/migration-jam-istirahat.sql` sekali). Bawaan ada di `BREAK_SLOTS` (`api/_hours.js` + `assets/js/hours.js`).
  Di app, scan istirahat/masuk yang berhasil menampilkan overlay "Selamat Istirahat" / "Selamat bekerja!".
- Kerja bersih = (sekarang atau jam pulang − jam masuk) − total istirahat. Pulang hanya boleh bila kerja bersih ≥ `target_minutes`
  (default 480 = 8 jam) dan tidak sedang istirahat. Jam pulang paling cepat = jam masuk + target + total istirahat.
- Telat bukan pelanggaran; hanya "utang menit" (informasi) yang lunas dengan memotong istirahat atau pulang lebih lambat.
- Target diubah di Setting. Laporan admin memuat kolom Telat, Total Istirahat, Kerja Bersih (juga di Export CSV).
- **Database lama:** jalankan `supabase/migration-istirahat.sql` sekali di SQL Editor. Instalasi baru cukup `schema.sql`.
- Tes aturan: `npm run test:rules`. Logika hitung ada di `api/_hours.js` (server) dan `assets/js/hours.js` (klien); tes memastikan keduanya sama.

## Struktur admin (tanpa reload antar halaman)
- `assets/js/guard.js` jalan di `<head>`: tanpa sesi login langsung ke `/login`, dan halaman ditutup layar boot sampai admin terverifikasi (tidak ada kilatan dashboard).
- `assets/js/core.js` membangun sidebar/navbar sekali, lalu router menukar isi `#app-content` (fetch + prefetch, `history.pushState`).
- Tiap halaman punya skrip sendiri di `assets/js/pages/<nama>.js` (`Pages.nama = () => { ...; return cleanup }`). Cleanup menutup realtime, interval, dan modal saat pindah halaman.
- Jabatan: **Karyawan** (role `employee`, memakai app) atau **Admin** (role `admin`, masuk dashboard). NIP otomatis berawalan `RB-`.
