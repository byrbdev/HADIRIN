import { db, requireAdmin } from './_lib.js';
// Edit & hapus pengajuan izin/sakit (khusus admin). Memakai service role, jadi tidak butuh policy delete di database.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const b = req.body || {}, id = Number(b.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID pengajuan tidak valid' });
  if (req.method === 'PATCH') {
    if (!['izin', 'sakit'].includes(b.type)) return res.status(400).json({ error: 'Jenis harus izin atau sakit' });
    if (!['pending', 'approved', 'rejected'].includes(b.status)) return res.status(400).json({ error: 'Status tidak valid' });
    if (!DATE.test(b.start_date || '') || !DATE.test(b.end_date || '')) return res.status(400).json({ error: 'Tanggal tidak valid' });
    if (b.end_date < b.start_date) return res.status(400).json({ error: 'Tanggal selesai harus setelah mulai' });
    const { data, error } = await db.from('leaves').update({ type: b.type, status: b.status, start_date: b.start_date, end_date: b.end_date, reason: String(b.reason ?? '') }).eq('id', id).select('id');
    if (error) return res.status(400).json({ error: error.message });
    return data?.length === 1 ? res.json({ ok: true }) : res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
  }
  if (req.method === 'DELETE') {
    const { data: row } = await db.from('leaves').select('attachment_path').eq('id', id).maybeSingle();
    if (!row) return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
    const { error } = await db.from('leaves').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    if (row.attachment_path) { try { await db.storage.from('leave-files').remove([row.attachment_path]); } catch {} }
    return res.json({ ok: true });
  }
  res.status(405).end();
}
