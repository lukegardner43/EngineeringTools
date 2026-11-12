// Working Platforms engine against BRE BR 470 (2004) Appendix A, outputs only: Table A1 (N_γ), Table A2 (K_p tan δ), Table A3
// (the load factors) and its four worked examples:
//  - soft clay (c_u 24 kPa, φ′_p 40°, W 0.7 m, L 3.6 / 3.1 m, 140 / 190 kPa): subgrade 128 kPa against 280 and 285, platform
//    alone 717 kPa, D₁ 0.72 and D₂ 0.71 m; with a 30 kN/m geogrid 0.53 m, but without it the platform must carry 1.25q₁k and
//    1.05q₂k: 0.61 m;
//  - firm clay (c_u 48 kPa): φ′_p 35° cannot carry case 2 however thick (336 > 316 kPa); at 40°, D₁ 0.50 and D₂ 0.63 m;
//  - granular, low water table (φ′_s 35°, γ′ 20, W 0.5, L 3.0 / 2.5 m, 140 / 220 kPa): subgrade 228 kPa, D₁ none, D₂ 0.38 m;
//  - granular, high water table (γ′ 10, W 0.9, L 3.6 / 3.2 m): subgrade 200 kPa, D₁ 0.39, D₂ 0.65 m.
// BR 470 rounds the shape factors to two places; the tolerances allow for it.
//   node tests/platform/test_platform.js
const { WorkingPlatform: P } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };

