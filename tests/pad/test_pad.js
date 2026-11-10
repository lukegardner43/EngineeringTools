// Pad Foundation engine checks: The Concrete Centre TCC81 (56 single bases, outputs only) and hand checks of the EC7
// Annex D bearing resistance, sliding, overturning, the DA1 and 6.10 combinations, bending, beam shear and punching.
//   node tests/pad/test_pad.js
const { Pad: P } = require('./load.js');
const REF = require('./ref_tcc81.json');
let n = 0, fails = 0;
const ok = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } };
const near = (name, a, b, tol = 1e-9) => ok(name, Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `got ${a}, want ${b}`);
const throws = (name, f, re) => { let e = null; try { f(); } catch (x) { e = x; } ok(name, !!e && (!re || re.test(e.message)), e ? e.message : 'no error'); };
const chk = (R, id) => R.checks.find(c => c.id === id);
const AREA = p => Math.PI * p * p / 4, rad = d => d * Math.PI / 180;

// ---------- TCC81 ----------
// TCC81 differences, set aside here (each confirmed by reproducing TCC81's figure with its own assumption):
//  - for bending and shear it puts the base's own weight, as well as the column load, at the column offset (the whole
//    load times the offset); the base's weight acts at its centre. Matched below by adding that moment.
//  - its YY moments take L where B is meant in the effective-width term (L − B′ for B − B′), so M_yy is wrong
//    whenever the y eccentricity moves the pressure off a cantilever; compared only where there is no y eccentricity.
//  - it places the beam-shear sections at the d of a nominal 20 mm bar whatever bar it then provides; matched below with
//    20 mm bars of the same area.
//  - punching: it deducts the gross ground pressure inside the perimeter (6.4.4(2) asks for the net upward force, which
//    this tool takes), checks a = d and 2d only (this tool scans every perimeter to 2d) and takes v_Rd,max 6.21 for C30
//    (0.5 ν f_cd is 5.28); compared with the gross deduction, at d and 2d, on the plain cases.
//  - with horizontal loads it uses the column offset for the depth in combination 2, and m_θ has cos θ for cos²θ; no
//    horizontal or wind loads are compared.
REF.cases.forEach((c, i) => {
  const o = c.out, tag = `TCC81 case ${i + 1}`, bar = s => +(/B(\d+)/.exec(s) || [])[1];
  const phiX = bar(o.C41), phiY = bar(o.H41), sX = AREA(phiX) * c.B / o.C42, sY = AREA(phiY) * c.L / o.H42;
  const base = { L: c.L, B: c.B, H: c.H, c1: c.h, c2: c.b, ex: c.ex, ey: c.ey, Dover: c.D, gc: 25, gs: c.gs, phi: c.phi, cEff: c.c, fck: c.fck, cover: c.cover, phiX, sX, phiY, sY,
    loads: { G: { N: c.G, Mx: c.MxG, My: c.MyG }, Q: { N: c.Q, Mx: c.MxQ, My: c.MyQ } } };
  const A = P.design(base);
  // ground: the DA1 bearing pressures and resistances on the effective area
  const g1 = A.geoRows.find(r => r.key === 'C1'), g2 = A.geoRows.find(r => r.key === 'C2');
  near(`${tag}: q_Ed combination 1`, g1.E.q, o.C31, 1e-9); near(`${tag}: q_Ed combination 2`, g2.E.q, o.D31, 1e-9);
  near(`${tag}: q_Rd combination 1`, g1.R.q, o.C32, 1e-9); near(`${tag}: q_Rd combination 2`, g2.R.q, o.D32, 2e-3);
  near(`${tag}: d along L`, A.dx, o.C39); near(`${tag}: d along B`, A.dy, o.H39);
  near(`${tag}: v_Rd,c along L`, A.vRdcX, o.C49, 1e-9); near(`${tag}: v_Rd,c along B`, A.vRdcY, o.H49, 1e-9);
  // bending: TCC81's offset taken on the base's weight too, as a permanent moment
  const off = { ...base, loads: { G: { N: c.G, Mx: c.MxG + A.Wb * c.ex / 1000, My: c.MyG + A.Wb * c.ey / 1000 }, Q: base.loads.Q } };
  const B = P.design(off);
  near(`${tag}: M_Ed along L`, B.best.Mx.M, o.C37, 1e-9); near(`${tag}: A_s along L`, B.BX.As, o.C40, 1e-9);
  if (c.ey === 0 && c.MyG === 0 && c.MyQ === 0) { near(`${tag}: M_Ed along B`, B.best.My.M, o.H37, 1e-9); near(`${tag}: A_s along B`, B.BY.As, o.H40, 1e-9); }
  // beam shear at d and 2d from the faces, the sections set at the d of 20 mm bars
  const C = P.design({ ...off, phiX: 20, sX: AREA(20) * c.B / o.C42, phiY: 20, sY: AREA(20) * c.L / o.H42 });
  near(`${tag}: V_Ed at d along L`, C.best.Vx.atD.V, o.C45, 1e-9); near(`${tag}: V_Ed at 2d along L`, C.best.Vx.at2D.V, o.C47, 1e-9);
  near(`${tag}: V_Ed at d along B`, C.best.Vy.atD.V, o.H45, 1e-9); near(`${tag}: V_Ed at 2d along B`, C.best.Vy.at2D.V, o.H47, 1e-9);
  // punching on the plain cases whose 2d perimeter lies on the base: gross deduction, a = d and 2d
  near(`${tag}: punching v_Rd,c`, A.vRdcP, o.H54, 1e-9);
  if (c.set === 'plain' && A.distEdge >= 2 * A.dave) {
    const G = P.design({ ...base, deductSelfWeight: false });
    near(`${tag}: punching d ave`, G.dave, o.C52); near(`${tag}: u at 2d`, G.best.P2.uLen, o.H52, 1e-9);
    near(`${tag}: punching v_Ed (gross deduction, a = d and 2d)`, Math.max(G.best.P2.vEd, G.best.P1.vEd / 2), o.C54, 1e-9);
    ok(`${tag}: the net deduction is the more onerous`, A.best.P1.vEd >= G.best.P1.vEd);
  }
});

