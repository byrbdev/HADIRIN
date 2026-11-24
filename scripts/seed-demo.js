// npm run seed:demo          -> isi data contoh (absensi 30 hari + izin/sakit) HANYA untuk karyawan1..3@hadirin.test
// npm run seed:demo -- --clear -> hapus data contoh itu
import fs from 'node:fs';
if (fs.existsSync('.env')) for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]; }
const { db, todayWIB } = await import('../api/_lib.js');
const all = (await db.auth.admin.listUsers({ perPage: 1000 })).data.users;
const ids = all.filter((u) => /^karyawan\d@hadirin\.test$/.test(u.email)).sort((a, b) => a.email.localeCompare(b.email)).map((u) => u.id);
if (!ids.length) { console.log('Karyawan contoh tidak ditemukan. Jalankan npm run seed dulu.'); process.exit(1); }
await db.from('leaves').delete().like('reason', '[DEMO]%');
await db.from('attendance').delete().in('user_id', ids);
if (process.argv.includes('--clear')) { console.log('Data contoh dihapus.'); process.exit(0); }
const day = (off) => new Date(Date.now() + 7 * 3600e3 + off * 864e5).toISOString().slice(0, 10);
const at = (d, h, m) => new Date(`${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+07:00`).toISOString();
const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const today = todayWIB(), rows = [];
for (let off = -30; off <= 0; off++) {
  const d = day(off), wd = new Date(d + 'T00:00:00Z').getUTCDay(); if (wd === 0 || wd === 6) continue;
  ids.forEach((id, i) => {
    if (d === today) { if (i === 2) return; const now = Date.now(); rows.push({ user_id: id, work_date: d, check_in: new Date(now - r(1, 3) * 3600e3).toISOString(), check_out: i === 0 ? null : new Date(now - 600e3).toISOString() }); return; }
    if (Math.random() < 0.12) return;
    rows.push({ user_id: id, work_date: d, check_in: at(d, r(7, 8), r(0, 59)), check_out: Math.random() < 0.9 ? at(d, 17, r(0, 45)) : null });
  });
}
const a = await db.from('attendance').insert(rows); if (a.error) throw a.error;
const lv = await db.from('leaves').insert([
  { user_id: ids[2], type: 'sakit', start_date: today, end_date: day(1), reason: '[DEMO] Demam dan flu, istirahat sesuai anjuran dokter.', status: 'approved' },
  { user_id: ids[1], type: 'izin', start_date: day(3), end_date: day(3), reason: '[DEMO] Mengurus perpanjangan KTP.', status: 'pending' },
  { user_id: ids[0], type: 'sakit', start_date: day(-7), end_date: day(-7), reason: '[DEMO] Sakit kepala.', status: 'rejected' }]);
if (lv.error) throw lv.error;
console.log(`Selesai: ${rows.length} data absensi + 3 pengajuan (disetujui, menunggu, ditolak).`);
