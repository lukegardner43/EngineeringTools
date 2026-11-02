// Wind Loading engine checks: the NA chart readings, Luke's spreadsheet sample, hand checks of the NA.2 factors,
// orography, Tables NA.3 to NA.7 and Figures 7.4 to 7.8, and whole-building load cases worked by hand.
const { Wind: W, CHARTS } = require('./load');
const REF = require('./ref_charts.json');
let n = 0, fails = 0;
const ok = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } };
const near = (name, a, b, tol = 1e-3) => ok(name, Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `got ${a}, want ${b}`);
const throws = (name, f, re) => { let e = null; try { f(); } catch (x) { e = x; } ok(name, !!e && (!re || re.test(e.message)), e ? e.message : 'no error'); };

// ---------- charts: compact digitisation against readings of Figures NA.3 to NA.8 ----------
for (const [nm, pts] of Object.entries(REF.charts)) {
  let worst = 0;
  for (const [z, x, v] of pts) {
    const c = W.chart(nm, z, x), r = Math.abs(c - v) / v; worst = Math.max(worst, r);
    ok(`${nm}(${z}, ${x}) within 1%`, r < 0.01, `got ${c}, figure ${v}`);
  }
  ok(`${nm}: largest error under 1%`, worst < 0.01, String(worst));
  const C = CHARTS[nm]; ok(`${nm}: compact table`, C.z.length <= 30 && C.x.length <= 30 && C.v.length === C.x.length && C.v.every(r => r.length === C.z.length));
}
// every chart rises with height and the sea charts fall inland; town factors between the limits
// (to the reading accuracy: the figures are flat near the coast and high up, where a read can wobble by a few in 10 000)
for (const nm of ['ce', 'cr']) for (const x of [0.1, 1, 10, 100]) { let p = 0; for (const z of [2, 3, 5, 10, 20, 50, 100, 200]) { const v = W.chart(nm, z, x); ok(`${nm} rises with z at ${x} km`, v >= p * (1 - 1e-3)); p = v; } }
for (const nm of ['ce', 'cr']) for (const z of [2, 10, 100]) { let p = Infinity; for (const x of [0.1, 0.3, 1, 3, 10, 30, 100]) { const v = W.chart(nm, z, x); ok(`${nm} falls inland at ${z} m`, v <= p * (1 + 1e-3)); p = v; } }
for (const z of [2, 5, 10, 30]) for (const x of [0.1, 1, 5, 20]) { const t = W.chart('ceT', z, x); ok(`ceT(${z}, ${x}) in (0.4, 1.01]`, t > 0.4 && t <= 1.01); const k = W.chart('kIT', z, x); ok(`kIT(${z}, ${x}) ≥ 1`, k >= 0.999); }
// the exposure chart is consistent with the roughness and turbulence charts: ce ≈ ((1 + 3Iv) cr)² (the basis of NA.4b)
for (const z of [5, 10, 30, 100]) for (const x of [1, 10, 50]) { const c = W.chart('ce', z, x), d = ((1 + 3 * W.chart('Iv', z, x)) * W.chart('cr', z, x)) ** 2; near(`ce = ((1 + 3Iv)cr)² at ${z} m, ${x} km`, c, d, 0.02); }
// below 2 m the 2 m value; distances clamped
near('ce below 2 m reads at 2 m', W.chart('ce', 1, 10), W.chart('ce', 2, 10), 1e-12);
near('ce beyond 100 km reads at 100 km', W.chart('ce', 10, 300), W.chart('ce', 10, 100), 1e-12);

// ---------- Luke's spreadsheet sample (z 7 m, 55 km from the sea, 0.2 km into town, A 32 m, v_b,map 21.51) ----------
{
  near('sample cr (NA.3)', W.chart('cr', 7, 55), 0.9498, 0.01);
  near('sample cr,T (NA.4)', W.chart('crT', 7, 0.2), 0.8262, 0.01);
  near('sample Iv,flat (NA.5)', W.chart('Iv', 7, 55), 0.1804, 0.01);
  near('sample kI,T (NA.6)', W.chart('kIT', 7, 0.2), 1.5985, 0.01);
  const S = W.site({ vbmap: 21.51, A: 32, terrain: 'town', xSea: 55, xTown: 0.2 }), q = W.qp(S, 7, 1, 0);
  near('sample calt', q.calt, 1.032, 1e-9); near('sample vb', q.vb, 22.20, 0.002); near('sample qb', q.qb, 0.30, 0.02);
  near('sample ce', q.ce, 2.14, 0.01); near('sample ce,T', q.ceT, 1.00, 0.005); near('sample qp', q.qp, 0.65, 0.01);
  ok('sample is town terrain', S.inTown && q.how === 'NA.3b');
}

