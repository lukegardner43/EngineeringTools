// Masonry Column against hand calculation: f_d, the small-area factor, self-weight, the ULS cases (6.10, 6.10a/b, the
// least-load case with wind), e at the top, mid-height and bottom with e_init and the 0.05d floor, Φ_i and Φ_m (Annex G),
// both directions, wind, double curvature, slenderness, warnings and errors.
const { MasonryColumn: MC } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol = 1e-9) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };
const phiM = (hef, tef, emk, t) => { const e = Math.max(emk, 0.05 * t), u = (hef / tef / Math.sqrt(1000) - 0.063) / (0.73 - 1.17 * e / t); return (1 - 2 * e / t) * Math.exp(-u * u / 2); };
const mas = { src: 'calc', unit: 'agg', group: 1, fb: 10, mortar: 'M4', category: 'I', exec: 2 };
const base = { b: 440, t: 215, h: 2400, rhoT: 1, rhoB: 1, mas, loads: { Gk: 40, Qk: 20, combo: '6.10', density: 21 }, ecc: { tTop: 30, tBot: 0, bTop: 0, bBot: 0 } };
const fd = 0.55 * 10 ** 0.7 * 4 ** 0.3 / 2.7, A = 440 * 215, fA = 0.7 + 3 * A / 1e6, SW = 21 * A * 2400 * 1e-6;
const at = (D, c, k, s) => D.cases[c].dirs.find(x => x.key === k).at.find(x => x.at === s);
{ const D = MC.design(base);
  near('f_d = f_k/γ_M', D.fd, fd); near('small area: 0.7 + 3A', D.fA, fA); near('self-weight 21 × A × h', D.SW, SW);
  truth('no wind: one case', D.cases.length === 1); near('N at the top = 1.35 G + 1.5 Q', D.cases[0].N, 84);
  const T = at(D, 0, 't', 'top'), Mi = at(D, 0, 't', 'mid-height'), B = at(D, 0, 't', 'bottom'), ei = 2400 / 450;
  near('top, across t: e = 30 + h_ef/450', T.e, 30 + ei); near('top, across t: Φ_i = 1 − 2e/t', T.phi, 1 - 2 * (30 + ei) / 215);
  near('top, across t: N_Rd = Φ A f_d (0.7 + 3A)', T.NRd, T.phi * A * fd * fA);
  const Nm = 84e3 + 1.35 * SW / 2, em = 84e3 * 15 / Nm + ei;
  near('mid-height: N + half the self-weight', Mi.N, Nm); near('mid-height: e_m = the mean moment/N_m + e_init', Mi.e, em);
  near('mid-height: Φ_m (Annex G)', Mi.phi, phiM(2400, 215, em, 215));
  near('bottom: N + the self-weight', B.N, 84e3 + 1.35 * SW); near('bottom: e_init under 0.05t, so 0.05t', B.e, 10.75); near('bottom: Φ = 0.9', B.phi, 0.9);
  const Tb = at(D, 0, 'b', 'top'), Mb = at(D, 0, 'b', 'mid-height');
  near('across b: e = 0.05b', Tb.e, 22); near('across b: Φ_m with t_ef = b', Mb.phi, phiM(2400, 440, 22, 440));
  near('the largest utilisation is a check', D.utilMax, Math.max(...D.checks.map(c => c.util)));
  near('mid-height across t is checked at its utilisation', D.checks.find(c => c.id === 't-mid-height').util, Nm / (phiM(2400, 215, em, 215) * A * fd * fA));
  near('slenderness across t: h_ef/t/27', D.checks.find(c => c.id === 'slend-t').util, 2400 / 215 / 27);
  truth('8 checks: slenderness and three sections each way', D.checks.length === 8); }
