-- Migrasi jam istirahat yang bisa diatur di halaman Setting (jalankan sekali di Supabase > SQL Editor).
-- Format: dua istirahat, masing-masing jam scan keluar dibuka (out) dan jam scan masuk dibuka (back), waktu WIB.
alter table settings add column if not exists break_slots jsonb not null default
  '[{"out":"11:40","back":"12:40"},{"out":"14:40","back":"15:40"}]'::jsonb;
