// Timber Member: k_c (6.3.2) against hand calculation; Porteous & Kermani examples 5.7.1 (a C18 column), 5.7.2 (a C18 tie
// with holes), 5.7.3 (a C24 column with the load off both axes), 5.7.4 (a Kerto-S column with an eccentric load and lateral
// buckling) and 5.7.5 (a C24 member in tension and biaxial bending), to the book's rounding; the strength checks when
// λ_rel ≤ 0.3; wind on a post (w L²/8, shear, G favourable when the wind pulls); self-weight; sizing; errors.
// The book (2007) used EN 338:2003, whose tensile strengths differ (C18 f_t,0,k 11, C24 14; EN 338:2016: 10 and 14.5);
// there the test checks the book's stresses and the tool's own strength.
const { EC5, TimberMember: TM } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol = 1e-9) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };
const BOOK = 0.006, ck = (D, id) => D.checks.find(c => c.id === id), G = D => D.combos.reduce((p, q) => (q.uMax > p.uMax ? q : p));
const KERTO = { family: 'other', props: { name: 'Kerto-S', fmk: 44, ft0k: 35, fc0k: 35, fvk: 4.1, fc90k: 6, E0mean: 13800, E005: 11600, Gmean: 600, G005: 400, rhomean: 510, gM: 1.2, kcr: 1, s: 0.12 } };

// ---------- k_c by hand ----------
{ const M = EC5.material({ family: 'solid', cls: 'C24' }), B = EC5.kc(M, 100), lr = 100 / Math.PI * Math.sqrt(21 / 7400), k = 0.5 * (1 + 0.2 * (lr - 0.3) + lr * lr);
  near('λ_rel', B.lr, lr); near('k', B.k, k); near('k_c', B.kc, 1 / (k + Math.sqrt(k * k - lr * lr))); near('k_c = 1 at λ_rel ≤ 0.3', EC5.kc(M, 15).kc, 1);
  near('glulam β_c 0.1', EC5.kc(EC5.material({ family: 'glulam', cls: 'GL24h' }), 80).bc, 0.1); }

// ---------- P&K 5.7.1: C18 150 × 200, SC2, L 3.75 m pinned, G 30 + Q 50 kN (medium) ----------
{ const D = TM.design({ mat: { family: 'solid', cls: 'C18' }, sc: 2, b: 150, h: 200, L: 3750, loads: [{ case: 'G', N: 30 }, { case: 'Q', N: 50 }], cat: 'A' }), w = G(D);
  near('5.7.1: λ_y = 64.95', D.BY.lam, 64.95, BOOK); near('5.7.1: λ_z = 86.6', D.BZ.lam, 86.6, BOOK); near('5.7.1: N_d = 116 kN', w.N / 1e3, 115.5, 1e-9);
  near('5.7.1: σ_c,0,d = 3.85', w.sc0, 3.85, BOOK); near('5.7.1: f_c,0,d = 11.08', w.fc, 11.08, BOOK);
  near('5.7.1: λ_rel,y = 1.13', D.BY.lr, 1.13, BOOK); near('5.7.1: λ_rel,z = 1.51', D.BZ.lr, 1.51, BOOK); near('5.7.1: k_z = 1.76', D.BZ.k, 1.76, BOOK); near('5.7.1: k_c,z = 0.37', D.BZ.kc, 0.375, BOOK);
  near('5.7.1: σ_c,0,d/(k_c,z f_c,0,d) = 0.93', ck(D, 'cz').util, 0.93, BOOK); truth('5.7.1: governs about z–z, 1.35G + 1.5Q at k_mod 0.8', ck(D, 'cz').combo === '1.35G + 1.5Q' && w.c.kmod === 0.8);
  near('5.7.1: 1.35G alone at k_mod 0.6', D.combos.find(r => r.c.name === '1.35G').u.cz, 40.5e3 / 30000 / (D.BZ.kc * 0.6 * 18 / 1.3), 1e-12);
  truth('5.7.1: no bending, no lateral buckling check', !ck(D, 'ltb') && !/σ_m/.test(ck(D, 'cz').note)); }

