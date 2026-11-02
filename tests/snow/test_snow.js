// Snow Loading engine checks by hand: ground snow (NA.1), the shape coefficients of Table 5.2, Tables NA.1 and NA.2 and
// Table B1, the Annex B caps and drift lengths, cylindrical roof geometry, and the load per metre run of every case.
const { Snow: S } = require('./load');
let n = 0, fails = 0;
const ok = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } };
const near = (name, a, b, tol = 1e-9) => ok(name, Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `got ${a}, want ${b}`);
const throws = (name, f, re) => { let e = null; try { f(); } catch (x) { e = x; } ok(name, !!e && (!re || re.test(e.message)), e ? e.message : 'no error'); };
const D = (o, g = { zone: 3, A: 100 }) => S.design({ ...g, ...o });

// ---------- ground snow ----------
[[1, 0.30], [2, 0.40], [3, 0.50], [4, 0.60], [5, 0.70], [6.5, 0.85]].forEach(([z, v]) => near(`zone ${z} at 100 m (Figure NA.1 legend)`, S.ground({ zone: z, A: 100 }).sk, v));
near('zone 3 at 250 m', S.ground({ zone: 3, A: 250 }).sk, 0.5 + 150 / 525);
near('zone 1 at sea level', S.ground({ zone: 1, A: 0 }).sk, 0.3 - 100 / 525);
near('coastal, no reduction below 100 m', S.ground({ zone: 1, A: 0, noReduce: true }).sk, 0.3);
near('no-reduction option leaves sites above 100 m alone', S.ground({ zone: 2, A: 300, noReduce: true }).sk, 0.4 + 200 / 525);
ok('ψ to 1000 m', S.ground({ zone: 3, A: 900 }).psi.join() === '0.5,0.2,0'); ok('ψ above 1000 m', S.ground({ zone: 3, A: 1100 }).psi.join() === '0.7,0.5,0.2');
throws('zone not on the map', () => S.ground({ zone: 7, A: 100 }), /Zone/); throws('above 1500 m', () => S.ground({ zone: 3, A: 1600 }), /Met Office/);
throws('Ce out of range', () => S.ground({ zone: 3, A: 100, Ce: 1.5 }), /C/); throws('Ct over 1', () => S.ground({ zone: 3, A: 100, Ct: 1.2 }), /C/);
// ---------- coefficients ----------
[[0, 0.8], [30, 0.8], [45, 0.4], [60, 0], [75, 0]].forEach(([a, v]) => near(`Table 5.2 μ1 at ${a}°`, S.mu1(a), v));
near('μ1 not below 0.8 behind a snow fence', S.mu1(50, true), 0.8);
[[10, 0.8], [15, 0.8], [22.5, 1.0], [30, 1.2], [45, 0.6], [60, 0]].forEach(([a, v]) => near(`Table NA.1 at ${a}°`, S.muDrift(a), v));
const c1 = S.muCyl(10, 20); ok('Table NA.2 α ≤ 15°: no drift', c1.m1 === 0 && c1.m2 === 0);
const c2 = S.muCyl(22.5, 45); near('Table NA.2 μ1', c2.m1, 0.4); near('Table NA.2 μ2, 15–30°', c2.m2, 1.0); near('Table NA.2 μ3 = μ2(60 − δ)/30', c2.m3, 0.5);
near('Table NA.2 μ2, 30–60°', S.muCyl(45, 50).m2, 0.6);
const b1 = S.tableB1(10, 4), b2 = S.tableB1(20, 3), b3 = S.tableB1(45, 3), b4 = S.tableB1(70, 3);
ok('Table B1 α ≤ 15°', b1.m1 === 4 && b1.m2 === 4); near('Table B1 μ1 at 20°', b2.m1, 2); near('Table B1 μ2 at 20°', b2.m2, 3);
near('Table B1 μ1 at 45°', b3.m1, 0); near('Table B1 μ2 at 45°', b3.m2, 1.5); ok('Table B1 α ≥ 60°', b4.m1 === 0 && b4.m2 === 0);
near('roof imposed load < 30°', S.qRoof(20), 0.6); near('roof imposed load 45°', S.qRoof(45), 0.3); near('roof imposed load 60°', S.qRoof(60), 0);

