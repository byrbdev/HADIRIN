Pages.karyawan = (admin) => {
  const PFX = 'RB-';
  let list = [], editing = null, flt = '', busy = false, alive = true;
  const modal = () => bootstrap.Modal.getOrCreateInstance('#m');
  const jab = (p) => (p.role === 'admin' ? 'Admin' : 'Karyawan');
  const pg = pager($('#info'), $('#pg'), 10, () => draw());
  // NIP selalu berawalan RB- (tidak bisa dihapus), otomatis huruf besar tanpa spasi
  const fixNip = () => { const el = $('#nip'); let v = el.value.toUpperCase().replace(/\s+/g, ''); if (v.startsWith(PFX)) v = v.slice(PFX.length); else v = v.replace(/^R?B?-?/, ''); el.value = PFX + v; };
  function draw() {
    const q = $('#q').value.toLowerCase();
    const rows = pg.slice(list.filter((p) => (p.full_name + (p.nip || '')).toLowerCase().includes(q) && (flt === '' || String(+p.active) === flt)));
    $('#rows').innerHTML = rows.map((p) => `<tr><td><div class="table-user-cell"><div><div class="table-user-name">${esc(p.full_name)}</div><div class="table-user-sub">${p.nip ? esc(p.nip) + ' • ' : ''}${jab(p)}</div></div></div></td><td>${esc(p.phone) || '-'}</td>
 <td><span class="badge-table ${p.active ? 'success' : 'failed'}">${p.active ? 'Aktif' : 'Nonaktif'}</span></td><td><div class="d-flex justify-content-center gap-1"><a href="#" class="table-btn-action" title="Edit" data-id="${p.id}"><i class="bi bi-pencil"></i></a>${p.id === admin.id ? '' : `<a href="#" class="table-btn-action delete" title="Hapus" data-del="${p.id}"><i class="bi bi-trash"></i></a>`}</div></td></tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted py-4">Belum ada karyawan</td></tr>';
  }
  async function load() { const { data } = await sb.from('profiles').select('*').in('role', ['employee', 'admin']).order('full_name'); if (!alive || !$('#rows')) return; list = data || []; draw(); }
  function open_(p) {
    editing = p; $('#mt').textContent = p ? 'Edit Karyawan' : 'Tambah Karyawan';
    for (const k of ['full_name', 'phone']) $('#' + k).value = p?.[k] || '';
    $('#nip').value = p?.nip || ''; fixNip();
    $('#position').value = p ? jab(p) : 'Karyawan'; $('#active').checked = p ? p.active : true;
    $('#email').value = ''; $('#email').required = !p; $('#password').required = !p; $('#password').value = '';
    $('#pwhint').textContent = p ? 'Kosongkan email/password jika tidak diubah.' : 'Password minimal 6 karakter.';
    const self = p && p.id === admin.id; $('#position').disabled = !!self; $('#active').disabled = !!self;   // admin tidak bisa menurunkan / menonaktifkan dirinya sendiri
    modal().show();
  }
  $('#btn-add').onclick = () => open_(null); $('#q').oninput = () => { pg.reset(); draw(); };
  $('#nip').addEventListener('input', fixNip); $('#nip').addEventListener('focus', () => { fixNip(); const n = $('#nip'); setTimeout(() => n.setSelectionRange(n.value.length, n.value.length)); });
  filterDropdown($('#fbtn'), $('#fmenu'), '', (v) => { flt = v; pg.reset(); draw(); });
  async function del_(p) {
    if (busy || !await confirmBox('Hapus karyawan?', `${p.full_name} akan dihapus permanen beserta seluruh data absensi dan pengajuan izinnya. Jika hanya ingin menutup akses login, pilih Edit lalu matikan "Akun aktif".`)) return;
    busy = true; try { await api('/api/employee', 'DELETE', { id: p.id }); list = list.filter((x) => x.id !== p.id); toast('Karyawan dihapus'); draw(); } catch (err) { toast(err.message, false); } finally { busy = false; }
  }
  $('#rows').onclick = (e) => {
    const d = e.target.closest('[data-del]'); if (d) { e.preventDefault(); const p = list.find((x) => x.id === d.dataset.del); if (p) del_(p); return; }
    const a = e.target.closest('[data-id]'); if (a) { e.preventDefault(); open_(list.find((p) => p.id === a.dataset.id)); }
  };
  $('#f').onsubmit = async (e) => {
    e.preventDefault(); if (busy) return; fixNip();
    const nip = $('#nip').value === PFX ? '' : $('#nip').value;
    const b = { full_name: $('#full_name').value, nip, position: $('#position').value, role: $('#position').value === 'Admin' ? 'admin' : 'employee', phone: $('#phone').value, active: $('#active').checked, email: $('#email').value || undefined, password: $('#password').value || undefined };
    busy = true;
    try { editing ? await api('/api/employee', 'PATCH', { ...b, id: editing.id }) : await api('/api/employee', 'POST', b); modal().hide(); toast('Data tersimpan'); load(); }
    catch (err) { toast(err.message, false); } finally { busy = false; }
  };
  load();
  return () => { alive = false; };
};
