// Glulam Beams: P&K example 6.7.3 (a single tapered GL28h beam, 150 × 320–750 mm over 9 m, braced at 3 m) and 6.7.4 (a
// curved GL32h beam, 175 × 960 mm over 18 m, β 9°, r_in 18 m, 30 mm laminations); a double tapered and a pitched cambered
// beam against hand calculation (EC5 6.4.2, 6.4.3 and P&K Table 6.6); the profiles; the self-weight; input errors.
// The book (2007) predates EN 1995-1-1 A1 (k_cr 0.67 in shear, l_ef and k_c,90 1.75 in bearing for glulam) and quotes the
// EN 1194 strengths, which the tests pass in as declared values. Where the tool follows A1 the test checks its own
// arithmetic and says so.
const { EC5, GlulamBeam: G } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol = 1e-9) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };
const BOOK = 0.005, DEG = Math.PI / 180;   // book values to their printed rounding (about 0.5 %)
const ck = (D, id) => D.checks.find(c => c.id === id);
const comb = (D, nm) => D.combos.find(x => x.c.name === nm);

// ---------- the EC5 core for glulam and declared products ----------
{ const M = EC5.material({ family: 'glulam', cls: 'GL24h' });
  [['f_m,k', M.fmk, 24], ['f_t,90,k', M.ft90k, 0.5], ['f_c,90,k', M.fc90k, 2.5], ['f_v,k', M.fvk, 3.5], ['E_0,mean', M.E0mean, 11500], ['γ_M', M.gM, 1.25], ['k_cr', M.kcr, 0.67]].forEach(([k, g, e]) => near(`GL24h ${k}`, g, e)); }
{ const P = EC5.material({ family: 'other', props: { name: 'x', kind: 'glulam', fmk: 28, ft90k: 0.45, fc0k: 26.5, fc90k: 3, fvk: 3.2, E0mean: 12600, E005: 10200, Gmean: 780, G005: 640, rhomean: 492 } });
  truth('a declared glulam product: glulam, softwood', P.kind === 'glulam' && P.softwood); near('… γ_M 1.25 by default', P.gM, 1.25); near('… k_cr 0.67 by default', P.kcr, 0.67); }
{ const P = EC5.material({ family: 'other', props: { name: 'LVL', fmk: 44, fvk: 4.1, fc90k: 6, E0mean: 13800, E005: 11600, Gmean: 600, G005: 400, rhomean: 510 } });
  truth('a declared product otherwise: LVL', P.kind === 'lvl' && !P.softwood); near('… γ_M 1.2', P.gM, 1.2); near('… k_cr 1', P.kcr, 1); }

