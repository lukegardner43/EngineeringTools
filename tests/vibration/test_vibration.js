// Floor vibration (SCI P354 simplified): four floors against the independent reference (reference/ref_vibration.py: section
// properties by moments of area and strip integration, primary deflection by virtual work, P354 expressions restated), and
// the frequency-dependent factors, caps, damping and walking-path effects.
const { EC3, Vibration: V, SECTION_DATA } = require('./load.js');
const REF = require('./ref_vibration.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const sec = name => EC3.fromRow(SECTION_DATA.find(r => r[0] === name));
const inp = c => ({ Ly: c.Ly, b: c.b, Lx: c.Lx, ny: c.ny, nx: c.nx, sec: sec(c.sec), prim: sec(c.prim), primComp: c.primComp, slab: { hs: c.hs, hp: c.hp, b0: c.b0, rib: c.rib, fck: c.fck, sw: c.sw },
  sdl: c.sdl, q: c.q, qFrac: 0.1, zeta: c.zeta, mue: c.mue, mur: c.mur, fp: c.fp, Lp: c.Lp, cutoff: c.cutoff, Rlim: 8, fmin: 3 });
for (const [k, { input, ref }] of Object.entries(REF)) {
  const R = V.design(inp(input));
  for (const f of ['Is', 'Ib', 'Ip', 'dSlab', 'dSBss', 'dSBfe', 'dPB', 'fA', 'fB', 'f0', 'm', 'Leff', 'S', 'M', 'W', 'rho', 'aSS', 'aTR', 'R']) near(`${k}: ${f}`, R[f], ref[f], 2e-4);   // slab I by 20000 strips in the reference
}
// factors
near('η = 0.5 below 5 Hz', V.eta(4.9), 0.5, 1e-12); near('η continuous at 5 Hz (0.21 × 5 − 0.55)', V.eta(5), 0.5, 1e-12); near('η continuous at 6 Hz', V.eta(6), 0.71, 1e-12); near('η = 0.71 above 6 Hz', V.eta(9), 0.71, 1e-12);
near('W_b = f/5 between 2 and 5 Hz', V.Wb(4), 0.8, 1e-12); near('W_b = 1 between 5 and 16 Hz', V.Wb(12), 1, 1e-12); near('W_b = 16/f above 16 Hz', V.Wb(20), 0.8, 1e-12);
near('walking speed at 2 Hz = 1.52 m/s (P354 (16))', V.pace(2), 1.52, 1e-12);
{ const c = REF.office_9x9.input, R = V.design(inp(c));
  near('transient: 185 = 60 × 2.2^1.43 (footfall impulse at f_p = 2.2 Hz)', 60 * 2.2 ** 1.43, 185, 2e-3);
  near('R = a_w,rms / 0.005', R.R, Math.max(R.aSS, R.aTR) / 0.005, 1e-12);
  const R2 = V.design({ ...inp(c), zeta: 0.06 }); near('steady state ∝ 1/ζ (ρ = 1)', R2.aSS, R.aSS / 2, 1e-12);
  const R3 = V.design({ ...inp(c), Lp: 1000 }); near('long walking path: ρ → 1', R3.rho, 1, 1e-9);
  const R4 = V.design({ ...inp(c), mue: 0.5, mur: 0.5 }); near('response ∝ μ_e μ_r', R4.a, R.a / 4, 1e-12);
  const R5 = V.design({ ...inp(c), slab: { ...inp(c).slab, Is: 2 * R.Is } }); near('slab I override used (δ_slab halves)', R5.dSlab, R.dSlab / 2, 1e-12);
  const R6 = V.design({ ...inp(c), ny: 1, Ly: 6000 }); truth('L_eff capped at n_y L_y', Math.abs(R6.Leff - 6) < 1e-9 || R6.Leff < 6);
  const R7 = V.design({ ...inp(c), nx: 9 }); truth('bay counts limited to 4', R7.nx === 4);
  const R8 = V.design({ ...inp(c), q: 0 }); truth('less mass (no imposed): higher frequency', R8.f0 > R.f0);
  near('primary deflection: n point loads + UDL closed form vs reference', R.dPB, REF.office_9x9.ref.dPB, 1e-7);
  truth('low-frequency floor governed by the larger of steady state and transient', R.low && R.a === Math.max(R.aSS, R.aTR)); }
{ const R = V.design(inp(REF.stiff_short.input)); truth('high-frequency floor (f₀ ≥ 10 Hz): transient only', !R.low && R.a === R.aTR);
  const E = V.design({ ...inp(REF.stiff_short.input), cutoff: 12 }); truth('raising the cut-off makes it a low-frequency floor', E.low && E.a === Math.max(E.aSS, E.aTR)); }
{ let m = ''; try { V.design({ ...inp(REF.office_9x9.input), slab: { ...inp(REF.office_9x9.input).slab, hp: 140 } }); } catch (e) { m = e.message; } truth('rib deeper than the slab rejected', /Rib height/.test(m)); }
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