// ---------- NA.2 factors ----------
near('calt z ≤ 10 (NA.2a)', W.calt(100, 5), 1.1, 1e-12);
near('calt z > 10 (NA.2b)', W.calt(100, 20), 1 + 0.1 * Math.pow(0.5, 0.2), 1e-12);
near('cprob 50 years', W.cprob(50), 1, 1e-12);
near('cprob 10 years (4.2)', W.cprob(10), 0.90249, 1e-4);
near('cprob 100 years', W.cprob(100), 1.0395, 1e-3);
near('cdir 240° (Table NA.1)', W.cdirAt(240), 1.0, 1e-12);
near('cdir 15° interpolated', W.cdirAt(15), 0.755, 1e-12);
near('cdir 345°', W.cdirAt(345), 0.80, 1e-12);
near('cdir face north: largest in ±45° (at 315°)', W.cdirFace(0), 0.865, 1e-9);
near('cdir face west', W.cdirFace(270), 1.0, 1e-12);
near('cdir face east', W.cdirFace(90), 0.765, 1e-9);
near('hdis x ≤ 2have (A.5)', W.hdisOf(8, 10, 16.2), 6.4, 1e-12);
near('hdis capped at 0.6h', W.hdisOf(20, 0, 10), 6, 1e-12);
near('hdis 2have < x < 6have', W.hdisOf(10, 40, 30), 4, 1e-12);
near('hdis x ≥ 6have', W.hdisOf(10, 70, 30), 0, 1e-12);
near('hdis no buildings', W.hdisOf(0, 0, 30), 0, 1e-12);

// ---------- orography, A.3 ----------
{
  const o = W.orography({ type: 'hill', H: 60, Lu: 300, Ld: 300, X: -50 }, 10);
  near('hill upwind: s (A.3)', o.s, 0.61525, 1e-3); near('hill upwind: co = 1 + 2sφ', o.co, 1.2461, 1e-3);
  near('gentle slope φ < 0.05: co = 1', W.orography({ type: 'hill', H: 10, Lu: 300, X: 0 }, 10).co, 1, 1e-12);
  near('far upwind X/Lu < −1.5: co = 1', W.orography({ type: 'hill', H: 60, Lu: 300, X: -500 }, 10).co, 1, 1e-12);
  near('far downwind of a hill X/Ld > 2: co = 1', W.orography({ type: 'hill', H: 60, Lu: 300, Ld: 300, X: 700 }, 10).co, 1, 1e-12);
  near('far behind a cliff X/Le > 3.5: co = 1', W.orography({ type: 'cliff', H: 60, Lu: 300, X: 1100 }, 10).co, 1, 1e-12);
  const steep = W.orography({ type: 'hill', H: 60, Lu: 100, Ld: 100, X: 0 }, 5);
  ok('steep slope φ > 0.3: Le = H/0.3, co = 1 + 0.6s', Math.abs(steep.Le - 200) < 1e-9 && Math.abs(steep.co - (1 + 0.6 * steep.s)) < 1e-12);
  const crest = W.orography({ type: 'cliff', H: 30, Lu: 200, X: 0 }, 5), just = W.orography({ type: 'cliff', H: 30, Lu: 200, X: 2 }, 5);
  near('cliff: continuous across the crest', just.co, crest.co, 0.03);
  ok('crest is the most exposed point of a hill', W.orography({ type: 'hill', H: 60, Lu: 300, Ld: 300, X: 0 }, 10).co > o.co);
  // NA.4a: q_p(o) = q_p,flat ((co + 0.6)/1.6)² with the base at the site altitude
  const S = W.site({ vbmap: 23, A: 100, terrain: 'country', xSea: 20, orog: { type: 'hill', H: 60, Lu: 300, Ld: 300, X: -50, Abase: 100 } });
  const S0 = W.site({ vbmap: 23, A: 100, terrain: 'country', xSea: 20 }), q = W.qp(S, 10, 1), q0 = W.qp(S0, 10, 1);
  near('NA.4a', q.qp, q0.qp * ((o.co + 0.6) / 1.6) ** 2, 1e-9); ok('NA.4a used', q.how === 'NA.4a');
  // above 50 m (NA.4b) with co = 1 it agrees with the flat value to the accuracy of the charts
  const Sb = W.site({ vbmap: 23, A: 100, terrain: 'country', xSea: 20, orog: { type: 'hill', H: 200, Lu: 1000, Ld: 1000, X: -1400, Abase: 100 } }), qb = W.qp(Sb, 80, 1);
  ok('NA.4b used above 50 m', qb.howO === 'NA.4b' && qb.co > 1);
  near('NA.4b: (1 + 3Iv/co)² 0.613 (cr co vb)²', qb.qpOrog, (1 + 3 * W.chart('Iv', 80, 20) / qb.co) ** 2 * 0.613 * (W.chart('cr', 80, 20) * qb.co * qb.vb) ** 2 / 1000, 1e-9);
  // a base lower than the site: v_b at the base altitude
  const Sl = W.site({ vbmap: 23, A: 150, terrain: 'country', xSea: 20, orog: { type: 'hill', H: 60, Lu: 300, Ld: 300, X: -50, Abase: 90 } }), ql = W.qp(Sl, 10, 1);
  near('base altitude used for the orography case', ql.qpOrog, q0.ce * 0.613 * (23 * 1.09) ** 2 / 1000 * ((o.co + 0.6) / 1.6) ** 2, 1e-9);
}

