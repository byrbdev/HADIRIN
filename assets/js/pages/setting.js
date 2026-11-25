Pages.setting = () => {
  const DEF = [{ out: '11:40', back: '12:40' }, { out: '14:40', back: '15:40' }];
  const setBrk = (v) => { const d = Array.isArray(v) && v.length === 2 ? v : DEF; $('#o1').value = d[0].out; $('#b1').value = d[0].back; $('#o2').value = d[1].out; $('#b2').value = d[1].back; };
  (async () => {
    const { data: s } = await sb.from('settings').select('*').eq('id', 1).single(); if (!s || !$('#lat')) return;
    $('#lat').value = s.office_lat; $('#lng').value = s.office_lng; $('#rad').value = s.radius_m; $('#ws').value = s.work_start?.slice(0, 5); $('#tm').value = s.target_minutes || 480; setBrk(s.break_slots);
  })();
  $('#loc').onclick = () => navigator.geolocation.getCurrentPosition((p) => { $('#lat').value = p.coords.latitude.toFixed(6); $('#lng').value = p.coords.longitude.toFixed(6); }, () => toast('Izin lokasi ditolak', false));
  $('#f1').onsubmit = async (e) => {
    e.preventDefault(); const { error } = await sb.from('settings').update({ office_lat: +$('#lat').value, office_lng: +$('#lng').value, radius_m: +$('#rad').value, work_start: $('#ws').value, target_minutes: +$('#tm').value }).eq('id', 1);
    error ? toast(error.message, false) : toast('Setting tersimpan');
  };
  $('#brk-def').onclick = () => setBrk(DEF);
  $('#f3').onsubmit = async (e) => {
    e.preventDefault(); const o1 = $('#o1').value, b1 = $('#b1').value, o2 = $('#o2').value, b2 = $('#b2').value;
    if (!(o1 < b1)) return toast('Istirahat pertama: scan masuk harus setelah scan keluar', false);
    if (!(b1 <= o2)) return toast('Istirahat kedua harus dimulai setelah scan masuk istirahat pertama', false);
    if (!(o2 < b2)) return toast('Istirahat kedua: scan masuk harus setelah scan keluar', false);
    const { error } = await sb.from('settings').update({ break_slots: [{ out: o1, back: b1 }, { out: o2, back: b2 }] }).eq('id', 1);
    error ? toast(/break_slots/.test(error.message) ? 'Kolom break_slots belum ada: jalankan supabase/migration-jam-istirahat.sql di Supabase SQL Editor' : error.message, false) : toast('Jam istirahat tersimpan');
  };
  $('#f2').onsubmit = async (e) => {
    e.preventDefault(); if ($('#np').value !== $('#np2').value) return toast('Password tidak sama', false);
    const { error } = await sb.auth.updateUser({ password: $('#np').value }); error ? toast(error.message, false) : (toast('Password diubah'), e.target.reset());
  };
};
