import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
export const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export const todayWIB = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
export const tokenFor = (d) => `HDR.${d}.` + crypto.createHmac('sha256', process.env.QR_SECRET).update(d).digest('hex').slice(0, 20);
export async function requireAdmin(req, res) {
  const jwt = (req.headers.authorization || '').replace('Bearer ', '');
  const { data: { user } } = await db.auth.getUser(jwt);
  const { data: p } = user ? await db.from('profiles').select('role,active').eq('id', user.id).single() : {};
  if (p?.role === 'admin' && p.active) return user;
  res.status(403).json({ error: 'Hanya admin' });
}
