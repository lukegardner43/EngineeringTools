// Retaining Wall: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every check of the full calculation (sliding, bearing in each combination, overturning, the characteristic pressure;
// the stem, its front face when propped, the toe and the heel; a gravity wall's plain concrete; the early-age horizontal
// bars), each with the wall, its weights, the earth pressure and the combination written out, is pasted into CalcPad
// (headless, tests/calcpad) and every value CalcPad works out must be the tool's own: the TCC62 walls (outputs only,
// ref_tcc62.json), set cases (water, surcharges, line and strip loads, a slope with and without the Rankine zone, at-rest
// pressure, passive and a key, undrained and cohesive ground, propped walls pinned or fixed with a slab holding the base,
// gravity walls) and random walls. Every check of the tool must be in a calculation with its utilisation; no chip may show
// an error or a unit CalcPad cannot read; and the CalcPad project of a wall must open check by check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Retaining Wall.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.RetWall = RetWall; this.CalcScript = CalcScript; this.RetWallScript = RetWallScript;', sb);
const { RetWall, CalcScript, RetWallScript } = sb;
const REF = require('./ref_tcc62.json');
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, walls = 0;
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
const keyOf = k => /^bear/.test(k.id) ? k.key : /^(slide1|slide2|equ|sls|plainN|plainV|restraint)$/.test(k.id) ? k.id : /^stemF/.test(k.id) ? 'stemF' : /^stem/.test(k.id) ? 'stem' : /^toe/.test(k.id) ? 'toe' : /^heel/.test(k.id) ? 'heel' : '?';
function wall(tag, inp) {
  let R; try { R = RetWall.design(inp); } catch (e) { return null; }
  let Z; try { Z = RetWallScript.zones(R); } catch (e) { bad++; console.log('SCRIPT', tag, e.message); return null; }
  walls++; Z.forEach(z => kinds.add(z.key.replace(/^C[12][ab]$/, 'bearing')));
  for (const k of R.checks) {
    if (k.req) continue; n++;
    const z = Z.find(zn => zn.key === keyOf(k));
    if (!z || (isFinite(k.util) && z.util < k.util - 1e-12)) { bad++; console.log('MISSING', tag, k.id, keyOf(k), z && z.util, k.util); }
  }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), said = zn.C.items.some(it => it.t === 'p' && /not satisfied/.test(it.text)); n++;
    if (zn.util != null && isFinite(zn.util) && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util) && !(said && zn.util > Math.max(0, ...u))) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    if (zn.util != null && !isFinite(zn.util) && !said) { bad++; console.log('INFINITE UTIL WITHOUT A NOTE', tag, zn.key); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  n++; const um = Math.max(...Z.map(z => z.util ?? 0)); if (!(um === R.util || Math.abs(um - R.util) <= 1e-9 * Math.max(1, R.util))) { bad++; console.log('TOOL UTIL', tag, um, R.util); }
  return Z;
}
// ---------- TCC62 ----------
REF.cases.forEach((c, i) => wall(`TCC62 ${i + 1}`, { type: 'cantilever', H: c.hb, tb: c.tb, B: c.B, bt: c.bt, ts: c.ts, hg: 0, beta: c.beta, g: c.g, phi: c.phi, gf: c.gf, phif: c.phif, gw: 9.814, fWater: true, fck: c.fck,
  phiS: 16, sS: 150, phiT: 12, sT: 200, phiH: 16, sH: 200 }));
