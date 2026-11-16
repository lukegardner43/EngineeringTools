// Pile Cap: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every check of the full calculation (the cap, piles and loads; the pile loads, characteristic, DA1 and in tension;
// bending and hogging, or the truss's ties and nodes; shear across the cap; punching at the column face and inside the
// piles; anchorage past the piles; the detailing) is pasted into CalcPad (headless, tests/calcpad) and every value
// CalcPad works out must be the tool's own: every TCC82 cap (outputs only, ref_tcc82.json), set cases (2 to 6 piles,
// bending and truss, offsets and wind, piles in tension with and without top steel, links, bent bars, a pile inside the
// punching perimeter) and 40 random caps. Every check of the tool must be in a zone with its utilisation; no chip may
// show an error or a unit CalcPad cannot read; and the CalcPad project of a cap must open check by check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Pile Cap.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.PileCap = PileCap; this.CalcScript = CalcScript; this.CapScript = CapScript;', sb);
const { PileCap, CalcScript, CapScript } = sb;
const REF = require('./ref_tcc82.json');
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, caps = 0;
const kinds = new Set();
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
const ZONE = { minx: 'detail', miny: 'detail', spacing: 'detail', smaxx: 'shearx', smaxy: 'sheary', ccc: 'truss', cct: 'truss' };
function cap(tag, inp) {
  let R; try { R = PileCap.design(inp); } catch (e) { return null; }
  const Z = CapScript.zones(R); caps++;
  Z.forEach(z => kinds.add(z.key.replace(/[xy]$|side$/, '')));
  for (const k of R.checks) { n++; const z = Z.find(zn => zn.key === (ZONE[k.id] || (/^tie/.test(k.id) ? 'truss' : k.id))); if (!z || (isFinite(k.util) && z.util < k.util - 1e-12)) { bad++; console.log('MISSING', tag, k.id, z && z.util, k.util); } }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v); n++;
    if (zn.util != null && isFinite(zn.util) && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util)) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  return Z;
}
const AREA = p => Math.PI * p * p / 4;
// ---------- TCC82 ----------
REF.cases.forEach((c, i) => {
  const o = c.out, tag = `TCC82 ${c.sheet} ${i + 1}`;
  const base = { loads: { G: { N: c.G, Mx: c.MxG, My: c.MyG }, Q: { N: c.Q, Mx: c.MxQ, My: c.MyQ } }, dp: c.dp, e: c.A, H: c.H, c1: c.h, c2: c.b, tol: c.tol, fck: c.fck, cover: c.bc, phiX: 16, sX: 200, phiY: 16, sY: 200 };
  if (c.sheet === '4CAP') { const Bc = c.sy + 2 * c.A, Lc = c.s + 2 * c.A; cap(tag, { ...base, n: 4, s: c.s, sy: c.sy, ex: c.ex, ey: c.ey, phiX: o.C68, sX: AREA(o.C68) * Bc / o.C77, phiY: o.G68, sY: AREA(o.G68) * Lc / o.G77, bottom: o.O65 === 1 ? 'x' : 'y' }); }
  else if (c.sheet === '2CAP') cap(tag, { ...base, n: 2, s: c.s, ex: c.ex, c1: c.b, c2: c.h });
  else if (c.sheet === '3CAP') cap(tag, { ...base, n: 3, s: c.s, nBand: 4, phiBand: 20 });
  else if (c.sheet === '5CAP') cap(tag, { ...base, n: 5, s: o.E10, sy: o.E11 });
  else if (c.sheet === '6CAP') cap(tag, { ...base, n: 6, s: c.s, sy: c.sy, psiQ: 1 });
});
// ---------- set cases ----------
const B4 = { n: 4, s: 1800, sy: 1800, e: 450, dp: 600, H: 1000, c1: 500, c2: 500, tol: 75, fck: 32, cover: 75, phiX: 20, sX: 150, phiY: 20, sY: 150, loads: { G: { N: 3000, Mx: 50 }, Q: { N: 1200, My: 40 } }, swl: 1500, Rcd: 2200 };
const Z0 = cap('four piles', B4);
cap('two piles, H', { ...B4, n: 2, sy: undefined, loads: { G: { N: 1500, Mx: 60, Hx: 20 }, Q: { N: 500 } } });
cap('three piles', { ...B4, n: 3, nBand: 5, phiBand: 25, bent: true, loads: { G: { N: 2500, Mx: 40, My: 30 }, Q: { N: 900 } } });
cap('five piles, truss, offsets, wind', { ...B4, n: 5, method: 'truss', ex: 100, ey: -50, loads: { G: { N: 4000, Mx: 30 }, Q: { N: 1500 }, W: { Mx: 400, My: 200, Hx: 60, Hy: 40 } }, Rtd: 300 });
cap('six piles, links, bent bars', { ...B4, n: 6, s: 1500, sy: 1600, H: 800, links: { legs: 6, phi: 12, s: 200 }, AsTop: 2000, bent: true, bottom: 'y', loads: { G: { N: 3500, My: 50 }, Q: { N: 1800 }, W: { Mx: 900, Hx: 80 } }, Rtd: 500 });
cap('two piles in tension, hogging', { ...B4, n: 2, sy: undefined, AsTop: 1500, Rtd: 400, loads: { G: { N: 400 }, Q: { N: 100 }, W: { Mx: 1200, Hx: 50 } } });
cap('two piles in tension, no top steel', { ...B4, n: 2, sy: undefined, loads: { G: { N: 400 }, W: { Mx: 1200 } } });
cap('five piles, a pile inside the perimeter', { ...B4, n: 5, s: 2600, sy: 2600, dp: 450, H: 900, loads: { G: { N: 5000, Mx: 80, My: 60 }, Q: { N: 2000 } } });
cap('four piles, truss, 6.10', { ...B4, method: 'truss', comb: '6.10' });
// ---------- random caps ----------
let seed = 8202; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 40; t++) {
  const np = pick([2, 3, 4, 4, 5, 6]), dp = pick([450, 600, 750]), s = pick([2.5, 3, 3.5]) * dp, W = rnd() < 0.4;
  cap(`random ${t}`, { n: np, s, sy: [4, 5, 6].includes(np) ? pick([1, 1.2]) * s : undefined, e: dp / 2 + pick([150, 200, 300]), dp, H: pick([700, 900, 1200, 1500]), c1: pick([400, 500, 600]), c2: pick([400, 500, 700]), tol: pick([0, 75]),
    ex: pick([0, 0, 75, -100]), ey: np === 2 ? 0 : pick([0, 0, 50]), fck: pick([28, 30, 32, 35, 40]), cover: pick([50, 75]), phiX: pick([16, 20, 25]), sX: pick([125, 150, 200]), phiY: pick([16, 20, 25]), sY: pick([125, 150, 200]), bottom: pick(['x', 'y']),
    method: pick(['bending', 'bending', 'truss']), nBand: pick([4, 5, 6]), phiBand: pick([20, 25, 32]), bent: rnd() < 0.3, comb: pick(['6.10', '6.10ab']), swl: rnd() < 0.5 ? pick([1000, 1500, 2500]) : undefined, Rcd: rnd() < 0.5 ? pick([1500, 2500, 3500]) : undefined,
    Rtd: rnd() < 0.3 ? pick([200, 500]) : undefined, AsTop: rnd() < 0.3 ? pick([1000, 2500]) : undefined, links: rnd() < 0.25 ? { legs: pick([4, 6, 8]), phi: pick([10, 12]), s: pick([150, 200]) } : undefined,
    loads: { G: { N: pick([1000, 2500, 4000]), Mx: pick([0, 40, -60]), My: np === 2 ? 0 : pick([0, 30]), Hx: pick([0, 20]), Hy: np === 2 ? 0 : pick([0, 15]) }, Q: { N: pick([0, 500, 1500]), Mx: pick([0, 20]) },
      W: W ? { Mx: pick([100, 400, 900]), My: np === 2 ? 0 : pick([0, 200]), Hx: pick([0, 40]) } : {} } });
}
// ---------- the project of the four-pile cap opens in CalcPad check by check with the same values ----------
(async () => {
  const list = Z0.map(zn => ({ C: zn.C, title: zn.title })), sz = x => JSON.stringify(x).length;
  const P = await CalcScript.project(list, { project: 'Test' }, 'Pile cap'), Pn = await CalcScript.project(list, { project: 'Test' }, 'Pile cap', { share: false });
  // the whole calculation as one CalcPad check (.perega): its parts merged, every value still the tool's, as pasted and as opened
  { const M = CalcScript.merge(list, { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
  n++; if (P.checks.length !== Z0.length + 1 || !P.checks[0].shared) { bad++; console.log('FAIL the project has the wrong shape'); }
  H.project(P).slice(1).forEach((r, k) => check(`project ${r.name}`, Z0[k].C, r));
  n++; if (!(sz(P) < 0.7 * sz(Pn))) { bad++; console.log('FAIL sharing did not make the pack smaller', sz(P), sz(Pn)); }
  console.log(`project: ${P.checks.length} checks, ${(sz(P) / 1e3).toFixed(0)} kB with the shared values, ${(sz(Pn) / 1e3).toFixed(0)} kB without`);
  console.log(`${zones} checks of ${caps} caps; kinds: ${[...kinds].sort().join(', ')}`);
  console.log(`\n${n - bad}/${n} Pile Cap values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
