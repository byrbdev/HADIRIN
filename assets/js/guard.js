// Guard sinkron di <head>: jalan SEBELUM halaman tampil, supaya tidak ada kilatan dashboard saat belum login.
(function () {
  var mode = (document.currentScript && document.currentScript.dataset.mode) || 'admin';
  var has = false;
  try { has = !!(window.HadirinStore && window.HadirinStore.hasAuth()); } catch (e) {}
  if (!has) try { has = Object.keys(localStorage).some(function (k) { return /^sb-.+-auth-token$/.test(k) && localStorage.getItem(k); }); } catch (e) {}
  if (mode === 'admin' && !has) { location.replace('/login'); }
  if (mode === 'admin' || has) document.documentElement.classList.add('boot');   // admin: tunggu verifikasi; login: tunggu cek sesi
})();