// ---------- set cases ----------
const D = { type: 'cantilever', H: 3000, tb: 300, B: 2500, bt: 600, ts: 300, hg: 0, g: 18, gsat: 20, phi: 30, gf: 19, phif: 32, fck: 32, phiS: 16, sS: 150, phiSF: 12, sSF: 200, phiT: 12, sT: 200, phiH: 16, sH: 200, dA: 0 };
const Z0 = wall('cantilever, surcharges', { ...D, qQ: 10, qG: 5 });
wall('water behind and in front, passive, key', { ...D, hw: 1800, hwf: 600, passive: true, hk: 400, tk: 300, hg: 500, dA: 200 });
wall('slope, Rankine zone fits', { ...D, beta: 15, B: 3200, bt: 500 });
wall('slope, heel too short', { ...D, beta: 20, B: 1800, bt: 600 });
wall('at rest, line and strip loads', { ...D, K: 'rest', lineG: 10, lineQ: 15, lineX: 800, stripQ: 20, stripB: 1000, stripA: 500, qQ: 5 });
wall('a line load beyond the heel', { ...D, lineG: 8, lineQ: 12, lineX: 2500 });
wall('undrained', { ...D, bearing: 'undrained', cuf: 60, passive: true });
wall('cohesive, allowable pressure, restraint bars', { ...D, cf: 5, qa: 150, phiHz: 12, sHz: 200, tCrack: 3, cement: 'R', psi2: 0.6, hg: 400 });
wall('propped, fixed', { ...D, type: 'propped', H: 4000, B: 2000, bt: 300, K: 'rest', qQ: 10, hProp: 3500, hUp: 300, wallG: 20, wallQ: 10 });
wall('propped, pinned base held by a slab', { ...D, type: 'propped', H: 3500, B: 1500, bt: 300, K: 'rest', fixBase: false, baseHeld: true, hw: 1500, qQ: 5 });
wall('gravity', { ...D, type: 'gravity', H: 2000, tb: 300, B: 1500, bt: 200, ts: 1000, tTop: 400, fck: 25, qQ: 5 });
wall('gravity, no base, water', { ...D, type: 'gravity', H: 1800, tb: 0, B: 1200, bt: 0, ts: 1200, tTop: 500, fck: 20, hw: 600 });
wall('a short toe, no toe', { ...D, bt: 0, B: 2200 });
wall('heavy: compression steel, crack tables run out', { ...D, H: 6000, ts: 250, B: 3500, bt: 800, phiS: 12, sS: 300, qQ: 20, wk: 0.2 });
// ---------- random walls ----------
let seed = 6262; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 60; t++) {
  const type = pick(['cantilever', 'cantilever', 'cantilever', 'propped', 'gravity']), H = pick([1500, 2500, 3500, 4500, 6000]);
  const grav = type === 'gravity', B = Math.round(H * pick([0.45, 0.6, 0.75])), bt = Math.round(B * pick([0, 0.15, 0.3])), ts = grav ? Math.round(B * pick([0.5, 0.8, 1]) - bt * (rnd() < 0.5 ? 0 : 0)) : pick([250, 300, 400]);
  wall(`random ${t}`, { type, H, tb: grav ? pick([0, 300]) : pick([250, 300, 450]), B, bt, ts: Math.min(ts, B - bt), tTop: grav ? pick([300, 450]) : undefined, hg: pick([0, 0, 400]), hk: rnd() < 0.2 ? 400 : 0, tk: 300,
    g: pick([17, 18, 20]), gsat: pick([19, 21]), phi: pick([25, 30, 35]), beta: pick([0, 0, 10, 18]), K: pick(['active', 'active', 'rest']), hw: rnd() < 0.3 ? pick([500, 1500]) : 0, hwf: rnd() < 0.2 ? 300 : 0,
    qG: pick([0, 0, 5]), qQ: pick([0, 5, 10]), lineG: rnd() < 0.2 ? 10 : 0, lineQ: rnd() < 0.2 ? 10 : 0, lineX: pick([300, 1000, 3000]), stripQ: rnd() < 0.2 ? 15 : 0, stripB: 1000, stripA: pick([0, 500, 2000]),
    bearing: rnd() < 0.2 ? 'undrained' : 'drained', cuf: pick([40, 80]), gf: pick([18, 20]), phif: pick([28, 32, 36]), cf: pick([0, 0, 5]), qa: rnd() < 0.3 ? 200 : undefined, passive: rnd() < 0.3, dA: rnd() < 0.5 ? undefined : 0,
    hProp: type === 'propped' ? H - pick([300, 600]) : undefined, baseHeld: type === 'propped' && rnd() < 0.4, fixBase: !(type === 'propped' && rnd() < 0.3), psi2: pick([0.3, 0.6]), wk: pick([0.2, 0.3, 0.4]),
    fck: pick([25, 30, 32, 40]), gc: 24, coverStem: pick([40, 50]), coverBase: pick([50, 75]), phiS: pick([12, 16, 20]), sS: pick([150, 200]), phiSF: 12, sSF: 200, phiT: pick([12, 16]), sT: 200, phiH: pick([12, 16, 20]), sH: pick([150, 200]),
    phiHz: rnd() < 0.3 ? 12 : 0, sHz: 200 });
}
// ---------- the project of a wall opens in CalcPad check by check with the same values ----------
(async () => {
  const list = Z0.map(zn => ({ C: zn.C, title: zn.title }));
  const P = await CalcScript.project(list, { project: 'Test' }, 'Retaining wall');
  n++; if (P.checks.length !== Z0.length + 1 || !P.checks[0].shared) { bad++; console.log('FAIL the project has the wrong shape'); }
  H.project(P).slice(1).forEach((r, k) => check(`project ${r.name}`, Z0[k].C, r));
  console.log(`project: ${P.checks.length} checks, ${(JSON.stringify(P).length / 1e3).toFixed(0)} kB`);
  console.log(`${zones} checks of ${walls} walls; kinds: ${[...kinds].sort().join(', ')}`);
  console.log(`\n${n - bad}/${n} Retaining Wall values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
