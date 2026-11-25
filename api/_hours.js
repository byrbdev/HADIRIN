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
export const BREAK_SLOTS = [{ out: '11:40', back: '12:40', due: '13:00', grace: 15 }, { out: '14:40', back: '15:40', due: '16:00', grace: 15 }];
const hm = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const wibMin = (t) => { const d = new Date(new Date(t).getTime() + 7 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const TM = /^([01]\d|2[0-3]):[0-5]\d$/;
// Pastikan pengaturan valid (2 istirahat; urutan waktu naik). Jika tidak valid / belum ada, pakai bawaan.
// due = jam masuk kembali yang dianggap tepat waktu; grace = toleransi telat (menit). Data lama tanpa due/grace tetap diterima.
export const normSlots = (v) => {
  if (!Array.isArray(v) || v.length !== 2 || !v.every((x) => x && TM.test(x.out) && TM.test(x.back))) return BREAK_SLOTS;
  const S = v.map((x, i) => {
    const okDue = (d) => TM.test(d) && hm(d) >= hm(x.back) && (i === 1 || hm(d) <= hm(v[1].out));
    const due = okDue(x.due) ? x.due : okDue(BREAK_SLOTS[i].due) && hm(BREAK_SLOTS[i].due) - hm(x.back) <= 30 ? BREAK_SLOTS[i].due : x.back;   // data lama tanpa due: pakai bawaan hanya jika dekat dengan jam scan masuk
    return { out: x.out, back: x.back, due, grace: Number.isInteger(x.grace) && x.grace >= 0 && x.grace <= 120 ? x.grace : BREAK_SLOTS[i].grace };
  });
  const [a, b] = S, ok = hm(a.out) < hm(a.back) && hm(a.back) <= hm(a.due) && hm(a.due) <= hm(b.out) && hm(b.out) < hm(b.back) && hm(b.back) <= hm(b.due);
  return ok ? S : BREAK_SLOTS;
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

// Waktu kembali dari istirahat yang DICATAT. Jika scan masuk telat tapi masih dalam toleransi (due .. due+grace),
// dicatat tepat jam due (mis. scan 13:07, due 13:00, toleransi 15 -> dicatat 13:00). Scan lebih awal / lewat toleransi = waktu asli.
export function breakEnd(open, now = Date.now(), slots = BREAK_SLOTS) {
  const S = normSlots(slots), k = slotOf(open.s, S);
  if (k < 0 || now - new Date(open.s).getTime() > 12 * 36e5) return { at: now, snapped: false };
  const late = wibMin(now) - hm(S[k].due);
  if (late < 0 || late > S[k].grace) return { at: now, snapped: false };
  const w = new Date(now + 7 * 3600e3), dayStart = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) - 7 * 3600e3;
  return { at: dayStart + hm(S[k].due) * MIN, snapped: late > 0 };
}
