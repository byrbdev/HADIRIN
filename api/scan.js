import { db, todayWIB, tokenFor } from './_lib.js';
import { summarize, breakState, breakEnd } from './_hours.js';
const rad = (x) => (x * Math.PI) / 180;
const dist = (a, b, c, d) => { const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2; return 2 * 6371000 * Math.asin(Math.sqrt(h)); };
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { token, lat, lng, action } = req.body || {}, date = todayWIB();
  if (token !== tokenFor(date)) return res.status(400).json({ error: 'QR tidak valid atau kedaluwarsa. Gunakan QR hari ini.' });
  if (typeof lat !== 'number' || typeof lng !== 'number') return res.status(400).json({ error: 'Lokasi tidak terbaca. Aktifkan GPS.' });
  const { data: { user } } = await db.auth.getUser((req.headers.authorization || '').replace('Bearer ', ''));
  if (!user) return res.status(401).json({ error: 'Sesi habis, silakan login ulang.' });
  // profil, setting, dan absensi hari ini dibaca bersamaan (sebelumnya berurutan = 3x lebih lambat)
  const [{ data: p }, { data: s }, { data: a }] = await Promise.all([
    db.from('profiles').select('role,active').eq('id', user.id).single(),
    db.from('settings').select('*').eq('id', 1).single(),
    db.from('attendance').select('*').eq('user_id', user.id).eq('work_date', date).maybeSingle(),
  ]);
  if (!p?.active || p.role !== 'employee') return res.status(403).json({ error: 'Akun tidak aktif atau bukan akun karyawan.' });
  if (!s) return res.status(500).json({ error: 'Setting belum terbaca. Coba lagi.' });
  const d = Math.round(dist(s.office_lat, s.office_lng, lat, lng));
  if (d > s.radius_m) return res.status(403).json({ error: `Anda berada ${d} m dari kantor (maksimal ${s.radius_m} m).` });
  const now = new Date().toISOString(), target = s.target_minutes || 480;
  if (!a) {
    const { error } = await db.from('attendance').insert({ user_id: user.id, work_date: date, check_in: now, in_lat: lat, in_lng: lng, breaks: [] });
    return error ? res.status(500).json({ error: error.message }) : res.json({ action: 'in', time: now, distance: d });
  }
  if (a.check_out) return res.status(409).json({ error: 'Absensi hari ini sudah lengkap (masuk dan pulang).' });
  const breaks = Array.isArray(a.breaks) ? a.breaks : [], open = breaks.findIndex((b) => !b.e);
  const last = Math.max(new Date(a.check_in), ...breaks.map((b) => new Date(b.e || b.s)));
  if (Date.now() - last < 20000) return res.status(409).json({ error: 'Scan baru saja tercatat. Tunggu sebentar sebelum scan lagi.' });
  const save = async (patch, out) => { const { error } = await db.from('attendance').update(patch).eq('id', a.id).is('check_out', null);
    return error ? res.status(500).json({ error: error.message }) : res.json({ time: now, distance: d, ...out }); };
  const g = breakState(a, Date.now(), s.break_slots);   // jendela jam istirahat dari Setting (bawaan 11:40/14:40 keluar, 12:40/15:40 masuk)
  if (open >= 0) {   // sedang istirahat: scan = kembali masuk
    if (!g.canEnd) return res.status(409).json({ error: g.msg });
    const be = breakEnd(breaks[open], Date.now(), s.break_slots), endIso = new Date(be.at).toISOString();   // telat masuk kembali dalam toleransi -> dicatat tepat waktu (mis. 13:07 -> 13:00)
    const nb = breaks.map((b, i) => (i === open ? { ...b, e: endIso } : b)), sm = summarize({ ...a, breaks: nb }, Date.now(), target, s.work_start);
    return save({ breaks: nb }, { action: 'break_end', time: endIso, real_time: now, snapped: be.snapped, break_min: Math.round((be.at - new Date(breaks[open].s)) / 6e4), ...sm });
  }
  if (action === 'break') {
    if (!g.canStart) return res.status(409).json({ error: g.msg });
    const sm = summarize(a, Date.now(), target, s.work_start);
    return save({ breaks: [...breaks, { s: now, e: null }] }, { action: 'break_start', back_at: g.backAt, ...sm });
  }
  if (action === 'out') {
    const sm = summarize(a, Date.now(), target, s.work_start);
    if (!sm.canOut) {
      const at = new Date(sm.earliest).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':');
      return res.status(409).json({ error: `Belum boleh pulang: kerja bersih ${sm.netMin} dari ${target} menit (kurang ${sm.remainMin} menit). Paling cepat pulang pukul ${at}.` });
    }
    const sm2 = summarize({ ...a, check_out: now }, Date.now(), target, s.work_start);
    return save({ check_out: now, out_lat: lat, out_lng: lng }, { action: 'out', check_in: a.check_in, ...sm2 });
  }
  return res.status(400).json({ error: 'Pilih Istirahat atau Pulang sebelum scan. Muat ulang aplikasi jika pilihan tidak muncul.' });
}
