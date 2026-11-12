// Tower Crane Base engine against CIRIA C761's worked examples (outputs only):
//  - Example 2A, a 6 × 6 × 1.5 m gravity base in sand (φ′ 37°) under a 202 EC-B: overturning (EQU); bearing in combination 1
//    (inferior, the jib at 5°: B′ 0.691, L′ 5.54, A′ 3.83 m², the Annex D factors, R_d 6155 kN, R_d/F_Ed 3.0) and combination
//    2 (the jib at 11°: 1.46 × 5.12 m, R_d 6968 kN, 3.45); sliding (R_hd 1524 kN against 174 kN); the slewing torque on the
//    effective area (I_T 17.7 m⁴, 2.66 m to the corner, 49.9 + 7.0 kPa); the presumed bearing (238 kPa on 4.15 × 2.04 m,
//    net 208 against 200); settlement and tilt (206 kPa with the jib along an axis, 1 in 925 and 1 in 478 with the legs ±1 mm);
//    the base: bending at the legs (536 kNm/m at 5°, 747 kNm/m at 43°, the true worst a little higher), 1280 mm²/m, minimum
//    1881 mm²/m, hogging 98 kNm/m and 168 mm²/m, plain concrete in hogging; shear at d (294.9 kN/m, v_Rd,c 0.284); the leg
//    loads (2065 kN down, 1684 kN up, 1137 kN up for each of a pair) and the punching and pull-out perimeters.
//  - Example 2B, the same base in stiff clay (c_u 120 kPa): bearing in combination 1 (the jib at 7°, 0.71 × 5.35 m, R_d/A′ 623,
//    F_Ed/A′ 531, 1.17) and combination 2 (18°, 1.61 × 4.57 m, 483, 275, 1.76); sliding (c_u A′: 456 and 631 kN); the
//    torque's section moduli (19.3 m⁴ / 2.59 m, 32.0 / 2.84); the presumed bearing ((π + 2) c_u / 3 = 206 kPa against 238);
//    settlement (8 mm at 45°, 7 mm along an axis, 1 in 420 with the legs: over 1 in 500).
//  - Example 1's pad (undrained bearing, combination 2), the C761 partial factor tables, Annex D drained, the refusals.
// Where the book rounds or carries a value over from another case, the note says so and the tolerance allows for it.
//   node tests/crane-base/test_crane_base.js
const { CraneBase: C, EC2 } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol, rel = (a, b, r) => Math.abs(a - b) <= r * Math.abs(b);
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };

