-- Toleransi masuk kembali setelah istirahat (jalankan sekali di Supabase > SQL Editor; butuh kolom break_slots dari migration-jam-istirahat.sql).
-- due = jam masuk kembali yang dianggap tepat waktu, grace = toleransi (menit). Scan masuk telat <= grace dicatat tepat jam due (13:07 -> 13:00).
update settings set break_slots =
  '[{"out":"11:40","back":"12:40","due":"13:00","grace":15},{"out":"14:40","back":"15:40","due":"16:00","grace":15}]'::jsonb where id = 1;
alter table settings alter column break_slots set default
  '[{"out":"11:40","back":"12:40","due":"13:00","grace":15},{"out":"14:40","back":"15:40","due":"16:00","grace":15}]'::jsonb;
-- Opsional (percepat query absensi karyawan): hanya jika belum ada unique/index (user_id, work_date)
create index if not exists attendance_user_date_idx on attendance(user_id, work_date);
