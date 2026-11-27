// HADIRIN app karyawan. Memakai helper dari core.js ($, sb, api, toast, fmtTime, fmtDur, wibDate, esc)
let me, att, ws = '08:00:00', target = 480, slots = null, mode = 'break', prevOut = false, stream, track, scanning = false, busy = false, manual = false, onHome = false, watch = null, ready = false, today = '', opening = false, camGen = 0, lastPos = null, entering = null, refreshing = null, retryT, lastMk = 0, lastBad = '', ym = wibDate().slice(0, 7), jenis = 'izin', dp;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fd = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const calc = (r) => HOURS.summarize(r, Date.now(), target, ws), brk = (r) => HOURS.breakState(r, Date.now(), slots);
const ST = { pending: ['pending', 'Menunggu'], approved: ['success', 'Disetujui'], rejected: ['failed', 'Ditolak'] };
function show(v) {
  if (v !== 'home') leaveHome();
  document.querySelectorAll('.view').forEach((e) => e.classList.toggle('on', e.id === 'v-' + v));
  $('#nav').style.display = v === 'login' ? 'none' : 'flex';
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === v)); scrollTo(0, 0);
  ({ home: enterHome, riwayat: loadRiwayat, izin: loadIzin, profil: loadProfil }[v] || (() => {}))();
}
function resetUi() { me = att = null; ready = false; mode = 'break'; prevOut = false; manual = false; slots = null; today = ''; show('login'); }
const hasSaved = () => { try { if (window.HadirinStore?.hasAuth()) return true; return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k) && localStorage.getItem(k)); } catch { return false; } };
let loginRetryT;
async function getSessionSafe() {   // sesi tersimpan tapi refresh gagal karena jaringan (sinyal belum siap saat app dibuka): coba lagi dulu, jangan langsung ke layar login
  let r = await sb.auth.getSession();
  for (let i = 0; i < 2 && !r.data.session && r.error && hasSaved(); i++) { await sleep(1500 * (i + 1)); r = await sb.auth.getSession(); }
  return r;
}
function enter() {   // dijaga: splash + login tidak boleh menjalankan enter() dua kali bersamaan
  return entering || (entering = (async () => {
    const { data: { session }, error: se } = await getSessionSafe();
    if (!session) { clearTimeout(loginRetryT); if (se && hasSaved()) { $('#err').textContent = 'Koneksi bermasalah. Sesi Anda tetap tersimpan, mencoba lagi...'; loginRetryT = setTimeout(() => !me && enter(), 5000); } return show('login'); }
    const { data: p, error } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
    if (error && !p && error.code !== 'PGRST116') { $('#err').textContent = 'Koneksi bermasalah. Coba lagi.'; return show('login'); }   // gangguan jaringan bukan alasan untuk logout
    if (p && p.role === 'admin' && p.active) return (location.href = '/dashboard');
    if (!p || p.role !== 'employee' || !p.active) { await sb.auth.signOut(); $('#err').textContent = p?.role === 'admin' ? 'Akun admin: gunakan dashboard admin.' : 'Akun tidak aktif atau tidak ditemukan.'; return show('login'); }
    me = { ...p, email: session.user.email };
    show('home');
  })().finally(() => (entering = null)));
}
async function loadSettings() {   // dibaca tiap membuka halaman Scan, supaya perubahan dari Setting admin langsung berlaku
  const { data: s } = await sb.from('settings').select('*').eq('id', 1).single();
  if (s?.work_start) ws = s.work_start; if (s?.target_minutes) target = s.target_minutes; slots = s?.break_slots || null;
}
// ---------- Home ----------
async function loadToday() {   // gagal baca = kamera TETAP tertutup (dulu dianggap 'belum absen' sehingga kamera terbuka sendiri)
  const d = wibDate(), { data, error } = await sb.from('attendance').select('*').eq('user_id', me.id).eq('work_date', d).maybeSingle();
  if (error) throw error; att = data; today = d; ready = true; renderStatus();
}
function renderStatus() {
  $('#st-d').textContent = new Date(wibDate()).toLocaleDateString('id-ID', { dateStyle: 'full', timeZone: 'UTC' });
  const x = $('#st-x'), seg = $('#mode'); x.textContent = ''; seg.classList.add('d-none'); if (!att || att.check_out || calc(att).onBreak) prevOut = false;
  if (!att) { $('#st-b').textContent = 'Belum Absen'; $('#st-t').textContent = 'Scan QR untuk absen masuk'; $('#hint').textContent = 'Arahkan kamera ke QR di layar kantor'; return; }
  const m = calc(att);
  if (att.check_out) { $('#st-b').textContent = 'Selesai'; $('#st-t').textContent = `${fmtTime(att.check_in)} - ${fmtTime(att.check_out)} • Kerja bersih ${HOURS.fmt(m.netMin)}`; x.textContent = `Total istirahat ${m.breakMin} menit`; $('#hint').textContent = 'Absensi hari ini lengkap. Sampai jumpa besok!'; return; }
  const g = brk(att);
  if (m.onBreak) { const b = att.breaks.find((b) => !b.e); $('#st-b').textContent = 'Istirahat'; $('#st-t').textContent = `Keluar ${fmtTime(b.s)} • ${fmtDur(b.s, null).replace(' (berjalan)', '')}`; x.textContent = `Kerja bersih sejauh ini ${HOURS.fmt(m.netMin)}`; $('#hint').textContent = g.canEnd ? 'Scan QR untuk kembali masuk dari istirahat' : g.msg.replace(/\.$/, ''); return; }
  $('#st-b').textContent = 'Sedang Bekerja'; $('#st-t').textContent = `Masuk ${fmtTime(att.check_in)} • Kerja bersih ${HOURS.fmt(m.netMin)}`;
  const dur = (n) => n >= 60 ? HOURS.fmt(n) : `${n}m`;
  x.innerHTML = m.canOut
    ? `<div class="st-main">Sudah boleh pulang</div><div class="st-sub">Istirahat ${dur(m.breakMin)}</div>`
    : `<div class="st-main">Pulang paling cepat <b>${fmtTime(m.earliest)}</b></div><div class="st-sub">Istirahat ${dur(m.breakMin)}` + `</div>`;
  seg.classList.remove('d-none'); $('#m-out').disabled = !m.canOut; $('#m-out').style.opacity = m.canOut ? 1 : .45; if (!m.canOut && mode === 'out') mode = 'break'; if (m.canOut && !prevOut) mode = 'out'; prevOut = m.canOut;   // kerja bersih sudah cukup: otomatis ke mode Pulang (masih bisa pilih Istirahat)
  seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
  $('#hint').textContent = mode === 'out' ? 'Scan QR untuk absen pulang' : g.canStart ? 'Scan QR saat keluar istirahat' : g.msg.replace(/\.$/, '');
}
$('#mode').onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b || b.disabled) return; mode = b.dataset.m; renderStatus(); };
function enterHome() {
  onHome = true; manual = false; ready = false; stopCam();   // kamera tertutup sampai status absen hari ini benar-benar terbaca
  const h = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  $('#gr').textContent = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; $('#nm').textContent = me.full_name.split(' ')[0];
  setIcon('bi-hourglass-split'); setIdle('Memuat status absen...'); startGps(); refresh();
}
function leaveHome() { onHome = false; clearTimeout(retryT); stopCam(); if (watch != null) { navigator.geolocation.clearWatch(watch); watch = null; } }
// Baca ulang setting + absensi hari ini, baru kamera boleh diputuskan buka/tutup (satu proses sekaligus)
function refresh() {
  return refreshing || (refreshing = (async () => {
    try { await Promise.all([loadSettings().catch(() => {}), loadToday()]); }
    catch { ready = false; stopCam(); setIcon('bi-wifi-off'); setIdle('Gagal memuat status', 'Periksa koneksi. Mencoba lagi...'); clearTimeout(retryT); retryT = setTimeout(() => onHome && refresh(), 3000); return; }
    if (onHome) startCam();
  })().finally(() => (refreshing = null)));
}
const setChip = (ok, t) => { $('#chip').className = 'chip' + (ok ? ' ok' : ''); $('#chip span').textContent = t; };
function startGps() { if (watch != null) return; if (!navigator.geolocation) return setChip(false, 'GPS tidak didukung');
  watch = navigator.geolocation.watchPosition((p) => { lastPos = { c: p.coords, t: Date.now() }; setChip(true, `Lokasi siap (±${Math.round(p.coords.accuracy)} m)`); }, () => setChip(false, 'Aktifkan izin lokasi'), { enableHighAccuracy: true, maximumAge: 10000 }); }
