// Beam web openings: Tee and net-section resistances against the published NSC 05/2024 worked example (EN 1993-1-13 Tee
// check), and full steel and composite cases (circular, rectangular, elongated openings; final and construction stages)
// against the independent fibre / virtual-work reference (reference/ref_webopen.py).
const { EC3, Openings: O, SECTION_DATA } = require('./load.js');
const REF = require('./ref_webopen.json'), CREF = require('../composite/ref_composite.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30) || (Math.abs(exp) < 1e-6 && Math.abs(got) < 1e-3); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const sec = name => EC3.fromRow(SECTION_DATA.find(r => r[0] === name));
const util = (cs, k) => (cs.find(c => c.k === k) || {}).util;
// 1 NSC 05/2024 worked example: welded 650 deep, flange 220 x 20, web 10, fy 345, 1000 x 450 opening at 5 m on a 13 m span
{ const s = { ...EC3.customI({ h: 650, b: 220, tw: 10, tf: 20, r: 0 }), mass: 0 }, R0 = O.fullRects(s), o = O.opening(s, 345, { shape: 'rect', x: 5000, h0: 450, lo: 1000, e0: 0 }, R0), N = REF.nsc;
  near('Tee area A_T = 5200 mm² (published)', o.tT.A, 5200, 1e-12); near('Tee centroid z_e = 18 mm (published 18)', o.tT.zc, N.ze, 1e-9);
  near('Tee axial resistance 1794 kN (published)', o.tT.A * 345 / 1e3, 1794, 1e-9);
  near('M_o,Rd = 1102 kNm (published), net-section plastic moment', O.plasticMN(o.Rnet, 345, 0, 0).Mpos / 1e6, 1102, 1e-3);
  near('Tee I = 2265 × 10³ mm⁴ (published)', o.tT.I / 1e3, 2265, 1e-3); near('Tee i = 20.9 mm (published)', Math.sqrt(o.tT.I / o.tT.A), 20.9, 2e-3);
  near('M_T,Rd = 21.1 kNm (published)', O.teeMN(o.tT, 345, 0, 0).Mpos / 1e6, 21.1, 2e-3); near('M_T,Rd against fibre integration', O.teeMN(o.tT, 345, 0, 0).Mpos, N.MTRd, 2e-4);
  // design case: ULS 30 kN/m and service 21.07 kN/m (V_ser = 31.6 kN at the opening centre), no self weight
  const R = O.design({ mode: 'steel', s, grade: 'S355', L: 13000, steel: { gk: 31.6 / 45 * 30, qk: 0, points: [], gG: 45 / 31.6, gQ: 1.5, deflQ: 360, deflT: 250 }, openings: [{ shape: 'rect', x: 5000, h0: 450, lo: 1000, e0: 0 }] });
  const r = R.res[0], tb = r.tb;
  near('M_Ed at the high-moment edge = 619 kNm (published)', r.MEd / 1e6, 619, 1e-3); near('N_T,Ed = 1008 kN (published)', r.NtT / 1e3, 1008, 2e-3);
  near('λ̄_T = 0.31 (published)', tb.lam, 0.31, 0.01); near('χ_T curve c (EN 1993-1-1 6.49; published table value 0.93)', tb.chi, 0.9445, 1e-3);
  near('Vierendeel moment in the Tee V a/4 = 11.3 kNm (published)', tb.MTEd / 1e6, 11.25, 1e-9); near('relative sway w = 2.8 mm (published)', tb.w, 2.8, 0.015);
  near('M_add = q a²/12 = 2.5 kNm (published)', tb.Madd / 1e6, 2.5, 1e-9);
  near('combined check with the published χ = 0.93: 0.99', r.NtT / (0.93 * 5200 * 345) + (0.4 * (tb.MTEd + r.NtT * tb.w) + tb.Madd) / tb.MTRd, 0.99, 0.01);
  near('combined check (engine)', tb.util, r.NtT / tb.NbRd + (0.4 * (tb.MTEd + r.NtT * tb.w) + tb.Madd) / tb.MTRd, 1e-12);
  near('Vierendeel (14) uses V at the lower-moment side (60 kN)', r.VEd / 1e3, 60, 1e-9); }
// 2 steel case against the reference
const cmpRes = (lbl, js, ref, tolE = 1e-3, tolR = 1e-2) => js.forEach((r, i) => { const q = ref[i], t = `${lbl} opening ${i + 1}`;
  near(`${t}: M_Ed`, r.MEd, q.MEd, tolE); near(`${t}: V_Ed`, r.VEd, q.VEd, tolE); near(`${t}: V_pl at the opening`, r.VplO, q.VplO, tolR); near(`${t}: h_eff`, r.o.heff, q.heff, tolR);
  near(`${t}: bending utilisation`, util(r.checks, 'oM'), q.uM, tolR); near(`${t}: shear utilisation`, util(r.checks, 'oV'), q.uV, tolR);
  near(`${t}: top Tee force`, r.NtT, q.Nt, tolR); near(`${t}: bottom Tee force`, r.NbT, q.Nb, tolR); near(`${t}: Σ M_NV (Vierendeel resistance)`, r.MvRd, q.MvRd, tolR);
  near(`${t}: Vierendeel utilisation`, util(r.checks, 'oVi'), q.uVi, tolR);
  if (q.uTb !== undefined) near(`${t}: compression Tee check`, util(r.checks, 'oTb'), q.uTb, tolR);
  if (q.dV !== undefined) near(`${t}: Vierendeel sway`, r.dV, q.dV, tolR); });
const cmpPosts = (lbl, js, ref) => { truth(`${lbl}: ${ref.length} web-posts checked`, js.length === ref.length); js.forEach((p, i) => { const q = ref[i], t = `${lbl} web-post ${i + 1}`;
  near(`${t}: ℓ_w`, p.lw, q.lw, 1e-9); near(`${t}: λ̄`, p.lam, q.lam, 1e-9); near(`${t}: V_wp,Ed`, p.Vwp, q.Vwp, 1e-2);
  near(`${t}: shear utilisation`, util(p.checks, 'wV'), q.uV, 1e-2); near(`${t}: buckling utilisation`, util(p.checks, 'wB'), q.uB, 1e-2);
  if (q.uM !== undefined) near(`${t}: bending utilisation`, util(p.checks, 'wM'), q.uM, 1e-2); }); };
{ const I = REF.steel.input, s = sec(I.section);
  const R = O.design({ mode: 'steel', s, grade: 'S355', L: I.L, steel: { gk: I.gk, qk: I.qk, points: I.points.map(p => ({ ...p })), gG: 1.35, gQ: 1.5, deflQ: 360, deflT: 250 }, openings: I.ops });
  cmpRes('steel', R.res, REF.steel.res); cmpPosts('steel', R.posts, REF.steel.posts);
  near('steel: total deflection at mid-span with openings (virtual work)', R.defl.dTmid, REF.steel.dTmid, 2e-3);
  near('steel: imposed deflection at mid-span with openings', R.defl.dQmid, REF.steel.dQmid, 2e-3);
  near('steel: gross deflection at mid-span (no openings)', R.defl.base.dTmid, REF.steel.dTgross, 1e-4);
  truth('steel: maximum deflection ≥ mid-span value', R.defl.dT >= R.defl.dTmid - 1e-9);
  truth('steel: elongated opening fails Vierendeel (as the reference)', util(R.res[3].checks, 'oVi') > 1);
  truth('steel: point load more than h from every opening (no warning)', !R.warn.some(w => /point load/.test(w))); }
// 3 composite case, final and construction stages
{ const ci = CREF.perp_single.input, s = sec(ci.section);
  const R = O.design({ mode: 'comp', s, grade: 'S355', L: ci.L, comp: ci, openings: REF.comp.input.ops });
  cmpRes('composite', R.res, REF.comp.res); cmpPosts('composite', R.posts, REF.comp.posts);
  cmpRes('construction', R.cons.res, REF.comp.cons); cmpPosts('construction', R.cons.posts, REF.comp.consPosts);
  for (const k of ['aWet', 'aSDL', 'aQ']) near(`composite: additional deflection ${k}`, R.defl.add[k], REF.comp.add[k], 2e-2);
  near('composite: imposed deflection = beam + openings', R.defl.dQ, R.C.dQ + R.defl.add.aQ, 1e-12);
  const P = O.design({ mode: 'comp', s, grade: 'S355', L: ci.L, comp: { ...ci, propped: true }, openings: REF.comp.input.ops });
  truth('propped composite: no construction-stage opening checks', P.cons === null && !P.checks.some(c => /Construction: Opening/.test(c.nm))); }
// 4 behaviour and validation
{ const s = sec('457×191×67 UKB'), base = { mode: 'steel', s, grade: 'S355', L: 9000, steel: { gk: 10, qk: 12, points: [], gG: 1.35, gQ: 1.5, deflQ: 360, deflT: 250 } };
  const run = ops => O.design({ ...base, openings: ops });
  const thr = (name, ops, re) => { let m = ''; try { run(ops); } catch (e) { m = e.message; } truth(name, re.test(m)); };
  thr('overlapping openings rejected', [{ shape: 'circ', x: 2000, h0: 250 }, { shape: 'circ', x: 2200, h0: 250 }], /overlap/);
  thr('opening into the flange rejected', [{ shape: 'circ', x: 2000, h0: 440 }], /flange/);
  thr('opening beyond the span rejected', [{ shape: 'rect', x: 100, h0: 200, lo: 400 }], /beyond the span/);
  const W = run([{ shape: 'rect', x: 4500, h0: 350, lo: 1000 }]);
  truth('deep, long rectangular opening flagged outside P355 limits', W.warn.some(w => /0.7h/.test(w)) && W.warn.some(w => /length exceeds/.test(w)));
  const far = run([{ shape: 'circ', x: 1500, h0: 200 }, { shape: 'circ', x: 4000, h0: 200 }]); truth('openings more than 5ℓ₀ apart: no web-post check', far.posts.length === 0);
  const ecc = run([{ shape: 'circ', x: 2000, h0: 200, e0: 50 }]); truth('eccentric opening: deeper bottom Tee', ecc.res[0].o.tB.depth > ecc.res[0].o.tT.depth + 99);
  const none = run([]); near('no openings: deflection = 5wL⁴/384EI', none.defl.dT, 5 * (10 + s.mass * 9.81e-3 + 12) * 9000 ** 4 / (384 * 210000 * s.Iy), 1e-5);
  // Tee M-N: interaction symmetry (M+(N) = M-(-N)) and N = N_pl gives zero
  const o = O.opening(s, 355, { shape: 'rect', x: 3000, h0: 200, lo: 400 }, O.fullRects(s)), Np = o.tT.A * 355;
  const a = O.plasticMN(o.tT.R, 355, 0.4 * Np, o.tT.zc), b = O.plasticMN(o.tT.R, 355, -0.4 * Np, o.tT.zc);
  near('plastic Tee: M+(N) = M-(-N)', a.Mpos, b.Mneg, 1e-9); truth('plastic Tee: zero moment at N_pl', O.plasticMN(o.tT.R, 355, Np, o.tT.zc).Mpos === 0);
  truth('shear above 0.5 V_pl reduces the Tee resistance', O.teeMN(o.tT, 355, 0, 0.5).Mpos < O.teeMN(o.tT, 355, 0, 0).Mpos); }
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
