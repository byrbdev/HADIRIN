// Mengirim konfigurasi publik ke browser. Kredensial default hanya dikirim saat mode dev lokal.
export default function handler(req, res) {
  const c = { url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY };
  if (process.env.HADIRIN_DEV === 'true') c.dev = { email: process.env.DEFAULT_ADMIN_EMAIL, password: process.env.DEFAULT_ADMIN_PASSWORD };
  res.setHeader('Content-Type', 'text/javascript'); res.setHeader('Cache-Control', 'no-store');
  res.end('window.HADIRIN_CONFIG=' + JSON.stringify(c) + ';');
}
