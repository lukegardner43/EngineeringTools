// Masonry Wall Panel: UK NA Table NA.6 flexural strengths (every row, the interpolations, the notes); the Annex E α₂ tables
// (spot values, interpolation, monotonic in μ and h/l, the case for each set of edges); the JRC Eurocode 6 workshop
// example L1 (a 190 mm block panel, case A); σ_d and its cap; a cavity wall's two leaves; one-way spans and the fallbacks
// outside 0.3 ≤ h/l ≤ 2.0; ρ₃, ρ₄, t_ef and the vertical checks with the wind's moment, against hand calculation.
const { EC6Lateral: X, MasonryWall: MW } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol = 1e-9) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };
const fx = (o, a, b, nm) => { const F = X.fxk(o); near(`${nm}: f_xk1`, F.fxk1, a); near(`${nm}: f_xk2`, F.fxk2, b); return F; };

// ---------- Table NA.6 ----------
fx({ unit: 'clay', mortar: 'M12', absorption: 'lt7' }, 0.70, 2.00, 'clay < 7 %, M12'); fx({ unit: 'clay', mortar: 'M4', absorption: 'lt7' }, 0.50, 1.50, 'clay < 7 %, M4');
fx({ unit: 'clay', mortar: 'M2', absorption: 'lt7' }, 0.40, 1.20, 'clay < 7 %, M2'); fx({ unit: 'clay', mortar: 'M6', absorption: '7to12' }, 0.40, 1.10, 'clay 7–12 %, M6');
fx({ unit: 'clay', mortar: 'M12', absorption: '7to12' }, 0.50, 1.50, 'clay 7–12 %, M12'); fx({ unit: 'clay', mortar: 'M2', absorption: '7to12' }, 0.35, 1.00, 'clay 7–12 %, M2');
fx({ unit: 'clay', mortar: 'M12', absorption: 'gt12' }, 0.40, 1.10, 'clay > 12 %, M12'); fx({ unit: 'clay', mortar: 'M4', absorption: 'gt12' }, 0.30, 0.90, 'clay > 12 %, M4');
fx({ unit: 'clay', mortar: 'M2', absorption: 'gt12' }, 0.25, 0.80, 'clay > 12 %, M2');
fx({ unit: 'cs', mortar: 'M4', size: 'brick' }, 0.30, 0.90, 'calcium silicate bricks, M4'); fx({ unit: 'cs', mortar: 'M2', size: 'brick' }, 0.20, 0.60, 'calcium silicate bricks, M2');
fx({ unit: 'agg', mortar: 'M12', size: 'brick' }, 0.30, 0.90, 'concrete bricks, M12');
fx({ unit: 'agg', mortar: 'M4', size: 'block', declared: 2.9, t: 100 }, 0.25, 0.40, 'blocks 2.9, 100 mm, M4'); fx({ unit: 'agg', mortar: 'M2', size: 'block', declared: 3.6, t: 90 }, 0.20, 0.40, 'blocks 3.6, 90 mm, M2');
fx({ unit: 'aac', mortar: 'M6', size: 'block', declared: 7.3, t: 100 }, 0.25, 0.60, 'AAC 7.3, 100 mm, M6'); fx({ unit: 'agg', mortar: 'M2', size: 'block', declared: 7.3, t: 100 }, 0.20, 0.50, 'blocks 7.3, 100 mm, M2');
fx({ unit: 'agg', mortar: 'M4', size: 'block', declared: 7.3, t: 250 }, 0.15, 0.35, 'blocks 7.3, 250 mm, M4'); fx({ unit: 'mstone', mortar: 'M2', size: 'block', declared: 2.9, t: 300 }, 0.10, 0.20, 'manufactured stone 2.9, 300 mm, M2');
fx({ unit: 'agg', mortar: 'M4', size: 'block', declared: 3.6, t: 250 }, 0.15, 0.25, 'blocks 3.6, 250 mm, M4');
fx({ unit: 'agg', mortar: 'M6', size: 'block', declared: 7.3, t: 190 }, 0.19, 0.45, 'JRC: blocks 7.3 in a 190 mm wall, M6, interpolated');
fx({ unit: 'agg', mortar: 'M4', size: 'block', declared: 3.6, t: 175 }, 0.20, 0.35, 'blocks 3.6, 175 mm: halfway in thickness');
fx({ unit: 'agg', mortar: 'M4', size: 'block', declared: 5.45, t: 100 }, 0.25, 0.525, 'blocks 5.45, 100 mm: halfway in strength');
fx({ unit: 'agg', mortar: 'M4', size: 'block', declared: 10.4, t: 140 }, 0.25, 0.75, 'blocks 10.4, any thickness, M4'); fx({ unit: 'aac', mortar: 'M2', size: 'block', declared: 10.4, t: 300 }, 0.20, 0.60, 'AAC 10.4, M2');
{ const F = fx({ unit: 'agg', mortar: 'M12', size: 'block', declared: 17.5, t: 140 }, 0.27, 0.90, 'blocks 17.5: f_xk1 = 0.3 f_xk2'); truth('17.5: the μ = 0.3 note', F.notes.some(x => /μ = 0.3/.test(x))); }
fx({ unit: 'agg', mortar: 'M2', size: 'block', declared: 22.5, t: 140 }, 0.21, 0.70, 'blocks 22.5, M2: the 17.5 row');
{ const F = fx({ unit: 'agg', mortar: 'M4', size: 'block', declared: 8.5, t: 100 }, 0.25, 0.60, 'blocks 8.5: the 7.3 row'); truth('8.5: noted', F.notes.length === 1); }
{ const F = fx({ unit: 'agg', mortar: 'M4', size: 'block', declared: 12, t: 100 }, 0.25, 0.75, 'blocks 12: the 10.4 row'); truth('12: noted', F.notes.length === 1); }
throws('thin layer mortar: not in Table NA.6', () => X.fxk({ unit: 'aac', mortar: 'TL', size: 'block', declared: 3.6, t: 100 }), /general purpose mortar/);
throws('calcium silicate blocks: not in Table NA.6', () => X.fxk({ unit: 'cs', mortar: 'M4', size: 'block' }), /brick-sized units only/);
throws('natural stone: not in Table NA.6', () => X.fxk({ unit: 'nstone', mortar: 'M4' }), /no flexural strengths/);
throws('blocks under 2.9 N/mm²', () => X.fxk({ unit: 'agg', mortar: 'M4', size: 'block', declared: 2, t: 100 }), /at least 2.9/);