// ---------- P&K 5.7.2: C18 47 × 125 tie, G 2.5 + Q 3 kN tension, 10 % of the area lost ----------
{ const D = TM.design({ mat: { family: 'solid', cls: 'C18' }, sc: 2, b: 47, h: 125, L: 2000, loss: 10, loads: [{ case: 'G', N: -2.5 }, { case: 'Q', N: -3 }], cat: 'A' }), w = G(D);
  near('5.7.2: A_net = 5.29 × 10³', D.Anet, 5290, BOOK); near('5.7.2: N_d = 7.88 kN', -w.N / 1e3, 7.875, 1e-9); near('5.7.2: σ_t,0,d = 1.49', w.st, 1.49, BOOK);
  near('5.7.2: k_h = 1.04 (h 125)', D.khT, 1.04, BOOK);
  near('5.7.2: f_t,0,d = 0.8 × 1.04 × 10/1.3 (EN 338:2016; the book 7.02 with 11)', w.ft, 0.8 * (150 / 125) ** 0.2 * 10 / 1.3, 1e-12); near('… the book: 7.02 with f_t,0,k 11', w.ft * 11 / 10, 7.02, BOOK);
  truth('5.7.2: a plain tie: one tension check', D.checks.length === 1 && ck(D, 'ty').name === 'Tension' && /6\.1\.2/.test(ck(D, 'ty').ref));
  near('5.7.2: utilisation', ck(D, 'ty').util, w.st / w.ft, 1e-12); }

// ---------- P&K 5.7.3: C24 100 × 200, SC2, L 3.75 m, G 10 + Q 17.5 kN at e_z 25, e_y 10 ----------
{ const D = TM.design({ mat: { family: 'solid', cls: 'C24' }, sc: 2, b: 100, h: 200, L: 3750, ez: 25, ey: 10, loads: [{ case: 'G', N: 10 }, { case: 'Q', N: 17.5 }], cat: 'A' }), w = G(D);
  near('5.7.3: N_d = 39.8 kN', w.N / 1e3, 39.75, 1e-9); near('5.7.3: M_y,d = 0.99 kNm', w.My / 1e6, 0.99, BOOK); near('5.7.3: M_z,d = 0.40 kNm', w.Mz / 1e6, 0.4, 0.01);
  near('5.7.3: σ_m,y,d = 1.49', w.smy, 1.49, BOOK); near('5.7.3: σ_m,z,d = 1.19', w.smz, 1.19, BOOK); near('5.7.3: f_m,y,d = 14.77', w.fmy, 14.77, BOOK); near('5.7.3: f_m,z,d = 16.02 (k_h 1.08)', w.fmz, 16.02, BOOK);
  near('5.7.3: σ_c,0,d = 1.99', w.sc0, 1.99, BOOK); near('5.7.3: f_c,0,d = 12.92', w.fc, 12.92, BOOK); near('5.7.3: λ_rel,y = 1.10', D.BY.lr, 1.10, BOOK); near('5.7.3: λ_rel,z = 2.20', D.BZ.lr, 2.20, BOOK);
  near('5.7.3: k_z = 3.12', D.BZ.k, 3.12, BOOK); near('5.7.3: k_c,z = 0.19', D.BZ.kc, 0.188, BOOK); near('5.7.3: k_y = 1.19', D.BY.k, 1.19, BOOK); near('5.7.3: k_c,y = 0.61', D.BY.kc, 0.614, BOOK);
  near('5.7.3: (6.23) = 0.40', ck(D, 'cy').util, 0.40, 0.01); near('5.7.3: (6.24) = 0.96', ck(D, 'cz').util, 0.96, BOOK);
  near('5.7.3: (6.24) by hand', ck(D, 'cz').util, w.sc0 / (D.BZ.kc * w.fc) + 0.7 * w.smy / w.fmy + w.smz / w.fmz, 1e-12); }

// ---------- P&K 5.7.4: Kerto-S 90 × 200, SC2, L 4.15 m, G 8 + Q 19.5 kN (short) at e_z 65, held at the ends ----------
{ const D = TM.design({ mat: KERTO, sc: 2, b: 90, h: 200, L: 4150, ez: 65, ltb: { mode: 'ends' }, loads: [{ case: 'G', N: 8 }, { case: 'Q', N: 19.5 }], cat: 'H' }), w = G(D);
  near('5.7.4: N_d = 40 kN', w.N / 1e3, 40.05, 1e-9); near('5.7.4: M_y,d = 2.6 kNm', w.My / 1e6, 2.6, BOOK); near('5.7.4: k_h = 1.05', D.khY, 1.05, BOOK);
  near('5.7.4: σ_m,y,d = 4.34', w.smy, 4.34, BOOK); near('5.7.4: f_m,y,d = 34.65', w.fmy, 34.65, BOOK); truth('5.7.4: k_mod short 0.9', w.c.kmod === 0.9);
  near('5.7.4: σ_m,crit = 55.9', D.ltb.scrit, 55.9, BOOK); near('5.7.4: λ_rel,m = 0.89', D.ltb.lam, 0.887, BOOK); near('5.7.4: k_crit = 0.89', D.ltb.k, 0.895, BOOK);
  near('5.7.4: σ_c,0,d = 2.23', w.sc0, 2.23, BOOK); near('5.7.4: f_c,0,d = 26.25', w.fc, 26.25, BOOK); near('5.7.4: λ_rel,y = 1.26', D.BY.lr, 1.26, BOOK); near('5.7.4: λ_rel,z = 2.79', D.BZ.lr, 2.79, BOOK);
  near('5.7.4: β_c 0.1', D.BY.bc, 0.1); near('5.7.4: k_y = 1.34', D.BY.k, 1.34, BOOK); near('5.7.4: k_c,y = 0.56', D.BY.kc, 0.557, BOOK); near('5.7.4: k_z = 4.52', D.BZ.k, 4.52, BOOK); near('5.7.4: k_c,z = 0.12', D.BZ.kc, 0.124, BOOK);
  near('5.7.4: (6.23) = 0.28', ck(D, 'cy').util, 0.277, BOOK); near('5.7.4: (6.24) = 0.77', ck(D, 'cz').util, 0.773, BOOK); near('5.7.4: (6.35) = 0.70', ck(D, 'ltb').util, 0.705, BOOK);
  truth('5.7.4: (6.35) named', /6\.35/.test(ck(D, 'ltb').ref)); }