// ---------- P&K 6.7.3: single tapered beam ----------
const GL28 = { family: 'other', props: { name: 'GL28h (EN 1194)', kind: 'glulam', fmk: 28, ft90k: 0.45, fc0k: 26.5, fc90k: 3.0, fvk: 3.2, E0mean: 12600, E005: 10200, Gmean: 780, G005: 637.5, rhomean: 492, gM: 1.25 } };
{ // G 1.65 kN/m + the book's self-weight 0.54 (b h_max g ρ_m, taken uniform), Q 2.25 kN/m roof (short term)
  const D = G.design({ mat: GL28, sc: 1, shape: 'single', b: 150, L: 9, hs: 320, h1: 750, lb: 150, sw: false, cat: 'H', loads: [{ case: 'G', form: 'line', w: 1.65 + 0.15 * 0.75 * 9.81 * 492 / 1000 }, { case: 'Q', form: 'line', w: 2.25 }], restraint: { mode: 'lef', lef: 3 } });
  const B = D.govern.B.bend, C = comb(D, '1.35G + 1.5Q');
  near('6.7.3 tan α', Math.tan(D.P.alpha), (750 - 320) / 9000);
  near('6.7.3 position of the greatest stress x = 2.69 m', B.x / 1000, 2.69, 0.01);
  near('6.7.3 W_y there 5.03 × 10⁶ mm³', B.W / 1e6, 5.03, BOOK);
  near('6.7.3 σ_m,d 10.69 N/mm²', B.sig, 10.69, BOOK);
  near('6.7.3 f_m,d 20.16 N/mm²', C.fmd, 20.16, BOOK);
  near('6.7.3 f_v,d 2.3 N/mm²', C.fvd, 2.304, BOOK); near('6.7.3 f_c,90,d 2.16 N/mm²', C.fc90d, 2.16, BOOK);
  near('6.7.3 k_m,α 0.96 (6.40, the compression face)', B.kmA, 0.963, BOOK);
  near('6.7.3 σ_m,crit 74.89 N/mm² (G_0,05 637.5, on the greatest depth)', D.ltb.top.scrit, 74.89, BOOK);
  near('6.7.3 λ_rel,m 0.6', D.ltb.top.lam, 0.611, 0.01); near('6.7.3 k_crit 1', D.ltb.top.k, 1);
  near('6.7.3 k_crit k_m,α f_m,d 19.42 N/mm²', B.cap, 19.42, BOOK);
  near('6.7.3 V_d 28.51 kN', D.govern.S.shear.V / 1000, 28.51, BOOK);
  near('6.7.3 τ_d: the book’s 0.89 N/mm² over k_cr 0.67 (A1)', D.govern.S.shear.tau, 0.89 / 0.67, BOOK);
  near('6.7.3 bearing (A1: l_ef 180 mm, k_c,90 1.75; the book 1.27 on 150 mm)', ck(D, 'bearing').util, 28.51e3 / (150 * 180) / (1.75 * 2.16), BOOK);
  // mid-span deflections: the book's bending 8.80 + shear 0.46 (G), 9.03 + 0.48 (Q); u_inst 18.77, u_net,fin 24.33 mm
  const mid = D.xs.indexOf(4500), yG = D.defs.G.E.y[mid], yQ = D.defs.Q.E.y[mid];
  truth('6.7.3 a section at mid-span', mid > 0);
  near('6.7.3 u_inst,G at mid-span 8.80 + 0.46 mm', yG, 9.26, BOOK); near('6.7.3 u_inst,Q at mid-span 9.03 + 0.48 mm', yQ, 9.51, BOOK);
  near('6.7.3 u_inst at mid-span 18.77 mm', yG + yQ, 18.77, BOOK); near('6.7.3 u_net,fin at mid-span 24.33 mm (k_def 0.6, ψ₂ 0)', yG * 1.6 + yQ, 24.33, BOOK);
  truth('6.7.3 the tool reports the greatest deflection, off mid-span', D.D.inst >= yG + yQ && D.D.uG > yG);
  near('6.7.3 w_inst limit L/300 30 mm', ck(D, 'winst').util * 30, D.D.inst); near('6.7.3 w_net,fin limit L/250 36 mm', ck(D, 'wfin').util * 36, D.D.fin);
  truth('6.7.3 passes', D.utilMax < 1 && !D.AP);
}

