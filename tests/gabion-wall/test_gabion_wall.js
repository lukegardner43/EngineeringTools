// Gabion Retaining Wall engine: the published gabion design example (a 3.1 m wall of four 27-system courses leaning back 10°
// on limestone fill, retaining a 15° slope with a 10 kN/m² surcharge: K_a 0.364, the thrust and its height, its components,
// the weight, sliding 1.87, overturning 2.69, eccentricity 0.14 m), Coulomb against Rankine and the tabulated value for
// δ = ⅔φ′, a single upright course by hand statics, the bearing pressure distribution, the EC7 partial factors, Annex D
// (drained and undrained) from its formulae, the course joints, and the refusals and warnings.
//   node tests/gabion-wall/test_gabion_wall.js
const { GabionWall: G } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol, rel = (a, b, r) => Math.abs(a - b) <= r * Math.abs(b);
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

// ---- the published design example (factors of safety) ----
// Courses bottom up: 1.7 × 1.0, 1.4 × 0.7, 1.0 × 0.7 at 0.4, 0.7 × 0.7 at 0.7 (front offsets); α 10°; γ_g 16 (limestone);
// retained soil γ 19, φ′ 28°, δ = φ′ (no geotextile), slope 15°, surcharge 10 kN/m²; founding soil φ′ 30°.
const EX = { basis: 'fos', alpha: 10, fill: 16, courses: [{ w: 1.7, h: 1 }, { w: 1.4, h: 0.7, off: 0 }, { w: 1.0, h: 0.7, off: 0.4 }, { w: 0.7, h: 0.7, off: 0.7 }],
  g: 19, phi: 28, eps: 15, kd: 1, gf: 19, phif: 30, qQ: 10, D: 0.5, qa: 0 };
{
  const D = G.design(EX), P = D.base.K;
  truth('example: W_g = 3.87 m² × 16 = 61.92 kN/m', near(P.A, 3.87, 1e-9) && near(P.W, 61.92, 1e-9), P.W);
  // the book's table takes course 3's centre at 0.8 m from the toe; offset 0.4 + 1.0/2 puts it at 0.9 m (x̄ 0.846, not 0.83)
  truth('example: centroid upright x̄ = (1.7×0.85 + 0.98×0.7 + 0.7×0.9 + 0.49×1.05)/3.87, ȳ 1.28 m (book)', near(P.xg, 3.2755 / 3.87, 1e-9) && near(P.yg, 4.9555 / 3.87, 1e-9) && near(P.yg, 1.28, 0.005), [P.xg, P.yg]);
  truth('example: X_g = x̄ cos 10° + ȳ sin 10°', near(P.Xg, P.xg * Math.cos(rad(10)) + P.yg * Math.sin(rad(10)), 1e-9));
  truth('example: top of the back (1.92, 2.81), heel (1.67, −0.30) m, as the book', near(P.tr[0], 1.92, 0.005) && near(P.tr[1], 2.81, 0.005) && near(P.heel[0], 1.67, 0.005) && near(P.heel[1], -0.30, 0.006), [P.tr, P.heel]);
  truth('example: effective slope of the back β = 94.46° (book)', near(deg(P.bc), 94.46, 0.02), deg(P.bc));
  truth('example: K_a = 0.364 (book)', near(P.Ka, 0.364, 0.0005), P.Ka);
  // the book squares H = 3.10; the plane's height is 3.105 m
  truth('example: P_a,soil = ½ K_a γ H′², H′ 3.105 m; book 33.23 with H 3.10 (within 0.5%)', near(P.Heff, 3.105, 0.001) && near(P.Ps, 0.5 * P.Ka * 19 * P.Heff ** 2, 1e-9) && rel(P.Ps, 33.23, 0.005), [P.Heff, P.Ps]);
  // a surcharge on a slope: an extra depth q/γ above it gives K_a q H′ cos ε sin β / sin(β + ε); the book uses K_a q H (11.28)
  const f = Math.cos(rad(15)) * Math.sin(P.bc) / Math.sin(P.bc + rad(15));
  truth('example: P_a,surcharge = K_a q H′ cos ε sin β / sin(β + ε), f 1.021; book K_a q H 11.28 (within 2.5%)', near(P.f, f, 1e-12) && near(f, 1.021, 0.001) && near(P.PqQ, P.Ka * 10 * P.Heff * f, 1e-9) && rel(P.PqQ, 11.28, 0.025), [P.PqQ, f]);
  truth('example: P_a 44.90 against the book 44.51 (within 1%)', rel(P.Pa, 44.51, 0.01) && near(P.Pa, P.Ps + P.PqQ, 1e-9), P.Pa);
  const hs = 10 / 19, dEq = hs * f;
  truth('example: d_h,soil = H/3 (H + 3h_s)/(H + 2h_s) = 1.164 m above the heel (book; with the slope factor on h_s)', near(P.dh, P.Heff / 3 * (P.Heff + 3 * dEq) / (P.Heff + 2 * dEq), 1e-9) && near(P.dh, 1.164, 0.005), P.dh);
  truth('example: d_h = d_h,soil − b_w sin α = 0.87 m above the toe (book)', near(P.YP, P.dh - 1.7 * Math.sin(rad(10)), 1e-9) && near(P.YP, 0.87, 0.005), P.YP);
  truth('example: P_h = P_a cos(90° − β + δ), P_v = P_a sin(…): 40.81 and 17.77 (book, within 1%)', near(P.Ph, P.Pa * Math.cos(rad(90 + 28) - P.bc), 1e-9) && near(P.Pv, P.Pa * Math.sin(rad(90 + 28) - P.bc), 1e-9) && rel(P.Ph, 40.81, 0.01) && rel(P.Pv, 17.77, 0.01), [P.Ph, P.Pv]);
  truth('example: P_v at b_v = b_w cos α − d_h,soil / tan β from the toe (1.77 m; the book works it with d_h, 1.74)', near(P.XP, 1.7 * Math.cos(rad(10)) - P.dh / Math.tan(P.bc), 1e-9) && near(P.XP, 1.765, 0.003), P.XP);
  truth('example: N = W_g + P_v 79.69 kN/m (book, within 0.5%)', rel(P.W + P.Pv, 79.69, 0.005), P.W + P.Pv);
  const Nv = P.W + P.Pv, T = P.Ph, a = rad(10), Fs = (Nv * Math.cos(a) + T * Math.sin(a)) * Math.tan(rad(30)) / (T * Math.cos(a) - Nv * Math.sin(a));
  truth('example: sliding F_s = (N cos α + T sin α) tan φ′ / (T cos α − N sin α) = 1.87 (book)', near(D.ext.Fs, Fs, 1e-9) && near(D.ext.Fs, 1.87, 0.02), D.ext.Fs);
  truth('example: overturning F_o = M_r / M_o = 2.69 (book; within 0.5%)', near(D.ext.Fo, (P.Pv * P.XP + P.W * P.Xg) / (P.Ph * P.YP), 1e-9) && rel(D.ext.Fo, 2.69, 0.005), D.ext.Fo);
  truth('example: the book\'s own numbers: M_r = 17.77 × 1.74 + 61.92 × 1.04 = 95.32, M_o = 40.81 × 0.87 = 35.50', near(17.77 * 1.74 + 61.92 * 1.04, 95.32, 0.01) && near(40.81 * 0.87, 35.50, 0.01));
  truth('example: e = B/2 − (M_r − M_o)/N with N normal to the base = 0.14 m (book), inside B/6 0.28', near(P.e, 0.85 - (P.Mstb - P.Mdst) / P.N, 1e-9) && near(P.e, 0.14, 0.005) && D.checks.find(c => c.id === 'mid').util < 1, P.e);
  truth('example: N normal to the base = (W + P_v) cos α + P_h sin α', near(P.N, Nv * Math.cos(a) + T * Math.sin(a), 1e-9) && near(P.T, T * Math.cos(a) - Nv * Math.sin(a), 1e-9));
  truth('example: toe and heel pressure N/B (1 ± 6e/B) (75.0 / 25.9; the book\'s 67 / 22.3 do not follow from its N and e)', near(P.p.toe, P.N / 1.7 * (1 + 6 * P.e / 1.7), 1e-9) && near(P.p.heel, P.N / 1.7 * (1 - 6 * P.e / 1.7), 1e-9) && near((P.p.toe + P.p.heel) / 2 * 1.7, P.N, 1e-9), [P.p.toe, P.p.heel]);
  truth('example: passes by factors of safety; no allowable given, so a note', D.utilMax < 1 && D.warnings.some(w => /allowable/.test(w)), D.utilMax);
  // the course joints: the resultant falls behind the middle at every joint, as the book's software reports
  truth('example: three joints, the resultant toward the heel at each (e < 0)', D.joints.length === 3 && D.joints.every(J => J.K.e < 0), D.joints.map(J => J.K.e));
  const top = G.design({ ...EX, courses: [{ w: 0.7, h: 0.7 }] }).base.K, J3 = D.joints[2];
  truth('joint under the top course = the top course alone as a wall (same thrust and statics)', near(J3.K.Pa, top.Pa, 1e-9) && near(J3.K.Mstb, top.Mstb, 1e-9) && near(J3.K.e, top.e, 1e-9));
  truth('joint sliding at 35° gabion on gabion: F_s = N tan 35° / T', near(J3.Fs, J3.K.N * Math.tan(rad(35)) / J3.K.T, 1e-9));
}

