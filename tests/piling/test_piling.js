// Sheet pile wall: Coulomb coefficients, Blum cantilever and free-earth propped walls against closed forms (uniform dry sand),
// water pressures, DA1 combinations and the section check.
const { Piling: P } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const r = Math.PI / 180;
// Coulomb: delta = 0 gives Rankine; delta > 0 against the closed form
near('Coulomb Ka (delta 0) = (1 - sin)/(1 + sin)', P.coulomb(30, 0).Ka, 1 / 3, 1e-12); near('Coulomb Kp (delta 0) = 3', P.coulomb(30, 0).Kp, 3, 1e-12);
{ const f = 32 * r, d = 20 * r, s = Math.sqrt(Math.sin(f + d) * Math.sin(f) / Math.cos(d));
  near('Coulomb Ka,h (phi 32, delta 20)', P.coulomb(32, 20).Ka, Math.cos(f) ** 2 / (Math.cos(d) * (1 + s) ** 2) * Math.cos(d), 1e-12); }
truth('passive wall friction capped at phi/3', Math.abs(P.coeffs({ phi: 30, c: 0, dA: 0, dP: 1 }, 1).Kp - P.coulomb(30, 10).Kp) < 1e-12);
const L = [{ top: 0, g: 18, gsat: 20, phi: 30, c: 0, dA: 0, dP: 0 }];
const base = { layers: L, H: 4, q: 0, zwR: Infinity, zwE: Infinity, type: 'cant', zp: 0, unplanned: false, section: { W: 1000, fy: 270, betaB: 1 } };
{ const a = P.analyse(base, 1), H = 4, x = H / (3 - 1);
  near('Blum cantilever: d0 = H/((Kp/Ka)^(1/3) - 1)', a.d0, H / (Math.cbrt(9) - 1), 1e-6);
  near('cantilever: M_max = Ka g (H + x)³/6 - Kp g x³/6', a.Mmax, (1 / 3) * 18 * (H + x) ** 3 / 6 - 3 * 18 * x ** 3 / 6, 2e-3); near('cantilever: zero shear at H + H/(sqrt(Kp/Ka) - 1)', a.zM, H + x, 2e-3);
  const D = P.design(base); near('design embedment = 1.2 max(d0)', D.dReq, 1.2 * Math.max(D.c1.d0, D.c2.d0), 1e-12);
  truth('combination 2 (factored phi) needs more embedment', D.c2.d0 > D.c1.d0);
  near('M_Ed = max(1.35 M1, M2)', D.MEd, Math.max(1.35 * D.c1.Mmax, D.c2.Mmax), 1e-12); }
{ const b = P.analyse({ ...base, type: 'prop', zp: 0 }, 1);
  let d = 2; for (let i = 0; i < 60; i++) { const f = 6 * (4 + d) ** 3 / 3 - 27 * d * d * (4 + 2 * d / 3), df = 6 * (4 + d) ** 2 - 27 * (2 * d * (4 + 2 * d / 3) + 2 * d * d / 3); d -= f / df; }
  near('free earth (prop at the top): d0 by Newton on the moment equation', b.d0, d, 1e-6);
  near('free earth: prop force T = Ka g (H+d)²/2 - Kp g d²/2', b.T, 6 * (4 + d) ** 2 / 2 - 27 * d * d, 1e-6);
  const z0 = Math.sqrt(2 * b.T / 6); near('free earth: M_max = T z - Ka g z³/6 at zero shear', b.Mmax, b.T * z0 - 6 * z0 ** 3 / 6, 2e-3); }
// water: hydrostatic difference with the excavation side
{ const w = P.pressures({ ...base, zwR: 2, zwE: 4 }, 1, 4, 6);
  near('water on the retained side at 6 m = 9.81 x 4', w.uR, 9.81 * 4, 1e-12); near('water on the excavation side at 6 m = 9.81 x 2', w.uE, 9.81 * 2, 1e-12);
  near('effective vertical stress with water at 2 m: 18x2 + 10.19x4', P.sigmaV(L, 6, 0, 2, 0), 18 * 2 + (20 - 9.81) * 4, 1e-12); }
{ const u = P.analyse({ ...base, unplanned: true }, 1); near('unplanned excavation: min(10 % H, 0.5 m)', u.dH, 0.4, 1e-12);
  const D = P.design({ ...base, section: { W: 1300, fy: 270, betaB: 0.85 } }); near('M_c,Rd = beta_B W fy', D.McRd, 0.85 * 1300 * 270 / 1e3, 1e-12); }
console.log(`\n${n - fails}/${n} sheet pile checks passed`);
if (fails) process.exit(1);
