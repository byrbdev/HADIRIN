import { db, requireAdmin } from './_lib.js';
const PFX = 'RB-';
// NIP selalu berawalan RB-. Kosong / hanya "RB-" disimpan sebagai null.
const normNip = (v) => {
  if (v === undefined) return undefined;
  let s = String(v ?? '').toUpperCase().replace(/\s+/g, ''); if (s.startsWith(PFX)) s = s.slice(PFX.length); else s = s.replace(/^R?B?-?/, '');
  return s ? PFX + s : null;
};
export default async function handler(req, res) {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const b = req.body || {};
  const role = b.role === 'admin' ? 'admin' : b.role === 'employee' ? 'employee' : undefined;
  const fields = { full_name: b.full_name, nip: normNip(b.nip), position: role ? (role === 'admin' ? 'Admin' : 'Karyawan') : b.position, phone: b.phone, active: b.active, role };
  if (req.method === 'POST') {
    const { data, error } = await db.auth.admin.createUser({ email: b.email, password: b.password, email_confirm: true });
    if (error) return res.status(400).json({ error: error.message });
    const { error: e2 } = await db.from('profiles').insert({ ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)), id: data.user.id, role: role || 'employee' });
    if (e2) { await db.auth.admin.deleteUser(data.user.id); return res.status(400).json({ error: e2.message }); }
    return res.json({ id: data.user.id });
  }
  if (req.method === 'PATCH') {
    if (b.id === admin.id && ((role && role !== 'admin') || b.active === false)) return res.status(400).json({ error: 'Anda tidak dapat menurunkan atau menonaktifkan akun Anda sendiri' });
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    const { error } = await db.from('profiles').update(patch).eq('id', b.id);
    if (!error && (b.password || b.email)) {
      const upd = {}; if (b.password) upd.password = b.password; if (b.email) upd.email = b.email;
      const r = await db.auth.admin.updateUserById(b.id, upd); if (r.error) return res.status(400).json({ error: r.error.message });
    }
    return error ? res.status(400).json({ error: error.message }) : res.json({ ok: true });
  }
  res.status(405).end();
}