// ---------- Annex E ----------
truth('twelve cases of 14 μ rows by 8 h/l columns', Object.keys(X.T).join('') === 'ABCDEFGHIJKL' && Object.values(X.T).every(t => t.length === 14 && t.every(r => r.length === 8)));
let mono = true; for (const [L, t] of Object.entries(X.T)) for (let i = 0; i < 14; i++) for (let j = 0; j < 8; j++) { if (i && t[i][j] < t[i - 1][j]) mono = false; if (j && t[i][j] < t[i][j - 1]) mono = false; }
truth('every table rises as μ falls and as h/l rises (no misread value)', mono);
near('A, μ 1.0, h/l 0.3', X.alpha2('A', 1, 0.3), 0.031); near('E, μ 1.0, h/l 1.0: wl²/24 for a square plate', X.alpha2('E', 1, 1), 0.042);
near('I, μ 0.05, h/l 2.0', X.alpha2('I', 0.05, 2), 0.056); near('J, μ 0.05, h/l 2.0', X.alpha2('J', 0.05, 2), 0.959); near('L, μ 1.0, h/l 0.3', X.alpha2('L', 1, 0.3), 0.006);
near('A at μ 0.42, h/l 1.0 = 0.0862 (JRC)', X.alpha2('A', 0.42, 1), 0.0862, 1e-6);
near('E at μ 0.45, h/l 0.6: both ways', X.alpha2('E', 0.45, 0.6), ((0.028 + 0.4 * 0.016) + (0.032 + 0.4 * 0.017)) / 2, 1e-9);
throws('μ under 0.05', () => X.alpha2('A', 0.04, 1), /outside Annex E/); throws('h/l over 2', () => X.alpha2('A', 0.5, 2.1), /outside Annex E/);
const cases = { A: ['free', 'ss', 'ss', 'ss'], B: ['free', 'ss', 'ss', 'fixed'], C: ['free', 'ss', 'fixed', 'fixed'], D: ['free', 'fixed', 'fixed', 'fixed'], E: ['ss', 'ss', 'ss', 'ss'], F: ['ss', 'ss', 'ss', 'fixed'],
  G: ['ss', 'ss', 'fixed', 'fixed'], H: ['ss', 'fixed', 'fixed', 'fixed'], I: ['fixed', 'fixed', 'fixed', 'fixed'], J: ['ss', 'ss', 'ss', 'free'], K: ['ss', 'ss', 'fixed', 'free'], L: ['ss', 'fixed', 'fixed', 'free'] };