// ---------- town terrain and displacement ----------
{
  const S = W.site({ vbmap: 22, A: 0, terrain: 'town', xSea: 30, xTown: 2 }), C = W.site({ vbmap: 22, A: 0, terrain: 'country', xSea: 30 });
  const q = W.qp(S, 10, 1), qc = W.qp(C, 10, 1);
  ok('town lower than country', q.qp < qc.qp && q.ceT < 1 && q.how === 'NA.3b');
  near('NA.3b = ce ce,T qb', q.qp, q.ce * q.ceT * q.qb, 1e-12);
  ok('under 0.1 km into town counts as country', !W.site({ vbmap: 22, terrain: 'town', xSea: 30, xTown: 0.05 }).inTown);
  const qd = W.qp(S, 12, 1, 4);
  near('z − hdis read from the charts', qd.ce, W.chart('ce', 8, 30), 1e-12); near('calt at z, not z − hdis', qd.calt, 1, 1e-12);
  throws('z − hdis above 200 m', () => W.qp(S, 260, 1, 0), /200 m/);
}
throws('vb,map below the map', () => W.site({ vbmap: 17, xSea: 10 }), /18 and 35/);
throws('cseason over 1', () => W.site({ vbmap: 22, xSea: 10, cseason: 1.2 }), /c_season/);

