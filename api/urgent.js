import { db, todayWIB } from './_lib.js';
// Izin/sakit URGENT (karyawan): mencatat pengajuan dan otomatis menghentikan jam kerja bersih yang sedang berjalan hari ini
// (pulang dicatat sekarang; bila sedang istirahat, istirahatnya ikut ditutup). Memakai service role karena karyawan tidak boleh mengubah absensi langsung.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const hhmm = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).replace('.', ':');
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { data: { user } } = await db.auth.getUser((req.headers.authorization || '').replace('Bearer ', ''));
  if (!user) return res.status(401).json({ error: 'Sesi habis, silakan login ulang.' });
  const b = req.body || {}, date = todayWIB(), reason = String(b.reason || '').trim();
  if (!['izin', 'sakit'].includes(b.type)) return res.status(400).json({ error: 'Jenis harus izin atau sakit' });
  if (!reason) return res.status(400).json({ error: 'Alasan wajib diisi' });
  if (reason.length > 500) return res.status(400).json({ error: 'Alasan maksimal 500 karakter' });
  const end = DATE.test(b.end_date || '') && b.end_date >= date ? b.end_date : date;
  const path = typeof b.attachment_path === 'string' && b.attachment_path.startsWith(`${user.id}/`) ? b.attachment_path : null;
  const [{ data: p }, { data: a }, { data: dup }] = await Promise.all([
    db.from('profiles').select('role,active').eq('id', user.id).single(),
    db.from('attendance').select('*').eq('user_id', user.id).eq('work_date', date).maybeSingle(),
    db.from('leaves').select('id').eq('user_id', user.id).like('reason', '[URGENT%').gte('created_at', `${date}T00:00:00+07:00`).limit(1),
  ]);
  if (!p?.active || p.role !== 'employee') return res.status(403).json({ error: 'Akun tidak aktif atau bukan akun karyawan.' });
  if (dup?.length) return res.status(409).json({ error: 'Pengajuan urgent hari ini sudah tercatat.' });
  const now = new Date().toISOString(), running = !!(a?.check_in && !a.check_out);
  const tag = running ? `[URGENT - KERJA DIHENTIKAN ${hhmm(now)}]` : '[URGENT]';
  const { data: row, error } = await db.from('leaves').insert({ user_id: user.id, type: b.type, start_date: date, end_date: end, reason: `${tag} ${reason}`, attachment_path: path }).select('id').single();
  if (error) return res.status(400).json({ error: error.message });
  if (running) {
    const breaks = (Array.isArray(a.breaks) ? a.breaks : []).map((x) => (x.e ? x : { ...x, e: now }));   // istirahat yang masih terbuka ikut ditutup
    const { data: upd, error: e2 } = await db.from('attendance').update({ check_out: now, breaks }).eq('id', a.id).is('check_out', null).select('id');
    if (e2 || !upd?.length) { await db.from('leaves').delete().eq('id', row.id); return res.status(500).json({ error: e2?.message || 'Gagal menghentikan jam kerja. Coba lagi.' }); }
  }
  return res.json({ ok: true, stopped: running, time: running ? hhmm(now) : null });
}
