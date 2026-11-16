// RC Lintel Design: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every check of the full calculation (the take-down; for an RC lintel the section with the moments and shears built from
// the permanent and imposed parts, then the links rule, lateral stability and the bearing; for a Naylor lintel the
// equivalent uniform load against the brochure's table, the end bearing, the fire resistance and the bearing) is pasted
// into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the tool's own: set cases (the load
// triangle, a low wall, no arching, floors in the triangle and the interaction zone, point loads kept whole and spreading
// past the ends, loads on the lintel, 6.10a/b, with and without links, deep and shallow), Naylor lintels (one and two side
// by side, a span past the table, a short bearing, fire) and 60 random lintels of each kind. Every check of the tool must be
// in a zone with its utilisation; no chip may show an error or a unit CalcPad cannot read; and the CalcPad project of a
// lintel must open check by check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Lintel Design.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.Lintel = Lintel; this.CalcScript = CalcScript; this.LintelScript = LintelScript; this.Naylor = Naylor;', sb);
const { Lintel, CalcScript, LintelScript, Naylor } = sb;
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, lintels = 0;
const kinds = new Set();
function check(tag, C, P) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), got = P.vars[it.name];
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + (it.name === 'N_res' ? 1e-2 : 1e-9);
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = P.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  if (P.warn) { bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
}
const ZONE = { nolinks: 'lintel', lat: 'lintel', table: 'table', bearlen: 'checks', fire: 'checks' };
function lintel(tag, inp, nay) {
  let R; try { R = nay ? Lintel.naylor(inp) : Lintel.design(inp); } catch (e) { return null; }
  const Z = LintelScript.zones(R); lintels++;
  Z.forEach(z => kinds.add(z.key));
  for (const k of R.checks) {
    n++;
    const key = ZONE[k.id] || (k.id === 'bearing' ? (nay ? 'checks' : 'lintel') : 'section'), z = Z.find(zn => zn.key === key);
    if (!z || (isFinite(k.util) && z.util < k.util - 1e-12)) { bad++; console.log('MISSING', tag, k.id, z && z.util, k.util); }
  }
  for (const zn of Z) {
    zones++;
    // bars that do not fit across the width have no clear spacing to check: the calculation says so, and the zone fails
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), noFit = zn.C.items.some(it => it.t === 'p' && /do not fit across the width/.test(it.text)); n++;
    if (noFit) {   // the zone fails on the spacing; every other check of the section is in the calculation
      const sm = R.sec.checks.find(k => k.id === 'smin'), rest = Math.max(0, ...R.sec.checks.filter(k => k.id !== 'smin').map(k => k.util));
      if (!(sm && sm.util > 1e6 && zn.util === R.sec.utilMax && Math.abs(Math.max(0, ...u) - rest) <= 1e-9 * Math.max(1, rest))) { bad++; console.log('NOFIT', tag, zn.key, u, rest); }
    }
    else if (zn.util != null && isFinite(zn.util) && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util)) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  n++; if (Math.abs(Math.max(...Z.map(z => z.util ?? 0)) - R.util) > 1e-9 * Math.max(1, R.util) && isFinite(R.util)) { bad++; console.log('TOOL UTIL', tag, Z.map(z => z.util), R.util); }
  return Z;
}
// ---------- set cases ----------
const B = { L: 1800, t1: 150, t2: 150, b: 140, h: 215, fck: 32, fyk: 500, cover: 25, dg: 10, mode: 'tri', Hm: 2000, tm: 140, gm: 20,
  bottom: { n: 2, phi: 12 }, top: { n: 2, phi: 10 }, link: { phi: 6, legs: 2, s: 125 }, floors: [{ y: 1200, G: 4, Q: 3 }], points: [], dG: 0, dQ: 0, comb: '6.10', psi2: 0.3, fk: 5, gammaM: 2.3 };
