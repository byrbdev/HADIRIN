// HADIRIN app karyawan. Memakai helper dari core.js ($, sb, api, toast, fmtTime, fmtDur, wibDate, esc)
let me, att, ws = '08:00:00', target = 420, mode = 'break', stream, track, scanning = false, busy = false, manual = false, onHome = false, watch = null, lastBad = '', ym = wibDate().slice(0, 7), jenis = 'izin', dp;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fd = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const calc = (r) => HOURS.summarize(r, Date.now(), target, ws);
const ST = { pending: ['pending', 'Menunggu'], approved: ['success', 'Disetujui'], rejected: ['failed', 'Ditolak'] };
function show(v) {
  if (v !== 'home') leaveHome();
  document.querySelectorAll('.view').forEach((e) => e.classList.toggle('on', e.id === 'v-' + v));
  $('#nav').style.display = v === 'login' ? 'none' : 'flex';
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === v)); scrollTo(0, 0);
  ({ home: enterHome, riwayat: loadRiwayat, izin: loadIzin, profil: loadProfil }[v] || (() => {}))();
}
async function enter() {
  const { data: { session } } = await sb.auth.getSession(); if (!session) return show('login');
  const { data: p } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  if (p && p.role === 'admin' && p.active) return (location.href = '/dashboard');
  if (!p || p.role !== 'employee' || !p.active) { await sb.auth.signOut(); $('#err').textContent = p?.role === 'admin' ? 'Akun admin: gunakan dashboard admin.' : 'Akun tidak aktif atau tidak ditemukan.'; return show('login'); }
  me = { ...p, email: session.user.email };
  const { data: s } = await sb.from('settings').select('work_start,target_minutes').eq('id', 1).single(); if (s?.work_start) ws = s.work_start; if (s?.target_minutes) target = s.target_minutes; show('home');
}
// ---------- Home ----------
async function loadToday() { const { data } = await sb.from('attendance').select('*').eq('user_id', me.id).eq('work_date', wibDate()).maybeSingle(); att = data; renderStatus(); }
function renderStatus() {
  $('#st-d').textContent = new Date(wibDate()).toLocaleDateString('id-ID', { dateStyle: 'full', timeZone: 'UTC' });
  const x = $('#st-x'), seg = $('#mode'); x.textContent = ''; seg.classList.add('d-none');
  if (!att) { $('#st-b').textContent = 'Belum Absen'; $('#st-t').textContent = 'Scan QR untuk absen masuk'; $('#hint').textContent = 'Arahkan kamera ke QR di layar kantor'; return; }
  const m = calc(att);
  if (att.check_out) { $('#st-b').textContent = 'Selesai'; $('#st-t').textContent = `${fmtTime(att.check_in)} - ${fmtTime(att.check_out)} • Kerja bersih ${HOURS.fmt(m.netMin)}`; x.textContent = `Total istirahat ${m.breakMin} menit`; $('#hint').textContent = 'Absensi hari ini lengkap. Sampai jumpa besok!'; return; }
  if (m.onBreak) { const b = att.breaks.find((b) => !b.e); $('#st-b').textContent = 'Istirahat'; $('#st-t').textContent = `Keluar ${fmtTime(b.s)} • ${fmtDur(b.s, null).replace(' (berjalan)', '')}`; x.textContent = `Kerja bersih sejauh ini ${HOURS.fmt(m.netMin)}`; $('#hint').textContent = 'Scan QR untuk kembali masuk dari istirahat'; return; }
  $('#st-b').textContent = 'Sedang Bekerja'; $('#st-t').textContent = `Masuk ${fmtTime(att.check_in)} • Kerja bersih ${HOURS.fmt(m.netMin)}`;
  const dur = (n) => n >= 60 ? HOURS.fmt(n) : `${n}m`;
  x.innerHTML = m.canOut
    ? `<div class="st-main">Sudah boleh pulang</div><div class="st-sub">Istirahat ${dur(m.breakMin)}</div>`
    : `<div class="st-main">Pulang paling cepat <b>${fmtTime(m.earliest)}</b></div><div class="st-sub">Istirahat ${dur(m.breakMin)}` + (m.lateMin ? ` &nbsp;•&nbsp; Telat ${dur(m.lateMin)}` : '') + `</div>` + (m.lateMin ? `<div class="st-tip">Potong jam istirahat atau pulang lebih lambat</div>` : '');
  seg.classList.remove('d-none'); $('#m-out').disabled = !m.canOut; $('#m-out').style.opacity = m.canOut ? 1 : .45; if (!m.canOut && mode === 'out') mode = 'break';
  seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
  $('#hint').textContent = mode === 'out' ? 'Scan QR untuk absen pulang' : 'Scan QR saat keluar istirahat';
}
$('#mode').onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b || b.disabled) return; mode = b.dataset.m; renderStatus(); };
function enterHome() {
  onHome = true; manual = false;
  const h = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  $('#gr').textContent = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; $('#nm').textContent = me.full_name.split(' ')[0];
  startGps(); loadToday().then(startCam);
}
function leaveHome() { onHome = false; stopCam(); if (watch != null) { navigator.geolocation.clearWatch(watch); watch = null; } }
const setChip = (ok, t) => { $('#chip').className = 'chip' + (ok ? ' ok' : ''); $('#chip span').textContent = t; };
function startGps() { if (watch != null) return; if (!navigator.geolocation) return setChip(false, 'GPS tidak didukung');
  watch = navigator.geolocation.watchPosition((p) => setChip(true, `Lokasi siap (±${Math.round(p.coords.accuracy)} m)`), () => setChip(false, 'Aktifkan izin lokasi'), { enableHighAccuracy: true, maximumAge: 10000 }); }
