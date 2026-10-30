// Crane gantry girder: moving loads against closed forms, composite section with a cap channel by parallel axes,
// l_eff (Table 5.1), the compression chord, dynamic factors, fatigue ranges and deflection by hand.
const { EC3, Gantry: G, SECTION_DATA, PFC_DATA } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
// moving loads: two equal loads W at a on L: Mmax = W(2L - a)²/(8L) if a < 0.586L, else WL/4; Vmax = W(2 - a/L)
for (const [L, a] of [[6000, 3000], [8000, 2000], [6000, 4000], [5000, 4500]]) {
  const m = G.moving(L, a, 1, 2000), exp = a < (2 - Math.SQRT2) * L ? (2 * L - a) ** 2 / (8 * L) : L / 4;
  near(`moving loads L=${L} a=${a}: M_max`, m.Mmax, exp, 2e-4); near(`moving loads L=${L} a=${a}: V_max`, m.Vmax, 2 - a / L, 1e-9);
}
const I = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('533×210×92'))), cap = EC3.fromRowPFC(PFC_DATA.find(r => r[0].startsWith('300×90×41')));
{ const S = G.section(I, cap), zC = I.h + cap.tw - cap.cy, A = I.A + cap.A, zc = (I.A * I.h / 2 + cap.A * zC) / A;
  near('cap section: area', S.A, A, 1e-12); near('cap section: neutral axis', S.zc, zc, 1e-12);
  near('cap section: I_y by parallel axes', S.Iy, I.Iy + I.A * (I.h / 2 - zc) ** 2 + cap.Iz + cap.A * (zC - zc) ** 2, 1e-12);
  near('cap section: top chord I_z = flange + channel major axis', S.IzTop, I.tf * I.b ** 3 / 12 + cap.Iy, 1e-12); }
const base = { I, cap, grade: 'S355', L: 6000, a: 3000, Qc: 30e3, Qh: 60e3, HT: 6e3, phi1: 1.1, hc: 'HC2', vh: 0.1, phi5: 1.5, rail: { hr: 75, br: 75, Ir: 2e6, Ar: 5000, mass: 39, fixed: false },
  gG: 1.35, gQ: 1.35, Lr: 6000, cls: 'S3', catFlange: 112, catWeb: 71, catShear: 80, gMf: 1.15, deflV: 600, deflH: 600 };
{ const R = G.design(base);
  near('phi2 = 1.10 + 0.34 v_h (HC2)', R.phi2, 1.10 + 0.34 * 0.1, 1e-12); near('dynamic wheel load', R.Wd, 1.1 * 30e3 + 1.134 * 60e3, 1e-12);
  const g = (R.S.A * 7850e-6 + 39) * 9.81e-3; near('M_Ed = 1.35 W_d M(1) + 1.35 g L²/8', R.MEd, 1.35 * R.Wd * (12000 - 3000) ** 2 / 48000 + 1.35 * g * 36e6 / 8, 1e-3);
  near('M_z,Ed = 1.35 phi5 H_T M(1)', R.MzEd, 1.35 * 1.5 * 6e3 * (12000 - 3000) ** 2 / 48000, 1e-3);
  const beff = Math.min(I.b, 75 + 75 + I.tf); near('l_eff (rail not rigidly fixed) = 3.25 ((I_r + I_f,eff)/t_w)^(1/3)', R.leff, 3.25 * Math.cbrt((2e6 + beff * I.tf ** 3 / 12 + cap.Iz) / I.tw), 1e-12);
  near('sigma_oz = F_z/(l_eff t_w)', R.soz, 1.35 * R.Wd / (R.leff * I.tw), 1e-12);
  const hw = I.h - 2 * I.tf; near('chord area = flange + cap + h_w t_w/5', R.Ach, I.b * I.tf + cap.A + hw / 5 * I.tw, 1e-12);
  const lam = 6000 / R.ich / (93.9 * Math.sqrt(235 / 355)), ph = 0.5 * (1 + 0.49 * (lam - 0.2) + lam * lam);
  near('chord chi (curve c)', R.chi, 1 / (ph + Math.sqrt(ph * ph - lam * lam)), 1e-12);
  near('fatigue lambda S3 (normal / shear)', R.fat.lamN * 1000 + R.fat.lamS, 397 + 0.575, 1e-12);
  near('fatigue: bottom flange range = lambda phi_fat W M / W_bot', R.fat.dsFl, R.fat.lamN * R.fat.phiFat * 90e3 * (12000 - 3000) ** 2 / 48000 / R.S.Wbot, 1e-9);
  // deflection for a=L/2: wheels at x and x+a, check against the maximum of the superposed closed form
  truth('vertical deflection positive and below the static two-wheel bound 2 P L³/(48 E I)', R.dV > 0 && R.dV <= 2 * 90e3 * 6000 ** 3 / (48 * EC3.E * R.S.Iy) + 1e-9);
  const R2 = G.design({ ...base, rail: { ...base.rail, fixed: true } });
  truth('rigidly fixed rail spreads the wheel further (larger l_eff)', R2.leff > R.leff);
  const R3 = G.design({ ...base, cap: null });
  truth('without the cap the top chord is weaker (higher LTB utilisation)', R3.checks.find(c => c.k === 'ltb').util > R.checks.find(c => c.k === 'ltb').util); }
console.log(`\n${n - fails}/${n} gantry checks passed`);
if (fails) process.exit(1);