const Z0 = lintel('base', B);
lintel('a low wall', { ...B, Hm: 400 });
lintel('no arching', { ...B, mode: 'full', Hm: 600, floors: [{ y: 600, G: 4, Q: 2 }] });
lintel('a floor in the triangle', { ...B, t1: 300, t2: 300, floors: [{ y: 300, G: 4, Q: 2 }] });
lintel('a floor at the top of the lintel', { ...B, floors: [{ y: 0, G: 4, Q: 1 }] });
lintel('a floor above the zone', { ...B, floors: [{ y: 1800, G: 4, Q: 3 }] });
lintel('point loads', { ...B, t1: 600, t2: 600, points: [{ x: 900, y: 300, G: 10, Q: 2 }, { x: 900, y: 1200, G: 10, Q: 0 }, { x: 900, y: 1800, G: 10, Q: 0 }] });
lintel('a point load spreading past the ends', { ...B, mode: 'full', points: [{ x: 900, y: 1500, G: 10, Q: 4 }] });
lintel('a point load on the lintel', { ...B, points: [{ x: 400, y: 0, G: 6, Q: 2 }] });
lintel('loads on the lintel', { ...B, dG: 1, dQ: 1.5, floors: [{ y: 300, G: 4, Q: 3 }], points: [{ x: 400, y: 200, G: 6, Q: 2 }] });
lintel('no links', { ...B, link: null, fk: 0 });
lintel('no links over 2 m', { ...B, L: 2400, link: null });
lintel('6.10a and b', { ...B, comb: '6.10ab', floors: [{ y: 0, G: 2, Q: 6 }] });
lintel('deep and narrow', { ...B, b: 100, h: 300, L: 3000 });
lintel('shallow, long', { ...B, h: 150, L: 4800, Hm: 6000, bottom: { n: 3, phi: 16 } });
lintel('a heavy point load near a bearing', { ...B, comb: '6.10ab', points: [{ x: 100, y: 0, G: 40, Q: 25 }] });
lintel('no load but its weight', { ...B, Hm: 0, floors: [] });
// Naylor
const N = { L: 1800, t1: 150, t2: 150, lintel: 'HS-R8', n: 1, fireNeed: 30, mode: 'tri', Hm: 2000, tm: 100, gm: 20, floors: [{ y: 1200, G: 4, Q: 3 }], points: [], dG: 0, dQ: 0, comb: '6.10', fk: 5, gammaM: 2.3 };
const ZN = lintel('Naylor HS-R8', N, true);
lintel('Naylor two side by side', { ...N, n: 2, tm: 200, lintel: 'HS-R6' }, true);
lintel('Naylor past the table', { ...N, L: 3600, t1: 200, t2: 200, Hm: 5000 }, true);
lintel('Naylor a short bearing, fire', { ...N, t1: 100, fireNeed: 120 }, true);
lintel('Naylor point loads, 6.10ab', { ...N, comb: '6.10ab', points: [{ x: 300, y: 100, G: 8, Q: 4 }], dG: 0.5, dQ: 0.5 }, true);
lintel('Naylor no arching, no f_k', { ...N, mode: 'full', Hm: 900, fk: 0, lintel: 'XF-XFS4' }, true);
// ---------- random lintels ----------
let seed = 4404; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
const NAMES = Naylor.LINTELS.map(l => l.id);
for (let t = 0; t < 120; t++) {
  const nay = t % 2 === 1, L = pick([600, 900, 1200, 1500, 1800, 2100, 2400, 3000, 3600, 4500]);
  const floors = Array.from({ length: pick([0, 1, 1, 2]) }, () => ({ y: pick([0, 150, 300, 600, 900, 1500, 2400]), G: pick([0, 2, 5, 10]), Q: pick([0, 1.5, 4]) }));
  const points = Array.from({ length: pick([0, 0, 1, 2]) }, () => ({ x: pick([-100, 0, 0.2 * L, 0.5 * L, 0.8 * L, L + 50]), y: pick([0, 100, 400, 900, 1600]), G: pick([0, 5, 15, 30]), Q: pick([0, 3, 10]) }));
  const com = { L, t1: pick([100, 150, 215, 300]), t2: pick([100, 150, 215, 300]), mode: pick(['tri', 'tri', 'full']), Hm: pick([0, 300, 900, 1800, 3000]), tm: pick([100, 140, 215]), gm: pick([18, 20, 22]),
    floors, points, dG: pick([0, 0, 1.2]), dQ: pick([0, 0, 0.8]), comb: pick(['6.10', '6.10ab']), fk: pick([0, 4, 7]), gammaM: pick([2.3, 2.6]) };
  if (nay) lintel(`random Naylor ${t}`, { ...com, lintel: pick(NAMES), n: pick([1, 1, 2]), fireNeed: pick([30, 60, 120]) }, true);
  else lintel(`random ${t}`, { ...com, b: pick([100, 140, 215, 300]), h: pick([150, 215, 300, 450]), fck: pick([25, 30, 32, 40]), fyk: 500, cover: pick([25, 30, 40]), dg: pick([10, 20]),
    bottom: { n: pick([2, 3]), phi: pick([10, 12, 16, 20]) }, top: { n: 2, phi: 10 }, link: rnd() < 0.7 ? { phi: pick([6, 8]), legs: 2, s: pick([100, 150, 200]) } : null, psi2: pick([0.3, 0.6]) });
}
// ---------- the projects open in CalcPad check by check with the same values ----------
(async () => {
  for (const [Z, nm] of [[Z0, 'RC lintel'], [ZN, 'Naylor lintel']]) {
    const list = Z.map(zn => ({ C: zn.C, title: zn.title }));
    const P = await CalcScript.project(list, { project: 'Test' }, nm);
    n++; if (P.checks.length !== Z.length + 1 || !P.checks[0].shared) { bad++; console.log('FAIL the project has the wrong shape'); }
    H.project(P).slice(1).forEach((r, k) => check(`project ${nm} ${r.name}`, Z[k].C, r));
    console.log(`project ${nm}: ${P.checks.length} checks, ${(JSON.stringify(P).length / 1e3).toFixed(0)} kB`);
  }
  console.log(`${zones} checks of ${lintels} lintels; kinds: ${[...kinds].sort().join(', ')}`);
  console.log(`\n${n - bad}/${n} RC Lintel values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