truth('Table A1: N_γ 10.9, 22.4, 48, 109, 272, 763 at 25° to 50°', [[25, 10.9], [30, 22.4], [35, 48], [40, 109], [45, 272], [50, 763]].every(([p, n]) => near(P.Ngamma(p), n, n * 0.004)), [25, 30, 35, 40, 45, 50].map(P.Ngamma));
truth('Table A2 and Figure A4: K_p tan δ 3.1, 5.5, 10.0 and 20 at 35°, 40°, 45° and 50°; log-linear between', near(P.kptand(35), 3.1, 1e-9) && near(P.kptand(40), 5.5, 1e-9) && near(P.kptand(45), 10, 1e-9) && near(P.kptand(50), 20, 1e-9) && near(P.kptand(37.5), Math.sqrt(3.1 * 5.5), 1e-9));
// ---- soft clay ----
const SOFT = { sub: 'cohesive', cu: 24, phiP: 40, gP: 20, W: 0.7, L1: 3.6, L2: 3.1, q1k: 140, q2k: 190 };
{
  const D = P.design(SOFT), [a, b] = D.C;
  truth('soft clay: s_c 1.04 / 1.05, s_γ 0.94 / 0.93, s_p 1.19 / 1.23', near(a.sc, 1.04, 0.005) && near(b.sc, 1.05, 0.005) && near(a.sg, 0.94, 0.005) && near(b.sg, 0.93, 0.005) && near(a.sp, 1.19, 0.005) && near(b.sp, 1.23, 0.005));
  truth('soft clay: R_d = 24 × 5.14 × 1.04 = 128 kPa against 2.0 × 140 = 280 and 1.5 × 190 = 285: a platform is needed', near(a.Rs, 128, 0.5) && a.qNo === 280 && b.qNo === 285 && D.needed);
  truth('soft clay: the platform material alone 0.5 × 20 × 0.7 × 109 × 0.94 = 717 kPa (721 unrounded) > 224 and 228', near(a.Rp, 717, 5) && D.checks.find(c => c.id === 'alone').util < 1);
  truth('soft clay: D₁ = √{0.7 (224 − 128)/(20 × 5.5 × 1.19)} = 0.72 m, D₂ = 0.71 m', near(a.D, 0.72, 0.006) && near(b.D, 0.71, 0.008), [a.D, b.D]);
  truth('soft clay: 0.72 m (BR 470: the larger); 0.725 m to 25 mm', near(D.Dreq, 0.717, 0.002) && near(D.Dround, 0.725, 1e-9));
  const G = P.design({ ...SOFT, reinf: { on: true, Tult: 30 } }), [g1, g2] = G.C;
  truth('soft clay with a geogrid T_ult 30 kN/m (T_d 15): D₁ = D₂ = 0.53 m', near(g1.D, 0.53, 0.005) && near(g2.D, 0.53, 0.011), [g1.D, g2.D]);
  truth('without the geogrid at 0.53 m: R_d 181 / 185 kPa against 1.25 × 140 = 175 and 1.05 × 190 = 200: case 2 fails', near(G.R(g1, 0.53, false), 181, 1.5) && near(G.R(g2, 0.53, false), 185, 2) && G.R(g2, 0.53, false) < 199.5);
  truth('so 0.61 m with the geogrid (BR 470), 0.625 m to 25 mm', near(G.Dreq, 0.61, 0.005) && near(G.Dround, 0.625, 1e-9), G.Dreq);
}
// ---- firm clay ----
{
  const F = P.design({ sub: 'cohesive', cu: 48, phiP: 35, gP: 20, W: 0.7, L1: 3.6, L2: 3.1, q1k: 190, q2k: 280 });
  truth('firm clay, φ′_p 35°: R_d 257 kPa against 380 and 420; the platform alone 316 kPa is under 1.2 × 280 = 336: a stronger material is needed', near(F.C[0].Rs, 257, 1) && near(F.C[0].Rp, 316, 1) && F.checks.find(c => c.id === 'alone').util > 1 && F.warnings.some(w => /stronger material/.test(w)));
  const F4 = P.design({ sub: 'cohesive', cu: 48, phiP: 40, gP: 20, W: 0.7, L1: 3.6, L2: 3.1, q1k: 190, q2k: 280 });
  truth('firm clay, φ′_p 40°: D₁ 0.50, D₂ 0.63 m', near(F4.C[0].D, 0.50, 0.006) && near(F4.C[1].D, 0.63, 0.008), [F4.C[0].D, F4.C[1].D]);
}
// ---- granular subgrades ----
{
  const L = P.design({ sub: 'granular', phiS: 35, gS: 20, phiP: 40, gP: 20, W: 0.5, L1: 3.0, L2: 2.5, q1k: 140, q2k: 220 });
  truth('granular, low water table: R_d = 0.5 × 20 × 0.5 × 48 × 0.95 = 228 kPa against 280 and 330', near(L.C[0].Rs, 228, 0.5) && L.needed);
  truth('granular, low water table: the platform alone 518 kPa', near(L.C[0].Rp, 518, 2));
  truth('granular, low water table: D₁ undefined (none), D₂ 0.38 m', L.C[0].D === 0 && near(L.C[1].D, 0.38, 0.005), [L.C[0].D, L.C[1].D]);
  const H = P.design({ sub: 'granular', phiS: 35, gS: 20, wt: 0, phiP: 40, gP: 20, W: 0.9, L1: 3.6, L2: 3.2, q1k: 140, q2k: 220 });
  truth('granular, water at the surface: γ′ = 20 − 10 = 10 kN/m³, R_d = 0.5 × 10 × 0.9 × 48 × 0.925 = 200 kPa', near(H.gSe, 10, 1e-12) && near(H.C[0].Rs, 200, 0.5));
  truth('granular, water at the surface: D₁ 0.39, D₂ 0.65 m', near(H.C[0].D, 0.39, 0.008) && near(H.C[1].D, 0.65, 0.005), [H.C[0].D, H.C[1].D]);
  const deep = P.design({ sub: 'granular', phiS: 35, gS: 20, wt: 2.0, phiP: 40, gP: 20, W: 0.9, L1: 3.6, L2: 3.2, q1k: 140, q2k: 220 });
  truth('a water table deeper than 2W: the bulk weight', near(deep.gSe, 20, 1e-12));
}
// ---- the rules ----
{
  truth('Table A3: 2.0 / 1.5 without a platform, 1.6 / 1.2 with, 1.25 / 1.05 for the unreinforced check', P.design(SOFT).C.map(c => [c.gNo, c.gYes, c.gChk].join()).join(';') === '2,1.6,1.25;1.5,1.2,1.05');
  const firm = P.design({ ...SOFT, cu: 90 });
  truth('c_u 90 kPa: no platform needed for bearing, with the note on a running surface and on 80 kPa', !firm.needed && firm.Dreq === 0 && firm.warnings.some(w => /running surface/.test(w)) && firm.warnings.some(w => /over 80 kPa/.test(w)));
  const soft = P.design({ ...SOFT, cu: 15 });
  truth('c_u 15 kPa: outside the method (fails)', soft.checks.find(c => c.id === 'range').util > 1);
  const thin = P.design({ ...SOFT, q1k: 80, q2k: 90 });
  truth('the minimum 300 mm governs when the calculation gives less', thin.needed && near(thin.Dreq, 0.3, 1e-12) && thin.Dcalc < 0.3, [thin.Dcalc, thin.Dreq]);
  const light = P.design({ ...SOFT, q1k: 80, q2k: 90, W: 0.4, L1: 2, L2: 2, light: true });
  truth('light plant: half the track width (0.2 m) when less than 300 mm', near(light.Dmin, 0.2, 1e-12));
  const prop = P.design({ ...SOFT, Dprop: 0.6 });
  truth('a proposed 0.6 m against 0.72 m needed fails', prop.checks.find(c => c.id === 'thick').util > 1 && prop.checks.find(c => c.id === 'case2').util > 1);
  const big = P.design({ ...SOFT, q2k: 400 });
  truth('a heavy rig: over 0.8 m flagged; D/W checked', big.Dreq > 0.8 && big.warnings.some(w => /0.8 m/.test(w)) && big.checks.some(c => c.id === 'dw'));
}
truth('refuses: a platform φ′ under 35°', throws(() => P.design({ ...SOFT, phiP: 32 }), /35° to 50°/));
truth('refuses: no track width', throws(() => P.design({ ...SOFT, W: 0 }), /Track width/));
truth('refuses: no pressures', throws(() => P.design({ ...SOFT, q1k: 0, q2k: 0 }), /bearing pressures/));
truth('refuses: a submerged weight that is not positive', throws(() => P.design({ sub: 'granular', phiS: 30, gS: 9, wt: 0, phiP: 40, W: 0.7, L1: 3, L2: 3, q1k: 100, q2k: 100 }), /effective unit weight/));

console.log(`\n${pass}/${pass + fail} passed`); if (fail) process.exit(1);
