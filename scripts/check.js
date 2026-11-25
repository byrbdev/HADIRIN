// npm run check : memeriksa koneksi Supabase, key, tabel, dan login admin default
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
if (fs.existsSync('.env')) for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]; }
const E = process.env, ok = (m) => console.log('  [OK]   ' + m), bad = (m) => console.log('  [GAGAL] ' + m);
const role = (k) => { try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64url')).role; } catch { return k?.startsWith('sb_secret') ? 'service_role' : k?.startsWith('sb_publishable') ? 'anon' : '?'; } };
console.log('1. Konfigurasi .env');
if (!E.SUPABASE_URL || E.SUPABASE_URL.includes('xxxx')) { bad('SUPABASE_URL belum diisi'); process.exit(1); } else ok('URL: ' + E.SUPABASE_URL);
const ra = role(E.SUPABASE_ANON_KEY), rs = role(E.SUPABASE_SERVICE_ROLE_KEY);
ra === 'anon' ? ok('ANON key benar (role anon)') : bad(`SUPABASE_ANON_KEY berperan "${ra}", seharusnya anon`);
rs === 'service_role' ? ok('SERVICE ROLE key benar') : bad(`SUPABASE_SERVICE_ROLE_KEY berperan "${rs}", seharusnya service_role (mungkin tertukar dengan anon)`);
const svc = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY), anon = createClient(E.SUPABASE_URL, E.SUPABASE_ANON_KEY);
console.log('2. Database (service role)');
const { data: ps, error: pe } = await svc.from('profiles').select('full_name,role,active');
if (pe) bad('Tabel profiles tidak terbaca: ' + pe.message); else { ok(`profiles berisi ${ps.length} baris`); ps.forEach((p) => console.log(`         - ${p.full_name} (${p.role}, ${p.active ? 'aktif' : 'nonaktif'})`)); if (!ps.some((p) => p.role === 'admin' && p.active)) bad('Belum ada admin aktif di profiles -> jalankan npm run seed'); }
const { data: st, error: se } = await svc.from('settings').select('radius_m').eq('id', 1).single(); se ? bad('Tabel settings: ' + se.message) : ok('settings OK (radius ' + st.radius_m + ' m)');
const { error: be } = await svc.from('settings').select('break_slots').eq('id', 1).single(); be ? bad('Kolom break_slots belum ada -> jalankan supabase/migration-jam-istirahat.sql (pakai jam istirahat bawaan sampai itu)') : ok('jam istirahat (break_slots) OK');
console.log('3. Login admin default (seperti browser)');
const { data: l, error: le } = await anon.auth.signInWithPassword({ email: E.DEFAULT_ADMIN_EMAIL, password: E.DEFAULT_ADMIN_PASSWORD });
if (le) bad('Login gagal: ' + le.message); else {
  ok('Login berhasil');
  const { data: me, error: me_e } = await anon.from('profiles').select('role').eq('id', l.user.id).single();
  me_e ? bad('Admin tidak bisa baca profilnya sendiri (RLS/tabel): ' + me_e.message) : me.role === 'admin' ? ok('Profil admin terbaca -> dashboard seharusnya bisa dibuka') : bad('Role profil: ' + me.role);
}
