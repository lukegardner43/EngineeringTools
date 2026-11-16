// RC Stair Design: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every check of the full calculation (the flight's loads; each part's moment by statics for the governing combination
// and pattern, then its 1 m strip as the RC Section Design Toolkit designs it; each support's hogging; the half landing)
// is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the tool's own: set flights
// (projections, built-in ends, 6.10a/b, over 200 mm, no landings), set landings, every TCC71 flight and landing (outputs
// only, ref_tcc71.json) and 40 random flights. Each check's utilisation must be the tool's own and the worst check the
// stair's; no chip may show an error or a unit CalcPad cannot read; a flight's project must open check by check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Stair Design.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.ST = Stair; this.CS = CalcScript; this.SS = StairScript;', sb);
const H = require('../calcpad/harness.js').open();
const REF = require('./ref_tcc71.json');
let n = 0, bad = 0, zones = 0;
function check(tag, C, Pc) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : sb.CS.toSI(it.v, it.unit), got = Pc.vars[it.name];
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + (/^N_res(_\d+)*$/.test(it.name) ? 1e-2 : 1e-9);
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = Pc.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  if (Pc.warn) { bad++; console.log('BAD UNIT', tag, Pc.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
}
function zs(tag, Z, util) {
  for (const zn of Z) { zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v); n++;
    if (zn.util != null && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util)) { bad++; console.log('UTIL', tag, zn.key, u.map(x => +x.toFixed(4)), zn.util); }
    check(tag + ' ' + zn.key, zn.C, H.text(zn.C.calcpad())); }
  n++; if (Math.abs(Math.max(...Z.map(z => z.util ?? 0)) - util) > 1e-9 * Math.max(1, util)) { bad++; console.log('ZUTIL', tag, Z.map(z => z.util), util); }
}
const flight = (tag, inp) => { let R; try { R = sb.ST.flight(inp); } catch (e) { return; } const Z = sb.SS.flight(R); zs(tag, Z, R.util); return Z; };
const landing = (tag, inp) => { let R; try { R = sb.ST.landing(inp); } catch (e) { return; } const Z = sb.SS.landing(R); zs(tag, Z, R.util); return Z; };
const base = { fck: 32, cover: 25, n: 10, going: 250, rise: 175, t: 175, a: 600, hA: 200, c: 1200, hC: 200, qk: 4, fF: 1.6, fL: 1.3, psi2: 0.3, bottom: { phi: 16, s: 200 }, top: { phi: 10, s: 250 } };
const Z0 = flight('base', base);
flight('projections', { ...base, pA: 600, pC: 300 });
flight('monolithic', { ...base, supports: 'monolithic' });
flight('6.10ab', { ...base, comb: '6.10ab', psi0: 0.7 });
flight('thick', { ...base, t: 225, hA: 250, hC: 250 });
flight('no landings', { ...base, a: 0, c: 0, hA: 0, hC: 0 });
flight('H given', { ...base, rise: 0, H: 1900 });
landing('landing', { fck: 32, cover: 25, a: 1200, b: 1200, c: 100, d: 150, h: 200, w: 1500, qk: 4, fL: 1.3, GA: 12, QA: 6, GB: 12, QB: 6 });
landing('landing mono thick', { fck: 32, cover: 25, a: 1100, b: 1000, c: 0, d: 0, h: 250, w: 2200, qk: 5, fL: 1.3, GA: 15, QA: 8, GB: 10, QB: 5, supports: 'monolithic', comb: '6.10ab' });
REF.cases.forEach((c, i) => { const o = c.out, F = k => o['FLIGHT!' + k], Ld = k => o['LANDING!' + k];
  const gQf = (F('P23') - 1.35 * F('P21')) / F('P22'), gQ = Math.abs(gQf - 1.5) < 1e-6 ? 1.5 : 1.05;
  flight('tcc' + i, { fck: c.fck, cover: c.cover, a: c.a, pA: -c.d, c: c.c, pC: -c.e, n: c.n, going: c.g, rise: c.r, t: c.t, hA: c.hA, hC: c.hC, qk: c.q, fF: c.fF, fL: c.fL, comb: 'custom', gG: 1.35, gQ, psi2: 0.3, ae: F('AJ29'), bottom: { phi: F('P31'), s: F('P37') } });
  const l = c.land, gQl = (Ld('P14') - 1.35 * (25 * l.h / 1000 + l.f)) / l.q;
  if (isFinite(Ld('P32'))) landing('tccL' + i, { fck: c.fck, cover: c.cover, a: l.a, b: l.b, c: l.c, d: l.d, h: l.h, w: l.w, qk: l.q, fL: l.f, GA: Ld('D26'), QA: Ld('E26'), GB: Ld('D27'), QB: Ld('E27'), comb: 'custom', gG: 1.35, gQ: Math.abs(gQl - 1.5) < 1e-6 ? 1.5 : 1.05, bottom: { phi: Ld('P26'), s: Ld('P32') } });
});
let seed = 71; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 40; t++) flight('r' + t, { fck: pick([25, 30, 32, 40]), cover: pick([20, 25, 30]), n: pick([6, 8, 10, 12]), going: pick([225, 250, 275]), rise: pick([150, 170, 190]), t: pick([150, 175, 200, 225]), a: pick([0, 600, 1200]), hA: pick([175, 200, 250]), c: pick([0, 900, 1500]), hC: pick([175, 200, 250]),
  pA: pick([0, 0, 500]), pC: pick([0, 0, 400]), qk: pick([3, 4, 5]), fF: 1.5, fL: 1.2, psi2: pick([0.3, 0.6]), comb: pick(['6.10', '6.10ab']), supports: pick(['simple', 'monolithic']), bottom: { phi: pick([10, 12, 16]), s: pick([125, 150, 200]) }, top: { phi: pick([10, 12]), s: pick([150, 200, 250]) } });
(async () => {
  const list = Z0.map(zn => ({ C: zn.C, title: zn.title })), sz = x => JSON.stringify(x).length;
  const P = await sb.CS.project(list, { project: 'Test' }, 'Stair');
  // the whole calculation as one CalcPad check (.perega): its parts merged, every value still the tool's, as pasted and as opened
  { const M = sb.CS.merge(list, { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
  n++; if (P.checks.length !== Z0.length + 1 || !P.checks[0].shared) { bad++; console.log('FAIL the project has the wrong shape'); }
  H.project(P).slice(1).forEach((r, k) => check(`project ${r.name}`, Z0[k].C, r));
  console.log(`project: ${P.checks.length} checks, ${(sz(P) / 1e3).toFixed(0)} kB; ${zones} checks`);
  console.log(`\n${n - bad}/${n} RC Stair values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
