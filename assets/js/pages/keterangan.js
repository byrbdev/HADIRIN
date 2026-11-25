Pages.keterangan = () => {
  let list = [], cur = null, flt = '', busy = false, alive = true, ch = null, t = null;
  const ST = { pending: ['pending', 'Menunggu'], approved: ['success', 'Disetujui'], rejected: ['failed', 'Ditolak'] };
  const dt = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const same = (a, b) => String(a) === String(b);   // id dibandingkan ketat sebagai string, tidak pakai ==
  const pg = pager($('#info'), $('#pg'), 10, () => draw());
  function draw() {
    const q = $('#q').value.toLowerCase();
    const rows = pg.slice(list.filter((l) => (!flt || l.status === flt) && (l.profiles?.full_name || '').toLowerCase().includes(q)));
    $('#rows').innerHTML = rows.map((l) => `<tr><td><div class="table-user-cell"><div><div class="table-user-name">${esc(l.profiles?.full_name)}</div><div class="table-user-sub">${esc(l.profiles?.position || 'Staff')}</div></div></div></td><td class="text-capitalize table-product-name">${esc(l.type)}</td><td>${dt(l.start_date)} - ${dt(l.end_date)}</td>
 <td><span class="badge-table ${ST[l.status][0]}">${ST[l.status][1]}</span></td><td><div class="d-flex justify-content-center gap-1"><a href="#" class="table-btn-action" title="Lihat detail" data-id="${l.id}"><i class="bi bi-eye"></i></a></div></td></tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted py-4">Tidak ada data</td></tr>';
  }
  async function load() {
    const { data, error } = await sb.from('leaves').select('*,profiles(full_name,position)').order('created_at', { ascending: false });
    if (!alive || !$('#rows')) return; if (error) return toast(error.message, false);
    list = data || []; if (cur) cur = list.find((l) => same(l.id, cur.id)) || cur; draw();
  }
  const reload = () => { clearTimeout(t); t = setTimeout(load, 300); };   // gabungkan banyak event realtime jadi satu muat ulang
  $('#q').oninput = () => { pg.reset(); draw(); }; filterDropdown($('#fbtn'), $('#fmenu'), '', (v) => { flt = v; pg.reset(); draw(); });
  $('#rows').onclick = async (e) => {
    const a = e.target.closest('[data-id]'); if (!a) return; e.preventDefault(); cur = list.find((l) => same(l.id, a.dataset.id)); if (!cur) return;
    let att = '<span class="text-muted">Tidak ada lampiran</span>';
    if (cur.attachment_path) { const { data } = await sb.storage.from('leave-files').createSignedUrl(cur.attachment_path, 300); if (data) att = `<a href="${data.signedUrl}" target="_blank"><img src="${data.signedUrl}" class="img-fluid rounded mt-1" alt="Lampiran"></a>`; }
    $('#d-name').textContent = cur.profiles?.full_name;
    $('#d-body').innerHTML = `<p class="mb-1"><b>Jenis:</b> <span class="text-capitalize">${esc(cur.type)}</span></p><p class="mb-1"><b>Tanggal:</b> ${dt(cur.start_date)} - ${dt(cur.end_date)}</p><p class="mb-1"><b>Status:</b> <span class="badge-table ${ST[cur.status][0]}">${ST[cur.status][1]}</span></p><p class="mb-2"><b>Alasan:</b> ${esc(cur.reason) || '-'}</p><b>Lampiran:</b><br>${att}`;
    $('#d-act').querySelectorAll('[data-s]').forEach((b) => { b.style.display = cur.status === 'pending' ? '' : 'none'; b.disabled = false; });
    bootstrap.Modal.getOrCreateInstance('#m').show();
  };
  // Setuju / Tolak: HANYA satu pengajuan (id terpilih) dan hanya yang masih 'pending'. Hasil diverifikasi = tepat 1 baris.
  $('#d-act').onclick = async (e) => {
    const s = e.target.closest('[data-s]')?.dataset.s; if (!s || busy || !cur) return;
    busy = true; const id = cur.id; $('#d-act').querySelectorAll('[data-s]').forEach((b) => (b.disabled = true));
    try {
      const { data, error } = await sb.from('leaves').update({ status: s }).eq('id', id).eq('status', 'pending').select('id,status');
      if (error) throw error;
      if (!data || data.length !== 1) throw new Error('Pengajuan ini sudah diproses atau tidak ditemukan');
      list = list.map((l) => (same(l.id, id) ? { ...l, status: s } : l));   // ubah hanya baris ini di layar
      bootstrap.Modal.getInstance('#m')?.hide(); toast(s === 'approved' ? 'Pengajuan disetujui' : 'Pengajuan ditolak'); draw();
    } catch (err) { toast(err.message, false); load(); }
    finally { busy = false; }
  };
  load(); ch = sb.channel('lv-' + Date.now()).on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, reload).subscribe();
  return () => { alive = false; clearTimeout(t); if (ch) sb.removeChannel(ch); };
};
