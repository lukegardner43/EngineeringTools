// RC Lintel Design: the load from the wall above (load triangle and interaction zone of PD 6697 clause 7, or all of it),
// dispersal at 45°, the effective span, the analysis, and the lintel checks, against hand calculation.
//   node tests/lintel/test_lintel.js
const { Lintel, EC2Section } = require('./load.js');
let n = 0, fails = 0;
const truth = (name, c) => { n++; if (!c) { fails++; console.log('FAIL ' + name); } else console.log('ok   ' + name); };
const near = (a, b, tol = 0.005) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const base = { L: 1800, t1: 150, t2: 150, b: 140, h: 215, fck: 32, fyk: 500, cover: 25, dg: 10, mode: 'tri', Hm: 2000, tm: 140, gm: 20,
  bottom: { n: 2, phi: 12 }, top: { n: 2, phi: 10 }, link: { phi: 6, legs: 2, s: 125 }, floors: [], points: [], dG: 0, dQ: 0, comb: '6.10', psi2: 0.3, fk: 5, gammaM: 2.3 };
const D = o => Lintel.design({ ...base, ...o });
const src = (R, kind, cs) => R.sources.filter(s => s.kind === kind && (!cs || s.case === cs)).reduce((t, s) => t + s.W, 0);

// effective span, 5.3.2.2: a_i = min(h/2, t_i/2)
{ const R = D({}); truth('effective span 1800 + 75 + 75', near(R.leff, 1950, 1e-9) && near(R.a1, 75, 1e-9)); }
{ const R = D({ h: 120, t1: 300, t2: 100 }); truth('effective span with a shallow lintel: a₁ = h/2 = 60, a₂ = t₂/2 = 50', near(R.a1, 60, 1e-9) && near(R.a2, 50, 1e-9) && near(R.leff, 1910, 1e-9)); }
// self weight over the whole lintel
{ const R = D({}); truth('self weight 25 kN/m³ × b × h × (l_n + t₁ + t₂)', near(src(R, 'self'), 25e-6 * 140 * 215 * 2100)); }
// masonry: the load triangle 0.5 × 1.1L × 0.55L, truncated by a low wall; all of it when the wall does not arch
{ const R = D({}), qm = 20e-6 * 140; truth('masonry in the load triangle: q × 0.3025 L²', near(src(R, 'masonry'), qm * 0.3025 * 1800 * 1800)); }
{ const Hm = 400, R = D({ Hm }), qm = 20e-6 * 140; truth('a wall lower than the triangle: q × (0.3025L² − (0.55L − H)²)', near(src(R, 'masonry'), qm * (0.3025 * 1800 * 1800 - (990 - Hm) ** 2))); }
{ const R = D({ mode: 'full', Hm: 600 }), qm = 20e-6 * 140; truth('no arching: q × H × lintel length', near(src(R, 'masonry'), qm * 600 * 2100)); }
// floors: in full in the triangle, halved in the zone, nothing above; 45° dispersal
{ const R = D({ floors: [{ y: 0, G: 4, Q: 0 }] }); truth('a floor at the top of the lintel: G × 1.1 L', near(src(R, 'floor', 'G'), 4 * 1.1 * 1800)); }
{ const R = D({ t1: 300, t2: 300, floors: [{ y: 300, G: 4, Q: 2 }] });
  const h45 = 990 - 300, h60 = 990 - 300 / Math.sqrt(3), eff = 2 * h45 + (h60 - h45);   // full width plus two half-weighted strips
  truth('a floor at 300: full over 2(0.55L − y), halved out to 0.55L − y/√3, all on the lintel', near(src(R, 'floor', 'G'), 4 * eff) && near(src(R, 'floor', 'Q'), 2 * eff)); }
{ const R = D({ floors: [{ y: 1200, G: 4, Q: 3 }] }); truth('a floor in the interaction zone only: factor 0.5', R.floors[0].factor === 0.5 && src(R, 'floor', 'G') > 0); }
{ const R = D({ floors: [{ y: 1800, G: 4, Q: 3 }] }); truth('a floor above the interaction zone (0.95L = 1715): not carried', R.floors[0].factor === 0 && src(R, 'floor') === 0); }
{ const R = D({ mode: 'full', floors: [{ y: 600, G: 4, Q: 0 }] }); truth('no arching: the floor in full over the lintel length', near(src(R, 'floor', 'G'), 4 * 2100)); }
// point loads: shares and dispersal, the part spreading past the ends lost to the wall
{ const R = D({ t1: 600, t2: 600, points: [{ x: 900, y: 300, G: 10, Q: 0 }, { x: 900, y: 1200, G: 10, Q: 0 }, { x: 900, y: 1800, G: 10, Q: 0 }] });
  truth('point loads: 1 in the triangle, 0.5 in the zone, 0 above', R.points.map(p => p.factor).join() === '1,0.5,0');
  const w = R.sources.filter(s => s.kind === 'point').map(s => s.W / 1e3);
  truth('point loads spread at 45° and kept whole when within the lintel (10 and 5 kN)', near(w[0], 10, 0.01) && near(w[1], 5 * Math.min(1, 3000 / 2400), 0.01)); }
{ const R = D({ points: [{ x: 900, y: 1500, G: 10, Q: 0 }], mode: 'full' }); truth('a high point load spreading past the ends: 10 × 2100/3000 on the lintel', near(src(R, 'point') / 1e3, 7, 0.01)); }
// statics: reactions balance the ULS load (6.10), loads over the bearings go straight in
{ const R = D({ floors: [{ y: 300, G: 4, Q: 3 }], points: [{ x: 400, y: 200, G: 6, Q: 2 }], dG: 1, dQ: 1 });
  const G = R.sources.filter(s => s.case === 'G').reduce((t, s) => t + s.W, 0), Q = R.sources.filter(s => s.case === 'Q').reduce((t, s) => t + s.W, 0);
  truth('reactions sum to 1.35ΣG + 1.5ΣQ', near(R.R1 + R.R2, 1.35 * G + 1.5 * Q, 1e-6)); }
