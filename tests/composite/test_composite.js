// Composite beam: full design cases against the independent fibre / hand reference (reference/ref_composite.py), the plastic
// stress block against closed forms (PNA in the slab and in the top flange), stud and decking factors, eta_min, construction
// stage LTB with the load on the top flange, and the propped / partial-interaction branches.
const { EC3, Composite: C, SECTION_DATA } = require('./load.js');
const REF = require('./ref_composite.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const sec = name => EC3.fromRow(SECTION_DATA.find(r => r[0] === name));
const run = c => C.design({ ...c, s: sec(c.section) });
// 1 full cases against the reference (M_Rd within 0.5 %: the engine uses the datasheet area, given to 3 s.f., the reference the exact shape)
const TOL = { beff: 1e-12, PRd: 1e-9, nHalf: 0, NcFull: 1e-3, eta: 1e-3, etaMin: 1e-12, MRd: 5e-3, MEd: 1e-9, VEd: 1e-9, M1: 1e-9, reqAst: 2e-3, vEd: 1e-3, vCrush: 1e-12, I0: 1e-9, IL: 1e-9, dQ: 2e-3, dSDL: 2e-3, dTot: 2e-3, f: 1e-3 };
for (const [k, { input, ref }] of Object.entries(REF)) {
  if (!input) continue;
  const R = run(input);
  for (const [f, t] of Object.entries(TOL)) {
    if (f === 'M1' && input.propped) continue;
    const got = f === 'PRd' ? R.St.PRd : f === 'VEd' ? R.VEd : R[f];
    if (f === 'reqAst' && ref.reqAst === 0) { truth(`${k}: no transverse reinforcement needed`, R.reqAst === 0); continue; }
    near(`${k}: ${f}`, got, ref[f], t);
  }
  near(`${k}: steel V_Rd`, R.sh.VRd, ref.VRd, 1e-9);
}
// 2 plastic stress block closed forms
{ const s = sec('457×191×67 UKB'), fy = 355;
  const z = C.plastic(s, fy, 2000, 70, 130, 20, 0);
  near('no concrete: M = W_pl,y f_y (datasheet)', z.M, s.Wply * fy, 2e-3); near('no concrete: M = fibre integration of the true shape', z.M, REF.plastic_steel.M, 1e-3);
  // PNA in the slab: wide, deep slab
  const fc = 0.85 * 30 / 1.5, beff = 3000, a = C.plastic(s, fy, beff, 120, 130, 30 / 1.5, Infinity), xc = s.A * fy / (fc * beff);
  truth('wide slab: PNA in the slab', a.pnaIn === 'slab'); near('PNA in the slab: M = N_pl (h_s + h/2 - x_c/2)', a.M, s.A * fy * (130 + s.h / 2 - xc / 2), 1e-9);
  // PNA in the top flange: concrete force between N_pl - 2 b t_f f_y and N_pl
  const Nc = s.A * fy - fy * s.b * s.tf, b = C.plastic(s, fy, 3000, 120, 130, 30 / 1.5, Nc), x = (s.A * fy - Nc) / (2 * fy * s.b);
  truth('PNA in the top flange', b.pnaIn === 'top flange');
  near('PNA in the top flange: M = N_pl(h_s + h/2) - 2 f_y b x (h_s + x/2) - N_c x_c/2', b.M, s.A * fy * (130 + s.h / 2) - 2 * fy * s.b * x * (130 + x / 2) - Nc * Nc / (fc * 3000) / 2, 1e-6);
  truth('moment increases with the concrete force', C.plastic(s, fy, 3000, 120, 130, 20, 0.3 * s.A * fy).M < C.plastic(s, fy, 3000, 120, 130, 20, 0.6 * s.A * fy).M); }
// 3 studs and decking (6.18, 6.19, 6.23, Table 6.2)
{ const o = { d: 19, hsc: 95, fu: 450, fck: 30, Ecm: 33000, deck: 'none', nr: 1, t: 0.9, b0: 150, hp: 60 }, A = Math.PI * 19 * 19 / 4;
  const p = C.stud(o); near('(6.18) 0.8 f_u π d²/4 / γ_V', p.P1, 0.8 * 450 * A / 1.25, 1e-12); near('(6.19) 0.29 α d² √(f_ck E_cm) / γ_V, α = 1 (h/d = 5)', p.P2, 0.29 * 361 * Math.sqrt(30 * 33000) / 1.25, 1e-12);
  near('h_sc/d = 3.5: α = 0.2(h/d + 1) = 0.9', C.stud({ ...o, hsc: 66.5 }).alpha, 0.9, 1e-12);
  near('f_u capped at 500 N/mm²', C.stud({ ...o, fu: 600 }).P1, 0.8 * 500 * A / 1.25, 1e-12);
  near('perpendicular, one stud: k_t = 0.7 b0/h_p (h_sc/h_p - 1)', C.stud({ ...o, deck: 'perp' }).k, Math.min(0.85, 0.7 * 150 / 60 * (95 / 60 - 1)), 1e-12);
  near('perpendicular, two studs, t ≤ 1: k_t,max = 0.70', C.stud({ ...o, deck: 'perp', nr: 2, hsc: 125, b0: 175 }).k, 0.7, 1e-12);
  near('perpendicular, two studs, t > 1: k_t,max = 0.80', C.stud({ ...o, deck: 'perp', nr: 2, t: 1.2, hsc: 125, b0: 175 }).k, 0.8, 1e-12);
  near('perpendicular, one stud, t > 1: k_t,max = 1.0', C.stud({ ...o, deck: 'perp', t: 1.2, hsc: 125, b0: 200 }).k, 1.0, 1e-12);
  near('h_sc limited to h_p + 75 in k_t', C.stud({ ...o, deck: 'perp', hsc: 160, b0: 50 }).k, 0.7 * 50 / 60 * (135 / 60 - 1), 1e-12);
  near('parallel: k_l = 0.6 b0/h_p (h_sc/h_p - 1) ≤ 1', C.stud({ ...o, deck: 'para', b0: 80 }).k, 0.6 * 80 / 60 * (95 / 60 - 1), 1e-12); }
// 4 minimum degree of shear connection (6.6.1.2) and the linear interpolation
{ const c = REF.perp_single.input;
  near('η_min, 9 m, S355 = 1 - (0.75 - 0.27)', run(c).etaMin, 0.52, 1e-12);
  near('η_min, 5 m: lower bound 0.4', run({ ...c, L: 5000 }).etaMin, 0.4, 1e-12);
  near('η_min, 26 m: 1.0', run({ ...c, L: 26000 }).etaMin, 1, 1e-12);
  const R = run(c); truth('stress block (6.2.1.3(3)) ≥ linear interpolation (6.2.1.3(5))', R.MRd >= R.MRdLin - 1e-6);
  near('linear interpolation: M_pl,a + η (M_pl,Rd - M_pl,a)', R.MRdLin, R.Mpla + R.eta * (R.full.M - R.Mpla), 1e-12);
  const F = run({ ...REF.solid_propped.input, propped: false, section: '356×171×45 UKB', L: 6000, bL: 3000, bR: 3000, studs: { ...c.studs, spacing: 100 } });
  truth('full connection: η = 1 and M_Rd = M_pl,Rd', F.eta === 1 && Math.abs(F.MRd - F.full.M) < 1e-6); }
// 5 construction stage: decking parallel -> LTB with the wet load on the top flange
{ const c = REF.parallel.input, R = run(c), s = sec(c.section), L = c.L, zg = s.h / 2;
  const sn003 = 1.127 * Math.PI ** 2 * EC3.E * s.Iz / L ** 2 * (Math.sqrt(s.Iw / s.Iz + L ** 2 * EC3.G * s.It / (Math.PI ** 2 * EC3.E * s.Iz) + (0.454 * zg) ** 2) - 0.454 * zg);
  truth('parallel decking: construction LTB assessed', R.ltb && R.chiLT < 1);
  near('construction M_cr (load on the top flange) vs SN003 three-factor formula', R.ltb.Mcr, sn003, 0.03);
  truth('M_cr with the load on the top flange < load at the shear centre', R.ltb.Mcr < 1.127 * EC3.mcrUniform(s, L));
  const P = run(REF.perp_single.input); truth('perpendicular decking: no LTB at construction', P.ltb === null && P.chiLT === 1); }
// 6 propped construction and partial interaction
{ const c = REF.perp_single.input, U = run(c), P = run({ ...c, propped: true });
  truth('propped: construction checks omitted', !P.checks.some(x => x.k === 'c1' || x.k === 'c2') && U.checks.some(x => x.k === 'c1'));
  truth('propped: total deflection less than unpropped', P.dTot < U.dTot);
  const F = run({ ...REF.solid_propped.input, propped: false, section: '356×171×45 UKB', L: 6000, bL: 3000, bR: 3000, studs: { ...c.studs, spacing: 100 } });
  near('full connection: imposed deflection without the partial-interaction increase', F.dQ, 5 * F.wComp.Q * 6000 ** 4 / (384 * 210000 * F.I0), 1e-12);
  truth('η < 1 increases deflection (7.3.1(4))', U.dQ > 5 * U.wComp.Q * 9000 ** 4 / (384 * 210000 * U.I0));
  near('long-term modular ratio n_L = n_0 (1 + 1.1 × 2)', U.nL, U.n0 * 3.2, 1e-12);
  near('utilMax = largest utilisation', U.utilMax, Math.max(...U.checks.map(x => x.util)), 0);
  truth('edge beam: one-sided effective width, slab shear plane carries all of N_c', run(REF.edge_alternate.input).frac === 1); }
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
