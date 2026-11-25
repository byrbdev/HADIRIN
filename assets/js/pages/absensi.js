Pages.absensi = () => {
  let rows = [], mode = 'bulan', ws = '08:00:00', target = 480, view = [], alive = true, ch = null;
  const pg = pager($('#info'), $('#pg'), 10, () => draw());
  const wib = wibDate(); $('#d-day').value = wib; $('#d-month').value = wib.slice(0, 7); $('#d-from').value = wib.slice(0, 8) + '01'; $('#d-to').value = wib;
  const fd = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const calc = (r) => HOURS.summarize(r, Date.now(), target, ws);
  const stat = (r) => { const m = calc(r); return r.check_out ? ['success', 'Selesai'] : r.work_date === wibDate() ? ['pending', m.onBreak ? 'Istirahat' : 'Bekerja'] : ['failed', 'Belum pulang']; };
  const net = (r) => r.check_out || r.work_date === wibDate() ? HOURS.fmt(calc(r).netMin) : '-';
  function range() {
    if (mode === 'hari') { const d = $('#d-day').value; return [d, d]; }
    if (mode === 'bulan') { const m = $('#d-month').value; if (!m) return []; const [y, mo] = m.split('-').map(Number); return [m + '-01', new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10)]; }
    return [$('#d-from').value, $('#d-to').value];
  }
  function showMode() { for (const k of ['hari', 'bulan', 'rentang']) $('#w-' + k).classList.toggle('d-none', k !== mode); }
  function draw() {
    const q = $('#q').value.toLowerCase();
    view = rows.filter((r) => ((r.profiles?.full_name || '') + (r.profiles?.nip || '')).toLowerCase().includes(q));
    $('#rows').innerHTML = pg.slice(view).map((r) => { const c = calc(r), s = stat(r); return `<tr><td>${fd(r.work_date)}</td><td><div class="table-user-cell"><div><div class="table-user-name">${esc(r.profiles?.full_name)}</div><div class="table-user-sub">${esc(r.profiles?.position || 'Staff')}</div></div></div></td>
 <td>${fmtTime(r.check_in)}</td><td>${fmtTime(r.check_out)}</td><td>${c.breakMin} mnt</td><td>${net(r)}</td><td><span class="badge-table ${s[0]}">${s[1]}</span></td></tr>`; }).join('') || '<tr><td colspan="8" class="text-center text-muted py-4">Tidak ada data absensi pada periode ini</td></tr>';
  }
  async function load() {
    const [a, b] = range(); if (!a || !b) return; $('#per').textContent = a === b ? `Data absensi ${fd(a)}` : `Data absensi ${fd(a)} sampai ${fd(b)}`;
    let all = [], from = 0;
    for (;;) {
      const { data, error } = await sb.from('attendance').select('*,profiles(full_name,nip,position)').gte('work_date', a).lte('work_date', b).order('work_date', { ascending: false }).order('check_in').range(from, from + 999);
      if (error) { toast(error.message, false); break; } all = all.concat(data); if (data.length < 1000) break; from += 1000;
    }
    if (!alive || !$('#rows')) return; rows = all; pg.reset(); draw();
  }
  filterDropdown($('#fbtn'), $('#fmenu'), '', (v) => { mode = v; showMode(); load(); });
  for (const i of ['#d-day', '#d-month', '#d-from', '#d-to']) $(i).onchange = load;
  $('#q').oninput = () => { pg.reset(); draw(); };
  $('#btn-export').onclick = () => {
    const c = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['Tanggal,Nama,NIP,Jam Masuk,Jam Pulang,Total Istirahat (menit),Kerja Bersih (menit),Status', ...view.map((r) => [r.work_date, r.profiles?.full_name, r.profiles?.nip, fmtTime(r.check_in), fmtTime(r.check_out), calc(r).breakMin, r.check_out || r.work_date === wibDate() ? calc(r).netMin : '', stat(r)[1]].map(c).join(','))].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = `absensi-${range().join('_')}.csv`; a.click();
  };
  (async () => {
    const { data: s } = await sb.from('settings').select('work_start,target_minutes').eq('id', 1).single();
    if (s?.work_start) ws = s.work_start; if (s?.target_minutes) target = s.target_minutes;
    if (!alive) return; load(); ch = sb.channel('abs-' + Date.now()).on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, load).subscribe();
  })();
  return () => { alive = false; if (ch) sb.removeChannel(ch); };
};