// 6.10a and 6.10b
{ const D = MC.design({ ...base, loads: { ...base.loads, combo: '6.10ab', psi0: 0.7 } }); near('6.10b governs: 0.925 × 1.35 G + 1.5 Q', D.cases[0].N, 0.925 * 1.35 * 40 + 30); near('6.10b: self-weight × ξ 1.35', D.cases[0].gG, 0.925 * 1.35); }
{ const D = MC.design({ ...base, loads: { ...base.loads, Gk: 100, Qk: 10, combo: '6.10ab', psi0: 0.7 } }); near('6.10a governs: 1.35 G + 1.5 ψ₀ Q', D.cases[0].N, 135 + 10.5); truth('6.10a named', D.cases[0].name === '6.10a'); }
// wind
{ const D = MC.design({ ...base, loads: { ...base.loads, wk: 0.8, wdir: 't' } });
  truth('wind: two cases', D.cases.length === 2 && D.cases[1].label === 'Least load with wind'); near('wind at 1.5', D.cases[0].w, 1.2); near('least load: 1.0 G', D.cases[1].N, 40);
  const ei = 2400 / 450, Mh = 1.2 * 2400 ** 2 / 8;
  for (const [c, N, gG] of [[0, 84e3, 1.35], [1, 40e3, 1]]) {
    const Nm = N + gG * SW / 2, em = (N * 15 + Mh) / Nm + ei, s = at(D, c, 't', 'mid-height');
    near(`${D.cases[c].label}: mid-height e with w h²/8`, s.e, em); near(`${D.cases[c].label}: Φ_m`, s.phi, phiM(2400, 215, em, 215)); }
  near('wind across t does not bend across b', at(D, 1, 'b', 'mid-height').e, 22);
  truth('wind: the support forces noted', D.warnings.some(w => /2\.5 %/.test(w))); }
{ const D = MC.design({ ...base, ecc: { tTop: 0, tBot: 0, bTop: 0, bBot: 0 }, loads: { ...base.loads, wk: 0.8, wdir: 'b' } }), s = at(D, 1, 'b', 'mid-height');
  near('wind across b: e at mid-height', s.e, Math.max(1.2 * 2400 ** 2 / 8 / (40e3 + SW / 2) + 2400 / 450, 22)); }
// double curvature, ρ, slenderness
{ const D = MC.design({ ...base, ecc: { tTop: 30, tBot: -30, bTop: 0, bBot: 0 } }); near('double curvature: no moment at mid-height, e = max(e_init, 0.05t)', at(D, 0, 't', 'mid-height').e, 10.75);
  near('double curvature: the bottom has its own e', at(D, 0, 't', 'bottom').e, 84e3 * 30 / (84e3 + 1.35 * SW) + 2400 / 450); }
{ const D = MC.design({ ...base, rhoT: 0.75 }); near('ρ = 0.75: h_ef', D.cases[0].dirs[0].hef, 1800); near('e_init from h_ef', D.cases[0].dirs[0].einit, 4); }
{ const D = MC.design({ ...base, h: 6000 }); truth('h_ef/t_ef over 27 fails', D.checks.find(c => c.id === 'slend-t').util > 1 && D.utilMax > 1); }
{ const D = MC.design({ ...base, b: 665 }); near('A over 0.1 m²: no small-area factor', D.fA, 1); }
{ const D = MC.design({ ...base, b: 215, t: 102.5, ecc: { tTop: 0, tBot: 0, bTop: 0, bBot: 0 }, loads: { ...base.loads, Gk: 5, Qk: 2 } }); truth('under 0.04 m²: warned', D.warnings.some(w => /0\.04 m²/.test(w))); }
{ const D = MC.design({ ...base, mas: { src: 'fk', fk: 6, category: 'II', exec: 1 } }); near('f_k given, category II, class 1: γ_M 2.6', D.fd, 6 / 2.6); }
throws('e outside the section', () => MC.design({ ...base, ecc: { tTop: 110 } }), /outside the section/);
throws('no load', () => MC.design({ ...base, loads: { ...base.loads, Gk: 0, Qk: 0 } }), /load at the top/);
throws('no thickness', () => MC.design({ ...base, t: 0 }), /positive/);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
