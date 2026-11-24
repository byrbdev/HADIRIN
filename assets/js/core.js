// HADIRIN core: Supabase client, auth guard, layout Spark Admin, helper
const CFG = window.HADIRIN_CONFIG || {};
const sb = supabase.createClient(CFG.url || 'http://invalid.local', CFG.anon || 'missing');
const $ = (s, r = document) => r.querySelector(s);
const wibDate = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const fmtTime = (t) => t ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':') : '-';
const fmtDur = (a, b) => { if (!a) return '-'; const m = Math.max(0, Math.round(((b ? new Date(b) : new Date()) - new Date(a)) / 6e4)); return `${Math.floor(m / 60)}j ${m % 60}m` + (b ? '' : ' (berjalan)'); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (msg, ok = true) => { const d = document.createElement('div'); d.className = 'position-fixed top-0 end-0 m-3'; d.style.zIndex = 2000;
  d.innerHTML = `<div class="alert-custom ${ok ? 'alert-custom-success' : 'alert-custom-danger'}"><i class="bi ${ok ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} alert-custom-icon"></i><div class="alert-custom-content">${esc(msg)}</div></div>`; document.body.appendChild(d); setTimeout(() => d.remove(), 3000); };
// pagination ala Spark (table-footer-control)
function pager(info, nav, per, redraw) {
  let page = 1, n = 0; const max = () => Math.max(1, Math.ceil(n / per));
  nav.onclick = (e) => { const a = e.target.closest('[data-p]'); if (!a) return; e.preventDefault(); const p = +a.dataset.p; if (p >= 1 && p <= max()) { page = p; redraw(); } };
  return { reset: () => (page = 1), slice(arr) { n = arr.length; if (page > max()) page = max(); const s = (page - 1) * per;
    info.textContent = n ? `Menampilkan ${s + 1} sampai ${Math.min(n, s + per)} dari ${n} data` : 'Tidak ada data';
    let h = `<li class="page-item ${page === 1 ? 'disabled' : ''}"><a class="page-link border-0" href="#" data-p="${page - 1}"><i class="bi bi-chevron-left"></i></a></li>`;
    for (let i = 1; i <= max(); i++) h += `<li class="page-item ${i === page ? 'active' : ''}"><a class="page-link border-0" href="#" data-p="${i}">${i}</a></li>`;
    h += `<li class="page-item ${page === max() ? 'disabled' : ''}"><a class="page-link border-0" href="#" data-p="${page + 1}"><i class="bi bi-chevron-right"></i></a></li>`; nav.innerHTML = h; return arr.slice(s, s + per); } };
}
// dropdown filter ala Spark (btn-table-action)
function filterDropdown(btn, menu, label, onPick) { menu.onclick = (e) => { const a = e.target.closest('[data-v]'); if (!a) return; e.preventDefault(); btn.innerHTML = `<i class="bi bi-funnel"></i> ${esc(a.textContent)}`; onPick(a.dataset.v); }; }
async function api(path, method, body) {
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Gagal'); return j;
}
const MENU = [['dashboard', 'bi-grid-fill', 'Dashboard'], ['absensi', 'bi-calendar-check-fill', 'Absensi'], ['karyawan', 'bi-people-fill', 'Karyawan'], ['keterangan', 'bi-file-earmark-medical', 'Keterangan'], ['setting', 'bi-gear-fill', 'Setting']];
async function initAdmin(active) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return (location.href = '/login');
  const { data: me, error: pe } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  if (!me || me.role !== 'admin') { await sb.auth.signOut(); const why = pe ? 'Gagal membaca profiles: ' + pe.message : !me ? 'Akun belum punya data di tabel profiles. Jalankan: npm run seed' : 'Akun ini bukan admin'; return (location.href = '/login?e=' + encodeURIComponent(why)); }
  const content = $('#app-content');
  const side = document.createElement('div'); side.className = 'sidebar-wrapper'; side.id = 'sidebar';
  side.innerHTML = `<a href="/dashboard" class="sidebar-brand"><i class="bi bi-person-check-fill"></i><span>HADIRIN</span></a>
   <div class="flex-grow-1"><div class="sidebar-menu-section"><div class="sidebar-menu-title">Menu</div><ul class="sidebar-menu-list">
   ${MENU.map(([k, i, t]) => `<li class="sidebar-menu-item"><a href="/${k}" class="sidebar-menu-link ${k === active ? 'active' : ''}"><i class="bi ${i}"></i><span>${t}</span></a></li>`).join('')}
   </ul></div></div>
   <div class="sidebar-profile"><img src="/assets/images/avatar.png" class="sidebar-profile-img" alt=""><div class="sidebar-profile-info"><div class="sidebar-profile-name">${esc(me.full_name)}</div><div class="sidebar-profile-email">${esc(session.user.email)}</div></div></div>`;
  const main = document.createElement('div'); main.className = 'main-wrapper';
  main.innerHTML = `<header class="navbar-custom"><div class="navbar-left"><button class="sidebar-toggle-btn me-2" id="sidebar-toggle" aria-label="Toggle Navigation"><i class="bi bi-list"></i></button><strong id="clock"></strong></div><div></div>
   <div class="navbar-actions"><button class="navbar-action-btn me-1" id="btn-fullscreen" aria-label="Fullscreen"><i class="bi bi-arrows-fullscreen"></i></button>
   <div class="dropdown"><button class="navbar-profile-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false"><img src="/assets/images/avatar.png" alt="" class="navbar-profile-img"><span class="navbar-profile-name d-none d-md-inline">${esc(me.full_name)}</span><i class="bi bi-chevron-down navbar-profile-caret"></i></button>
   <ul class="dropdown-menu dropdown-menu-end dropdown-menu-profile"><li class="dropdown-header">Selamat datang!</li><li><a class="dropdown-item" href="/setting"><i class="bi bi-gear"></i> Setting</a></li><li><hr class="dropdown-divider"></li><li><a class="dropdown-item text-danger" href="#" id="logout"><i class="bi bi-box-arrow-right"></i> Keluar</a></li></ul></div></div></header>`;
  main.appendChild(content);
  main.insertAdjacentHTML('beforeend', `<footer class="footer-custom"><div class="footer-left"><span class="footer-logo"><i class="bi bi-person-check-fill"></i> HADIRIN</span><span class="footer-separator">|</span><span class="footer-copy">&copy; ${new Date().getFullYear()} HADIRIN &bull; Sistem Absensi Karyawan</span></div>
   <div class="footer-right"><ul class="footer-links">${MENU.map(([k, , t]) => `<li><a href="/${k}" class="footer-link">${t}</a></li>`).join('')}</ul></div></footer>`);
  document.body.prepend(main); document.body.prepend(side);
  const ov = document.createElement('div'); ov.className = 'sidebar-overlay'; document.body.appendChild(ov);
  const tg = (f) => { side.classList.toggle('show', f); ov.classList.toggle('show', f); };
  $('#sidebar-toggle').onclick = () => tg(!side.classList.contains('show')); ov.onclick = () => tg(false);
  $('#btn-fullscreen').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  $('#logout').onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); location.href = '/login'; };
  const tick = () => $('#clock').textContent = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'Asia/Jakarta' });
  tick(); setInterval(tick, 1000);
  return me;
}