// ---- Coulomb ----
{
  truth('Coulomb, upright wall, level ground, δ 0: Rankine tan²(45° − φ/2) = 1/3 at 30°', near(G.coulomb(rad(30), 0, rad(90), 0), 1 / 3, 1e-12));
  truth('Coulomb, φ′ 30°, δ 20°, upright, level: 0.297 (tables)', near(G.coulomb(rad(30), rad(20), rad(90), 0), 0.297, 0.0005), G.coulomb(rad(30), rad(20), rad(90), 0));
  truth('Coulomb, δ 0, level ground, slope steeper than φ takes the limit (finite)', Number.isFinite(G.coulomb(rad(25), rad(25), rad(90), rad(30))));
  truth('Coulomb: leaning back into the soil lowers K_a', G.coulomb(rad(30), rad(30), rad(100), 0) < G.coulomb(rad(30), rad(30), rad(90), 0));
}
// ---- one upright course by hand ----
{
  const D = G.design({ basis: 'fos', alpha: 0, fill: 16, courses: [{ w: 1, h: 1 }], g: 18, phi: 30, eps: 0, kd: 0, gf: 18, phif: 30, D: 0.3 }), P = D.base.K;
  const Ka = 1 / 3, Ph = 0.5 * Ka * 18;
  truth('1 × 1 upright, smooth: P_a = ½ K_a γ H² = 3.0 kN/m, horizontal, at H/3', near(P.Pa, Ph, 1e-9) && near(P.Ph, Ph, 1e-9) && near(P.Pv, 0, 1e-12) && near(P.YP, 1 / 3, 1e-9));
  truth('1 × 1 upright: F_o = 16 × 0.5 / (3 × 1/3) = 8.0', near(D.ext.Fo, 8, 1e-9), D.ext.Fo);
  truth('1 × 1 upright: F_s = 16 tan 30° / 3 = 3.079', near(D.ext.Fs, 16 * Math.tan(rad(30)) / 3, 1e-9), D.ext.Fs);
  truth('1 × 1 upright: s = (8 − 1)/16 m, e = 0.5 − s', near(P.e, 0.5 - 7 / 16, 1e-9), P.e);
}
// ---- the bearing pressure distribution ----
{
  const a = G.pressures(100, 2, 1), b = G.pressures(100, 2, 0.5), c = G.pressures(100, 2, 1.6);
  truth('pressures: central load 50 / 50', near(a.toe, 50, 1e-9) && near(a.heel, 50, 1e-9));
  truth('pressures: e 0.5 > B/6 toward the toe: triangle 2N/3s = 133.3 over 1.5 m', near(b.toe, 200 / 1.5, 1e-9) && b.heel === 0 && near(b.len, 1.5, 1e-9));
  truth('pressures: toward the heel: 2N/3(B − s) at the heel', near(c.heel, 200 / 1.2, 1e-9) && c.toe === 0);
  truth('pressures: resultant outside the base: unbounded', !Number.isFinite(G.pressures(100, 2, -0.1).toe));
}
// ---- EC7: partial factors ----
const DEFW = { basis: 'ec7', alpha: 6, fill: 16, courses: [{ w: 2, h: 1 }, { w: 1.5, h: 1, off: 0.5 }, { w: 1, h: 1, off: 1 }], g: 19, phi: 30, eps: 0, kd: 1, gf: 19, phif: 32, qQ: 10, D: 0.5, qa: 150 };   // the page's default wall
{
  const D = G.design({ ...DEFW, qG: 5 }), B = D.base, pd = Math.atan(Math.tan(rad(30)) / 1.25);
  truth('EC7: DA1-1 thrust 1.35 × (soil + permanent surcharge) + 1.5 × variable', near(B.C1s.Pa, 1.35 * (B.K.Ps + B.K.PqG) + 1.5 * B.K.PqQ, 1e-9));
  truth('EC7: DA1-2 at φ′_d = atan(tan 30°/1.25) = 24.79°, variable × 1.3', near(B.C2.phi, pd, 1e-12) && near(B.C2.Pa, B.C2.Ps + B.C2.PqG + 1.3 * B.C2.PqQ, 1e-9) && B.C2.Ka > B.K.Ka);
  truth('EC7: EQU weight × 0.9, thrust × 1.1, variable × 1.5, φ′_d as DA1-2', near(B.EQU.Wd, 0.9 * B.K.W, 1e-9) && near(B.EQU.Pa, 1.1 * (B.C2.Ps + B.C2.PqG) + 1.5 * B.C2.PqQ, 1e-9));
  truth('EC7: bearing in DA1-1 also with the weight × 1.35', near(B.C1a.Wd, 1.35 * B.K.W, 1e-9));
  const s2 = D.checks.find(c => c.id === 'slideC2');
  truth('EC7: sliding DA1-2 = T / (N tan(φ′_d of the founding soil))', near(s2.util, B.C2.T / (B.C2.N * Math.tan(Math.atan(Math.tan(rad(32)) / 1.25))), 1e-9), s2.util);
  const eq = D.checks.find(c => c.id === 'equ');
  truth('EC7: overturning EQU = M_dst / M_stb about the toe', near(eq.util, B.EQU.Mdst / B.EQU.Mstb, 1e-9));
  const D0 = G.design(DEFW);
  truth('EC7: the default wall passes (utilisation 0.631, sliding DA1-2 governs), its back plane leaning back with no notes', D0.base.K.psi > 0 && !D0.warnings.length && near(D0.utilMax, 0.631, 0.0005) && [...D0.checks].sort((a, b) => b.util - a.util)[0].id === 'slideC2', D0.utilMax);
  // Annex D, drained, from its formulae with the reported B′ and the loads normal and along the base
  const g = D.ext.bear2, P = B[g.key], phi = Math.atan(Math.tan(rad(32)) / 1.25), t = Math.tan(phi), Bp = 2 - 2 * Math.abs(P.e);
  const Nq = Math.exp(Math.PI * t) * Math.tan(Math.PI / 4 + phi / 2) ** 2, Ng = 2 * (Nq - 1) * t, r = 1 - Math.abs(P.T) / P.N, bq = (1 - rad(6) * t) ** 2;
  const qRd = 19 * 0.5 * Nq * bq * r * r + 0.5 * 19 * Bp * Ng * bq * r ** 3;
  truth('Annex D drained (DA1-2): q_Rd = q′N_q b_q i_q + ½γ′B′N_γ b_γ i_γ, i_q = (1 − H/V)², i_γ = (1 − H/V)³, b = (1 − α tan φ′)²', near(g.b.R.q, qRd, 1e-9) && near(g.b.Bp, Bp, 1e-12) && near(g.b.util, P.N / Bp / qRd, 1e-9), [g.b.R.q, qRd]);
  truth('Annex D: N_q 18.40 and N_γ 20.09 at 30° (EC7 values)', (() => { const t3 = Math.tan(rad(30)), nq = Math.exp(Math.PI * t3) * Math.tan(rad(60)) ** 2; return near(nq, 18.40, 0.005) && near(2 * (nq - 1) * t3, 20.09, 0.005); })());
  const U = G.design({ ...DEFW, bearing: 'undrained', cuf: 60 }), gu = U.ext.bear2, Pu = U.base[gu.key], cud = 60 / 1.4, Bu = 2 - 2 * Math.abs(Pu.e);
  const ic = 0.5 * (1 + Math.sqrt(1 - Math.abs(Pu.T) / (Bu * cud))), bc = 1 - 2 * rad(6) / (Math.PI + 2);
  truth('Annex D undrained: (π + 2) c_u,d b_c i_c + q, b_c = 1 − 2α/(π + 2)', near(gu.b.R.q, (Math.PI + 2) * cud * bc * ic + 19 * 0.5, 1e-9), [gu.b.R.q]);
  const su = U.checks.find(c => c.id === 'slideC2');
  truth('undrained sliding: B′ c_u,d', near(su.util, U.base.C2.T / ((2 - 2 * Math.abs(U.base.C2.e)) * cud), 1e-9));
  truth('EC7 joints: sliding and EQU at each, with 35° factored in DA1-2', D.joints.length === 2 && D.checks.some(c => c.id === 'jslide') && D.checks.some(c => c.id === 'jot') && near(D.joints[0].slide.key === 'C2' ? D.joints[0].slide.R.ang : 35, D.joints[0].slide.key === 'C2' ? deg(Math.atan(Math.tan(rad(35)) / 1.25)) : 35, 1e-9));
  const N = G.design({ ...DEFW, qa: 0 });
  truth('EC7: no allowable pressure, no toe pressure check and no note', !N.checks.some(c => c.id === 'qa') && !N.warnings.some(w => /allowable/.test(w)));
  const tight = G.design({ ...DEFW, qa: 40 });
  truth('allowable pressure 40 kPa exceeded', tight.checks.find(c => c.id === 'qa').util > 1);
}
// ---- the wall leaning forward, shallow toe, steep lean ----
{
  const F = G.design({ ...DEFW, alpha: 0, courses: [{ w: 2, h: 1 }, { w: 1.5, h: 1, off: 0 }, { w: 1, h: 1, off: 0 }], D: 0.2 });
  truth('back stepped, upright: the back plane leans forward, with a note; shallow toe noted', F.base.K.psi < 0 && F.warnings.some(w => /leans forward/.test(w)) && F.warnings.some(w => /0\.3 to 0\.5 m/.test(w)));
  truth('lean beyond 10°: noted', G.design({ ...DEFW, alpha: 12 }).warnings.some(w => /10° for the 27 system/.test(w)));
  truth('geotextile: δ = 0.9 φ′', near(G.design({ ...DEFW, kd: 0.9 }).base.K.delta, 0.9 * rad(30), 1e-12));
  truth('base friction ⅔φ′ reduces the sliding resistance', G.design({ ...DEFW, kb: 0.667 }).checks.find(c => c.id === 'slideC2').util > G.design(DEFW).checks.find(c => c.id === 'slideC2').util);
}
// ---- refusals ----
truth('refuses: no courses', throws(() => G.design({ ...DEFW, courses: [] }), /at least one course/));
truth('refuses: a course overhanging the front', throws(() => G.design({ ...DEFW, courses: [{ w: 2, h: 1 }, { w: 1.5, h: 1, off: 0.25 }, { w: 1, h: 1, off: 0.1 }] }), /Course 3 overhangs the front of course 2/));
truth('refuses: a course overhanging the back', throws(() => G.design({ ...DEFW, courses: [{ w: 2, h: 1 }, { w: 1.5, h: 1, off: 0.6 }] }), /overhangs the back/));
truth('refuses: ground slope at or above φ′', throws(() => G.design({ ...DEFW, eps: 30 }), /slope more steeply/));
truth('refuses: undrained without c_u', throws(() => G.design({ ...DEFW, bearing: 'undrained' }), /c_u,k/));
truth('refuses: lean over 20°', throws(() => G.design({ ...DEFW, alpha: 25 }), /up to 20°/));
truth('refuses: a blank width', throws(() => G.design({ ...DEFW, courses: [{ w: NaN, h: 1 }] }), /Course 1 width/));
truth('refuses: δ more than φ′', throws(() => G.design({ ...DEFW, kd: 1.2 }), /δ/));

console.log(`\n${pass}/${pass + fail} passed`); if (fail) process.exit(1);
