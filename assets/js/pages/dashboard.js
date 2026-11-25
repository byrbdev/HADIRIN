Pages.dashboard = () => {
  let rowsData = [], target = 480, wsd = '08:00:00', alive = true, qrInfo = null, qrTimer = null, full = null;
  const timers = [], chans = [];
  function draw() {
    const q = $('#q').value.toLowerCase();
    $('#rows').innerHTML = rowsData.filter((r) => r.name.toLowerCase().includes(q)).map((r) => `<tr><td><div class="table-user-cell"><div><div class="table-user-name">${esc(r.name)}</div><div class="table-user-sub">${esc(r.sub)}</div></div></div></td><td>${fmtTime(r.in)}</td><td>${fmtTime(r.out)}</td><td>${r.m.breakMin} mnt</td><td>${HOURS.fmt(r.m.netMin)}</td><td><span class="badge-table ${r.out ? 'success' : 'pending'}">${r.out ? 'Selesai' : r.m.onBreak ? 'Istirahat' : 'Bekerja'}</span></td></tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted py-4">Belum ada yang absen hari ini</td></tr>';
  }
  async function load() {
    const day = wibDate();
    const [emp, att, lv, cfg] = await Promise.all([
      sb.from('profiles').select('id,full_name,nip,position').eq('role', 'employee').eq('active', true),
      sb.from('attendance').select('*').eq('work_date', day).order('check_in'),
      sb.from('leaves').select('user_id').eq('status', 'approved').lte('start_date', day).gte('end_date', day),
      sb.from('settings').select('work_start,target_minutes').eq('id', 1).single()]);
    if (!alive || !$('#rows')) return;   // sudah pindah halaman
    if (cfg.data) { target = cfg.data.target_minutes || 480; wsd = cfg.data.work_start || wsd; }
    const info = Object.fromEntries((emp.data || []).map((e) => [e.id, e])), n = Object.keys(info).length;
    const hadir = (att.data || []).filter((a) => info[a.user_id]), izin = new Set((lv.data || []).map((l) => l.user_id).filter((i) => info[i]));
    $('#g-date').textContent = new Date(day).toLocaleDateString('id-ID', { dateStyle: 'long', timeZone: 'UTC' });
    $('#g-text').textContent = `${hadir.length} karyawan hadir hari ini`;
    $('#s-absen').textContent = Math.max(0, n - hadir.length - izin.size); $('#s-izin').textContent = izin.size;
    rowsData = hadir.map((a) => ({ name: info[a.user_id].full_name, sub: info[a.user_id].position || 'Staff', in: a.check_in, out: a.check_out, m: HOURS.summarize(a, Date.now(), target, wsd) })); draw();
  }
  $('#q').oninput = draw;
  const onClick = (e) => { if (e.target.closest('[data-refresh]')) { e.preventDefault(); load(); } };
  document.addEventListener('click', onClick);

  // ---------- QR Hari Ini: modal + layar penuh + jam berjalan ----------
  const clockTxt = () => new Date().toLocaleTimeString('id-ID', { hour12: false, timeZone: 'Asia/Jakarta' }).replace(/\./g, ':');
  const dateTxt = () => new Date(qrInfo.date).toLocaleDateString('id-ID', { dateStyle: 'full', timeZone: 'UTC' });
  const drawQR = (el) => { el.innerHTML = ''; new QRCode(el, { text: qrInfo.token, width: 560, height: 560, correctLevel: QRCode.CorrectLevel.M }); };
  async function fetchQR() { qrInfo = await api('/api/qr', 'GET'); }
  function qrTick() {
    document.querySelectorAll('.qr-clock').forEach((c) => (c.textContent = clockTxt()));
    if (qrInfo && wibDate() !== qrInfo.date) {   // lewat tengah malam WIB: token baru otomatis
      fetchQR().then(() => { document.querySelectorAll('.qr-date').forEach((d) => (d.textContent = dateTxt())); document.querySelectorAll('.qr-slot').forEach(drawQR); }).catch(() => {});
    }
  }
  function ensureQRTimer() { if (!qrTimer) { qrTick(); qrTimer = setInterval(qrTick, 1000); } }
  function stopQRTimer() { if (!$('#qrModal.show') && !full) { clearInterval(qrTimer); qrTimer = null; } }
  function closeFull() { if (!full) return; document.removeEventListener('keydown', onKey); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); full.remove(); full = null; stopQRTimer(); }
  const onKey = (e) => { if (e.key === 'Escape') closeFull(); };
  function openFull() {
    if (!qrInfo || full) return;
    full = document.createElement('div'); full.id = 'qr-full';
    full.innerHTML = `<div class="qr-brand">HADIRIN By RB</div><button class="btn-custom btn-custom-light qr-close" type="button"><i class="bi bi-x-lg"></i> Tutup</button>
      <div class="qr-clock"></div><div class="qr-date">${dateTxt()}</div><div class="qr-box"><div class="qr-slot"></div></div><div class="qr-date" style="font-size:1rem;opacity:.7">Scan QR ini lewat aplikasi HADIRIN</div>`;
    document.body.appendChild(full); drawQR(full.querySelector('.qr-slot')); full.querySelector('.qr-slot').id = 'qr-big';
    full.querySelector('.qr-close').onclick = closeFull; document.addEventListener('keydown', onKey);
    full.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) closeFull(); });
    full.requestFullscreen?.().catch(() => {});   // bila browser menolak (mis. iOS), tetap tampil sebagai overlay penuh
    ensureQRTimer();
  }
  $('#btn-qr').onclick = async () => {
    try {
      await Promise.all([fetchQR(), loadScript('https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js')]);
      const slot = $('#qr'); slot.classList.add('qr-slot'); drawQR(slot); $('#qr-date').textContent = dateTxt();
      const m = bootstrap.Modal.getOrCreateInstance('#qrModal'); m.show(); ensureQRTimer();
    } catch (e) { toast(e.message, false); }
  };
  $('#btn-qr-full').onclick = openFull;
  $('#qrModal').addEventListener('hidden.bs.modal', stopQRTimer);

  let ch = sb.channel('rt-' + Date.now()).on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, load).on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, load).subscribe(); chans.push(ch);
  timers.push(setInterval(load, 60000));
  load();
  return () => { alive = false; timers.forEach(clearInterval); chans.forEach((c) => sb.removeChannel(c)); document.removeEventListener('click', onClick); closeFull(); clearInterval(qrTimer); qrTimer = null; };
};
