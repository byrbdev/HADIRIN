// npm run seed : membuat admin default + contoh karyawan di Supabase (untuk testing)
import fs from 'node:fs';
if (fs.existsSync('.env')) for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]; }
const { db } = await import('../api/_lib.js');
async function ensure(email, password, profile) {
  let { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) { const all = await db.auth.admin.listUsers({ perPage: 1000 }); data = { user: all.data?.users?.find((u) => u.email === email) }; if (!data.user) throw error; }
  const r = await db.from('profiles').upsert({ id: data.user.id, ...profile }); if (r.error) throw new Error('Gagal simpan profiles untuk ' + email + ': ' + r.error.message); console.log('OK', email);
}
const E = process.env;
await ensure(E.DEFAULT_ADMIN_EMAIL, E.DEFAULT_ADMIN_PASSWORD, { full_name: 'Administrator', role: 'admin' });
if (E.SEED_SAMPLE_EMPLOYEES !== 'false') for (const [i, n] of ['Budi Santoso', 'Siti Aminah', 'Andi Pratama'].entries())
  await ensure(`karyawan${i + 1}@hadirin.test`, E.DEFAULT_EMPLOYEE_PASSWORD || 'karyawan123', { full_name: n, nip: `EMP00${i + 1}`, position: 'Staff', role: 'employee' });
console.log('Seed selesai.');