// ---------- pressure coefficients ----------
{
  const t = W.wallCpe(0.25); ok('Table NA.4 h/d ≤ 0.25', t.A === -1.2 && t.B === -0.8 && t.C === -0.5 && t.D === 0.7 && t.E === -0.3);
  near('Table NA.4 h/d = 1, E', W.wallCpe(1).E, -0.5, 1e-12); near('Table NA.4 h/d = 5, E', W.wallCpe(5).E, -0.7, 1e-12);
  near('Table NA.4 h/d = 3, E interpolated', W.wallCpe(3).E, -0.6, 1e-12); near('Table NA.4 h/d = 0.625, D interpolated', W.wallCpe(0.625).D, 0.75, 1e-12);
  near('Table NA.4 h/d > 5 as 5', W.wallCpe(8).E, -0.7, 1e-12);
  near('net coefficient h/d = 1', W.netCoeff(1), 1.1, 1e-12); near('net coefficient h/d = 5', W.netCoeff(5), 1.3, 1e-3); near('net coefficient h/d = 0.25', W.netCoeff(0.25), 0.8, 1e-3);
  near('lack of correlation h/d ≤ 1', W.fCorr(0.5), 0.85, 1e-12); near('lack of correlation h/d ≥ 5', W.fCorr(6), 1, 1e-12); near('lack of correlation h/d = 3', W.fCorr(3), 0.925, 1e-12);
  const f = W.flatCpe({ type: 'sharp' }, 10); ok('Table NA.5 sharp eaves', f.F.neg === -2.0 && f.G.neg === -1.4 && f.H.neg === -0.7 && f.I.neg === -0.2 && f.I.pos === 0.2);
  near('Table NA.5 parapet hp/e = 0.1', W.flatCpe({ type: 'parapet', hp: 2 }, 20).F.neg, -1.85, 1e-12);
  near('Table NA.5 parapet hp/e ≥ 0.2', W.flatCpe({ type: 'parapet', hp: 5 }, 20).G.neg, -1.0, 1e-12);
  near('Table NA.5 parapet hp/e = 0.075', W.flatCpe({ type: 'parapet', hp: 1.5 }, 20).F.neg, -1.875, 1e-12);
  near('Table NA.5 curved r/e = 0.1', W.flatCpe({ type: 'curved', r: 2 }, 20).F.neg, -0.75, 1e-12);
  near('Table NA.5 mansard 45°', W.flatCpe({ type: 'mansard', a: 45 }, 20).G.neg, -1.3, 1e-12);
  near('Table NA.5 mansard 37.5°', W.flatCpe({ type: 'mansard', a: 37.5 }, 20).F.neg, -1.075, 1e-12);
  const d = W.pitchedCpe(W.DUO0, 22.5); near('Table NA.7a 22.5° F negative', d.F.neg, -0.8, 1e-12); near('Table NA.7a 22.5° F positive', d.F.pos, 0.5, 1e-12);
  near('Table NA.7a 52.5° F negative (0 to none)', W.pitchedCpe(W.DUO0, 52.5).F.neg, 0, 1e-12);
  near('Table NA.7a 15° J', W.pitchedCpe(W.DUO0, 15).J.neg, -1.3, 1e-12);
  near('Table NA.7b 30° F', W.pitchedCpe(W.DUO90, 30).F.neg, -1.2, 1e-12);
  near('Table NA.6a 10° F', W.pitchedCpe(W.MONO0, 10).F.neg, -1.45, 1e-12);
  ok('Table NA.6a θ = 180° has no positive values', W.pitchedCpe(W.MONO180, 20).F.pos === null);
  near('Table NA.6b 10° Fup', W.pitchedCpe(W.MONO90, 10).Fup.neg, -2.4, 1e-12);
  near('below 5° reads 5°', W.pitchedCpe(W.DUO90, 2).F.neg, -2.0, 1e-12);
  near('Table NA.3 zone A, small', W.sizeFactor('A', 5, 6), 1, 1e-12);
  near('Table NA.3 zone C, 300 m, 200 m', W.sizeFactor('C', 300, 200), 0.80, 1e-12);
  near('Table NA.3 zone B, 50 m, 30 m', W.sizeFactor('B', 50, 30), 0.90, 1e-12);
  near('Table NA.3 zone A, 60 m, 40 m interpolated', W.sizeFactor('A', 60, 40), (0.92 + 0.92 + 0.90 + 0.91) / 4, 1e-12);
  throws('Table NA.3 zone', () => W.sizeFactor('D', 10, 10), /A, B or C/);
}
// ---------- zones ----------
{
  const s1 = W.strips(10, 20); ok('Figure 7.4 h ≤ b: one part at h', s1.length === 1 && s1[0].ze === 10);
  const s2 = W.strips(30, 20); ok('Figure 7.4 b < h ≤ 2b: two parts', s2.length === 2 && s2[0].ze === 20 && s2[1].ze === 30);
  const s3 = W.strips(70, 20); ok('Figure 7.4 h > 2b: bottom b, strips, top b', s3[0].ze === 20 && s3[s3.length - 1].z0 === 50 && s3[s3.length - 1].ze === 70 && s3.every((p, i) => i === 0 || Math.abs(p.z0 - s3[i - 1].z1) < 1e-9));
  const z1 = W.wallZones(10, 20); ok('Figure 7.5 e < d', z1.A === 2 && z1.B === 8 && z1.C === 10);
  const z2 = W.wallZones(30, 12); ok('Figure 7.5 d ≤ e < 5d', z2.A === 6 && z2.B === 6 && z2.C === 0);
  const z3 = W.wallZones(100, 12); ok('Figure 7.5 e ≥ 5d', z3.A === 12 && z3.B === 0);
  for (const kind of ['flat', 'mono0', 'mono180', 'mono90', 'duo0', 'duo90']) for (const [e, b, d] of [[20, 30, 12], [12, 12, 30], [60, 30, 50], [4, 40, 40]]) {
    const z = W.roofZones(kind, e, b, d), A = z.reduce((s, q) => s + q.area, 0); near(`${kind} roof zones cover the roof (e ${e}, b ${b}, d ${d})`, A, b * d, 1e-9);
  }
  const f = W.roofZones('flat', 20, 30, 40); near('Figure 7.6 F', f.find(q => q.zone === 'F').area, 2 * 5 * 2, 1e-12); near('Figure 7.6 H', f.find(q => q.zone === 'H').area, 30 * 8, 1e-12);
  const j = W.roofZones('duo0', 20, 30, 12); near('Figure 7.8 J', j.find(q => q.zone === 'J').area, 30 * 2, 1e-12);
}

