# HADIRIN — sisi Admin (Spark Admin + Supabase)

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
- Kerja bersih = (sekarang atau jam pulang − jam masuk) − total istirahat. Pulang hanya boleh bila kerja bersih ≥ `target_minutes`
  (default 420 = 7 jam) dan tidak sedang istirahat. Jam pulang paling cepat = jam masuk + target + total istirahat.
- Telat bukan pelanggaran; hanya "utang menit" (informasi) yang lunas dengan memotong istirahat atau pulang lebih lambat.
- Target diubah di Setting. Laporan admin memuat kolom Telat, Total Istirahat, Kerja Bersih (juga di Export CSV).
- **Database lama:** jalankan `supabase/migration-istirahat.sql` sekali di SQL Editor. Instalasi baru cukup `schema.sql`.
- Tes aturan: `npm run test:rules`. Logika hitung ada di `api/_hours.js` (server) dan `assets/js/hours.js` (klien); tes memastikan keduanya sama.