// a uniform load: M = w l_eff²/8 at mid-span, V at the face = w(l_eff/2 − a₁); the load over the bearings adds to the reactions only
{ const R = D({ mode: 'full', Hm: 600, link: null, fk: 0 }), w = 1.35 * (25e-6 * 140 * 215 + 20e-6 * 140 * 600);
  truth('uniform load: M_Ed = w l_eff² / 8 at mid-span', near(R.MEd, w * R.leff ** 2 / 8, 0.003) && near(R.xM, 900, 0.01));
  truth('uniform load: V_Ed at the face = w (l_eff/2 − a₁)', near(R.VEd, w * (R.leff / 2 - R.a1), 0.005));
  truth('uniform load: each reaction w × lintel length / 2', near(R.R1, w * 2100 / 2, 0.003));
  truth('no links: 6.2.1(4) check = clear span / 2 m', near(R.checks.find(c => c.id === 'nolinks').util, 0.9, 1e-9) && !R.checks.some(c => c.id === 'links')); }
// 6.10a and 6.10b
{ const R = D({ comb: '6.10ab', floors: [{ y: 0, G: 2, Q: 6 }] }); truth('6.10a/b: two combinations, the governing one named', R.runs.length === 2 && /6\.10[ab]/.test(R.govCombo)); }
// the section: the engine's EC2Section result is that of its own input
{ const R = D({ floors: [{ y: 300, G: 4, Q: 3 }] }), S = EC2Section.design(R.secIn);
  truth('section: M_Rd, d and the checks as EC2Section gives them', near(R.sec.res.MRd, S.res.MRd, 1e-9) && near(R.sec.d, 178, 1e-9) && R.sec.checks.length === S.checks.length);
  truth('shear passed at d from the face: V_Ed − w d = V_Ed,d', near(R.secIn.shear.VEd - R.secIn.shear.w * R.d, R.VEd_d, 1e-6)); }
// lateral stability 5.9(3), bearing on the masonry 6.1.3
{ const R = D({ b: 100, h: 300, L: 3000 }), c = R.checks.find(k => k.id === 'lat');
  truth('lateral stability: max(l₀t / (50b/(h/b)^⅓), (h/b)/2.5)', near(c.util, Math.max(R.leff / (50 * 100 / Math.cbrt(3)), 3 / 2.5), 1e-9)); }
{ const R = D({}), c = R.checks.find(k => k.id === 'bearing'); truth('bearing: R / (b t) against f_k / γ_M', near(c.util, Math.max(R.R1 / (140 * 150), R.R2 / (140 * 150)) / (5 / 2.3), 1e-9)); }
{ const R = D({ fk: 0 }); truth('no masonry strength: no bearing check', !R.checks.some(k => k.id === 'bearing') && R.bearing === null); }
// warnings and errors
{ const R = D({ L: 5000, Hm: 6000 }); truth('warning: the load triangle method beyond 4.5 m', R.warnings.some(w => /4\.5 m/.test(w))); }
{ const R = D({ Hm: 1200 }); truth('warning: masonry lower than the interaction zone', R.warnings.some(w => /interaction zone/.test(w))); }
{ const R = D({ t1: 75 }); truth('warning: a bearing under 100 mm', R.warnings.some(w => /100 mm/.test(w))); }
{ let m = ''; try { D({ L: 0 }); } catch (e) { m = e.message; } truth('a zero span is refused', /Clear span/.test(m)); }
{ let m = ''; try { D({ h: 30 }); } catch (e) { m = e.message; } truth('bars that do not fit are refused', /do not fit/.test(m)); }
console.log(`\n${n - fails}/${n} lintel checks passed`); process.exit(fails ? 1 : 0);