// ---------- P&K 6.7.4: curved beam ----------
const GL32 = { family: 'other', props: { name: 'GL32h (EN 1194)', kind: 'glulam', fmk: 32, ft90k: 0.5, fc0k: 29, fc90k: 3.3, fvk: 3.8, E0mean: 13700, E005: 11100, Gmean: 850, G005: 708, rhomean: 516, gM: 1.25 } };
{ // the design action 6 kN/m including the self-weight: Q 4 kN/m roof × 1.5
  const D = G.design({ mat: GL32, sc: 2, shape: 'curved', b: 175, L: 18, h: 960, beta: 9, rin: 18, t: 30, lb: 200, sw: false, cat: 'H', loads: [{ case: 'Q', form: 'line', w: 4 }], restraint: { mode: 'top' } });
  const A = D.AP, C = comb(D, '1.35G + 1.5Q');
  near('6.7.4 k_l (k_curve,b) 1.02', A.kl, 1.02, BOOK); near('6.7.4 k_p (k_curve,t) 0.01', A.kp, 0.25 * 960 / (18000 + 480), 1e-9);
  near('6.7.4 apex volume V 0.98 m³', A.Vst / 1e9, 0.98, BOOK); near('6.7.4 beam volume V_b 3.05 m³', A.Vb / 1e9, 3.05, BOOK);
  near('6.7.4 V/V_b 0.32', A.Vst / A.Vb, 0.32, 0.01); near('6.7.4 k_vol 0.4', A.kvol, 0.4, BOOK); near('6.7.4 k_dis 1.4', A.kdis, 1.4);
  near('6.7.4 k_r 1 (r_in/t 600)', A.kr, 1); near('6.7.4 W_y 2.69 × 10⁷ mm³', A.W / 1e7, 2.69, BOOK);
  near('6.7.4 M_d 2.43 × 10⁸ N mm', C.apex.Map / 1e8, 2.43, BOOK);
  near('6.7.4 σ_m,0,d 9.22 N/mm²', C.apex.sm, 9.22, BOOK); near('6.7.4 f_m,d 23.04 N/mm²', C.fmd, 23.04, BOOK);
  near('6.7.4 σ_t,90,d 0.12 N/mm²', C.apex.st, 0.117, 0.01); near('6.7.4 f_t,90,d 0.36 N/mm²', C.ft90d, 0.36, BOOK);
  near('6.7.4 k_dis k_vol f_t,90,d 0.2 N/mm²', C.apex.ftr, 0.2016, BOOK);
  near('6.7.4 V_d 53.34 kN (R cos β)', D.govern.S.shear.V / 1000, 53.34, BOOK);
  near('6.7.4 τ_d: the book’s 0.48 N/mm² over k_cr 0.67 (A1)', D.govern.S.shear.tau, 1.5 * 53.34e3 / (175 * 960) / 0.67, BOOK);
  near('6.7.4 f_v,d 2.74 N/mm²', C.fvd, 2.74, BOOK);
  near('6.7.4 f_c,90,d 2.38, f_c,0,d 20.88 N/mm²', C.fc90d + C.fc0d, 2.376 + 20.88, BOOK);
  // the book's bearing stress 1.52 N/mm² takes R cos β; the tool takes the vertical reaction 54 kN on b l (6.16)
  const fca = 20.88 / (20.88 / 2.376 * Math.sin(81 * DEG) ** 2 + Math.cos(81 * DEG) ** 2);
  near('6.7.4 f_c,α,d 2.43 N/mm² (6.16, α 81°)', fca, 2.43, BOOK);
  near('6.7.4 bearing: 54 kN/(175 × 200) against f_c,α,d', ck(D, 'bearing').util, 54e3 / (175 * 200) / fca, 1e-3);
  truth('6.7.4 apex: bending, radial tension, shear with tension checked', ['apexM', 'apexT', 'apexTV'].every(i => ck(D, i)) && !ck(D, 'apexC'));
  near('6.7.4 apex shear with tension (6.53), section by section', ck(D, 'apexTV').util, 0.612, BOOK);
  truth('6.7.4 passes, with the horizontal movement warned', D.utilMax < 1 && D.warnings.some(w => /horizontal movement/.test(w)));
  // the curved profile: legs at 9° tangent to the r_in arc about mid-span
  const yc = 9000 * Math.tan(9 * DEG) - 18000 / Math.cos(9 * DEG);
  near('6.7.4 soffit at mid-span: L/2 tan β − r_in/cos β + r_in', D.P.bot(9000), yc + 18000, 1e-9);
  near('6.7.4 the apex zone from the tangent point on the axis, x = L/2 − (r_in + h/2) sin β', D.P.apex.x0, 9000 - 18480 * Math.sin(9 * DEG), 1e-9);
  near('6.7.4 depth normal to the axis constant 960 mm', G.depthAt(D.P, 3000), 960, 1e-6);
}