// ---------- P&K 5.7.5: C24 63 × 125, SC2, G 1 + Q 4 kN tension, Q also M_y 1.0, M_z 0.1 kNm ----------
{ const D = TM.design({ mat: { family: 'solid', cls: 'C24' }, sc: 2, b: 63, h: 125, L: 2000, loads: [{ case: 'G', N: -1 }, { case: 'Q', N: -4, My: 1, Mz: 0.1 }], cat: 'A' }), w = G(D);
  near('5.7.5: M_y,d = 1.5 kNm', w.My / 1e6, 1.5, 1e-9); near('5.7.5: M_z,d = 0.15 kNm', w.Mz / 1e6, 0.15, 1e-9);
  near('5.7.5: σ_m,y,d = 9.14', w.smy, 9.14, BOOK); near('5.7.5: σ_m,z,d = 1.81', w.smz, 1.81, BOOK); near('5.7.5: f_m,y,d = 15.32', w.fmy, 15.32, BOOK); near('5.7.5: f_m,z,d = 17.57', w.fmz, 17.57, BOOK);
  // the book's N_d = 6.75 kN does not follow from 1.35 × 1.0 + 1.5 × 4.0 = 7.35 kN; the tool takes 7.35
  near('5.7.5: N_d = 1.35 × 1 + 1.5 × 4 = 7.35 kN', -w.N / 1e3, 7.35, 1e-9); near('5.7.5: σ_t,0,d = N/A', w.st, 7350 / 7875, 1e-12);
  near('5.7.5: f_t,0,d with k_h 1.04 (EN 338:2016 f_t,0,k 14.5)', w.ft, 0.8 * (150 / 125) ** 0.2 * 14.5 / 1.3, 1e-12);
  near('5.7.5: (6.17) = 0.77', ck(D, 'ty').util, 0.77, BOOK); near('5.7.5: (6.18) = 0.62', ck(D, 'tz').util, 0.62, BOOK);
  near('5.7.5: (6.17) by hand', ck(D, 'ty').util, w.st / w.ft + w.smy / w.fmy + 0.7 * w.smz / w.fmz, 1e-12); }

