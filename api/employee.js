import { db, requireAdmin } from './_lib.js';
const PFX = 'RB-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // tanpa huruf/angka yang mirip (I, O, 0, 1)
const OK_NIP = /^RB-[A-Z0-9]{6}$/;
const randNip = () => PFX + Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
// NIP dibuat otomatis oleh server (RB- + 6 karakter acak) dan dijamin unik. Pengguna tidak bisa mengetik/mengubahnya.
async function genNip(want) {
  for (let i = 0; i < 20; i++) {
    const c = i === 0 && OK_NIP.test(String(want || '')) ? want : randNip();
    const { data } = await db.from('profiles').select('id').eq('nip', c).limit(1);
    if (!data?.length) return c;
  }
  throw new Error('Gagal membuat NIP unik, coba lagi');
}
export default async function handler(req, res) {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const b = req.body || {};
  const role = b.role === 'admin' ? 'admin' : b.role === 'employee' ? 'employee' : undefined;
  const fields = { full_name: b.full_name, position: role ? (role === 'admin' ? 'Admin' : 'Karyawan') : b.position, phone: b.phone, active: b.active, role };
  if (req.method === 'POST') {
    let nip; try { nip = await genNip(b.nip); } catch (e) { return res.status(500).json({ error: e.message }); }
    const { data, error } = await db.auth.admin.createUser({ email: b.email, password: b.password, email_confirm: true });
    if (error) return res.status(400).json({ error: error.message });
    const { error: e2 } = await db.from('profiles').insert({ ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)), nip, id: data.user.id, role: role || 'employee' });
    if (e2) { await db.auth.admin.deleteUser(data.user.id); return res.status(400).json({ error: e2.message }); }
    return res.json({ id: data.user.id });
  }
  if (req.method === 'PATCH') {
    if (b.id === admin.id && ((role && role !== 'admin') || b.active === false)) return res.status(400).json({ error: 'Anda tidak dapat menurunkan atau menonaktifkan akun Anda sendiri' });
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    const { data: cur } = await db.from('profiles').select('nip').eq('id', b.id).single();
    if (cur && !cur.nip) { try { patch.nip = await genNip(); } catch (e) { return res.status(500).json({ error: e.message }); } }   // NIP lama tidak pernah diubah; yang kosong diisi otomatis
    const { error } = await db.from('profiles').update(patch).eq('id', b.id);
    if (!error && (b.password || b.email)) {
      const upd = {}; if (b.password) upd.password = b.password; if (b.email) upd.email = b.email;
      const r = await db.auth.admin.updateUserById(b.id, upd); if (r.error) return res.status(400).json({ error: r.error.message });
    }
    return error ? res.status(400).json({ error: error.message }) : res.json({ ok: true });
  }
  if (req.method === 'DELETE') {
    if (!b.id) return res.status(400).json({ error: 'ID karyawan wajib' });
    if (b.id === admin.id) return res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri' });
    try { const { data: files } = await db.storage.from('leave-files').list(b.id); if (files?.length) await db.storage.from('leave-files').remove(files.map((f) => `${b.id}/${f.name}`)); } catch {}   // lampiran izin ikut dihapus
    const { error } = await db.auth.admin.deleteUser(b.id);   // profiles, absensi, dan izin ikut terhapus (on delete cascade)
    if (error) return res.status(400).json({ error: error.message });
    await db.from('profiles').delete().eq('id', b.id);
    return res.json({ ok: true });
  }
  res.status(405).end();
}
