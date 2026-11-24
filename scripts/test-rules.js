// npm run test:rules : memeriksa aturan jam kerja (contoh dari kebijakan) dan kesamaan salinan server vs klien
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { summarize } from '../api/_hours.js';
const ctx = {}; vm.runInNewContext(fs.readFileSync(new URL('../assets/js/hours.js', import.meta.url), 'utf8') + ';this.HOURS=HOURS', ctx);
const at = (hm) => new Date(`2026-01-05T${hm}:00+07:00`).toISOString(), hm = (ms) => new Date(ms + 7 * 3600e3).toISOString().slice(11, 16);
const B = (a, b) => ({ s: at(a), e: at(b) });
// Contoh 1: masuk 07:00, istirahat total 60 menit -> pulang paling cepat 15:00
let a = { check_in: at('07:00'), breaks: [B('12:00', '12:30'), B('15:00', '15:30')] }; // (jam sengaja di luar; diganti di bawah)
a = { check_in: at('07:00'), breaks: [B('12:00', '12:30'), B('14:00', '14:30')] };
let m = summarize(a, new Date(at('15:00')).getTime()); assert.equal(m.breakMin, 60); assert.equal(hm(m.earliest), '15:00'); assert.equal(m.canOut, true);
m = summarize(a, new Date(at('14:59')).getTime()); assert.equal(m.canOut, false); assert.equal(m.remainMin, 1);
// Contoh 2: masuk 07:20, istirahat total 40 menit -> pulang 15:00 (utang telat lunas), dengan jam acuan 07:00
a = { check_in: at('07:20'), breaks: [B('12:00', '12:20'), B('14:00', '14:20')] };
m = summarize(a, new Date(at('15:00')).getTime(), 420, '07:00'); assert.equal(hm(m.earliest), '15:00'); assert.equal(m.canOut, true); assert.equal(m.lateMin, 20);
// Sedang istirahat: tidak boleh pulang walau jam sudah lewat, kerja bersih tidak bertambah
a = { check_in: at('07:00'), breaks: [{ s: at('15:00'), e: null }] };
m = summarize(a, new Date(at('16:00')).getTime()); assert.equal(m.onBreak, true); assert.equal(m.canOut, false); assert.equal(m.netMin, 480);
// Tanpa istirahat: 07:00 -> 14:00
m = summarize({ check_in: at('07:00'), breaks: [] }, new Date(at('14:00')).getTime()); assert.equal(m.canOut, true);
// Detik dibulatkan ke bawah per menit (sesuai tampilan HH:MM)
m = summarize({ check_in: '2026-01-05T00:00:20Z', breaks: [] }, new Date('2026-01-05T07:00:05Z').getTime()); assert.equal(m.canOut, true);
// Salinan klien identik dengan server
for (let i = 0; i < 2000; i++) {
  const t0 = Date.UTC(2026, 0, 5, 0, 0) + Math.floor(Math.random() * 3e6), br = []; let c = t0 + Math.floor(Math.random() * 3e6);
  for (let k = 0; k < Math.floor(Math.random() * 3); k++) { const e = c + Math.floor(Math.random() * 3e6); br.push({ s: new Date(c).toISOString(), e: Math.random() < .2 ? null : new Date(e).toISOString() }); c = e + 1e5; if (br.at(-1).e === null) break; }
  const x = { check_in: new Date(t0).toISOString(), check_out: Math.random() < .3 ? new Date(c + 3e6).toISOString() : null, breaks: br }, now = c + Math.floor(Math.random() * 3e7);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.HOURS.summarize(x, now, 420, '08:00'))), JSON.parse(JSON.stringify(summarize(x, now, 420, '08:00'))));
}
console.log('Semua tes aturan jam kerja lulus.');