for (const [L, [top, bottom, left, right]] of Object.entries(cases)) {
  truth(`case ${L} from its edges`, X.caseOf({ top, bottom, left, right }).L === L);
  if (left !== right) truth(`case ${L} mirrored`, X.caseOf({ top, bottom, left: right, right: left }).L === L && X.caseOf({ top, bottom, left: right, right: left }).mirrored); }
truth('no case for a fixed top on a simply supported bottom', X.caseOf({ top: 'fixed', bottom: 'ss', left: 'ss', right: 'ss' }) === null);

// ---------- the JRC example L1: 190 mm solid blocks (7.3 N/mm² declared) in M6, 4.15 × 4.15 m, top free, Q_k 0.45 kN/m² ----------
const mas = { src: 'calc', unit: 'agg', group: 1, fb: 10, mortar: 'M6', category: 'I', exec: 2 };
{ const D = MW.design({ t: 190, h: 4150, l: 4150, edges: { top: 'free', bottom: 'ss', left: 'ss', right: 'ss' }, mas, flex: { src: 'na', size: 'block', declared: 7.3 }, loads: { wk: 0.45, density: 0 } }), v = D.leaves[0];
  truth('JRC: case A, two-way, h/l 1.0', D.S.mode === 'two' && D.S.L === 'A' && D.S.hl === 1);
  near('JRC: γ_M = 2.7 for flexure', D.gMf, 2.7); near('JRC: μ = 0.19/0.45', v.mu, 0.19 / 0.45); near('JRC: α₂ = 0.0862 (at μ 0.42)', v.a2, 0.0862, 0.002);
  near('JRC: W_Ed = 1.5 × 0.45', D.WEd * 1e3, 0.675); near('JRC: Z = 190²/6 = 6017 mm³/mm', v.Z, 6016.67, 1e-4);
  near('JRC: M_Rd1 = 0.19/2.7 × Z = 0.42 kNm/m', v.MRd1 / 1e3, 0.42, 0.01); near('JRC: M_Ed1 = μα₂ W l² = 0.42 kNm/m', v.MEd1 / 1e3, 0.42, 0.01);
  near('JRC: M_Ed2 = α₂ W l² = 1.00 kNm/m', v.MEd2 / 1e3, 1.00, 0.01); near('JRC: just adequate', D.utilMax, 1, 0.01);
  truth('JRC: no vertical checks with the top free', !D.V); }
