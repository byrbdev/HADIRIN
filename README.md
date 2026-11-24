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
