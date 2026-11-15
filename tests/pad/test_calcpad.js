// Pad Foundation: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every check of the full calculation (the base, loads and ground; bearing and sliding in each DA1 combination or the
// pressure against an allowable one; overturning; bending, beam shear and punching each in its governing ULS
// combination; the detailing) is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be
// the tool's own: every TCC81 base (outputs only, ref_tcc81.json), set cases (wind both ways with offsets, horizontal
// loads and cohesion; undrained; an allowable pressure; a strip; 6.10) and 40 random bases and strips. Each check's
// utilisation must be the tool's own for it; no chip may show an error or a unit CalcPad cannot read; and the CalcPad
// project of a base must open check by check with the same values.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Pad Foundation.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.Pad = Pad; this.CalcScript = CalcScript; this.PadScript = PadScript;', sb);
const { Pad, CalcScript, PadScript } = sb;
const REF = require('./ref_tcc81.json');
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, bases = 0;
function check(tag, C, P) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), got = P.vars[it.name];
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + 1e-9;
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = P.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  if (P.warn) { bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
}
function pad(tag, inp) {
  let R; try { R = Pad.design(inp); } catch (e) { return null; }
  const Z = PadScript.zones(R); bases++;
  // every check of the tool is in one of the zones, with the same utilisation
  const ids = { bearC1: 'bearC1', bearC2: 'bearC2', slideC1: 'slideC1', slideC2: 'slideC2', allow: 'allow', equ: 'equ', bendX: 'bendx', bendY: 'bendy', shearX: 'shearx', shearY: 'sheary', punch: 'punch', punch0: 'punch0', minX: 'detail', minY: 'detail', spacing: 'detail' };
  for (const k of R.checks) { n++; const z = Z.find(zn => zn.key === ids[k.id]); if (!z || (isFinite(k.util) && z.util < k.util - 1e-12)) { bad++; console.log('MISSING', tag, k.id, z && z.util, k.util); } }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v); n++;
    if (zn.util != null && isFinite(zn.util) && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util)) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  return Z;
}
const AREA = p => Math.PI * p * p / 4;
// ---------- TCC81 ----------
REF.cases.forEach((c, i) => {
  const o = c.out, bar = s => +(/B(\d+)/.exec(s) || [])[1], phiX = bar(o.C41), phiY = bar(o.H41);
  pad(`TCC81 ${i + 1}`, { L: c.L, B: c.B, H: c.H, c1: c.h, c2: c.b, ex: c.ex, ey: c.ey, Dover: c.D, gc: 25, gs: c.gs, phi: c.phi, cEff: c.c, fck: c.fck, cover: c.cover, phiX, sX: AREA(phiX) * c.B / o.C42, phiY, sY: AREA(phiY) * c.L / o.H42,
    loads: { G: { N: c.G, Mx: c.MxG, My: c.MyG }, Q: { N: c.Q, Mx: c.MxQ, My: c.MyQ } } });
});
// ---------- set cases ----------
const D0 = { L: 2000, B: 2000, H: 500, c1: 400, c2: 400, Dover: 500, gc: 25, gs: 18, phi: 30, cEff: 0, fck: 30, cover: 50, phiX: 16, sX: 150, phiY: 16, sY: 150, loads: { G: { N: 1000 } } };
const Z0 = pad('wind, offsets, H, c′', { ...D0, ex: 100, Dover: 800, cEff: 5, loads: { G: { N: 900, Mx: 30, Hx: 10 }, Q: { N: 300, My: 20 }, W: { Mx: 60, My: 40, Hx: 25, Hy: 15 } } });
pad('undrained', { ...D0, soil: 'undrained', cu: 75, loads: { G: { N: 800, Hx: 20 }, Q: { N: 200 }, W: { Hy: 30, My: 50 } } });
pad('allowable', { ...D0, soil: 'allowable', qa: 250, loads: { G: { N: 700, Hx: 10 }, Q: { N: 250 }, W: { Mx: 40 } } });
pad('strip', { ...D0, type: 'strip', L: 1500, c1: 300, phiY: 10, sY: 200, ex: 50, loads: { G: { N: 150, Mx: 10, Hx: 5 }, Q: { N: 60 } } });
pad('6.10 with an allowable check', { ...D0, comb: '6.10', qa: 300, loads: { G: { N: 1200, Mx: -40 }, Q: { N: 400, My: -30 } } });
pad('thin: compression steel', { ...D0, H: 250, loads: { G: { N: 2500 }, Q: { N: 1500 } } });
// ---------- random bases ----------
let seed = 8101; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 40; t++) {
  const strip = rnd() < 0.25, soil = pick(['drained', 'drained', 'undrained', 'allowable']), L = pick([1200, 1800, 2400, 3000]), W = rnd() < 0.5;
  const ld = () => ({ N: pick([200, 500, 900, 1400]), Mx: pick([0, 0, 25, -40]), My: strip ? 0 : pick([0, 20, -30]), Hx: pick([0, 0, 10, 30]), Hy: strip ? 0 : pick([0, 15]) });
  pad(`random ${t}`, { type: strip ? 'strip' : 'pad', L, B: strip ? 1000 : pick([1200, 1800, 2400, 3000]), H: pick([350, 450, 600, 800]), c1: pick([300, 400, 500]), c2: pick([300, 400, 600]), ex: pick([0, 0, 100, -150]), ey: strip ? 0 : pick([0, 0, 75]),
    Dover: pick([500, 800, 1200]), gc: 25, gs: pick([17, 18, 19, 20]), soil, phi: pick([25, 28, 30, 35]), cEff: pick([0, 0, 5]), cu: pick([50, 75, 120]), qa: soil === 'allowable' || rnd() < 0.2 ? pick([150, 200, 300]) : undefined,
    fck: pick([25, 30, 32, 35, 40]), cover: pick([40, 50, 75]), phiX: pick([12, 16, 20, 25]), sX: pick([125, 150, 200]), phiY: pick([10, 12, 16, 20]), sY: pick([150, 200]), comb: pick(['6.10', '6.10ab']), psiQ: 0.7, psiW: 0.5,
    loads: { G: ld(), Q: { ...ld(), N: pick([0, 100, 300, 600]) }, W: W ? { N: 0, Mx: pick([0, 40, 80]), My: strip ? 0 : pick([0, 30]), Hx: pick([0, 20]), Hy: strip ? 0 : pick([0, 10]) } : {} } });
}
// ---------- the project of the first set case opens in CalcPad check by check with the same values ----------
(async () => {
  const list = Z0.map(zn => ({ C: zn.C, title: zn.title })), sz = x => JSON.stringify(x).length;
  const P = await CalcScript.project(list, { project: 'Test' }, 'Pad'), Pn = await CalcScript.project(list, { project: 'Test' }, 'Pad', { share: false });
  n++; if (P.checks.length !== Z0.length + 1 || !P.checks[0].shared) { bad++; console.log('FAIL the project has the wrong shape'); }
  H.project(P).slice(1).forEach((r, k) => check(`project ${r.name}`, Z0[k].C, r));
  n++; if (!(sz(P) < 0.7 * sz(Pn))) { bad++; console.log('FAIL sharing did not make the pack smaller', sz(P), sz(Pn)); }
  console.log(`project: ${P.checks.length} checks, ${(sz(P) / 1e3).toFixed(0)} kB with the shared values, ${(sz(Pn) / 1e3).toFixed(0)} kB without`);
  console.log(`${zones} checks of ${bases} bases`);
  console.log(`\n${n - bad}/${n} Pad Foundation values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