// ---------- hand calculations ----------
{ // a stocky post: λ_rel ≤ 0.3 → (6.19), (6.20) with (σ/f)²
  const D = TM.design({ mat: { family: 'solid', cls: 'C24' }, sc: 1, b: 150, h: 150, L: 400, ez: 20, loads: [{ case: 'G', N: 50 }, { case: 'Q', N: 60 }], cat: 'A' }), w = G(D);
  truth('stocky: λ_rel ≤ 0.3, (6.19)', D.slender && /6\.19/.test(ck(D, 'cy').ref)); near('stocky: (6.19)', ck(D, 'cy').util, (w.sc0 / w.fc) ** 2 + w.smy / w.fmy, 1e-12);
  // wind on a post: w L²/8, the shear, and G favourable when the wind lifts
  const P = { mat: { family: 'solid', cls: 'C24' }, sc: 2, b: 100, h: 150, L: 2400, ltb: { mode: 'ends' }, loads: [{ case: 'G', N: 3 }, { case: 'Q', N: 2 }, { case: 'W', N: -4, w: 1.2 }], cat: 'H' };
  const W = TM.design(P), uw = W.combos.find(r => r.c.name === '1.0G + 1.5W');
  truth('wind lifting: 1.0G + 1.5W, not combined with Q', !!uw && !W.combos.some(r => /Q/.test(r.c.name) && /W/.test(r.c.name)));
  near('wind: N = 3 − 6 = −3 kN (tension)', uw.N / 1e3, -3, 1e-12); near('wind: M_y = 1.5 × 1.2 × 2.4²/8', uw.My / 1e6, 1.5 * 1.2 * 2.4 ** 2 / 8, 1e-12); near('wind: V = 1.5 × 1.2 × 2.4/2', uw.V / 1e3, 1.5 * 1.2 * 1.2, 1e-12);
  near('wind: τ = 1.5V/(k_cr b h)', uw.tau, 1.5 * uw.V / (0.67 * 100 * 150), 1e-12); truth('wind: shear check', !!ck(W, 'v') && !!ck(W, 'ty') && !!ck(W, 'cy'));
  near('wind: k_mod 1.1', uw.c.kmod, 1.1); near('wind: (6.33) σ_m/(k_crit f_m)', uw.u.ltb, uw.smy / (W.ltb.k * uw.fmy), 1e-12);
  truth('wind: reversal warned', W.warnings.some(x => /reverses/.test(x)));
  // self-weight
  const S0 = TM.design({ ...P, loads: [{ case: 'G', N: 3 }], sw: true }); near('self-weight: ρ_mean g b h L', S0.swkN, 420 * 9.81 * 100 * 150 * 2400 * 1e-12, 1e-12); near('… added to G', S0.defs.G.N, 3 + S0.swkN, 1e-12);
  // l_ef factors, k_sys, 6.10a/b
  const E = TM.design({ ...P, kZ: 0.5 }); near('l_ef,z = 0.5L', E.lefZ, 1200); near('… λ_z', E.BZ.lam, 1200 / (100 / Math.sqrt(12)), 1e-12);
  const K = TM.design({ ...P, ksys: true }); near('k_sys 1.1 on f_c,0,d', G(K).fc, G(K).c.kmod * 1.1 * 21 / 1.3, 1e-12);
  const A = TM.design({ ...P, combo: '6.10ab' }); truth('6.10a/b combinations', A.combos.some(r => /6\.10a/.test(r.c.name)) && A.combos.some(r => /6\.10b/.test(r.c.name)));
  // glulam
  const GLD = TM.design({ ...P, mat: { family: 'glulam', cls: 'GL28h' }, b: 90, h: 225 }); near('glulam: β_c 0.1, γ_M 1.25', GLD.BY.bc + GLD.M.gM, 1.35, 1e-12);
  // sizing
  const Z = TM.suggest({ mat: { family: 'solid', cls: 'C24' }, sc: 2, L: 3000, loads: [{ case: 'G', N: 20 }, { case: 'Q', N: 30 }], cat: 'A' });
  truth('size the member: a passing section', Z && Z.D.utilMax <= 1);
  truth('… none smaller in area passes', [[47, 100], [63, 100], [75, 100], [47, 150], [63, 125], [75, 125]].filter(([b, h]) => b * h < Z.b * Z.h).every(([b, h]) => TM.design({ mat: { family: 'solid', cls: 'C24' }, sc: 2, b, h, L: 3000, loads: [{ case: 'G', N: 20 }, { case: 'Q', N: 30 }], cat: 'A' }).utilMax > 1));
  // slender warning
  const SL = TM.design({ mat: { family: 'solid', cls: 'C24' }, sc: 2, b: 47, h: 150, L: 3000, loads: [{ case: 'G', N: 1 }], cat: 'A' }); truth('λ over 180 warned', SL.warnings.some(x => /180/.test(x)));
}
// ---------- errors ----------
const base = { mat: { family: 'solid', cls: 'C24' }, sc: 2, b: 100, h: 100, L: 3000, loads: [{ case: 'G', N: 10 }], cat: 'A' };
throws('no load', () => TM.design({ ...base, loads: [] }), /axial force or a moment/);
throws('a length', () => TM.design({ ...base, L: 0 }), /length/);
throws('area lost', () => TM.design({ ...base, loss: 70 }), /area lost/);
throws('l_ef for lateral buckling', () => TM.design({ ...base, loads: [{ case: 'G', N: 10, My: 1 }], ltb: { mode: 'lef', lef: 0 } }), /l_ef/);
throws('a product needs f_c,0,k in compression', () => TM.design({ ...base, mat: { family: 'other', props: { ...KERTO.props, fc0k: 0 } } }), /f_c,0,k/);
throws('numbers in the loads', () => TM.design({ ...base, loads: [{ case: 'G', N: 'x' }] }), /numbers/);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