// ---------- σ_d, a cavity wall, the vertical checks ----------
const cav = { t: 100, h: 2600, l: 4500, edges: { top: 'ss', bottom: 'ss', left: 'ss', right: 'ss' }, mas: { ...mas, mortar: 'M4' }, flex: { src: 'na', size: 'block', declared: 7.3 },
  leaf2: { t: 102.5, src: 'na', unit: 'clay', mortar: 'M4', absorption: '7to12' }, loads: { Gk: 15, Qk: 7.5, combo: '6.10', wk: 0.9, density: 21, rho2: 0.75, eTop: 20 } };
{ const D = MW.design(cav), [a, b] = D.leaves, fd = 0.55 * 10 ** 0.7 * 4 ** 0.3 / 2.7, l = 4500;
  const sig = (15 + 21 * 100 * 1300e-6) / 100; near('σ_d = (G_k + the wall above mid-height)/t', a.sig, sig);
  near('loaded leaf: f_xd1,app = 0.25/2.7 + σ_d', a.fxd1app, 0.25 / 2.7 + sig); near('loaded leaf: μ over 1 is taken as 1', a.muU, 1);
  near('loaded leaf: α₂ (E, μ 1, h/l 0.578)', a.a2, X.alpha2('E', 1, 2600 / 4500));
  near('loaded leaf: W_Rd', a.WRd, Math.min(0.6 / 2.7 * 100 ** 2 / 6 / (a.a2 * l * l), a.fxd1app * 100 ** 2 / 6 / (a.a2 * l * l)));
  const mu2 = 0.4 / 1.1, a2b = X.alpha2('E', mu2, 2600 / 4500), Z2 = 102.5 ** 2 / 6;
  near('clay leaf: μ = 0.40/1.10', b.mu, mu2); near('clay leaf: W_Rd', b.WRd, Math.min(1.1 / 2.7 * Z2 / (a2b * l * l), 0.4 / 2.7 * Z2 / (mu2 * a2b * l * l)));
  near('the wall: W_Rd = the sum', D.lat.WRd, a.WRd + b.WRd); near('lateral utilisation', D.lat.util, 1.35e-3 / (a.WRd + b.WRd));
  near('shares by resistance', a.share + b.share, 1); near('each leaf at the wall utilisation', a.MEd2 / a.MRd2, D.lat.util);
  const rho = 0.75 / (1 + (0.75 * 2600 / 4500) ** 2), hef = rho * 2600, tef = Math.cbrt(2e6), ei = hef / 450;
  near('ρ₄ with both sides held', D.V.rho, rho); near('t_ef of the cavity wall (other leaf taken as 100)', D.V.tef, tef);
  const C = D.V.cases[0], Nt = 31.5, SW = 21 * 100 * 2600e-6, Nm = Nt + 1.35 * SW / 2, Mh = a.a1 * 1.35e-3 * a.share * l * l, em = (Nt * 10 + Mh) / Nm + ei;
  const phiM = (() => { const e = Math.max(em, 5), u = (hef / tef / Math.sqrt(1000) - 0.063) / (0.73 - 1.17 * e / 100); return (1 - 2 * e / 100) * Math.exp(-u * u / 2); })();
  near('mid-height: e with the wind e_hm', C.at[1].e, em); near('mid-height: Φ_m', C.at[1].phi, phiM); near('mid-height: N_Rd = Φ t f_d', C.at[1].NRd, phiM * 100 * fd);
  near('top: Φ_i with e = 20 + e_init', C.at[0].phi, 1 - 2 * (20 + ei) / 100);
  truth('least load with wind checked too', D.V.cases.length === 2 && D.V.cases[1].N === 15);
  truth('the tie share and stiffening walls noted', D.warnings.some(w => /ties/.test(w)) && D.warnings.some(w => /stiffening walls/.test(w))); }
{ const D = MW.design({ ...cav, loads: { ...cav.loads, Gk: 100 } }), fd = 0.55 * 10 ** 0.7 * 4 ** 0.3 / 2.7; near('σ_d capped at 0.2 f_d', D.leaves[0].sig, 0.2 * fd); }
{ const D = MW.design({ ...cav, l: 2000 }); near('ρ₄ = 0.5 l/h when h > 1.15 l', D.V.rho, 0.5 * 2000 / 2600); }
{ const D = MW.design({ ...cav, edges: { top: 'ss', bottom: 'ss', left: 'ss', right: 'free' } }); near('ρ₃ with one side held', D.V.rho, 0.75 / (1 + (0.75 * 2600 / 13500) ** 2)); truth('case J', D.S.L === 'J'); }
{ const D = MW.design({ ...cav, leaf2: null, loads: { ...cav.loads, rho2: 1 }, edges: { top: 'ss', bottom: 'ss', left: 'free', right: 'free' } }), v = D.leaves[0];
  truth('both sides free: spans vertically', D.S.mode === 'v'); near('vertical span: W_Rd = M_Rd1/(h²/8)', v.WRd, v.MRd1 / (2600 ** 2 / 8)); near('ρ₂ = 1.0 with no side held', D.V.rho, 1);
  near('vertical span: e_hm = w h²/8 / N', D.V.cases[0].Mh, 1.35e-3 * 2600 ** 2 / 8); }
{ const D = MW.design({ ...cav, leaf2: null, edges: { top: 'fixed', bottom: 'ss', left: 'free', right: 'free' } }); near('one end fixed: wL²/8 at the support governs', D.leaves[0].c, 1 / 8); }
{ const D = MW.design({ ...cav, leaf2: null, edges: { top: 'fixed', bottom: 'fixed', left: 'free', right: 'free' } }); near('both ends fixed: wL²/12', D.leaves[0].c, 1 / 12); }
{ const D = MW.design({ ...cav, leaf2: null, loads: { ...cav.loads, Gk: 0, Qk: 0 }, edges: { top: 'free', bottom: 'free', left: 'ss', right: 'ss' } }), v = D.leaves[0];
  truth('top and bottom free: spans horizontally', D.S.mode === 'h'); near('horizontal span: W_Rd = M_Rd2/(l²/8)', v.WRd, v.MRd2 / (4500 ** 2 / 8)); }
{ const D = MW.design({ ...cav, h: 1000, l: 5000 }); truth('h/l 0.2 with the top held: one-way vertical, noted', D.S.mode === 'v' && D.S.beyond && D.S.L === 'E'); }
{ const D = MW.design({ ...cav, h: 5000, l: 2000 }); truth('h/l 2.5 with both sides held: one-way horizontal', D.S.mode === 'h' && D.S.beyond); }
{ const D = MW.design({ ...cav, h: 6000, l: 2000, edges: { top: 'ss', bottom: 'ss', left: 'ss', right: 'free' } }); truth('h/l 3 with a free side: one-way vertical', D.S.mode === 'v' && D.S.beyond); }
throws('a long panel free at the top: a cantilever', () => MW.design({ ...cav, h: 1000, l: 5000, edges: { top: 'free', bottom: 'ss', left: 'ss', right: 'ss' } }), /cantilever/);
throws('edges that match no case', () => MW.design({ ...cav, edges: { top: 'fixed', bottom: 'ss', left: 'ss', right: 'ss' } }), /match no Annex E case/);
throws('free-standing wall', () => MW.design({ ...cav, edges: { top: 'free', bottom: 'fixed', left: 'free', right: 'free' } }), /free-standing/);
{ const D = MW.design({ ...cav, edges: { top: 'free', bottom: 'ss', left: 'ss', right: 'ss' } }); truth('top free: the top load left out, noted', !D.V && D.warnings.some(w => /left out/.test(w))); }
throws('no wind and no load', () => MW.design({ ...cav, loads: { ...cav.loads, wk: 0, Gk: 0, Qk: 0 } }), /wind load or a load/);
{ const D = MW.design({ ...cav, flex: { src: 'enter', fxk1: 0.3, fxk2: 0.9 } }); near('f_xk entered', D.leaves[0].fxd2, 0.9 / 2.7); }
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
