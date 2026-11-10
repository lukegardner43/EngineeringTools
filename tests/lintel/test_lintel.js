// RC Lintel Design: the load from the wall above (load triangle and interaction zone of PD 6697 clause 7, or all of it),
// dispersal at 45°, the effective span, the analysis, and the lintel checks, against hand calculation; and the check of a
// Naylor lintel against the load tables of Naylor's March 2025 brochure.
//   node tests/lintel/test_lintel.js
const { Lintel, EC2Section, Naylor } = require('./load.js');
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

// ---- Naylor: the brochure's tables as built in ----
{ const L = Naylor.LINTELS;
  truth('Naylor tables: 60 lintels (Economy, on edge, Hi-Spec, Fire-Spec, XtraFire), unique ids', L.length === 60 && new Set(L.map(l => l.id)).size === 60
    && ['EC', 'EE', 'HS', 'FS', 'XF'].every(r => L.some(l => l.range === r)));
  truth('Naylor tables: every allowable load falls as the clear span grows', L.every(l => l.w.every((v, i) => i === 0 || v < l.w[i - 1])));
  truth('Naylor source: the March 2025 brochure with its address', Naylor.SOURCE.edition === 'March 2025' && /lintelsbrochurexfs4march2025/.test(Naylor.SOURCE.url) && Naylor.SOURCE.file === 'LintelsBrochureXFS4March2025');
  const at = (id, s) => Naylor.get(id).w[Naylor.SPANS.indexOf(s)];
  // values read from the brochure pages (the cells OCR misread are included: 5.56, 55.12, 27.71, 27.56, 22.73)
  truth('Naylor values as printed: R9 1800 28.63, ER3 1000 5.56, R3 700 55.12, R7 1500 27.71', at('HS-R9', 1800) === 28.63 && at('EC-ER3', 1000) === 5.56 && at('HS-R3', 700) === 55.12 && at('HS-R7', 1500) === 27.71);
  truth('Naylor values as printed: Fire R13 120 min 2400 27.56, Fire S8 90 min 2100 22.73, XFS8 3200 8.00, ER8 on edge 2700 3.55',
    at('FS-FireR13-120', 2400) === 27.56 && at('FS-FireS8-90', 2100) === 22.73 && at('XF-XFS8', 3200) === 8 && at('EE-ER8', 2700) === 3.55);
  truth('Naylor n/a as printed: S4 past 2700, R3 and Fire R3 past 2100, ER1 past 2100', Naylor.get('HS-S4').w.length === 8 && Naylor.get('HS-R3').w.length === 6 && Naylor.get('FS-FireR3-90').w.length === 6 && Naylor.get('EC-ER1').w.length === 6);
  truth('Naylor sizes and weights: R8 140 × 215 72 kg/m, Fire R11 98 kg/m, ER7 on edge 215 × 100 51.6 kg/m', (l => l.b === 140 && l.h === 215 && l.kg === 72)(Naylor.get('HS-R8')) && Naylor.get('FS-FireR11-60').kg === 98 && (l => l.b === 215 && l.h === 100 && l.kg === 51.6)(Naylor.get('EE-ER7')));
  truth('Naylor fire ratings: Hi-Spec 30, XFR9 to 240, XFS4 to 120', Naylor.get('HS-R9').fire === 30 && Naylor.get('XF-XFR9').fire === 240 && Naylor.get('XF-XFS4').fire === 120);
}
{ const l = Naylor.get('HS-R9'), a = s => Naylor.allowable(l, s);
  truth('Naylor row: the next tabulated clear span up (1650 → 1800, 1800 → 1800, 500 → 700)', a(1650).span === 1800 && a(1800).w === 28.63 && a(500).span === 700);
  truth('Naylor row: past 3200 there is no allowable load', a(3300).w === null && /3200/.test(a(3300).why));
  truth('Naylor end bearing: 100 up to 1000, 150 up to 3000, 200 over', Naylor.bearingNeed(1000) === 100 && Naylor.bearingNeed(1001) === 150 && Naylor.bearingNeed(3000) === 150 && Naylor.bearingNeed(3001) === 200);
}
const nb = { L: 1800, t1: 150, t2: 150, mode: 'tri', Hm: 2000, tm: 140, gm: 20, floors: [], points: [], dG: 0, dQ: 0, comb: '6.10', fk: 5, gammaM: 2.3, lintel: 'HS-R8', n: 1, fireNeed: 30 };
const N = o => Lintel.naylor({ ...nb, ...o }), G_ = 9.80665e-3;
{ const R = N({ Hm: 0, dG: 5, dQ: 3 }), sw = 72 * G_;
  truth('Naylor w_eq: a uniform load is itself, with the lintel\'s own weight (5 + 3 + 0.706)', near(R.E.w, 8 + sw, 1e-6) && near(R.E.wM, 8 + sw, 1e-3) && near(R.E.wV, 8 + sw, 1e-3));
  truth('Naylor check: w_eq / allowable at 1800 (31.18)', near(R.checks.find(c => c.id === 'table').util, (8 + sw) / 31.18, 1e-6));
  truth('Naylor loads: own weight from kg/m over the lintel length, unfactored', near(src(R, 'self'), sw * 2100) && R.sources[0].case === 'G'); }
{ const R = N({ Hm: 0, points: [{ x: 900, y: 0, G: 10, Q: 0 }] }), sw = 72 * G_, le = R.E.le;
  truth('Naylor w_eq: a central point load is 2P/l + own weight (by moment)', near(R.E.wM, 2 * 10000 / le + sw, 0.01) && R.E.by === 'moment' && near(le, 1950, 1e-9)); }
{ const R = N({}), qm = 20e-6 * 140, Wm = qm * 0.3025 * 1800 * 1800;
  truth('Naylor loads: the masonry in the load triangle as for the RC design (q × 0.3025 L²)', near(src(R, 'masonry'), Wm));
  // by hand: the triangle peaks at q × 0.55L = 2.772 N/mm at mid-span; over the half l_eff 975 mm it gives
  // W = 2.772 (975 − 975²/1980) = 1371.8 N and a moment about mid-span 2.772 (975²/2 − 975³/2970) = 452 485 Nmm,
  // so M = 1371.8 × 975 − 452 485 = 885 040 Nmm; own weight 0.706 × 1950²/8 = 335 608; w_eq = 8 M / 1950²
  const q = qm * 990, Wh = q * (975 - 975 ** 2 / 1980), Mh = q * (975 ** 2 / 2 - 975 ** 3 / 2970), M = Wh * 975 - Mh + 72 * G_ * 1950 ** 2 / 8;
  truth('Naylor, the load triangle by hand: M_k 1.221 kNm, w_eq 2.568 kN/m by moment', near(R.E.M, M, 0.002) && near(R.E.w, 8 * M / 1950 ** 2, 0.002) && near(R.E.w, 2.568, 0.002) && R.E.by === 'moment' && R.util <= 1 && R.A.w === 31.18); }
{ const R = Lintel.naylor({ ...nb, points: [{ x: 900, y: 0, G: 10, Q: 0 }], Hm: 0 }), P = R.sources.find(s => s.kind === 'point');
  truth('a point load on the lintel between two strips is counted once (10 kN)', near(P.W, 10000, 1e-9));
  const R2 = D({ Hm: 0, points: [{ x: 900, y: 0, G: 10, Q: 0 }] });
  truth('the same in the RC design', near(src(R2, 'point', 'G'), 10000, 1e-9)); }
{ const R1 = N({ lintel: 'HS-R6' }), R2 = N({ lintel: 'HS-R6', n: 2 }), t = R => R.checks.find(c => c.id === 'table');
  truth('Naylor side by side: the allowable load doubles, the own weight too', near(t(R2).util, R2.E.w / (2 * 13.59), 1e-9) && R2.E.w > R1.E.w && t(R2).util < t(R1).util); }
{ const R = N({ t1: 100 }), c = R.checks.find(k => k.id === 'bearlen');
  truth('Naylor end bearing 100 mm at an 1800 mm opening: not met, fails', !c.ok && c.util > 1 && R.util > 1);
  const R2 = N({}), c2 = R2.checks.find(k => k.id === 'bearlen');
  truth('Naylor end bearing met: OK and never governs', c2.ok && c2.util === 0); }
{ const R = N({ fireNeed: 60 }), c = R.checks.find(k => k.id === 'fire'), R2 = N({ fireNeed: 60, lintel: 'FS-FireR8-60' });
  truth('Naylor fire: 60 min needed, R8 gives 30: not met; Fire R8 60 min: met', !c.ok && R.util > 1 && R2.checks.find(k => k.id === 'fire').ok && R2.util <= 1); }
{ const R = N({ L: 3400, t1: 200, t2: 200 }), c = R.checks.find(k => k.id === 'table');
  truth('Naylor: a clear span past the table fails with the reason', c.util === Infinity && /3200/.test(c.note) && R.A.w === null); }
{ const R = N({ L: 2400, lintel: 'HS-R3' }), c = R.checks.find(k => k.id === 'table');
  truth('Naylor: n/a in the brochure fails with the reason', c.util === Infinity && /n\/a/.test(c.note)); }
{ const R = N({ mode: 'full', Hm: 2400, L: 2700, lintel: 'HS-R6' }), c = R.checks.find(k => k.id === 'table');
  truth('Naylor: a heavy wall on R6 at 2700 fails on the table', c.util > 1 && R.util > 1); }
{ const R = N({}), me = R.options.find(o => o.l.id === 'HS-R8');
  truth('Naylor options: lightest first, the chosen lintel\'s utilisation matches its check', R.options.every((o, i) => i === 0 || o.l.kg >= R.options[i - 1].l.kg) && near(me.util, R.checks.find(c => c.id === 'table').util, 1e-9));
  const o6 = R.options.find(o => o.l.id === 'HS-S5'), E6 = N({ lintel: 'HS-S5' });
  truth('Naylor options: another lintel\'s utilisation equals checking it directly', near(o6.util, E6.checks.find(c => c.id === 'table').util, 1e-9)); }
{ const R = N({ fk: 4 }), b = R.checks.find(c => c.id === 'bearing');
  truth('Naylor bearing on the masonry: ULS reaction / (n b t) against f_k/γ_M', near(b.util, Math.max(R.R1 / (140 * 150), R.R2 / (140 * 150)) / (4 / 2.3), 1e-9)); }
{ const R = N({ L: 3000, t1: 200, t2: 200, lintel: 'HS-R6' });
  truth('Naylor: longer than the stock length gives a warning', R.warnings.some(w => /stock length/.test(w))); }
{ const R = N({ tm: 215 }); truth('Naylor: a lintel narrower than the leaf gives a warning', R.warnings.some(w => /140 mm wide and the leaf 215/.test(w))); }
{ let m = ''; try { N({ lintel: 'nope' }); } catch (e) { m = e.message; } truth('Naylor: an unknown lintel is refused', /Choose a Naylor lintel/.test(m)); }
console.log(`\n${n - fails}/${n} lintel checks passed`); process.exit(fails ? 1 : 0);
