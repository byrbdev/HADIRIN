import { db, todayWIB, tokenFor } from './_lib.js';
const rad = (x) => (x * Math.PI) / 180;
const dist = (a, b, c, d) => { const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2; return 2 * 6371000 * Math.asin(Math.sqrt(h)); };
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { data: { user } } = await db.auth.getUser((req.headers.authorization || '').replace('Bearer ', ''));
  if (!user) return res.status(401).json({ error: 'Sesi habis, silakan login ulang.' });
  const { data: p } = await db.from('profiles').select('role,active').eq('id', user.id).single();
  if (!p?.active || p.role !== 'employee') return res.status(403).json({ error: 'Akun tidak aktif atau bukan akun karyawan.' });
  const { token, lat, lng } = req.body || {}, date = todayWIB();
  if (token !== tokenFor(date)) return res.status(400).json({ error: 'QR tidak valid atau kedaluwarsa. Gunakan QR hari ini.' });
  if (typeof lat !== 'number' || typeof lng !== 'number') return res.status(400).json({ error: 'Lokasi tidak terbaca. Aktifkan GPS.' });
  const { data: s } = await db.from('settings').select('*').eq('id', 1).single();
  const d = Math.round(dist(s.office_lat, s.office_lng, lat, lng));
  if (d > s.radius_m) return res.status(403).json({ error: `Anda berada ${d} m dari kantor (maksimal ${s.radius_m} m).` });
  const { data: a } = await db.from('attendance').select('*').eq('user_id', user.id).eq('work_date', date).maybeSingle();
  const now = new Date().toISOString();
  if (!a) {
    const { error } = await db.from('attendance').insert({ user_id: user.id, work_date: date, check_in: now, in_lat: lat, in_lng: lng });
    return error ? res.status(500).json({ error: error.message }) : res.json({ action: 'in', time: now, distance: d });
  }
  if (a.check_out) return res.status(409).json({ error: 'Absensi hari ini sudah lengkap (masuk dan pulang).' });
  if (Date.now() - new Date(a.check_in) < 60000) return res.status(409).json({ error: 'Anda baru saja absen masuk. Scan lagi saat pulang.' });
  const { error } = await db.from('attendance').update({ check_out: now, out_lat: lat, out_lng: lng }).eq('id', a.id);
  return error ? res.status(500).json({ error: error.message }) : res.json({ action: 'out', time: now, check_in: a.check_in, distance: d });
}