// ---------- double tapered beam, by hand ----------
{ // GL24h 140 × 500–900 mm over 12 m, Q 5 kN/m roof: the design load 7.5 kN/m; held along the top
  const D = G.design({ mat: { family: 'glulam', cls: 'GL24h' }, sc: 1, shape: 'double', b: 140, L: 12, hs: 500, hap: 900, lb: 150, sw: false, cat: 'H', loads: [{ case: 'Q', form: 'line', w: 5 }], restraint: { mode: 'top' } });
  const t = 400 / 6000, A = D.AP, C = comb(D, '1.35G + 1.5Q');
  near('double: α_ap', D.P.alpha, Math.atan(t));
  near('double: k_l = 1 + 1.4 tan α + 5.4 tan²α (6.43)', A.kl, 1.117333, 1e-6);
  near('double: k_p = 0.2 tan α (6.56)', A.kp, 0.0133333, 1e-5);
  near('double: V = b h_ap²(1 − tan α/4) 0.1115 m³', A.Vst / 1e9, 0.111510, 1e-5);
  near('double: V_b = b L (h_s + h_ap)/2', A.Vb / 1e9, 1.176, 1e-9);
  near('double: k_vol (0.01/V)^0.2', A.kvol, 0.617358, 1e-5);
  near('double: M_ap = wL²/8 135 kNm', C.apex.Map / 1e6, 135, 1e-6);
  near('double: σ_m,0,d = k_l 6M/(b h_ap²) 7.981 N/mm²', C.apex.sm, 1.117333 * 135e6 * 6 / (140 * 900 * 900), 1e-5);
  near('double: apex bending utilisation (k_r 1, f_m,d 17.28)', C.apex.uM, 7.98095 / 17.28, 1e-5);
  near('double: σ_t,90,d = k_p 6M/(b h_ap²)', C.apex.st, 0.0133333 * 135e6 * 6 / (140 * 900 * 900), 1e-5);
  near('double: radial tension against 1.4 k_vol f_t,90,d (0.36)', C.apex.uT, 0.0952381 / (1.4 * 0.617358 * 0.36), 1e-5);
  // along the beam: the greatest stress at x = L h_s/(2 h_ap) = 3.33 m, on the tapered face with k_m,α (6.40)
  const B = D.govern.B.bend, x = 3333.33, h = 500 + x * t, s = 7.5 * x * (12000 - x) / 2 / (140 * h * h / 6);
  near('double: the greatest stress at L h_s/(2h_ap)', B.x, x, 0.01);
  near('double: σ_m,d there 8.901 N/mm²', B.sig, s, 1e-4);
  const kma = 1 / Math.sqrt(1 + (17.28 / (1.5 * 2.52) * t) ** 2 + (17.28 / 1.8 * t * t) ** 2);
  near('double: k_m,α 0.9558 (compression face)', B.kmA, kma, 1e-4); near('… by hand', kma, 0.955770, 1e-5);
  near('double: utilisation', B.u, s / (kma * 17.28), 1e-4);
  near('double: the k_m,α function (6.40)', G.kma(Math.atan(t), 17.28, 2.52, 0.36, 1.8, false), kma, 1e-12);
  near('double: k_m,α on a tensile face (6.39)', G.kma(Math.atan(t), 17.28, 2.52, 0.36, 1.8, true), 1 / Math.sqrt(1 + (17.28 / (0.75 * 2.52) * t) ** 2 + (17.28 / 0.36 * t * t) ** 2), 1e-12);
  truth('double: no curvature: k_r 1, no t needed', A.kr === 1 && !A.t);
  truth('double: the apex sections are left to 6.4.3', !D.P.inApex(B.x) && D.P.inApex(6000));
}
{ // the same beam under wind uplift, both edges held: 1.0G + 1.5W = 1 − 9 = −8 kN/m, M_ap −144 kNm, k_mod 1.1 (f_m,d 21.12)
  const D = G.design({ mat: { family: 'glulam', cls: 'GL24h' }, sc: 1, shape: 'double', b: 140, L: 12, hs: 500, hap: 900, lb: 150, sw: false, cat: 'H', loads: [{ case: 'G', form: 'line', w: 1 }, { case: 'W', form: 'line', w: 6, up: true }], restraint: { mode: 'both' } });
  const C = comb(D, '1.0G + 1.5W'), s = 1.117333 * 144e6 * 6 / (140 * 900 * 900);
  near('hogging: M_ap −144 kNm', C.apex.Mb / 1e6, -144, 1e-6); truth('hogging: the apex bending check takes the hogging moment', C.apex.hog);
  near('hogging: σ_m,0,d = k_l 6|M_ap|/(b h_ap²) 8.513 N/mm²', C.apex.sm, s, 1e-5);
  near('hogging: apex bending governed by 1.0G + 1.5W', ck(D, 'apexM').util, s / 21.12, 1e-5); truth('… and named so', ck(D, 'apexM').combo === '1.0G + 1.5W' && /hogging/.test(ck(D, 'apexM').note));
  near('hogging: radial compression k_p 6|M|/(b h²) against f_c,90,d 2.2', ck(D, 'apexC').util, 0.0133333 * 144e6 * 6 / (140 * 900 * 900) / 2.2, 1e-5);
  truth('hogging: uplift at the supports warned', D.warnings.some(w => /uplift/.test(w)));
}

