import { requireAdmin, todayWIB, tokenFor } from './_lib.js';
export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const date = todayWIB();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ date, token: tokenFor(date) });
}