// ---------- monopitch ----------
{
  const R = D({ type: 'mono', alpha: 40, b: 10 }), c = R.cases[0];
  near('monopitch 40°: s = μ1 sk', c.sMax, 0.8 * 20 / 30 * 0.5); near('monopitch load per metre run', c.W, c.sMax * 10);
  near('monopitch with a parapet at the eaves: 0.8', D({ type: 'mono', alpha: 40, b: 10, keep: true }).cases[0].muMax, 0.8);
  near('Ce scales the persistent load', D({ type: 'mono', alpha: 10, b: 10, Ce: 0.8 }).sP, 0.8 * 0.8 * 0.5);
  ok('monopitch: one persistent case, no accidental', R.cases.length === 1 && R.sA === null);
}
// ---------- duopitch ----------
{
  const R = D({ type: 'duo', a1: 35, a2: 20, b: 14 }), v = R.val;
  near('duopitch: ridge position', v.b1, 14 * Math.tan(20 * Math.PI / 180) / (Math.tan(35 * Math.PI / 180) + Math.tan(20 * Math.PI / 180)));
  near('duopitch: ridge height the same from both eaves', v.b1 * Math.tan(35 * Math.PI / 180), v.b2 * Math.tan(20 * Math.PI / 180), 1e-12);
  ok('duopitch: three cases (i)–(iii)', R.cases.length === 3 && R.cases.every(c => c.sit === 'P'));
  near('case (i) slope 1', R.cases[0].segs[0].m0, 0.8 * 25 / 30); near('case (i) slope 2', R.cases[0].segs[1].m0, 0.8);
  ok('case (ii) loads slope 2 only', R.cases[1].segs.length === 1 && R.cases[1].segs[0].x0 === v.b1); near('case (ii) μ', R.cases[1].muMax, 0.8 + 0.4 * 5 / 15);
  near('case (iii) μ', R.cases[2].muMax, 1.2 * 25 / 30); near('governing persistent load', R.sP, 1.0 * 0.5);
  near('case (i) load per metre run', R.cases[0].W, 0.5 * (0.8 * 25 / 30 * v.b1 + 0.8 * v.b2));
  near('low pitch: drifted 0.8 on one slope', D({ type: 'duo', a1: 5, a2: 5, b: 10 }).cases[1].muMax, 0.8);
  throws('a flat duopitch', () => D({ type: 'duo', a1: 0, a2: 0, b: 10 }), /pitch/);
}
// ---------- multi-span valley ----------
{
  const R = D({ type: 'multi', a1: 22, a2: 22, b1: 6, b2: 6 }), v = R.val, h = 6 * Math.tan(22 * Math.PI / 180);
  near('valley: h', v.h, h); near('valley: b3 = 1.5 spans by default', v.b3, 18); near('valley: 2b3/(ls1 + ls2) governs', v.mu, 3); ok('valley: governing term named', /b₃/.test(v.gov));
  const A = R.cases[1]; ok('valley drift is accidental', A.sit === 'A'); near('valley drift: s = μ sk', A.sMax, 1.5); near('valley drift per metre of valley', A.W, 3 * 0.5 * 12 / 2);
  const Rh = D({ type: 'multi', a1: 22, a2: 22, b1: 6, b2: 6 }, { zone: 6.5, A: 1000 }), sk = 0.85 + 900 / 525;
  near('valley: 2h/sk governs at a snowy site', Rh.val.mu, 2 * h / sk); near('accidental drift not scaled by Ce', D({ type: 'multi', a1: 22, a2: 22, b1: 6, b2: 6, Ce: 1.2 }).sA, 1.5);
  near('valley: 5 governs', D({ type: 'multi', a1: 45, a2: 45, b1: 6, b2: 6, b3: 40 }).val.mu, 5);
  const U = D({ type: 'multi', a1: 30, a2: 15, b1: 4, b2: 8 }); near('unequal ridges: h at the valley on the line joining them', U.val.h, 4 * Math.tan(Math.PI / 6) + (8 * Math.tan(Math.PI / 12) - 4 * Math.tan(Math.PI / 6)) * 4 / 12);
  near('unequal: default b3', U.val.b3, 20); near('undrifted slopes 1 and 2', U.cases[0].segs[0].m0 + U.cases[0].segs[1].m0, 1.6);
  throws('b3 shorter than b1 + b2', () => D({ type: 'multi', a1: 22, a2: 22, b1: 6, b2: 6, b3: 10 }), /b₃/);
  throws('valley side over 60°', () => D({ type: 'multi', a1: 65, a2: 22, b1: 6, b2: 6 }), /5\.3\.4/);
}
// ---------- cylindrical ----------
{
  const R = D({ type: 'cyl', b: 20, h: 4 }), v = R.val;
  near('cylinder radius', v.R, 14.5); near('cylinder δ', v.delta, Math.asin(10 / 14.5) * 180 / Math.PI); near('cylinder α', v.alpha, Math.atan(0.4) * 180 / Math.PI);
  near('cylinder: 30° point from the eaves', v.x30, 10 - 7.25);
  const d = R.cases[1]; near('drifted μ3 at the eaves', d.segs[0].m0, v.m2 * (60 - v.delta) / 30); near('drifted μ2 at the 30° point', d.segs[0].m1, v.m2); near('drifted μ1 at the crown', d.segs[1].m1, 0.4);
  near('drifted μ2 value', v.m2, 0.8 + 0.4 * (v.alpha - 15) / 15); ok('drifted ends at the crown', Math.abs(d.segs[1].x1 - 10) < 1e-12);
  near('undrifted 0.8 over the whole span (δ < 60°)', R.cases[0].W, 0.8 * 0.5 * 20);
  const T = D({ type: 'cyl', b: 20, h: 9 }), w = T.val;
  near('tall arch: α to the 60° point is 30°', w.alpha, 30, 1e-9); near('tall arch: μ2 = 1.2', w.m2, 1.2); near('tall arch: undrifted stops at the 60° points', T.cases[0].segs[0].x0, 10 - w.R * Math.sin(Math.PI / 3));
  near('tall arch: drift starts at zero at the 60° point', T.cases[1].segs[0].m0, 0); near('tall arch: drift from the 60° point', T.cases[1].segs[0].x0, w.x60);
  const F = D({ type: 'cyl', b: 20, h: 2 }); ok('shallow arch: α ≤ 15°, no drifted load', F.cases[1].segs.length === 0 && /15°/.test(F.cases[1].note));
  for (const hh of [1, 2.5, 4, 5.5]) { const L = D({ type: 'cyl', b: 20, h: hh }); near(`circular arc: δ = 2α (h ${hh} m), so δ < 30° only where α < 15° and there is no drift`, L.val.delta, 2 * L.val.alpha, 1e-9); }
  throws('rise over half the span', () => D({ type: 'cyl', b: 20, h: 11 }), /semicircle/);
}
// ---------- abutting a taller building ----------
{
  const R = D({ type: 'abut', alpha: 0, b1: 20, b2: 15, h: 4 }), v = R.val;
  near('abutting: ls = 15 m cap', v.ls, 15); near('abutting: μ3 = 2b/ls', v.m3, 2 * 20 / 15); near('abutting: drift', R.sA, 2 * 20 / 15 * 0.5);
  near('abutting: drift per metre of wall', R.cases[1].W, v.m3 * 0.5 * 15 / 2); near('abutting: undrifted 0.8', R.cases[0].muMax, 0.8);
  near('abutting: ls = 5h', D({ type: 'abut', alpha: 0, b1: 20, b2: 15, h: 2 }).val.ls, 10); near('abutting: ls = b1', D({ type: 'abut', alpha: 0, b1: 8, b2: 15, h: 3 }).val.ls, 8);
  near('abutting: 2h/sk governs', D({ type: 'abut', alpha: 0, b1: 30, b2: 30, h: 1 }).val.m3, 2 * 1 / 0.5); near('abutting: 8 governs', D({ type: 'abut', alpha: 0, b1: 15, b2: 60, h: 3 }).val.m3, 8);
  const P = D({ type: 'abut', alpha: 20, b1: 8, b2: 15, h: 3 }); near('pitched lower roof: μ1 at the ridge', P.val.m1, 3.75 * 10 / 15); near('pitched lower roof: μ2 at the eaves', P.val.m2, 3.75); near('drift uses μ2', P.sA, 3.75 * 0.5);
}
// ---------- parapet, obstruction, canopy ----------
{
  const R = D({ type: 'parapet', h: 1.2, b1: 20, b2: 30 }, { zone: 3, A: 150 }), v = R.val, sk = 0.5 + 50 / 525;
  near('parapet: ls = 5h', v.ls, 6); near('parapet: μ = 2h/sk', v.m, 2.4 / sk); near('parapet: drift', R.sA, 2.4);
  near('parapet: 2b/ls governs', D({ type: 'parapet', h: 2, b1: 4, b2: 4 }).val.m, 2); near('parapet: 8 governs', D({ type: 'parapet', h: 3, b1: 15, b2: 80 }).val.m, 8);
  near('parapet: ls = 15 m', D({ type: 'parapet', h: 4, b1: 40, b2: 40 }).val.ls, 15);
  const O = D({ type: 'obstr', h1: 0.8, h2: 0.6, b1: 10, b2: 2, L: 4, w: 0.5 }), o = O.val;
  near('obstruction: μ1 = 2h1/sk', o.m1, 3.2); near('obstruction: μ2 = 2h2/sk', o.m2, 2.4); near('obstruction: ls1 = 5h', o.ls1, 4); near('obstruction: ls2 = b2', o.ls2, 2);
  near('obstruction: cap 5', D({ type: 'obstr', h1: 0.8, h2: 0.8, b1: 10, b2: 10, L: 4 }, { zone: 1, A: 0 }).val.m1, 5);
  ok('obstruction: face ≤ 1 m² ignored', D({ type: 'obstr', h1: 0.4, h2: 0.4, b1: 10, b2: 10, L: 2, w: 0.3 }).cases[1].segs.length === 0);
  const Sl = D({ type: 'obstr', h1: 1.8, h2: 1.8, b1: 10, b2: 10, L: 1.5, w: 0.8 }).val; ok('slender obstruction: h = width', Sl.slender && Sl.he1 === 0.8); near('slender: μ from the width', Sl.m1, 3.2); near('slender: ls with h ≤ 1 m', Sl.ls1, 4);
  near('ls uses h not more than 1 m', D({ type: 'obstr', h1: 1.5, h2: 1.5, b1: 10, b2: 10, L: 1, w: 1.8 }).val.ls1, 5);
  throws('tall and wide obstruction is B3', () => D({ type: 'obstr', h1: 3, h2: 3, b1: 10, b2: 10, L: 5, w: 4 }), /B3/);
  const C = D({ type: 'canopy', h: 3, b1: 2, b2: 12 }); near('canopy: ls = b1', C.val.ls, 2); near('canopy: cap 5', C.val.m, 5);
  near('canopy: 2b/ls governs', D({ type: 'canopy', h: 3, b1: 4, b2: 4 }).val.m, 2); near('canopy: 2h/sk governs', D({ type: 'canopy', h: 0.5, b1: 2, b2: 12 }).val.m, 2);
  throws('canopy over 5 m', () => D({ type: 'canopy', h: 3, b1: 6, b2: 12 }), /5 m/);
}
// ---------- every case: totals and design values ----------
for (const t of [{ type: 'mono', alpha: 15, b: 9 }, { type: 'duo', a1: 30, a2: 30, b: 12 }, { type: 'multi', a1: 25, a2: 25, b1: 5, b2: 5 }, { type: 'cyl', b: 18, h: 5 }, { type: 'abut', alpha: 0, b1: 10, b2: 10, h: 3 }, { type: 'parapet', h: 1, b1: 12, b2: 12 }, { type: 'obstr', h1: 0.9, h2: 0.9, b1: 6, b2: 6, L: 3 }, { type: 'canopy', h: 2, b1: 3, b2: 9 }]) {
  const R = D(t, { zone: 2, A: 180 });
  for (const c of R.cases) {
    let W = 0; for (const s of c.segs) { const m = 2000; for (let i = 0; i < m; i++) { const u = (i + 0.5) / m; W += (s.m0 + (s.m1 - s.m0) * u) * c.f * (s.x1 - s.x0) / m; } }
    near(`${t.type} ${c.name}: load per metre run`, c.W, W, 1e-9);
    near(`${t.type} ${c.name}: design value`, c.ed, c.sit === 'A' ? c.sMax : 1.5 * c.sMax);
  }
  ok(`${t.type}: summary values`, R.sP === Math.max(...R.cases.filter(c => c.sit === 'P').map(c => c.sMax)));
}
throws('unknown case', () => D({ type: 'dome' }), /Choose/);
console.log(`${n - fails}/${n} checks passed`);
if (fails) process.exit(1);
