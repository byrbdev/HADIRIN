import { db, requireAdmin } from './_lib.js';
export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const b = req.body || {};
  const fields = { full_name: b.full_name, nip: b.nip, position: b.position, phone: b.phone, active: b.active };
  if (req.method === 'POST') {
    const { data, error } = await db.auth.admin.createUser({ email: b.email, password: b.password, email_confirm: true });
    if (error) return res.status(400).json({ error: error.message });
    const { error: e2 } = await db.from('profiles').insert({ id: data.user.id, ...fields, role: 'employee' });
    if (e2) { await db.auth.admin.deleteUser(data.user.id); return res.status(400).json({ error: e2.message }); }
    return res.json({ id: data.user.id });
  }
  if (req.method === 'PATCH') {
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