// ---------- pitched cambered beam, by hand ----------
{ // GL24h 180 wide, h_s 600 at the supports, roof 10°, soffit legs 5° curved to r_in 15 m, 33 mm laminations, L 16 m
  const D = G.design({ mat: { family: 'glulam', cls: 'GL24h' }, sc: 1, shape: 'pitched', b: 180, L: 16, hs: 600, alpha: 10, beta: 5, rin: 15, t: 33, lb: 300, sw: false, cat: 'H', loads: [{ case: 'Q', form: 'line', w: 5 }], restraint: { mode: 'top' } });
  const A = D.AP;
  near('pitched: top at the apex h_s + L/2 tan α', D.P.top(8000), 600 + 8000 * Math.tan(10 * DEG), 1e-9);
  near('pitched: h_ap 1368.0 mm', D.hap, 1368.0, 1e-4);
  near('pitched: h_ap/r, r = r_in + h_ap/2', A.hr, 1368.0 / 15684.0, 1e-4);
  near('pitched: k_l 1.3362 (6.43)', A.kl, 1.336220, 1e-4);
  near('pitched: k_p 0.04292 (6.56)', A.kp, 0.042923, 1e-3);
  near('pitched: V = b(sin α cos α (r_in + h_ap)² − r_in² α) 1.178 m³', A.Vst / 1e9, 1.17821, 1e-3);
  near('pitched: k_vol 0.3853', A.kvol, 0.385268, 1e-3);
  near('pitched: k_dis 1.7', A.kdis, 1.7);
  near('pitched: k_r 0.76 + 0.001 r_in/t (r_in/t 455 ≥ 240: 1)', A.kr, 1);
  truth('pitched: the soffit legs at β', Math.abs(D.P.theta(1000) - 5 * DEG) < 1e-9);
}
{ const D = G.design({ mat: { family: 'glulam', cls: 'GL24h' }, sc: 1, shape: 'curved', b: 140, L: 10, h: 600, beta: 5, rin: 6, t: 45, lb: 200, sw: false, cat: 'H', loads: [{ case: 'Q', form: 'line', w: 2 }], restraint: { mode: 'top' } });
  near('curved: k_r 0.76 + 0.001 r_in/t (r_in/t 133 < 240)', D.AP.kr, 0.76 + 6000 / 45 / 1000, 1e-12); near('curved: V = β b (h_ap² + 2 h_ap r_in) (Table 6.6)', D.AP.Vst, 5 * DEG * 140 * (600 * 600 + 2 * 600 * 6000), 1e-9);
  truth('curved: a tight curve warned (r_in/t < 150)', D.warnings.some(w => /tight curve/.test(w))); }

