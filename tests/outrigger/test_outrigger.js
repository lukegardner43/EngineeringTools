// Outrigger Loading engine: the outrigger reactions by statics (a rigid plane on four supports, and three when one lifts),
// the largest reaction through a full slew against its closed form, the 75% rule and a given load with their partial factors,
// the published CICA / CANZ crane-mat examples (48 t on 1.7 × 1.7 m: 162.8 kPa; 2.35 m² for 200 kPa), Annex D for a
// rectangle (drained and undrained), the one-way strip (statics and the cantilever deflection), the two-way circular plate
// against an independent finite-difference solution of the axisymmetric plate equation, the timber, steel and plastic mat
// checks, the deflection limits of TWf GN22, and the refusals and warnings.
//   node tests/outrigger/test_outrigger.js
const { Outrigger: O } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol, rel = (a, b, r) => Math.abs(a - b) <= r * Math.abs(b);
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const g = 9.81;

// ---- reactions by statics ----
{
  const a = 6, b = 5, V = 400;
  const c = O.reactions(V, 0, 0, a, b);
  truth('central load: V/4 at each outrigger', c.R.every(r => near(r, 100, 1e-9)) && c.lift === -1);
  const f = O.reactions(V, a / 4, 0, a, b);
  truth('e_x = a/4: front 3V/8, rear V/8', near(f.R[0], 150, 1e-9) && near(f.R[1], 150, 1e-9) && near(f.R[2], 50, 1e-9) && near(f.R[3], 50, 1e-9));
  const ex = 0.4 * a, ey = 0.4 * b, l = O.reactions(V, ex, ey, a, b);
  const P = [[a / 2, b / 2], [a / 2, -b / 2], [-a / 2, b / 2], [-a / 2, -b / 2]];
  truth('corner resultant: the rear right lifts (0) and the other three hold V, V e_x, V e_y', l.lift === 3 && l.R[3] === 0 && near(l.R.reduce((s, r) => s + r, 0), V, 1e-9)
    && near(l.R.reduce((s, r, i) => s + r * P[i][0], 0), V * ex, 1e-9) && near(l.R.reduce((s, r, i) => s + r * P[i][1], 0), V * ey, 1e-9), l.R);
  truth('three supports: front left takes V(e_x/a + e_y/b) = 0.8 V', near(l.R[0], V * (ex / a + ey / b), 1e-9), l.R[0]);
  truth('resultant beyond the outriggers: overturning (null)', O.reactions(V, 0.51 * a, 0, a, b) === null && O.reactions(V, 0.45 * a, 0.55 * b, a, b) === null && O.reactions(V, 0.45 * a, 0.45 * b, a, b) !== null);
}
// ---- through a full slew: max R = V/4 + (M/2)√(1/a² + 1/b²) for a slew centre at the middle, all four bearing ----
{
  const C = { a: 6, b: 5, xs: 0, Wc: 400, xc: 0, Wu: 0, ru: 0, Wcw: 0, rcw: 0, Wb: 0, kb: 0.5, phi: 1 }, lift = { P: 10, R: 8 }, V = 410, M = 80;
  const S = O.slew(C, lift, 1, 1), want = V / 4 + M / 2 * Math.sqrt(1 / 36 + 1 / 25);
  truth(`slew: largest reaction V/4 + (M/2)√(1/a² + 1/b²) = ${want.toFixed(2)} kN (to the ¼° step)`, near(S.gov.R, want, 0.01) && S.over === null, S.gov.R);
  truth('slew: at atan(a/b) from the front over the front left', near(S.best[0].th, Math.atan2(1 / 5, 1 / 6) * 180 / Math.PI, 0.25), S.best[0].th);
}
// ---- the published CICA / CANZ examples: 48 t on a 1.7 m square mat; the area for 200 kPa ----
const thin = { mat: 'plastic', fd: 50, Epl: 1e6, rhopl: 0.001, t: 1, span: 'two', footShape: 'round', foot: 300 };
{
  const D = O.design({ method: 'given', Fgiven: 48, Fq: 0, B: 1.7, L: 1.7, ...thin, basis: 'allow', qa: 200 });
  truth('CICA example 1: 48 t on 1.7 × 1.7 m = 162.8 kPa (with g 9.8; 163.0 with 9.81) ≤ 200', near(D.ground.q, 48 * g / 2.89, 0.01) && rel(D.ground.q, 162.8, 0.002) && D.checks.find(c => c.id === 'ground').util < 1, D.ground.q);
  truth('CICA example 2: the area for 200 kPa = 2.35 m²', rel(D.ground.sMin ** 2, 2.35, 0.003), D.ground.sMin ** 2);
}
// ---- the 75% rule and a given load ----
{
  const base = { B: 2, L: 2, t: 200, mat: 'timber', cls: 'D40', footShape: 'round', foot: 500, basis: 'allow', qa: 300 };
  const R = O.design({ ...base, method: 'rule', Wgross: 50, Prule: 5 });
  truth('75% rule: 0.75 × 50 t + 5 t = 42.5 t', near(R.F.k, (0.75 * 50 + 5) * g, 1e-9) && R.warnings.some(w => /C703/.test(w)));
  truth('75% rule: DA1-1 1.35 × 0.75W + 1.5P, DA1-2 1.0 × 0.75W + 1.3P', near(R.F.d.C1.R, (1.35 * 37.5 + 1.5 * 5) * g, 1e-9) && near(R.F.d.C2.R, (37.5 + 1.3 * 5) * g, 1e-9));
  truth('75% rule above 160 t: noted', O.design({ ...base, method: 'rule', Wgross: 200, Prule: 0, B: 6, L: 6, qa: 1000 }).warnings.some(w => /160 t/.test(w)));
  const Gv = O.design({ ...base, method: 'given', Fgiven: 30, Fq: 6 });
  truth('given: 30 t, 6 t hoisted: DA1-1 1.35 × 24 + 1.5 × 6 t', near(Gv.F.d.C1.R, (1.35 * 24 + 1.5 * 6) * g, 1e-9));
  truth('allowable: q = (F + mat weight)/A with the mat at ρ_mean (D40 660 kg/m³)', near(Gv.ground.q, (30 * g + 660 * g / 1000 * 4 * 0.2) / 4, 1e-9), Gv.ground.q);
}
// ---- Annex D, a rectangle under a central vertical load ----
{
  const r = O.annexD({ mode: 'drained', gam: 18, phi: 30 * Math.PI / 180, c: 5, cu: 0, D: 0.3, B: 1.5, L: 2.5 }, { gphi: 1, gcu: 1 });
  const t = Math.tan(Math.PI / 6), Nq = Math.exp(Math.PI * t) * Math.tan(Math.PI / 3) ** 2, Nc = (Nq - 1) / t, Ng = 2 * (Nq - 1) * t, sq = 1 + 0.6 * 0.5, sg = 1 - 0.3 * 0.6, sc = (sq * Nq - 1) / (Nq - 1);
  truth('Annex D drained: c′N_c s_c + q′N_q s_q + ½γB′N_γ s_γ, s_q = 1 + (B/L) sin φ′, s_γ = 1 − 0.3 B/L', near(r.q, 5 * Nc * sc + 18 * 0.3 * Nq * sq + 0.5 * 18 * 1.5 * Ng * sg, 1e-9), r.q);
  const u = O.annexD({ mode: 'undrained', gam: 18, phi: 0, c: 0, cu: 60, D: 0, B: 2, L: 2 }, { gphi: 1, gcu: 1.4 });
  truth('Annex D undrained: (π + 2)(c_u/1.4)(1 + 0.2 B/L)', near(u.q, (Math.PI + 2) * 60 / 1.4 * 1.2, 1e-9));
  const F = O.design({ method: 'given', Fgiven: 20, Fq: 0, B: 1.5, L: 1.5, ...thin, basis: 'fos', FoS: 2, bearing: 'undrained', cu: 50, gam: 18 });
  truth('factor of safety 2: q ≤ q_ult/2', near(F.checks.find(c => c.id === 'ground').util, F.ground.q / ((Math.PI + 2) * 50 * 1.2 / 2), 1e-9));
}
// ---- the one-way strip ----
{
  const s = O.strip(300, 2, 0.4);
  truth('strip: M = F(L − f)/8 = 60 kNm, V = F(L − f)/2L = 120 kN', near(s.M, 60, 1e-12) && near(s.V, 120, 1e-12));
  // the centre moment by statics of the half: the upward pressure F/L over L/2 at L/4, the foot's half F/2 at f/4
  truth('strip: the moment by statics of the half beam', near(s.M, 150 * 0.5 - 150 * 0.1, 1e-12));
  // the edge's rise relative to the centre by numerical double integration of M/EI over the half
  const n = 4000, l = 1, w = 150, qf = 750; let th = 0, d = 0;
  for (let i = 0; i < n; i++) { const x = (i + 0.5) / n * l, xe = l - x; const Mx = w * xe * xe / 2 - (xe > 0.8 ? qf * (xe - 0.8) ** 2 / 2 : 0); th += Mx / n; }
  { let slope = 0; d = 0; for (let i = 0; i < n; i++) { const x = (i + 0.5) / n * l, xe = l - x, Mx = w * xe * xe / 2 - (xe > 0.8 ? qf * (xe - 0.8) ** 2 / 2 : 0); slope += Mx / n; d += slope / n; } }
  truth('strip: EI δ = wℓ⁴/8 − q_f b³(4ℓ − b)/24 against a numerical double integration', rel(s.EIw, d, 1e-3), [s.EIw, d]);
}
// ---- the circular plate against a finite-difference solution of D(φ″ + φ′/r − φ/r²) = Q(r), M_r(a) = 0 ----
function fdPlate(F, a, r0, nu, N = 4000) {
  const h = a / N, p = F / (Math.PI * a * a), w0 = F / (Math.PI * r0 * r0);
  const Q = r => (r <= r0 ? (w0 - p) * r / 2 : F / (2 * Math.PI * r) - p * r / 2);
  // unknowns φ_1..φ_N (φ_0 = 0); rows 1..N-1 central differences, row N the free edge with a one-sided second-order difference
  const A = [], B = [], C = [], R = [];
  for (let i = 1; i < N; i++) { const r = i * h; A.push(1 / h / h - 1 / (2 * h * r)); B.push(-2 / h / h - 1 / (r * r)); C.push(1 / h / h + 1 / (2 * h * r)); R.push(Q(r)); }
  // edge: (3φ_N − 4φ_{N−1} + φ_{N−2})/2h + ν φ_N/a = 0; fold φ_{N−2} using row N−1 is awkward, so use the ghost-point form:
  // φ′(a) ≈ (φ_{N+1} − φ_{N−1})/2h = −ν φ_N/a, and the equation at N with the ghost eliminated
  const rN = a; A.push(2 / h / h); B.push(-2 / h / h - 1 / (rN * rN) - (2 * h) * nu / a * (1 / h / h + 1 / (2 * h * rN))); C.push(0); R.push(Q(rN));
  // Thomas algorithm (D = 1)
  const n = A.length, cp = new Array(n), dp = new Array(n);
  cp[0] = C[0] / B[0]; dp[0] = R[0] / B[0];
  for (let i = 1; i < n; i++) { const m = B[i] - A[i] * cp[i - 1]; cp[i] = C[i] / m; dp[i] = (R[i] - A[i] * dp[i - 1]) / m; }
  const phi = new Array(n + 1).fill(0); phi[n] = dp[n - 1];
  for (let i = n - 1; i >= 1; i--) phi[i] = dp[i - 1] - cp[i - 1] * phi[i + 1];
  const Mr = i => -((phi[i + 1] - phi[i - 1]) / (2 * h) + nu * phi[i] / (i * h));
  return { Mr, h, phi };
}
{
  const F = 300, a = 1.0, r0 = 0.25, nu = 0.3, P = O.circPlate(F, a, r0, nu), fd = fdPlate(F, a, r0, nu);
  const iC = 2, iR = Math.round(r0 / fd.h), iM = Math.round(0.6 / fd.h);
  truth('circular plate: radial moment near the centre against finite differences (0.5%)', rel(P.Mr(iC * fd.h), fd.Mr(iC), 0.005), [P.Mr(iC * fd.h), fd.Mr(iC)]);
  truth('circular plate: at the edge of the foot and at 0.6a (0.5%)', rel(P.Mr(iR * fd.h), fd.Mr(iR), 0.005) && rel(P.Mr(iM * fd.h), fd.Mr(iM), 0.005), [P.Mr(iR * fd.h), fd.Mr(iR)]);
  truth('circular plate: M_r = 0 at the free edge; M_r = M_t at the centre', near(P.Mr(a), 0, 1e-9) && near(P.Mr(0), P.Mt(0), 1e-12));
  truth('circular plate: the shear at the foot F/2πr₀ − p r₀/2', near(P.Q0, F / (2 * Math.PI * r0) - F / (Math.PI) * r0 / 2, 1e-9));
  // the moment grows as ln(a/r0) as the foot shrinks: (1 + ν)F/4π per unit of ln
  const d1 = O.circPlate(F, a, 0.02, nu).Mc - O.circPlate(F, a, 0.01, nu).Mc;
  truth('circular plate: halving a small foot adds (1 + ν)(F/4π) ln 2 at the centre', rel(Math.abs(d1), (1 + nu) * F / (4 * Math.PI) * Math.log(2), 0.002), d1);
}
// ---- the mat checks ----
const CR = { method: 'calc', a: 6.6, b: 6.0, xs: -1.2, Wc: 22, xc: 0.3, Wu: 7, ru: -0.8, Wcw: 11.8, rcw: 3.2, Wb: 8, dyn: 1, lifts: [{ P: 4, R: 14, name: 'Planned lift' }, { P: 0, R: 3, name: 'No load' }],
  B: 1.8, L: 1.8, t: 200, mat: 'timber', cls: 'D40', footShape: 'round', foot: 500, basis: 'ec7', bearing: 'drained', gam: 19, phi: 32, c: 0, D: 0, dcrit: 'cant' };
{
  const D = O.design(CR), m = D.mat;
  truth('page default: passes at 0.567, the ground (DA1-2) governing; 227.9 kN at the rear right', near(D.utilMax, 0.567, 0.0005) && D.checks.reduce((x, y) => (y.util > x.util ? y : x)).id === 'ground' && near(D.F.k, 227.9, 0.05) && D.F.gov.out.id === 'RR', [D.utilMax, D.F.k]);
  truth('timber D40: f_m,d = k_mod f_m,k/γ_M = 0.70 × 40/1.3, f_v,d = 0.70 × 4.2/1.3, f_c,90,d = 0.70 × 5.5/1.3', near(m.fmd, 0.7 * 40 / 1.3, 1e-9) && near(m.fvd, 0.7 * 4.2 / 1.3, 1e-9) && near(m.fc90d, 0.7 * 5.5 / 1.3, 1e-9));
  truth('timber one-way: M_d = F_d(L − f)/8, σ = 6M/Bt²', near(m.Md, D.F.d.C1.R * 1.3 / 8, 1e-9) && near(m.sigma, m.Md * 6 / (1.8 * 0.04) / 1000, 1e-9));
  truth('timber crushing: F_d / (π 0.5²/4)', near(m.sc90, D.F.d.C1.R / (Math.PI * 0.0625) / 1000, 1e-9));
  truth('deflection limit 0.75% of the cantilever (L − f)/2 = 0.65 m: 4.9 mm', near(m.lim, 4.875, 1e-9));
  truth('deflection limit 10 mm per metre width: 18 mm; capped at 25 mm', near(O.design({ ...CR, dcrit: 'width' }).mat.lim, 18, 1e-9) && near(O.design({ ...CR, dcrit: 'width', B: 3, L: 3 }).mat.lim, 25, 1e-9));
  truth('default: every outrigger bears through the slew, no notes', !D.warnings.length && D.crane.runs.every(r => r.K.minR > 0));
  const S = O.design({ ...CR, mat: 'steel', grade: 'S275', t: 40 });
  truth('steel plate 40 mm: f_y 265 (16 < t ≤ 40), two-way, von Mises at the centre', near(S.mat.M.fy, 265, 1e-12) && S.mat.span === 'two' && near(S.mat.at, 0, 1e-12) && near(S.mat.svm, Math.abs(S.mat.sr), 1e-9));
  truth('steel one-way when chosen', O.design({ ...CR, mat: 'steel', grade: 'S355', t: 50, span: 'one' }).mat.span === 'one' && O.fyOf('S355', 50) === 335);
  const Pl = O.design({ ...CR, mat: 'plastic', fd: 15, Epl: 1000, t: 100, span: 'two' });
  truth('plastic 100 mm: too weak and too flexible here', Pl.checks.find(c => c.id === 'bend').util > 1 && Pl.checks.find(c => c.id === 'defl').util > 1);
  truth('timber is always one-way (TWf GN14)', O.design({ ...CR, span: 'two' }).mat.span === 'one');
  truth('two-way, long mat: noted', O.design({ ...CR, mat: 'steel', t: 40, B: 1.5, L: 3 }).warnings.some(w => /one-way too/.test(w)));
  const U = O.design({ ...CR, bearing: 'undrained', cu: 40 });
  truth('undrained ground c_u 40 kPa: DA1-2 on (π + 2)(40/1.4)(1.2)', near(U.ground.R, (Math.PI + 2) * 40 / 1.4 * 1.2, 1e-9) && U.ground.k === 'C2');
}
// ---- refusals ----
truth('refuses: no lifts', throws(() => O.design({ ...CR, lifts: [] }), /at least one lift/));
truth('refuses: an overturning lift', throws(() => O.design({ ...CR, lifts: [{ P: 20, R: 20, name: 'Too far' }] }), /overturns/));
truth('refuses: a foot as big as the mat', throws(() => O.design({ ...CR, foot: 1800 }), /foot must be smaller/));
truth('refuses: undrained without c_u', throws(() => O.design({ ...CR, bearing: 'undrained' }), /c_u,k/));
truth('refuses: hoisted part more than the load', throws(() => O.design({ ...CR, method: 'given', Fgiven: 10, Fq: 12 }), /hoisted part/));
truth('refuses: no allowable pressure', throws(() => O.design({ ...CR, basis: 'allow' }), /Allowable bearing pressure/));

console.log(`\n${pass}/${pass + fail} passed`); if (fail) process.exit(1);