// ---------- hand checks ----------
const D0 = { L: 2000, B: 2000, H: 500, c1: 400, c2: 400, Dover: 500, gc: 25, gs: 18, phi: 30, cEff: 0, fck: 30, cover: 50, phiX: 16, sX: 150, phiY: 16, sY: 150,
  loads: { G: { N: 1000 } } };
const run = o => P.design({ ...D0, ...o });
{ // Annex D factors and shape factors, φ = 30°, a square
  const R = P.bearingResistance({ soil: { mode: 'drained', phi: 30, c: 0 }, set: P.SETS.C1, Lp: 2, Bp: 2, V: 1000, H: 0, thetaH: 0, q0: 10, gamma: 18 });
  const Nq = Math.exp(Math.PI * Math.tan(rad(30))) * Math.tan(rad(60)) ** 2;
  near('D.4: N_q = e^{π tan φ} tan²(45 + φ/2) = 18.40', R.Nq, Nq); near('D.4: N_q value', R.Nq, 18.401, 1e-4);
  near('D.4: N_c = (N_q − 1) cot φ = 30.14', R.Nc, 30.140, 1e-4); near('D.4: N_γ = 2(N_q − 1) tan φ = 20.09', R.Ng, 20.093, 1e-4);
  near('D.4: s_q = 1 + sin φ, s_γ = 0.7 for a square', R.sq, 1.5); near('s_γ', R.sg, 0.7);
  near('D.4: q_Rd = q′N_q s_q + 0.5γB′N_γ s_γ (no inclination)', R.q, 10 * Nq * 1.5 + 0.5 * 18 * 2 * R.Ng * 0.7, 1e-12);
  const C2 = P.bearingResistance({ soil: { mode: 'drained', phi: 30, c: 0 }, set: P.SETS.C2, Lp: 2, Bp: 2, V: 1000, H: 0, thetaH: 0, q0: 10, gamma: 18 });
  near('combination 2: tan φ′_d = tan φ′_k/1.25', C2.phi, Math.atan(Math.tan(rad(30)) / 1.25) * 180 / Math.PI);
  const I = P.bearingResistance({ soil: { mode: 'drained', phi: 30, c: 0 }, set: P.SETS.C1, Lp: 2, Bp: 2, V: 1000, H: 100, thetaH: 0, q0: 10, gamma: 18 });
  near('D.4 inclination, square: m = 1.5, i_q = 0.9^1.5, i_γ = 0.9^2.5', I.iq, 0.9 ** 1.5); near('i_γ', I.ig, 0.9 ** 2.5); near('m', I.m, 1.5);
  const J = P.bearingResistance({ soil: { mode: 'drained', phi: 30, c: 0 }, set: P.SETS.C1, Lp: 3, Bp: 1, V: 1000, H: 100, thetaH: Math.PI / 2, q0: 10, gamma: 18 });
  near('D.4 inclination across B′: m = m_B = (2 + B′/L′)/(1 + B′/L′)', J.m, (2 + 1 / 3) / (1 + 1 / 3));
  const K = P.bearingResistance({ soil: { mode: 'drained', phi: 30, c: 10 }, set: P.SETS.C1, Lp: 2, Bp: 2, V: 1000, H: 100, thetaH: 0, q0: 10, gamma: 18 });
  near('D.4 with c′: i_c = i_q − (1 − i_q)/(N_c tan φ), the base V + A′c′ cot φ', K.ic, K.iq - (1 - K.iq) / (K.Nc * Math.tan(rad(30))));
  near('D.4 with c′: i_q', K.iq, (1 - 100 / (1000 + 4 * 10 / Math.tan(rad(30)))) ** 1.5);
  const U = P.bearingResistance({ soil: { mode: 'undrained', cu: 100 }, set: P.SETS.C2, Lp: 4, Bp: 2, V: 1000, H: 200, thetaH: 0, q0: 20, gamma: 18 });
  const cud = 100 / 1.4, ic = 0.5 * (1 + Math.sqrt(1 - 200 / (8 * cud)));
  near('D.3 undrained: (π + 2)c_u,d s_c i_c + q with c_u/1.4, s_c = 1 + 0.2B′/L′', U.q, (Math.PI + 2) * cud * 1.1 * ic + 20);
}
{ // the ground under a concentric pad: own weight, pressures, DA1 combinations
  const R = run({ loads: { G: { N: 1000 }, Q: { N: 500 } } });
  near('own weight 25 × 0.5 = 12.5 kPa, 50 kN', R.Wb, 50);
  const g1 = R.geoRows.find(r => r.key === 'C1'), g2 = R.geoRows.find(r => r.key === 'C2');
  near('C1: V_d = 1.35(1000 + 50) + 1.5 × 500', g1.U.N, 1.35 * 1050 + 750); near('C1: q_Ed = V_d/4', g1.E.q, (1.35 * 1050 + 750) / 4);
  near('C2: V_d = 1.0(1050) + 1.3 × 500', g2.U.N, 1050 + 650);
  ok('no wind: one combination each', R.geoRows.length === 2 && !chk(R, 'slideC1') && !chk(R, 'equ').util);
  near('characteristic pressure G + Q', R.qSLS, 1550 / 4);
}
{ // wind both ways, sliding and EQU by hand
  const R = run({ loads: { G: { N: 1000, Mx: 20 }, W: { Mx: 60, Hx: 40 } } });
  ok('wind both ways: 1 + 3 × 2 combinations per set', R.geoRows.filter(r => r.key === 'C1').length === 7 && R.geoRows.filter(r => r.key === 'C2').length === 7);
  const lead = R.geoRows.find(r => r.key === 'C1' && r.U.name === 'C1: 1G + 1.5W');
  near('1.0G + 1.5W: M_x at the underside = 20 + 1.5(60 + 40 × 0.5)', lead.U.Mx, 20 + 1.5 * 80); near('… H_d', lead.H, 60);
  near('… e_x and L′', lead.E.Lp, 2 - 2 * (140 / 1050));
  near('sliding C1: H_d/((G + own weight) tan φ′)', chk(R, 'slideC1').util, 60 / (1050 * Math.tan(rad(30))));
  near('sliding C2: tan φ′_d = tan φ′/1.25; H_d = 1.3 × 40', chk(R, 'slideC2').util, 52 / (1050 * Math.tan(rad(30)) / 1.25));
  // EQU about the +x edge: stabilising 0.9(1000 + 50) × 1.0; destabilising 1.1 × 20 + 1.5 × (60 + 40 × 0.5)
  near('EQU: 1.1 G_dst + 1.5 W against 0.9 G_stb', chk(R, 'equ').util, (1.1 * 20 + 1.5 * 80) / (0.9 * 1050 * 1.0));
}
{ // bending, shear and punching by hand: a 3 m square, 400 column, 1000 kN permanent, 6.10a governs
  const R = run({ L: 3000, B: 3000 });
  const p = 1.35 * (1000 + 12.5 * 9) / 9, net = p - 1.35 * 12.5;
  near('M_Ed at the face = (p − 1.35w) B c²/2 with c = 1.3 m', R.best.Mx.M, net * 3 * 1.3 ** 2 / 2, 1e-12);
  near('both ways the same for a square', R.best.My.M, R.best.Mx.M, 1e-12);
  const dx = 500 - 50 - 8, dy = 500 - 50 - 16 - 8; near('d each way', R.dx, dx); near('d', R.dy, dy);
  // beam shear at d (β = 0.5) and 2d (β = 1)
  near('V at d = net × B × (1.3 − d)', R.best.Vx.atD.V, net * 3 * (1.3 - dx / 1000), 1e-12);
  near('V at 2d', R.best.Vx.at2D.V, net * 3 * (1.3 - 2 * dx / 1000), 1e-12);
  const vD = 0.5 * R.best.Vx.atD.V * 1e3 / (3000 * dx), v2 = R.best.Vx.at2D.V * 1e3 / (3000 * dx);
  near('v_Ed = max(0.5V_d, V_2d)/(b d)', R.best.Vx.v, Math.max(vD, v2), 1e-12);
  // v_Rd,c (6.2.a) with ρ from the bars provided
  const rho = AREA(16) * 1000 / 150 * 3 / (3000 * dx), k = 1 + Math.sqrt(200 / dx);
  near('v_Rd,c = 0.12k(100ρf_ck)^1/3', R.vRdcX, Math.max(0.12 * k * (100 * rho * 30) ** (1 / 3), 0.035 * k ** 1.5 * Math.sqrt(30)), 1e-12);
  // punching at a = d: V_red = V − (p − 1.35w) A(a); β = 1 with no moment
  const d = (dx + dy) / 2, a = d, u = 1600 + 2 * Math.PI * a, Ain = 400 * 400 + 4 * a * 400 + Math.PI * a * a;
  const Vred = 1.35 * 1000 * 1e3 - net * Ain / 1e6 * 1e3;
  near('punching at d: v_Ed = V_Ed,red/(u d), net upward pressure deducted', R.best.P1.vEd, Vred / (u * d), 1e-12);
  near('punching at d: v_Rd = v_Rd,c 2d/a', R.best.P1.vRd, R.vRdcP * 2, 1e-12);
  ok('punching: the scan finds a perimeter at least as onerous as d and 2d', R.best.P.u >= R.best.P1.u - 1e-12 && R.best.P.u >= R.best.P2.u - 1e-12);
  near('column face: v = V/(u₀ d) ≤ 0.5νf_cd, ν = 0.6(1 − 30/250), f_cd = 20', chk(R, 'punch0').util, 1.35e6 / (1600 * d) / (0.5 * 0.6 * (1 - 30 / 250) * 20), 1e-12);
  near('minimum steel 0.26 f_ctm/f_yk b d', R.AsMinX, Math.max(0.26 * 0.3 * 30 ** (2 / 3) / 500 * 3000 * dx, 0.0013 * 3000 * dx), 1e-12);
  ok('bending checks use the steel over the full width', Math.abs(chk(R, 'bendX').util - R.BX.As / (AREA(16) * 1000 / 150 * 3)) < 1e-12);
}
{ // 6.10 and 6.10a/b
  const R = run({ loads: { G: { N: 1000 }, Q: { N: 800 } } }), S = run({ loads: { G: { N: 1000 }, Q: { N: 800 } }, comb: '6.10' });
  const cnt = R.strRows.length; ok('6.10a/b: two combinations without wind', cnt === 2 && S.strRows.length === 1);
  const p610 = (1.35 * 1050 + 1.5 * 800) / 4, p610b = (1.24875 * 1050 + 1.5 * 800) / 4;
  near('6.10b governs with a large Q: 1.25G + 1.5Q', R.best.Mx.M, (p610b - 1.24875 * 12.5) * 2 * 0.64 / 2, 1e-12);
  near('6.10: 1.35G + 1.5Q', S.best.Mx.M, (p610 - 1.35 * 12.5) * 2 * 0.64 / 2, 1e-12);
}
{ // the column offset: the column load at the offset, the base's weight at the centre
  const R = run({ ex: 200, loads: { G: { N: 1000 } } });
  const g1 = R.geoRows[0]; near('offset: M_x = N_col e_x only', g1.U.Mx, 1.35 * 1000 * 0.2, 1e-12);
  ok('offset: the effective area on the loaded side', Math.abs(g1.E.exr - 1.35 * 200 / (1.35 * 1050)) < 1e-12);
  throws('the column must sit on the base', () => run({ ex: 900 }), /not on the base/);
}
{ // uplift, allowable pressure, undrained, strip, errors
  const R = run({ loads: { G: { N: 100 }, W: { N: -400 } } });
  ok('uplift under 1.0G + 1.5W: bearing fails with a note', chk(R, 'bearC1').util === Infinity && /uplift/.test(chk(R, 'bearC1').note) && R.util > 1);
  const A = run({ soil: 'allowable', qa: 200, loads: { G: { N: 600 }, Q: { N: 200 } } });
  near('allowable: characteristic pressure (G + Q + own weight)/A', chk(A, 'allow').util, (850 / 4) / 200, 1e-12);
  ok('allowable: no Annex D check', !chk(A, 'bearC1') && !chk(A, 'bearC2'));
  const U = run({ soil: 'undrained', cu: 60 });
  const u2 = U.geoRows.find(r => r.key === 'C2'); near('undrained C2: (π + 2)(60/1.4)(1.2) + γD', u2.R.q, (Math.PI + 2) * 60 / 1.4 * 1.2 + 18 * 0.5, 1e-12);
  const S = run({ type: 'strip', L: 1500, c1: 300, loads: { G: { N: 200 }, Q: { N: 80 } } });
  ok('strip: per metre, no punching, distribution steel', S.B === 1 && !chk(S, 'punch') && !chk(S, 'bendY') && /20 %/.test(chk(S, 'minY').note));
  const s1 = S.geoRows.find(r => r.key === 'C1'); ok('strip: s = 1 and m = 2', s1.R.r === 0 && s1.R.sq === 1 && s1.R.m === 2);
  near('strip: M at the wall face per metre (6.10b)', S.best.Mx.M, ((1.24875 * (200 + 12.5 * 1.5) + 1.5 * 80) / 1.5 - 1.24875 * 12.5) * 0.6 * 0.6 / 2, 1e-12);
  throws('φ′ out of range', () => run({ phi: 55 }), /φ′k/); throws('a zero length', () => run({ L: 0 }), /L must be/);
  throws('bars that do not fit', () => run({ H: 60 }), /do not fit/);
  const W = run({ L: 4000, B: 4000 }); ok('a wide base gets the 2/3-of-steel note', W.warnings.some(w => /1\.5d/.test(w)));
  const T = run({ H: 250, loads: { G: { N: 3000 } } }); ok('a thin base: punching fails', chk(T, 'punch').util > 1 && T.util > 1);
}
console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
