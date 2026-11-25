-- HADIRIN schema. Jalankan di Supabase > SQL Editor.
create table profiles(
  id uuid primary key references auth.users on delete cascade,
  full_name text not null, nip text, position text, phone text,
  role text not null default 'employee' check (role in ('admin','employee')),
  active boolean not null default true, created_at timestamptz default now());
create table attendance(
  id bigserial primary key, user_id uuid not null references profiles on delete cascade,
  work_date date not null, check_in timestamptz, check_out timestamptz,
  in_lat float8, in_lng float8, out_lat float8, out_lng float8,
  breaks jsonb not null default '[]'::jsonb,  -- scan istirahat: [{"s":iso,"e":iso|null}]
  unique(user_id, work_date));
create table leaves(
  id bigserial primary key, user_id uuid not null references profiles on delete cascade,
  type text not null check (type in ('izin','sakit')),
  start_date date not null, end_date date not null, reason text,
  attachment_path text, status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now());
create table settings(
  id int primary key default 1 check (id=1),
  office_lat float8 default -6.9175, office_lng float8 default 107.6191, radius_m int default 100,
  work_start time default '08:00', work_end time default '17:00',
  target_minutes int not null default 420,   -- kerja bersih minimal (menit) untuk boleh pulang
  break_slots jsonb not null default '[{"out":"11:40","back":"12:40"},{"out":"14:40","back":"15:40"}]'::jsonb);  -- jam scan istirahat (WIB)
insert into settings default values;

create function is_admin() returns boolean language sql security definer stable as
$$ select exists(select 1 from profiles where id=auth.uid() and role='admin' and active) $$;

alter table profiles enable row level security; alter table attendance enable row level security;
alter table leaves enable row level security; alter table settings enable row level security;
create policy p_sel on profiles for select using (id=auth.uid() or is_admin());
create policy p_adm on profiles for all using (is_admin());
create policy a_sel on attendance for select using (user_id=auth.uid() or is_admin());   -- tulis hanya lewat API (service role)
create policy l_sel on leaves for select using (user_id=auth.uid() or is_admin());
create policy l_ins on leaves for insert with check (user_id=auth.uid());
create policy l_adm on leaves for update using (is_admin());
create policy s_sel on settings for select using (auth.role()='authenticated');
create policy s_upd on settings for update using (is_admin());

alter publication supabase_realtime add table attendance, leaves;
insert into storage.buckets(id,name,public) values('leave-files','leave-files',false) on conflict do nothing;
create policy lf_up on storage.objects for insert with check (bucket_id='leave-files' and auth.uid() is not null);
create policy lf_sel on storage.objects for select using (bucket_id='leave-files' and (is_admin() or owner=auth.uid()));

-- Izin level tabel (proyek Supabase baru tidak memberi otomatis). Akses data tetap dibatasi RLS di atas.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- Setelah membuat akun admin pertama di Authentication > Users, jalankan:
-- insert into profiles(id,full_name,role) values ('<UUID-ADMIN>','Administrator','admin');
