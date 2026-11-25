-- Ubah target kerja bersih menjadi 480 menit (8 jam) pada database yang sudah berjalan.
-- Jalankan sekali di Supabase > SQL Editor (atau ubah lewat halaman Setting).
alter table settings alter column target_minutes set default 480;
update settings set target_minutes = 480 where id = 1;