const getPos = () => lastPos && Date.now() - lastPos.t < 20000 ? Promise.resolve(lastPos.c) : new Promise((ok, no) => navigator.geolocation.getCurrentPosition((p) => ok(p.coords), () => no(new Error('Lokasi tidak terbaca. Aktifkan GPS dan izinkan akses lokasi.')), { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }));
// Kamera otomatis: tutup setelah absen masuk; buka tepat saat jam keluar istirahat dibuka selama BREAK_WIN menit
// (lewat itu tetap bisa lewat ketuk 2x). Saat istirahat, kamera baru dibuka ketika scan masuk dibuka.
// Jam diatur admin di halaman Setting (settings.break_slots; bawaan HOURS.BREAK_SLOTS) dan dicek ulang di server (api/scan.js).
const BREAK_WIN = 40;
const hm = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const wibMin = () => { const d = new Date(Date.now() + 7 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
function camWanted() {
  if (!att) return true;
  if (att.check_out) return false;
  const m = calc(att), g = brk(att); if (m.onBreak) return g.canEnd; if (m.canOut) return true;
  return g.canStart && wibMin() - hm(HOURS.normSlots(slots)[g.slot].out) < BREAK_WIN;
}
// Isi tengah area scan; keterangan (p) disembunyikan bila kosong supaya tetap center
function setIdle(title, sub) { $('#cam-t').textContent = title; const p = $('#cam-p'); p.textContent = sub || ''; p.classList.toggle('d-none', !sub); }
const setIcon = (c) => { $('.pulse i').className = 'bi ' + c; };
function showIdle() {
  const g = att && brk(att);
  if (g?.onBreak) { setIcon('bi-cup-hot-fill'); setIdle('Selamat Istirahat', g.canEnd ? '' : `Scan masuk dibuka pukul ${g.backAt}`); }
  else { setIcon('bi-briefcase-fill'); setIdle('Selamat bekerja!'); }
}
function syncCam() {
  if (!onHome || document.hidden || busy) return;
  if (ready && today !== wibDate()) return void refresh();   // ganti hari saat aplikasi terbuka terus
  if (!ready || att?.check_out) return;
  if (camWanted()) { if (!stream) startCam(); } else if (stream && !manual) { stopCam(); showIdle(); }
}
setInterval(syncCam, 20000);
async function startCam() {
  if (!onHome || !ready || document.hidden) return;
  if (att?.check_out) { stopCam(); setIcon('bi-check2-circle'); return setIdle('Absensi Hari Ini Selesai', 'Terima kasih, sampai jumpa besok!'); }
  if (!manual && att && !camWanted()) { stopCam(); return showIdle(); }
  setIcon('bi-qr-code-scan');
  if (stream || opening) return;   // cegah dua kamera terbuka bersamaan (stream bocor = kamera menyala terus)
  const gen = ++camGen; opening = true; setIdle('Silakan Scan QR untuk Kehadiran', 'Menyiapkan kamera...');
  try {
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    if (gen !== camGen) return st.getTracks().forEach((t) => t.stop());   // dibatalkan saat menunggu izin / kamera
    stream = st; const v = $('#vid'); v.srcObject = st; await v.play();
    if (gen !== camGen) return;
    scanning = true; $('#scan').classList.add('live'); track = st.getVideoTracks()[0];
    if (track.getCapabilities?.().torch) $('#torch').classList.add('can'); loop();
  } catch { if (gen === camGen) { stopCam(); setIdle('Kamera belum aktif', 'Izinkan akses kamera di browser, lalu ketuk 2x layar ini.'); } }
  finally { if (gen === camGen) opening = false; }
}
function stopCam() {
  camGen++; opening = false; scanning = false; stream?.getTracks().forEach((t) => t.stop()); stream = track = null;
  const v = $('#vid'); v.srcObject = null; $('#scan').classList.remove('live'); $('#torch').classList.remove('can', 'on');
}
// Pemindai: BarcodeDetector bawaan browser (cepat, hemat baterai) bila ada; jsQR sebagai cadangan
let BD = null; try { if ('BarcodeDetector' in window) BD = new BarcodeDetector({ formats: ['qr_code'] }); } catch {}
const cv = $('#cv'), cx = cv.getContext('2d', { willReadFrequently: true });
async function readQR(v) {
  if (BD) { try { return (await BD.detect(v))[0]?.rawValue || ''; } catch { BD = null; } }
  const k = Math.min(1, 480 / v.videoWidth), w = Math.round(v.videoWidth * k), h = Math.round(v.videoHeight * k);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }   // jangan ubah ukuran tiap frame (mereset canvas)
  cx.drawImage(v, 0, 0, w, h); return jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data || '';
}
async function loop() {
  if (!scanning) return; const v = $('#vid');
  if (v.readyState >= 2 && v.videoWidth && !busy && !document.hidden) {
    const d = await readQR(v).catch(() => '');
    if (!scanning) return;
    if (d.startsWith('HDR.')) onCode(d); else if (d && d !== lastBad) { lastBad = d; toast('QR bukan milik HADIRIN', false); setTimeout(() => (lastBad = ''), 3000); }
  }
  setTimeout(loop, BD ? 120 : 170);
}
const ICON = { ok: '<svg class="ck ok" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><path d="M30 52l14 14 27-30"/></svg>', bad: '<svg class="ck bad" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><path d="M35 35l30 30M65 35L35 65"/></svg>', load: '<div class="spin"></div>',
  rest: '<div class="ov-ic rest"><i class="bi bi-cup-hot-fill"></i></div>', work: '<div class="ov-ic work"><i class="bi bi-briefcase-fill"></i></div>' };
let resTimer;
function result(k, t, p) { clearTimeout(resTimer); $('#res-i').innerHTML = ICON[k]; $('#res-t').textContent = t || 'Memverifikasi...'; $('#res-p').textContent = p || 'Mengecek QR dan lokasi Anda'; $('#res-ok').classList.toggle('d-none', k === 'load'); $('#res').classList.add('on'); }
async function onCode(token) {
  busy = true; navigator.vibrate?.(60); result('load');
  try {
    const p = await getPos(); const r = await api('/api/scan', 'POST', { token, lat: p.latitude, lng: p.longitude, action: mode }); navigator.vibrate?.([80, 40, 80]); mode = 'break'; manual = false; await loadToday(); if (!camWanted()) { stopCam(); showIdle(); }
    const T = { in: ['Absen Masuk Berhasil', `Pukul ${fmtTime(r.time)} • ${r.distance} m dari kantor`], break_start: ['Selamat Istirahat', `Keluar pukul ${fmtTime(r.time)}` + (r.back_at ? ` • Scan masuk dibuka pukul ${r.back_at}` : ' • Scan lagi saat kembali')],
      break_end: ['Selamat bekerja!', `Kembali pukul ${fmtTime(r.time)} • Istirahat ${r.break_min} menit` + (r.snapped ? ` • Scan ${fmtTime(r.real_time)}, dicatat tepat waktu` : '')], out: ['Absen Pulang Berhasil', `Pukul ${fmtTime(r.time)} • Kerja bersih ${HOURS.fmt(r.netMin)} • Istirahat ${r.breakMin} menit`] }[r.action];
    const k = { break_start: 'rest', break_end: 'work' }[r.action] || 'ok'; result(k, T[0], T[1]);
    if (k !== 'ok') resTimer = setTimeout(() => $('#res-ok').click(), 3500);   // overlay istirahat / bekerja menutup sendiri
  } catch (e) { result('bad', 'Absen Gagal', e.message); }
}
$('#res-ok').onclick = () => { clearTimeout(resTimer); $('#res').classList.remove('on'); busy = false; manual = false; if (att?.check_out) startCam(); else syncCam(); };
// Ketuk 2x pada area scan = buka kamera manual (kondisi urgent)
let lastTap = 0, lastX = 0, lastY = 0;
$('#scan').addEventListener('pointerup', (e) => {
  const now = Date.now(), dbl = now - lastTap < 350 && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 40;
  lastTap = dbl ? 0 : now; lastX = e.clientX; lastY = e.clientY;
  if (!dbl || stream || opening || busy || !ready || att?.check_out) return;
  manual = true; navigator.vibrate?.(30); startCam();
});
$('#torch').onclick = async (e) => { const on = !e.currentTarget.classList.contains('on'); try { await track.applyConstraints({ advanced: [{ torch: on }] }); e.currentTarget.classList.toggle('on', on); } catch {} };
// ---------- Riwayat ----------
async function loadRiwayat() {
  const [y, m] = ym.split('-').map(Number), a = ym + '-01', b = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  $('#ym').textContent = new Date(a).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const data = (await sb.from('attendance').select('*').eq('user_id', me.id).gte('work_date', a).lte('work_date', b).order('work_date', { ascending: false })).data || [];
  let mins = 0; const rs = data.map((r) => ({ r, m: calc(r) })); rs.forEach(({ r, m }) => { if (r.check_out) mins += m.netMin; });
  $('#sum').innerHTML = `<div><b>${data.length}</b><span>Hadir</span></div><div><b>${Math.floor(mins / 60)}j</b><span>Jam bersih</span></div>`;
  $('#rlist').innerHTML = rs.map(({ r, m }) => { const today = r.work_date === wibDate(), st = r.check_out ? ['success', 'Selesai'] : today ? ['pending', m.onBreak ? 'Istirahat' : 'Bekerja'] : ['failed', 'Belum pulang'];
   return `<div class="sheet"><div class="row2"><b>${fd(r.work_date)}</b><span class="badge-table ${st[0]}">${st[1]}</span></div>
   <div class="mut mt-1">Masuk ${fmtTime(r.check_in)} • Pulang ${fmtTime(r.check_out)}</div><div class="mut">Istirahat ${m.breakMin}m • Kerja bersih ${HOURS.fmt(m.netMin)}</div></div>`; }).join('') || '<div class="sheet mut text-center">Belum ada data bulan ini</div>';
}
const shift = (n) => { const [y, m] = ym.split('-').map(Number); ym = new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); loadRiwayat(); };
$('#pm').onclick = () => shift(-1); $('#nm2').onclick = () => shift(1);
// ---------- Izin / Sakit ----------
const shrink = async (f) => { const b = await createImageBitmap(f), s = Math.min(1, 1280 / Math.max(b.width, b.height)), c = document.createElement('canvas'); c.width = b.width * s; c.height = b.height * s; c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8)); };
const setDates = () => { $('#ds').value = $('#de').value = wibDate(); };
async function loadIzin() {
  if (!$('#ds').value) setDates();
  const d = (await sb.from('leaves').select('*').eq('user_id', me.id).order('created_at', { ascending: false })).data || [];
  $('#llist').innerHTML = d.map((l) => `<div class="sheet"><div class="row2"><b class="text-capitalize">${l.type}</b><span class="badge-table ${ST[l.status][0]}">${ST[l.status][1]}</span></div><div class="mut">${fd(l.start_date)} - ${fd(l.end_date)}</div><div class="mt-1">${esc(l.reason)}</div></div>`).join('') || '<div class="sheet mut text-center">Belum ada pengajuan</div>';
}
$('#seg').onclick = (e) => { const b = e.target.closest('[data-j]'); if (!b) return; jenis = b.dataset.j; $('#seg').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
$('#fi').onsubmit = async (e) => {
  e.preventDefault(); if ($('#de').value < $('#ds').value) return toast('Tanggal selesai harus setelah mulai', false);
  const btn = e.submitter; btn.disabled = true;
  try {
    let path = null; const f = $('#file').files[0];
    if (f) { path = `${me.id}/${Date.now()}.jpg`; const { error } = await sb.storage.from('leave-files').upload(path, await shrink(f), { contentType: 'image/jpeg' }); if (error) throw error; }
    const { error } = await sb.from('leaves').insert({ user_id: me.id, type: jenis, start_date: $('#ds').value, end_date: $('#de').value, reason: $('#rs').value, attachment_path: path }); if (error) throw error;
    toast('Pengajuan terkirim'); e.target.reset(); setDates(); loadIzin();
  } catch (err) { toast(err.message, false); } finally { btn.disabled = false; }
};
// ---------- Profil ----------
function loadProfil() { $('#av').textContent = me.full_name.trim()[0].toUpperCase(); $('#pn').textContent = me.full_name; $('#pp').textContent = me.position || 'Staff'; $('#pe').textContent = me.email; $('#pi').textContent = me.nip || '-'; $('#pt').textContent = me.phone || '-'; }
$('#fp').onsubmit = async (e) => { e.preventDefault(); const { error } = await sb.auth.updateUser({ password: $('#np').value }); error ? toast(error.message, false) : (toast('Password diubah'), e.target.reset()); };
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); dp = e; });
if (/; wv\)|Capacitor/.test(navigator.userAgent) || window.Capacitor?.isNativePlatform?.()) $('#btn-install').classList.add('d-none');
$('#btn-install').onclick = () => dp ? dp.prompt() : toast('Buka menu browser lalu pilih "Tambahkan ke layar utama".');
$('#btn-out').onclick = async () => { await sb.auth.signOut(); resetUi(); };
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && me) resetUi(); });   // sesi habis / logout dari tab lain
// ---------- Umum ----------
$('#eye').onclick = () => { const p = $('#pw'), s = p.type === 'password'; p.type = s ? 'text' : 'password'; $('#eye i').className = s ? 'bi bi-eye-slash' : 'bi bi-eye'; };
$('#fl').onsubmit = async (e) => { e.preventDefault(); $('#err').textContent = ''; const btn = e.submitter; btn.disabled = true; try { const { error } = await sb.auth.signInWithPassword({ email: $('#em').value, password: $('#pw').value }); if (error) return ($('#err').textContent = error.status === 400 ? 'Email atau password salah' : 'Koneksi bermasalah. Coba lagi.'); $('#pw').value = ''; await enter(); } finally { btn.disabled = false; } };
document.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => show(b.dataset.v)));
document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => show(b.dataset.go)));
// Layar mati / pindah aplikasi: kamera pasti mati. Saat kembali, status dibaca ulang dari server dulu (bukan langsung membuka kamera)
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopCam(); manual = false; } else if (onHome) refresh(); });
addEventListener('pagehide', () => stopCam());
addEventListener('online', () => { if (!me && hasSaved()) enter(); });
addEventListener('pageshow', (e) => { if (e.persisted && onHome) { stopCam(); ready = false; refresh(); } });
setInterval(() => { $('#clk').textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }).replace(/\./g, ':'); const mk = Math.floor(Date.now() / 6e4); if (mk !== lastMk) { lastMk = mk; if (ready && att && !att.check_out && onHome) renderStatus(); } }, 1000);   // status hanya digambar ulang tiap menit (dulu tiap detik)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
(async () => {   // di APK: splash dipegang native (HadirinStore) sampai tampilan siap; di browser/PWA: splash web minimal 1,6 dtk
  const nat = window.HadirinStore, t = sleep(nat ? 0 : 1600); if (nat) $('#splash').style.display = 'none';
  try { await enter(); } finally { await t; $('#splash').classList.add('hide'); try { nat?.appReady(); } catch {} }
})();