// ---------- whole building ----------
{
  // flat box, cdir 1: one part at h, overall force by hand
  const base = { vbmap: 22, A: 0, terrain: 'country', xSea: 100, cdirOne: true, L: 20, W: 10, h: 10, roof: { type: 'flat', eaves: { type: 'sharp' } } };
  const R = W.design(base), c = R.cases[0], qp = W.qp(R.S, 10, 1).qp;
  near('flat box: qp at h', c.qH.qp, qp, 1e-12); ok('flat box: one part', c.parts.length === 1);
  near('flat box: net-coefficient force', c.Fw, 0.85 * 1.1 * qp * 200, 1e-6); near('flat box: moment at h/2', c.Mw, c.Fw * 5, 1e-6);
  near('flat box: D + E force', c.FwDE, 0.85 * (0.8 + 0.5) * qp * 200, 1e-6);
  near('flat box: no roof horizontal force', c.FhRoof, 0, 1e-12);
  near('flat box: side 2, h/d = 0.5', R.cases[1].hd, 0.5, 1e-12);
  near('flat box: side 2 force', R.cases[1].FwDE, 0.85 * (W.wallCpe(0.5).D - W.wallCpe(0.5).E) * qp * 100, 1e-6);
  ok('flat box: opposite sides equal', Math.abs(R.cases[0].Fw - R.cases[2].Fw) < 1e-9 && Math.abs(R.cases[1].Mw - R.cases[3].Mw) < 1e-9);
  near('flat box: wall zone A net', c.walls.find(w => w.zone === 'A').net[0], qp * (-1.2 - 0.2), 1e-9);
  near('flat box: roof uplift, positive cpi', c.roofCases[0].Fvi[0], qp * c.roof.reduce((s, z) => s + (z.cpe.neg - 0.2) * z.area, 0), 1e-9);
  ok('R.M13 and R.M24', R.M13 === Math.max(R.cases[0].Mw, R.cases[2].Mw) && R.M24 === Math.max(R.cases[1].Mw, R.cases[3].Mw));
  // size and dynamic factors scale the overall force only
  const Rc = W.design({ ...base, csZone: 'A', cd: 1.05 }), cs = W.sizeFactor('A', 30, 10);
  near('cscd scales the overall force', Rc.cases[0].Fw, c.Fw * cs * 1.05, 1e-9); near('cscd leaves the pressures', Rc.cases[0].walls[0].we, c.walls[0].we, 1e-12);
  // tall: three parts and a moment above h/2
  const T = W.design({ ...base, L: 10, W: 10, h: 35 }), ct = T.cases[0];
  ok('tall: parts at b, two strips, h', ct.parts.length === 4 && ct.parts[0].ze === 10 && ct.parts[1].ze === 17.5 && ct.parts[2].ze === 25 && ct.parts[3].z0 === 25 && ct.parts[3].ze === 35);
  ok('tall: moment arm above mid-height', ct.Mw / ct.Fw > 17.5);
  near('tall: force from the parts', ct.Fw, W.fCorr(3.5) * W.netCoeff(3.5) * 10 * ct.parts.reduce((s, p) => s + p.q.qp * (p.z1 - p.z0), 0), 1e-6);
  // return period and direction
  near('10-year return period', W.design({ ...base, Tr: 10 }).cases[0].qH.qp, qp * W.cprob(10) ** 2, 1e-9);
  const D = W.design({ ...base, cdirOne: false, bearing: 0 });
  near('side 1 faces north', D.cases[0].cdir, 0.865, 1e-9); near('side 4 faces west', D.cases[3].cdir, 1.0, 1e-9); ok('wind directions 0, 90, 180, 270', D.cases.map(q => q.from).join() === '0,90,180,270');
  near('bearing rotates the directions', W.design({ ...base, cdirOne: false, bearing: 270 }).cases[0].cdir, 1.0, 1e-9);
  // duopitch: geometry, kinds, the roof horizontal force
  const P = W.design({ ...base, L: 30, W: 12, h: 6, roof: { type: 'duo', pitch: 22.5 } }), p1 = P.cases[0];
  near('duopitch ridge height', P.H, 6 + 6 * Math.tan(22.5 * Math.PI / 180), 1e-12);
  ok('duopitch kinds', P.cases.map(q => q.kind).join() === 'duo0,duo90,duo0,duo90');
  ok('duopitch: eaves face width stops at the eaves', p1.area === undefined || Math.abs(p1.area - 30 * 6) < 0.5);
  const tan = Math.tan(22.5 * Math.PI / 180), qH = p1.qH.qp, ar = zn => p1.roof.find(z => z.zone === zn).area, cv = (zn, k) => p1.roof.find(z => z.zone === zn).cpe[k];
  const FhPos = qH * tan * (cv('F', 'pos') * ar('F') + cv('G', 'pos') * ar('G') + cv('H', 'pos') * ar('H') - cv('J', 'pos') * ar('J') - cv('I', 'pos') * ar('I'));
  near('duopitch: roof horizontal force (positive case)', p1.FhRoof, Math.max(FhPos, p1.roofCases[0].Fh), 1e-9);
  ok('duopitch: roof horizontal force acts downwind', p1.FhRoof > 0);
  near('duopitch: overall includes the roof', p1.Fw, p1.cscd * p1.fc * (p1.Fnet + p1.FhRoof), 1e-9);
  const g2 = P.cases[1]; ok('duopitch gable: two parts or one by the gable', g2.parts.length >= 1 && Math.abs(g2.area - (12 * 6 + 0.5 * 12 * 6 * tan)) < 0.2);
  // monopitch: low eave on side 1, high on side 3
  const M = W.design({ ...base, L: 30, W: 12, h: 6, roof: { type: 'mono', pitch: 10 } });
  ok('monopitch kinds', M.cases.map(q => q.kind).join() === 'mono0,mono90,mono180,mono90');
  ok('monopitch: high eave face is taller', Math.abs(M.cases[2].area - 30 * M.H) < 0.5 && Math.abs(M.cases[0].area - 30 * 6) < 0.5);
  // parapet
  const Pp = W.design({ ...base, h: 10, roof: { type: 'flat', eaves: { type: 'parapet', hp: 1 } } });
  near('parapet adds to the face height', Pp.cases[0].parts[0].ze, 11, 1e-12); near('parapet: hp/e = 1/20 on the roof', Pp.cases[0].roof.find(z => z.zone === 'F').cpe.neg, -1.9, 1e-9);
  // input errors
  throws('pitch under 5°', () => W.design({ ...base, roof: { type: 'duo', pitch: 3 } }), /5°/);
  throws('negative length', () => W.design({ ...base, L: -2 }), /Length L/);
}
console.log(`${n - fails}/${n} checks passed`);
if (fails) process.exit(1);
