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