// ---- C761 Example 2A: Table E2A.1 loads, the base and the ground ----
const CASES = [{ k: 'ins', M: 2894, H: 40, F: 768, T: 255 }, { k: 'oosRear', M: 3320, H: 129, F: 722 }, { k: 'oosFront', M: 4280, H: 90, F: 726 }, { k: 'erect', M: 2210, H: 29, F: 505 }];
// C25/30, 50 mm covers, H25 bottom (d = 1500 − 50 − 25 − 12.5), legs at 1.98 m, the size of the legs ignored as the book does,
// compression in at the first cross piece 235 mm down, the foot plate 1115 mm down
const EX2A = { L: 6, h: 1.5, gc: 24, Gc: 724, ce: true, ground: 'drained', gs: 20, phi: 37, Df: 1.5, fck: 25, cB: 50, cT: 50, phiB: 25, sB: 250, phiT: 25, sT: 300, s: 1.98, a: 1, tc: 235, tp: 1115, qp: 200, qpBasis: 'net', E: 90, nu: 0.3, tol: 1, tiltN: 500, cases: CASES };
const D2A = C.design(EX2A), FR = D2A.out.find(R => R.r.k === 'oosFront'), G2A = { mode: 'drained', g: 20, phi: 37 * Math.PI / 180, c: 0, Df: 1.5 };
const M1 = 1.22 * (4280 + 90 * 1.5), M2 = 1.06 * (4280 + 90 * 1.5);
{
  truth('C761 Ex 2A: base weight 6 × 6 × 1.5 × 24 = 1296 kN', near(D2A.Gb, 1296, 1e-9));
  truth('C761 Ex 2A: EQU destabilising 1.22 × (4280 + 90 × 1.5) = 5386 kNm (book 5387)', near(FR.equ.Mdst, 5386.3, 0.05), FR.equ.Mdst);
  truth('C761 Ex 2A: EQU stabilising (726 × 1.0 + 0.9 × 1296) × 3 = 5677 kNm (book)', near(FR.equ.Mstb, 5677.2, 0.05), FR.equ.Mstb);
  const eq = D2A.checks.find(c => c.id === 'equ');
  truth('C761 Ex 2A: storm from the front governs EQU, utilisation 0.949', eq.util > 0.948 && eq.util < 0.95 && /storm from the front/.test(eq.note));
  truth('C761 Ex 2A: in service, the crane\'s own weight 724 kN permanent and 44 kN variable', near(D2A.out[0].r.perm, 724, 1e-9) && near(D2A.out[0].r.vari, 44, 1e-9));
  const NC = C.design({ ...EX2A, ce: false });
  truth('not CE marked: 0.9 on the crane\'s weight', near(NC.out[2].equ.Mstb, (0.9 * 726 + 0.9 * 1296) * 3, 1e-9));
}
// ---- Example 2A: bearing, combination 1 case 1 (inferior), the jib at 5° ----
{
  const A = C.effArea(6, M1 / 2022, 5), R = C.annexD(G2A, { gphi: 1, gcu: 1 }, A.Bp, A.Lp, 2022, 1.22 * 90, A.theta);
  truth('C761 Ex 2A comb 1 case 1: M_Edx 5367, M_Edy 470 kNm; e_x 2.65, e_y 0.23 m', near(A.ex * 2022, 5367, 2) && near(A.ey * 2022, 470, 1) && near(A.ex, 2.65, 0.005) && near(A.ey, 0.23, 0.005));
  truth('C761 Ex 2A comb 1 case 1: B′ 0.691, L′ 5.54 m, A′ 3.83 m²', near(A.Bp, 0.691, 0.003) && near(A.Lp, 5.54, 0.005) && near(R.Ap, 3.83, 0.005), [A.Bp, A.Lp, R.Ap]);
  truth('C761 Ex 2A: N_q 42.92, N_γ 63.2, N_c 55.6 at φ′ 37°', near(R.Nq, 42.92, 0.005) && near(R.Ng, 63.2, 0.05) && near(R.Nc, 55.6, 0.05));
  truth('C761 Ex 2A: s_q 1.08, s_γ 0.96, m 1.89 (D.4 with H at 85° to L′: 1.883), i_q 0.90, i_c 0.898, i_γ 0.85', near(R.sq, 1.08, 0.005) && near(R.sg, 0.96, 0.005) && near(R.m, 1.89, 0.01) && near(R.iq, 0.90, 0.005) && near(R.ic, 0.898, 0.001) && near(R.ig, 0.85, 0.005), [R.sq, R.sg, R.m, R.iq, R.ic, R.ig]);
  truth('C761 Ex 2A comb 1 case 1: R_d = 6155 kN (6153), R_d/F_Ed 3.0', rel(R.R, 6155, 0.002) && near(R.R / 2022, 3.04, 0.01), R.R);
  const W = FR.comb[0].worst;
  truth('C761 Ex 2A: swept over the jib angle, the worst is the inferior case at 5° (book: by iteration, 5°)', W.tag === 'inferior' && W.beta === 5 && rel(W.Rb.R, 6155, 0.002), [W.tag, W.beta]);
  const B = D2A.checks.find(c => c.id === 'bear1');
  truth('C761 Ex 2A: combination 1 bearing governed by the storm from the front, utilisation 1/3.04', /storm from the front/.test(B.note) && near(B.util, 2022 / 6153, 0.002));
  // the 0° case is 4% less onerous (book: "the error in taking the 0 degree case would only be four per cent")
  const A0 = C.effArea(6, M1 / 2022, 0), R0 = C.annexD(G2A, { gphi: 1, gcu: 1 }, A0.Bp, A0.Lp, 2022, 109.8, A0.theta);
  truth('C761 Ex 2A: the jib along the axis gives about 4% more resistance', near(R0.R / R.R, 1.04, 0.01), R0.R / R.R);
}
// ---- Example 2A: combination 1 case 2 (superior: 1296 × 1.1 + 799 = 2224 kN) ----
{
  const V = 1.1 * (726 + 1296), A = C.effArea(6, M1 / V, 9), R = C.annexD(G2A, { gphi: 1, gcu: 1 }, A.Bp, A.Lp, V, 109.8, A.theta);
  truth('C761 Ex 2A comb 1 case 2: F_Ed 2224 kN; at 9°, e_x 0.38... e 2.42 m, B′ 1.22, L′ 5.24 m, A′ 6.39 m²', near(V, 2224.2, 0.05) && near(A.Bp, 1.22, 0.005) && near(A.Lp, 5.24, 0.005) && near(R.Ap, 6.39, 0.02), [A.Bp, A.Lp]);
  // the book carries case 1's s_q, s_γ, i_q and i_γ into case 2 (1.08, 0.96, 0.90, 0.85 give its 12018 kN); with case 2's own
  // factors R_d is 12499 kN, R_d/F_Ed 5.62 against the book's 5.4: not critical either way
  const book = R.Ap * (30 * R.Nq * 1.08 * 0.9 + 0.5 * 20 * R.B * R.Ng * 0.96 * 0.85);
  truth('C761 Ex 2A comb 1 case 2: the book\'s 12018 kN reproduced with case 1\'s factors; our own 4% higher (5.6 against 5.4)', rel(book, 12018, 0.005) && rel(R.R, 12499, 0.002) && R.R / V > 5.4, [book, R.R]);
}
// ---- Example 2A: combination 2 (γ_φ 1.25, F_Ed 2022 kN, M_Ed 4537 + 95 × 1.5 = 4680 kNm), the jib at 11° ----
{
  const A = C.effArea(6, M2 / 2022, 11), R = C.annexD(G2A, { gphi: 1.25, gcu: 1.4 }, A.Bp, A.Lp, 2022, 1.06 * 90, A.theta);
  truth('C761 Ex 2A comb 2: M_Ed 4680 kNm; at 11°, B′ 1.46, L′ 5.12 m, A′ 7.449 m²', near(M2, 4680, 0.5) && near(A.Bp, 1.46, 0.005) && near(A.Lp, 5.12, 0.005) && near(R.Ap, 7.449, 0.002), [A.Bp, A.Lp, R.Ap]);
  truth('C761 Ex 2A comb 2: R_d 6968 kN (6981), R_d/F_Ed 3.45', rel(R.R, 6968, 0.003) && near(R.R / 2022, 3.45, 0.01), R.R);
  const W = FR.comb[1].worst;
  truth('C761 Ex 2A comb 2: swept, the worst at 11° (book: 11°)', W.beta === 11 && rel(W.Rb.R, 6981, 0.001), W.beta);
}
// ---- Example 2A: sliding and the slewing torque ----
{
  const RR = D2A.out.find(R => R.r.k === 'oosRear'), S = RR.comb[0].slide;
  truth('C761 Ex 2A sliding: storm from the rear H_Ed 1.35 × 129 = 174 kN against F tan 37° (book: 2022 × 0.75 = 1524 kN; the rear case\'s own 2018 kN)', near(S.Hd, 174.15, 0.01) && near(S.util, 174.15 / (2018 * Math.tan(37 * Math.PI / 180)), 1e-9), S.util);
  const T = C.torsion(1.46, 5.12, 332, 52);
  truth('C761 Ex 2A torque: I_T = 1.46 × 5.12³/12 + 5.12 × 1.46³/12 = 17.7 m⁴, 2.66 m to the corner', near(T.Ip, 17.7, 0.05) && near(T.rc, 2.66, 0.005), [T.Ip, T.rc]);
  truth('C761 Ex 2A torque: f_T = 332/(17.7/2.66) = 49.9 kPa, H/A′ = 52/(1.46 × 5.12) = 7.0 kPa', near(T.fT, 49.9, 0.3) && near(T.fH, 7.0, 0.05), [T.fT, T.fH]);
  truth('C761 Ex 2A torque: against 2022/(1.46 × 5.12) × tan 37°/1.25 = 163 kPa', near(2022 / T.A * Math.tan(37 * Math.PI / 180) / 1.25, 163, 0.5));
  // the book pairs the in-service torque with the storm case's area and load; the engine sweeps the in-service case itself
  const I2 = D2A.out[0].comb[1].slide;
  truth('in service, combination 2: H/A′ + T r_c/I_p on the in-service case\'s own effective area, the worst angle (more onerous than the book\'s pairing)', I2.util > (49.9 + 7.0) / 163 && I2.util < 1 && near(I2.util, (I2.fH + I2.fT) / I2.tR, 1e-12), I2.util);
}
// ---- Example 2A: the prescriptive method and settlement ----
{
  const Q = FR.sls;
  truth('C761 Ex 2A presumed bearing: the worst characteristic pressure 238 kPa (the book: at 25°, 4.15 × 2.04 m; flat from 25° to 45°)', near(Q.q, 238.4, 0.6) && Q.beta >= 25 && Q.beta <= 45, [Q.q, Q.beta]);
  const A25 = C.effArea(6, 4415 / 2022, 25);
  truth('C761 Ex 2A: at 25° the rectangle is 4.15 × 2.04 m and 238 kPa', near(A25.Lp, 4.15, 0.01) && near(A25.Bp, 2.04, 0.01) && near(2022 / (A25.Bp * A25.Lp), 238, 0.6));
  truth('C761 Ex 2A: net 238 − 30 = 208 kPa against the SI\'s 200 kPa: just over (1.04)', near(Q.qc, Q.q - 30, 1e-9) && near(D2A.checks.find(c => c.id === 'sls').util, 1.044, 0.003));
  const A0 = C.effArea(6, 4415 / 2022, 0), q0 = 2022 / (A0.Bp * A0.Lp), s34 = q0 * 3.4 * Math.PI / 4 * (1 - 0.09) / 90;
  truth('C761 Ex 2A settlement: the jib along an axis, 206 kPa on 6 × 1.63 m; on the book\'s 3.4 m circle 5.6 mm', near(q0, 206, 0.6) && near(A0.Bp, 1.63, 0.005) && near(s34, 5.6, 0.05), [q0, s34]);
  truth('C761 Ex 2A tilt: 5.6/(6000 − 1630/2) = 1 in 925; with the legs ±1 mm across 1.98 m, 1 in 478', near(1 / (5.6 / 5185), 925, 3) && near(1 / (5.6 / 5185 + 2 / 1980), 478, 2));
  const T = FR.tilt;
  truth('the engine: the same at 0° on the equal-area circle (3.53 m): 5.8 mm, 1 in 470, over 1 in 500 as the book finds', T.beta === 0 && near(T.d, 3.53, 0.005) && near(T.s, 5.79, 0.02) && near(T.far, 5.183, 0.002) && near(1 / T.tilt, 470, 2) && T.util > 1, [T.beta, T.d, T.s, 1 / T.tilt]);
}
// ---- Example 2A: the base ----
{
  const B = FR.base, w = 36;
  // at 5°, the inferior case: 530 kPa over 0.69 m (Table E2A.5), the legs 2.01 m from the edge
  const A5 = C.effArea(6, M1 / 2022, 5), q5 = 2022 / (A5.Bp * A5.Lp), m5 = q5 * A5.Bp * (2.01 - A5.Bp / 2) - w * 2.01 ** 2 / 2;
  truth('C761 Ex 2A sagging at 5°: (0.69 × 530)(2.01 − 0.69/2) − 2.01²/2 × 36 = 536 kNm/m', near(q5, 528, 2) && near(m5, 536, 2), [q5, m5]);
  const A43 = C.effArea(6, M1 / 2022, 43), q43 = 2022 / (A43.Bp * A43.Lp), m43 = (q43 - w) * 2.01 ** 2 / 2;
  truth('C761 Ex 2A sagging at 43°: 2.10 × 2.37 m, 406 kPa: (406 − 36) × 2.01²/2 = 747 kNm/m', near(A43.Bp, 2.1, 0.01) && near(A43.Lp, 2.37, 0.01) && near(q43, 406, 1) && near(m43, 747, 1.5), [A43.Bp, A43.Lp, q43, m43]);
  truth('the engine sweeps the angle: the worst bottom moment 752 kNm/m at 39° (the book picks 43° by inspection)', B.bot.tag === 'inferior' && B.bot.beta === 39 && near(B.Mbot, 752.4, 0.2) && B.Mbot >= m43, [B.bot.beta, B.Mbot]);
  truth('C761 Ex 2A bottom steel: 747 × 10⁶/(435 × 0.95 × 1413) = 1280 mm²/m (ours 1290 for 752)', near(747e6 / (500 / 1.15 * 1342), 1280, 1) && rel(D2A.RB.As, 1290, 0.003) && near(D2A.RB.z, 1342, 0.5), [D2A.RB.As, D2A.RB.z]);
  truth('C761 Ex 2A minimum: 0.26 × 2.56/500 × 1000 × 1413 = 1881 mm²/m (f_ctm 2.565: 1884)', near(D2A.AsMinB, 1884, 1) && near(0.26 * 2.565 / 500 * 1000 * 1412.5, 1884, 1));
  truth('C761 Ex 2A hogging: 36 × 1.35 × 2.01²/2 = 98 kNm/m, 168 mm²/m', near(Math.max(...D2A.out.map(R => R.base.Mtop)), 98.2, 0.1) && near(D2A.RT.As, 168, 1), D2A.RT.As);
  truth('C761 Ex 2A plain concrete in hogging: f_ctd,pl h²/6 (UK NA α_ct,pl 0.6: 0.718 × 1.5²/6 = 269 kNm/m; the book 0.8, 300) > 98', D2A.topPlain && near(D2A.MRdpl, 269.3, 0.2) && near(D2A.checks.find(c => c.id === 'top').util, 98.2 / 269.3, 0.002));
  truth('C761 Ex 2A shear at d: 0.597 × (530 − 36) = 294.9 kN/m (the worst angle 8°, 531 kPa: 295.8)', near(0.597 * (530 - 36), 294.9, 0.1) && near(B.Vsh, 295.8, 0.3) && near(B.sh.q, 531, 1), [B.Vsh, B.sh.q]);
  truth('C761 Ex 2A: v_Rd,c = 0.035 k^1.5 √f_ck = 0.284 N/mm² governs (ρ 0.0014)', near(D2A.VRdc / 1412.5, 0.2826, 0.002) && near(0.035 * 1.376 ** 1.5 * 5, 0.2825, 0.001), D2A.VRdc / 1412.5);
  truth('C761 Ex 2A legs: 798.6/4 + 5222/(1.98√2) = 2065 kN down', near(B.Pleg, 2064.4, 0.2) && near(B.Fcr, 798.6, 1e-9), B.Pleg);
  truth('C761 Ex 2A legs: 726/4 − 5222/(1.98√2) = −1684 kN, and 726/4 − 5222/(2 × 1.98) = −1137 kN each of a pair', near(B.Pt1, 1683.3, 0.2) && near(B.Pt2, 2 * 1137.1, 0.5), [B.Pt1, B.Pt2]);
  const P = D2A.punch;
  truth('C761 Ex 2A punching: d = 1413 − 235 = 1178 mm; the full 2d perimeter 2π × 2 × 1178 = 14 803 mm', near(P.d, 1177.5, 1e-9) && near(P.full, 14801, 2), [P.d, P.full]);
  truth('C761 Ex 2A: 2065 × 10³/(1178 × 14 803) = 0.12 N/mm² on the full perimeter; the engine leaves out the part beyond the base\'s edges', near(2064.4e3 / (1177.5 * 14801), 0.118, 0.001) && P.u < P.full && near(P.vEd, 2064.4e3 / (P.u * 1177.5), 1e-3) && P.util < 1);
  const pl = D2A.pull;
  truth('C761 Ex 2A pull-out: d = 1115 − 50 − 25 − 12.5 = 1027.5 mm; a pair of legs round 2π × 2 × 1027.5 + 2 × 1980 = 16 871 mm', near(pl.dP, 1027.5, 1e-9) && near(2 * Math.PI * 2 * 1027.5 + 2 * 1980, 16871, 2) && near(pl.two.u, 2 * Math.PI * 2 * 1027.5 + 2 * 1980 + 4 * 1, 0.5), [pl.dP, pl.two.u]);
  truth('C761 Ex 2A pull-out: τ_cp = 1.5 × 1684 × 10³/(12 911 × 1027.5) = 0.19 N/mm² on the full perimeter; within f_ctd,pl', near(1.5 * 1683.3e3 / (12911 * 1027.5), 0.19, 0.005) && near(pl.one.tau, 1.5 * 1683.3e3 / (pl.one.u * 1027.5), 1e-3) && pl.gov.util < 1);
  truth('C761 Ex 2A: the hogging stress 98/(1.5²/6) = 0.26 N/mm² enters the principal stress', near(pl.sigT, 0.262, 0.001) && pl.one.s1 > pl.one.tau);
  truth('C761 Ex 2A final base H25@250 bottom: all base checks pass', ['bot', 'min', 'shear', 'punch', 'pull', 'top'].every(id => D2A.checks.find(c => c.id === id).util <= 1));
}
// ---- C761 Example 2B: the same base in stiff clay, c_u 120 kPa ----
const EX2B = { ...EX2A, ground: 'undrained', cu: 120, qp: 206, qpBasis: 'gross', E: 60, nu: 0.5 };
const D2B = C.design(EX2B), FB = D2B.out.find(R => R.r.k === 'oosFront'), G2B = { mode: 'undrained', g: 20, phi: 0, c: 0, cu: 120, Df: 1.5 };
{
  const A = C.effArea(6, M1 / 2022, 7), R = C.annexD(G2B, { gphi: 1, gcu: 1 }, A.Bp, A.Lp, 2022, 109.8, A.theta);
  truth('C761 Ex 2B comb 1 case 1 at 7°: L′ 5.35, B′ 0.71 m', near(A.Lp, 5.35, 0.005) && near(A.Bp, 0.71, 0.005), [A.Lp, A.Bp]);
  truth('C761 Ex 2B: R/A′ = (π + 2) c_u s_c i_c + q = 623, F_Ed/A′ 531 kPa, R_d/F_Ed 1.17', near(R.q, 623, 0.5) && near(2022 / R.Ap, 531, 0.5) && near(R.R / 2022, 1.17, 0.005), [R.q, 2022 / R.Ap]);
  const W = FB.comb[0].worst;
  truth('C761 Ex 2B comb 1: swept, the worst at 7° (book: 7°)', W.beta === 7 && W.tag === 'inferior' && near(1 / W.util, 1.173, 0.002), [W.beta, 1 / W.util]);
  const A2 = C.effArea(6, M2 / 2022, 18), R2 = C.annexD(G2B, { gphi: 1.25, gcu: 1.4 }, A2.Bp, A2.Lp, 2022, 95.4, A2.theta);
  truth('C761 Ex 2B comb 2 at 18°: 4.57 × 1.61 m (1.60), R/A′ 483 kPa, F_Ed/A′ 275 (277), 1.76 (1.74)', near(A2.Lp, 4.57, 0.005) && near(A2.Bp, 1.61, 0.015) && near(R2.q, 483, 0.5) && near(2022 / R2.Ap, 275, 2.5) && near(R2.R / 2022, 1.76, 0.02), [A2.Bp, R2.q, R2.R / 2022]);
  const W2 = FB.comb[1].worst;
  truth('C761 Ex 2B comb 2: swept, the worst at 17°–18° (flat), 1.74', W2.beta >= 17 && W2.beta <= 18 && near(1 / W2.util, 1.742, 0.002), [W2.beta, 1 / W2.util]);
  truth('C761 Ex 2B sliding comb 1: c_u A′ = 120 × 5.35 × 0.71 = 456 kN against 110 kN', near(120 * 5.35 * 0.71, 456, 0.5) && near(FB.comb[0].slide.Rs, 457, 2) && near(FB.comb[0].slide.util, 109.8 / FB.comb[0].slide.Rs, 1e-9), FB.comb[0].slide.Rs);
  truth('C761 Ex 2B sliding comb 2: (120/1.4) × 4.57 × 1.61 = 631 kN against 95 kN (the worst angle: 625)', near(120 / 1.4 * 4.57 * 1.61, 631, 0.5) && near(FB.comb[1].slide.Rs, 625, 3), FB.comb[1].slide.Rs);
  const T1 = C.torsion(1.77, 4.87, 383, 60), T2 = C.torsion(2.28, 5.21, 332, 52);
  truth('C761 Ex 2B torque comb 1: I_p 19.3 m⁴, l_c 2.59 m, Z_p 7.44 m³, 383/Z_p = 51.5 kPa', near(T1.Ip, 19.3, 0.05) && near(T1.rc, 2.59, 0.005) && near(T1.Ip / T1.rc, 7.44, 0.02) && near(T1.fT, 51.5, 0.2), [T1.Ip, T1.rc, T1.fT]);
  truth('C761 Ex 2B torque comb 2: I_p 32.0 m⁴, l_c 2.84 m, Z_p 11.26 m³, 29.5 kPa', near(T2.Ip, 32.0, 0.1) && near(T2.rc, 2.84, 0.005) && near(T2.Ip / T2.rc, 11.26, 0.03) && near(T2.fT, 29.5, 0.1), [T2.Ip, T2.rc, T2.fT]);
  // the book adds H × 1.5/A′ (10.4 kPa: the 1.5 is not a factor H needs, it is already factored) and takes the in-service
  // angle 17°; the engine adds H/A′ and sweeps: the worst is the square at 45°, still well within c_u
  const S1 = D2B.out[0].comb[0].slide;
  truth('C761 Ex 2B in service comb 1: H/A′ + T r_c/I_p on the worst angle ≤ c_u 120 kPa', S1.util < 1 && S1.util > 62 / 120 && near(S1.tR, 120, 1e-9), S1.util);
  truth('C761 Ex 2B presumed: (π + 2) × 120/3 = 206 kPa against the gross 238: the base would need to grow (1.16)', near((Math.PI + 2) * 120 / 3, 206, 0.5) && near(FB.sls.q, 238.4, 0.6) && near(D2B.checks.find(c => c.id === 'sls').util, 238.9 / 206, 0.003));
  const s45 = C.settle(238.4, 2.912 ** 2, 60, 0.5), s0 = C.settle(206.4, 1.633 * 6, 60, 0.5);
  truth('C761 Ex 2B settlement at 45°: 2.91 m square ≈ a 3.3 m circle, 238 × 3.3 × π/4 × 0.75/60 000 = 8 mm', near(s45.d, 3.3, 0.02) && near(s45.s, 7.7, 0.05), [s45.d, s45.s]);
  truth('C761 Ex 2B settlement along an axis: 6 × 1.63 m ≈ a 3.5 m circle, 7 mm; 1 in 740, and 1 in 420 with the legs ±1 mm', near(s0.d, 3.53, 0.01) && near(s0.s, 7.16, 0.03) && near(5183.5 / s0.s, 724, 5) && near(1 / (s0.s / 5183.5 + 2 / 1980), 418, 3), [s0.d, s0.s]);
  truth('C761 Ex 2B: the engine finds the axis worse than the diagonal and over 1 in 500: refer to the crane maker (as the book)', FB.tilt.beta === 0 && FB.tilt.util > 1 && near(1 / FB.tilt.tilt, 418, 2), [FB.tilt.beta, 1 / FB.tilt.tilt]);
}
// ---- C761 Example 1: a single pad of the cruciform, undrained ----
const EX1 = { L: 1.75, h: 0.9, gc: 24, Gc: 0, ground: 'undrained', gs: 20, cu: 100, Df: 0.45, fck: 30, cB: 50, cT: 50, phiB: 16, sB: 200, phiT: 12, sT: 200, s: 0.8, a: 200, tp: 600, cases: [{ k: 'ins', M: 0, H: 29.0, F: 500, T: 0 }] };
{
  const D = C.design(EX1), c2 = D.out[0].comb[1];
  const A = C.effArea(1.75, 33.93 / 716.15, 'diag'), R = C.annexD({ mode: 'undrained', g: 20, phi: 0, c: 0, cu: 100, Df: 0.45 }, { gphi: 1.25, gcu: 1.4 }, A.Bp, A.Lp, 716.15, 1.3 * 29, A.theta);
  truth('C761 Ex 1: G_k = 1.75² × 0.9 × 24 = 66.2 kN', near(D.Gb, 66.15, 1e-9));
  truth('C761 Ex 1: F_d2 = 1.3 × 500 + 1.0 × 66.2 = 716 kN, M_d2 = 1.3 × 29 × 0.9 = 33.93 kNm', near(c2.worst.V, 716.15, 1e-9) && near(c2.worst.Md, 33.93, 1e-9));
  truth('C761 Ex 1: the diagonal, e = M sin 45°/F = 0.034 m each way, L′ = 1.68 m, A′ = 2.83 m²', near(A.ex, 0.034, 0.0005) && near(A.Bp, 1.683, 0.001) && near(R.Ap, 2.83, 0.005), [A.ex, A.Bp]);
  truth('C761 Ex 1: s_c 1.2, i_c 0.951, c_u,d 71.4 kPa, q 9 kPa', near(R.sc, 1.2, 1e-12) && near(R.ic, 0.951, 0.001) && near(R.cud, 71.43, 0.01) && near(R.q0, 9, 1e-9));
  truth('C761 Ex 1: R_d2 = A′((π + 2) c_u,d s_c i_c + q) = 1211 kN (book; 1213 unrounded)', rel(R.R, 1211, 0.002), R.R);
  truth('C761 Ex 1: the engine\'s sweep finds no angle worse than the book\'s diagonal by more than the rounding', c2.worst.util >= 716.15 / R.R - 1e-12 && c2.worst.util < 716.15 / R.R * 1.01, [c2.worst.beta, c2.worst.util]);
}
// ---- the partial factor tables ----
{
  const T = C.CASES;
  truth('C761 Table A3.2: in service 1.35/1.5 and 1.0/1.3; storm from the front free 1.1/1.22 and 1.0/1.06', T.ins.A32[0][0] === 1.35 && T.ins.A32[0][1] === 1.5 && T.ins.A32[1][1] === 1.3 && T.oosFront.A32[0][0] === 1.1 && T.oosFront.A32[0][1] === 1.22 && T.oosFront.A32[1][1] === 1.06);
  truth('C761 Table A3.3: in service 1.35/1.35 and 1.0/1.17; storm from the rear 1.22/1.22, 1.0/1.06', T.ins.A33[0][1] === 1.35 && T.ins.A33[1][1] === 1.17 && T.oosRear.A33[0][1] === 1.22 && T.oosRear.A33[1][1] === 1.06);
  const D = C.design({ ...EX2A, dyn: true });
  truth('loads with dynamic effects: EQU at 1.10 for the storm from the front', near(D.out[2].equ.Mdst, 1.1 * (4280 + 135), 1e-9));
}
// ---- Annex D drained, the effective areas, the perimeter on the base ----
{
  const ax = C.effArea(6, 1, 'axis'), dg = C.effArea(6, 1, 'diag'), b30 = C.effArea(6, 1, 30);
  truth('effective area: (L − 2e) × L along an axis, (L − √2 e)² on the diagonal, (L − 2e cos β)(L − 2e sin β) between', near(ax.Bp, 4, 1e-12) && near(ax.Lp, 6, 1e-12) && near(dg.Bp, 6 - Math.SQRT2, 1e-12) && near(dg.Lp, 6 - Math.SQRT2, 1e-12) && near(b30.Bp, 6 - Math.sqrt(3), 1e-12) && near(b30.Lp, 5, 1e-12));
  const G = { mode: 'drained', g: 19, phi: 35 * Math.PI / 180, c: 0, Df: 1 }, R = C.annexD(G, { gphi: 1.25, gcu: 1.4 }, 4, 6, 2000, 100, Math.PI / 2);
  const phi = Math.atan(Math.tan(35 * Math.PI / 180) / 1.25), t = Math.tan(phi), Nq = Math.exp(Math.PI * t) * Math.tan(Math.PI / 4 + phi / 2) ** 2, Ng = 2 * (Nq - 1) * t;
  const m = (2 + 4 / 6) / (1 + 4 / 6), iq = (1 - 100 / 2000) ** m, ig = (1 - 100 / 2000) ** (m + 1), sq = 1 + 4 / 6 * Math.sin(phi), sg = 1 - 0.3 * 4 / 6;
  truth('Annex D drained: q′N_q s_q i_q + ½γB′N_γ s_γ i_γ, m_B for H along B′', rel(R.q, 19 * Nq * sq * iq + 0.5 * 19 * 4 * Ng * sg * ig, 1e-12), R.q);
  truth('perimeter round a square foot: 4a_f + 2πa in full; a quarter of it in a corner', rel(C.perimInside(0, 0, 0.4, 1, 10), 1.6 + 2 * Math.PI, 1e-3) && rel(C.perimInside(5, 5, 0, 1, 10), Math.PI / 2, 2e-3));
}
// ---- the refusals ----
truth('refuses: no load cases', throws(() => C.design({ ...EX2A, cases: [] }), /at least one load case/));
truth('refuses: legs that do not fit', throws(() => C.design({ ...EX2A, s: 6 }), /do not fit/));
truth('refuses: undrained without c_u', throws(() => C.design({ ...EX1, cu: 0 }), /c_u,k/));
truth('refuses: no F', throws(() => C.design({ ...EX2A, cases: [{ k: 'ins', M: 100, H: 1 }] }), /F/));
truth('refuses: the compression going in below the bottom steel', throws(() => C.design({ ...EX2A, tc: 1450 }), /below the bottom steel/));
truth('refuses: the foot plate below the bottom steel', throws(() => C.design({ ...EX2A, tp: 1480 }), /foot plate is below/));
truth('refuses: ν over 0.5', throws(() => C.design({ ...EX2A, nu: 0.6 }), /Poisson/));
truth('no E: no settlement check', !C.design({ ...EX2A, E: 0 }).checks.some(c => c.id === 'tilt'));

console.log(`\n${pass}/${pass + fail} passed`); if (fail) process.exit(1);