// ---------- self-weight and area loads ----------
{ const base = { mat: { family: 'glulam', cls: 'GL24h' }, sc: 1, shape: 'double', b: 140, L: 12, hs: 500, hap: 900, lb: 150, cat: 'H', restraint: { mode: 'top' } };
  const D = G.design({ ...base, sw: true, loads: [] }), Gk = D.defs.G.E;
  near('self-weight: ρ_mean g V_b (GL24h 420 kg/m³)', (Gk.RA + Gk.RB), 1.176 * 420 * 9.81, 1e-3);
  truth('self-weight: heavier at the apex', Gk.M[200] > 0 && D.defs.G.G.udl.length > 10);
  const A = G.design({ ...base, sw: false, spacing: 4.8, loads: [{ case: 'G', form: 'area', w: 0.75 }] }), L = G.design({ ...base, sw: false, loads: [{ case: 'G', form: 'line', w: 3.6 }] });
  near('area load × spacing: 0.75 kN/m² × 4.8 m = 3.6 kN/m', A.defs.G.E.RA, L.defs.G.E.RA, 1e-12); near('… the reaction 21.6 kN', A.defs.G.E.RA / 1000, 21.6, 1e-12);
  const P = G.design({ ...base, sw: false, loads: [{ case: 'Q', form: 'point', w: 10, a: 3 }] });
  near('a point load: R_A = P (L − a)/L', P.defs.Q.E.RA / 1000, 10 * 9 / 12, 1e-12);
  const C = G.design({ ...base, sw: false, defl: { inst: 300, fin: 250, camber: 20 }, loads: [{ case: 'G', form: 'line', w: 3 }] });
  near('pre-camber taken off the net final deflection', C.D.net, G.design({ ...base, sw: false, loads: [{ case: 'G', form: 'line', w: 3 }] }).D.fin - 20, 1e-9);
}

// ---------- input errors ----------
{ const base = { mat: { family: 'glulam', cls: 'GL24h' }, sc: 1, b: 140, L: 12, lb: 150, sw: false, cat: 'H', loads: [{ case: 'Q', form: 'line', w: 5 }], restraint: { mode: 'top' } };
  throws('single: h₁ must be deeper than h_s', () => G.design({ ...base, shape: 'single', hs: 500, h1: 500 }), /deeper/);
  throws('double: h_ap deeper than h_s', () => G.design({ ...base, shape: 'double', hs: 900, hap: 600 }), /deeper|h_ap/);
  throws('curved: r_in needed', () => G.design({ ...base, shape: 'curved', h: 600, beta: 5, rin: 0, t: 33 }), /r_in|radius/i);
  throws('pitched: β no steeper than α_ap', () => G.design({ ...base, shape: 'pitched', hs: 600, alpha: 5, beta: 8, rin: 15, t: 33 }), /β|α/);
  throws('area loads need the spacing', () => G.design({ ...base, shape: 'double', hs: 500, hap: 900, loads: [{ case: 'G', form: 'area', w: 1 }] }), /spacing/);
  throws('a point load beyond the span', () => G.design({ ...base, shape: 'double', hs: 500, hap: 900, loads: [{ case: 'Q', form: 'point', w: 1, a: 13 }] }), /within the span/);
  throws('a load without a value', () => G.design({ ...base, shape: 'double', hs: 500, hap: 900, loads: [{ case: 'Q', form: 'line', w: NaN }] }), /value/);
}

console.log(`\n${n - fails}/${n} glulam checks passed`);
process.exit(fails ? 1 : 0);