const getPos = () => new Promise((ok, no) => navigator.geolocation.getCurrentPosition((p) => ok(p.coords), () => no(new Error('Lokasi tidak terbaca. Aktifkan GPS dan izinkan akses lokasi.')), { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }));
// Kamera otomatis: tutup setelah absen masuk, buka lagi menjelang jam istirahat
const BREAK_TIME = ['11:30', '14:30'], BREAK_LEAD = 10, BREAK_WIN = 40; // buka 10 mnt sebelum, aktif 40 mnt
const hm = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const wibMin = () => { const d = new Date(Date.now() + 7 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
function camWanted() {
  if (!att) return true;
  if (att.check_out) return false;
  const m = calc(att); if (m.onBreak || m.canOut) return true;
  const n = wibMin();
  return BREAK_TIME.some((t) => {
    const a = hm(t) - BREAK_LEAD; if (n < a || n >= a + BREAK_WIN) return false;
    const from = new Date(`${wibDate()}T${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}:00+07:00`);
    return !(att.breaks || []).some((b) => new Date(b.s) >= from);
  });
}
// Isi tengah area scan; keterangan (p) disembunyikan bila kosong supaya tetap center
function setIdle(title, sub) { $('#cam-t').textContent = title; const p = $('#cam-p'); p.textContent = sub || ''; p.classList.toggle('d-none', !sub); }
function showWork() { $('.pulse i').className = 'bi bi-briefcase-fill'; setIdle('Selamat bekerja!'); }
function syncCam() {
  if (!onHome || !att || att.check_out || busy) return;
  if (camWanted()) { if (!stream) startCam(); } else if (stream && !manual) { stopCam(); showWork(); }
}
setInterval(syncCam, 20000);
async function startCam() {
  if (att?.check_out) return setIdle('Absensi Hari Ini Selesai', 'Terima kasih, sampai jumpa besok!');
  if (!manual && att && !camWanted()) { stopCam(); return showWork(); }
  $('.pulse i').className = 'bi bi-qr-code-scan';
  if (stream) return; setIdle('Silakan Scan QR untuk Kehadiran', 'Menyiapkan kamera...');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); const v = $('#vid'); v.srcObject = stream; await v.play();
    scanning = true; $('#scan').classList.add('live'); track = stream.getVideoTracks()[0];
    if (track.getCapabilities?.().torch) $('#torch').classList.add('can'); loop();
  } catch { setIdle('Kamera belum aktif', 'Izinkan akses kamera di browser, lalu ketuk 2x layar ini.'); }
}
function stopCam() { scanning = false; stream?.getTracks().forEach((t) => t.stop()); stream = null; $('#scan').classList.remove('live'); }
function loop() {
  if (!scanning) return; const v = $('#vid');
  if (v.readyState >= 2 && !busy) {
    const s = Math.min(1, 520 / v.videoWidth), c = $('#cv'), x = c.getContext('2d', { willReadFrequently: true }); c.width = v.videoWidth * s; c.height = v.videoHeight * s; x.drawImage(v, 0, 0, c.width, c.height);
    const q = jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'dontInvert' });
    if (q?.data.startsWith('HDR.')) onCode(q.data); else if (q && q.data !== lastBad) { lastBad = q.data; toast('QR bukan milik HADIRIN', false); setTimeout(() => (lastBad = ''), 3000); }
  }
  setTimeout(loop, 130);
}
const ICON = { ok: '<svg class="ck ok" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><path d="M30 52l14 14 27-30"/></svg>', bad: '<svg class="ck bad" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><path d="M35 35l30 30M65 35L35 65"/></svg>', load: '<div class="spin"></div>' };
function result(k, t, p) { $('#res-i').innerHTML = ICON[k]; $('#res-t').textContent = t || 'Memverifikasi...'; $('#res-p').textContent = p || 'Mengecek QR dan lokasi Anda'; $('#res-ok').classList.toggle('d-none', k === 'load'); $('#res').classList.add('on'); }
async function onCode(token) {
  busy = true; navigator.vibrate?.(60); result('load');
  try {
    const p = await getPos(); const r = await api('/api/scan', 'POST', { token, lat: p.latitude, lng: p.longitude, action: mode }); navigator.vibrate?.([80, 40, 80]); mode = 'break'; await loadToday();
    const T = { in: ['Absen Masuk Berhasil', `Pukul ${fmtTime(r.time)} • ${r.distance} m dari kantor`], break_start: ['Keluar Istirahat Tercatat', `Pukul ${fmtTime(r.time)} • Scan lagi saat kembali`],
      break_end: ['Kembali dari Istirahat', `Istirahat ${r.break_min} menit • Total hari ini ${r.breakMin} menit`], out: ['Absen Pulang Berhasil', `Pukul ${fmtTime(r.time)} • Kerja bersih ${HOURS.fmt(r.netMin)} • Istirahat ${r.breakMin} menit`] }[r.action];
    result('ok', T[0], T[1]);
  } catch (e) { result('bad', 'Absen Gagal', e.message); }
}
$('#res-ok').onclick = () => { $('#res').classList.remove('on'); busy = false; manual = false; if (att?.check_out) { stopCam(); startCam(); } else syncCam(); };
// Ketuk 2x pada area scan = buka kamera manual (kondisi urgent)
let lastTap = 0, lastX = 0, lastY = 0;
$('#scan').addEventListener('pointerup', (e) => {
  const now = Date.now(), dbl = now - lastTap < 350 && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 40;
  lastTap = dbl ? 0 : now; lastX = e.clientX; lastY = e.clientY;
  if (!dbl || stream || busy || att?.check_out) return;
  manual = true; navigator.vibrate?.(30); startCam();
});
$('#torch').onclick = async (e) => { const on = !e.currentTarget.classList.contains('on'); try { await track.applyConstraints({ advanced: [{ torch: on }] }); e.currentTarget.classList.toggle('on', on); } catch {} };
// ---------- Riwayat ----------
async function loadRiwayat() {
  const [y, m] = ym.split('-').map(Number), a = ym + '-01', b = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  $('#ym').textContent = new Date(a).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const data = (await sb.from('attendance').select('*').eq('user_id', me.id).gte('work_date', a).lte('work_date', b).order('work_date', { ascending: false })).data || [];
  let mins = 0, lt = 0; const rs = data.map((r) => ({ r, m: calc(r) })); rs.forEach(({ r, m }) => { if (r.check_out) mins += m.netMin; if (m.lateMin) lt++; });
  $('#sum').innerHTML = `<div><b>${data.length}</b><span>Hadir</span></div><div><b>${lt}</b><span>Hari telat</span></div><div><b>${Math.floor(mins / 60)}j</b><span>Jam bersih</span></div>`;
  $('#rlist').innerHTML = rs.map(({ r, m }) => { const today = r.work_date === wibDate(), st = r.check_out ? ['success', 'Selesai'] : today ? ['pending', m.onBreak ? 'Istirahat' : 'Bekerja'] : ['failed', 'Belum pulang'];
   return `<div class="sheet"><div class="row2"><b>${fd(r.work_date)}</b><span class="badge-table ${st[0]}">${st[1]}</span></div>
   <div class="mut mt-1">Masuk ${fmtTime(r.check_in)} • Pulang ${fmtTime(r.check_out)}</div><div class="mut">Istirahat ${m.breakMin}m • Kerja bersih ${HOURS.fmt(m.netMin)}${m.lateMin ? ` • Telat ${m.lateMin}m` : ''}</div></div>`; }).join('') || '<div class="sheet mut text-center">Belum ada data bulan ini</div>';
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
$('#btn-out').onclick = async () => { await sb.auth.signOut(); me = att = null; show('login'); };
// ---------- Umum ----------
$('#fl').onsubmit = async (e) => { e.preventDefault(); $('#err').textContent = ''; const { error } = await sb.auth.signInWithPassword({ email: $('#em').value, password: $('#pw').value }); if (error) return ($('#err').textContent = 'Email atau password salah'); enter(); };
document.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => show(b.dataset.v)));
document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => show(b.dataset.go)));
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCam(); else if ($('#v-home').classList.contains('on')) startCam(); });
setInterval(() => { $('#clk').textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }).replace(/\./g, ':'); if (att && !att.check_out && $('#v-home').classList.contains('on')) renderStatus(); }, 1000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
(async () => { await sleep(1800); $('#splash').classList.add('hide'); enter(); })();
