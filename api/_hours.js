// Aturan jam kerja HADIRIN (sisi server). Salinan klien: assets/js/hours.js — jaga tetap sama
// (scripts/test-rules.js membandingkan keduanya).
const MIN = 6e4;
const fl = (t) => Math.floor(new Date(t).getTime() / MIN) * MIN; // semua waktu dibulatkan ke bawah per menit (sesuai tampilan HH:MM)
export function summarize(a, now = Date.now(), target = 420, workStart = '08:00') {
  const breaks = Array.isArray(a.breaks) ? a.breaks : [];
  const end = a.check_out ? fl(a.check_out) : fl(now), cin = fl(a.check_in);
  const open = breaks.find((b) => !b.e);
  let breakMs = 0;
  for (const b of breaks) breakMs += Math.max(0, (b.e ? fl(b.e) : end) - fl(b.s));
  const netMs = Math.max(0, end - cin - breakMs);
  const earliest = cin + target * MIN + breakMs;       // jam pulang paling cepat (jika istirahat tidak bertambah lagi)
  const [h, m] = String(workStart).split(':').map(Number);
  const inWib = new Date(cin + 7 * 3600e3), inMin = inWib.getUTCHours() * 60 + inWib.getUTCMinutes();
  return { breakMin: Math.round(breakMs / MIN), netMin: Math.round(netMs / MIN), onBreak: !!open && !a.check_out, earliest,
    remainMin: Math.max(0, Math.ceil((target * MIN - netMs) / MIN)), canOut: !a.check_out && !open && netMs >= target * MIN,
    lateMin: Math.max(0, inMin - (h * 60 + m)) };
}

// Jendela istirahat (WIB). out = scan keluar istirahat mulai dibuka; back = scan masuk setelah istirahat mulai dibuka.
// Istirahat ke-1 dan ke-2 masing-masing hanya sekali. Salinan klien: assets/js/hours.js — jaga tetap sama.
export const BREAK_SLOTS = [{ out: '11:40', back: '12:40' }, { out: '14:40', back: '15:40' }];
const hm = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const wibMin = (t) => { const d = new Date(new Date(t).getTime() + 7 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const TM = /^([01]\d|2[0-3]):[0-5]\d$/;
// Pastikan pengaturan valid (2 istirahat; keluar < masuk; urutan naik). Jika tidak valid / belum ada, pakai bawaan.
export const normSlots = (v) => {
  if (!Array.isArray(v) || v.length !== 2 || !v.every((x) => x && TM.test(x.out) && TM.test(x.back))) return BREAK_SLOTS;
  const t = v.flatMap((x) => [hm(x.out), hm(x.back)]);
  return t.every((n, i) => i === 0 || (i % 2 ? n > t[i - 1] : n >= t[i - 1])) ? v.map((x) => ({ out: x.out, back: x.back })) : BREAK_SLOTS;
};
const slotOf = (t, S) => { const n = wibMin(t); let k = -1; S.forEach((s, i) => { if (hm(s.out) <= n) k = i; }); return k; };
export function breakState(a, now = Date.now(), slots = BREAK_SLOTS) {
  const S = normSlots(slots);
  const breaks = Array.isArray(a.breaks) ? a.breaks : [], open = breaks.find((b) => !b.e), n = wibMin(now);
  if (open) {   // sedang istirahat: boleh kembali masuk hanya setelah jam "back" slot tempat istirahat itu dimulai
    const k = slotOf(open.s, S), backAt = k >= 0 ? S[k].back : null, canEnd = !backAt || n >= hm(backAt);
    return { onBreak: true, slot: k, canStart: false, canEnd, backAt, nextAt: null, msg: canEnd ? '' : `Scan masuk setelah istirahat dibuka pukul ${backAt}.` };
  }
  const k = slotOf(now, S), canStart = k >= 0 && !breaks.some((b) => slotOf(b.s, S) === k);
  const nx = S.find((x) => hm(x.out) > n), nextAt = nx ? nx.out : null;
  return { onBreak: false, slot: k, canStart, canEnd: false, backAt: canStart ? S[k].back : null, nextAt,
    msg: canStart ? '' : nextAt ? `Scan keluar istirahat dibuka pukul ${nextAt}.` : 'Jatah istirahat hari ini sudah terpakai.' };
}
