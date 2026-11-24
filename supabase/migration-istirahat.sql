-- Migrasi aturan jam kerja bersih (jalankan sekali di Supabase > SQL Editor).
-- Aman untuk data lama: absensi lama mendapat breaks = [] (tanpa istirahat tercatat).
alter table attendance add column if not exists breaks jsonb not null default '[]'::jsonb;  -- [{"s":"<iso>","e":"<iso>|null"}]
alter table settings   add column if not exists target_minutes int not null default 420;   -- kerja bersih minimal untuk boleh pulang
