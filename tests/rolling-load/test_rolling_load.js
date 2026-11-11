// Rolling Load Analysis engine against closed forms: Barré's theorem for the absolute maximum moment on a simply supported span
// (two and three loads), PL/4 and the reactions and shears for one load, the deflection of two symmetric loads, a fixed-ended
// span (PL/8), a propped cantilever (3PL/16 at the fixed end), a cantilever (PL), and a two-span beam (the reaction 11P/16
// and the support moment −3PL/32 with the load at mid-span, the support moment's influence line peak 0.0962PL at a = L/√3);
// the design combination, the uplift warning and the refusals.
//   node tests/rolling-load/test_rolling_load.js
const { RollingLoad: RL } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol, rel = (a, b, r) => Math.abs(a - b) <= r * Math.abs(b);
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const one = (o = {}) => RL.design({ spans: [{ L: 10, I: 50000, G: 0 }], supports: ['pin', 'pin'], E: 210, train: [{ P: 100 }], gG: 1.35, gQ: 1.5, ...o });

// ---- one load on a simple span ----
{
  const D = one();
  truth('single load: M max PL/4 = 250 kNm at mid-span', near(D.abs.M, 250, 1e-6) && near(D.abs.x, 5, 1e-6), [D.abs.M, D.abs.x]);
  truth('single load: reactions up to P = 100 kN', D.reac.every(r => near(r.Rq, 100, 1e-6)));
  truth('single load: shear beside the supports reaches ±P', near(Math.max(...D.Vmax), 100, 1e-6) && near(Math.min(...D.Vmin), -100, 1e-6));
  truth('single load: the moment envelope is P x (L − x)/L at every section', D.sx.every((x, k) => near(D.Mmax[k], 100 * x * (10 - x) / 10, 1e-6)));
  truth('single load: deflection PL³/48EI', rel(D.defl[0].w, 1e5 * 1e4 ** 3 / (48 * 210e3 * 5e8), 1e-6), D.defl[0].w);
  truth('design: γ_Q × moving only (no permanent load here)', near(D.absU.M, 1.5 * 250, 1e-6) && near(D.VEd, 150, 1e-6));
}
// ---- Barré's theorem ----
{
  const D2 = one({ train: [{ P: 100 }, { P: 100, s: 3 }] });
  truth('two loads 100 kN at 3 m on 10 m: 361.25 kNm under a load at 4.25 m (Barré)', near(D2.abs.M, 361.25, 1e-6) && near(Math.min(D2.abs.x, 10 - D2.abs.x), 4.25, 1e-6), [D2.abs.M, D2.abs.x]);
  truth('two loads: largest reaction 100 + 100 × 7/10 = 170 kN, shear beside it 170 kN', D2.reac.every(r => near(r.Rq, 170, 1e-6)) && near(Math.abs(D2.vabs.V), 170, 1e-6));
  truth('two loads: deflection of the symmetric pair 2 × Pa(3L² − 4a²)/48EI (a 3.5 m) is the peak at mid-span', rel(D2.Wmax[D2.sx.findIndex(x => Math.abs(x - 5) < 1e-9)], 2 * 1e5 * 3500 * (3e8 - 4 * 3500 ** 2) / (48 * 210e3 * 5e8), 1e-6));
  const w3 = [{ P: 80 }, { P: 120, s: 2 }, { P: 60, s: 1.5 }], D3 = one({ spans: [{ L: 12, I: 50000 }], train: w3 }), B3 = RL.ssAbsMax(12, D3.wheels);
  truth(`three unequal loads on 12 m: ${B3.M.toFixed(3)} kNm (Barré), to 0.01%`, rel(D3.abs.M, B3.M, 1e-4), [D3.abs.M, B3.M]);
  const D4 = one({ spans: [{ L: 6, I: 50000 }], train: [{ P: 50 }, { P: 150, s: 4 }, { P: 50, s: 4 }] }), B4 = RL.ssAbsMax(6, D4.wheels);
  truth(`a train longer than the span (8 m on 6 m): ${B4.M.toFixed(2)} kNm, to 0.01%`, rel(D4.abs.M, B4.M, 1e-4), [D4.abs.M, B4.M]);
  truth('one way or both: the same for a symmetric train', near(one({ dir: 'one', train: [{ P: 100 }, { P: 100, s: 3 }] }).abs.M, 361.25, 1e-6));
  const asym = one({ dir: 'one', spans: [{ L: 12, I: 50000 }], train: w3 }), asyB = one({ dir: 'both', spans: [{ L: 12, I: 50000 }], train: w3 });
  truth('an unsymmetric train: both ways is at least one way', asyB.abs.M >= asym.abs.M - 1e-9);
}
// ---- statically indeterminate spans ----
{
  const ff = one({ supports: ['fixed', 'fixed'] });
  truth('fixed-ended span, one load: PL/8 = 125 at mid-span; the end moment peaks at −4PL/27 = −148.1 (load at L/3)', near(ff.abs.M, 125, 0.05) && near(ff.absH.M, -4 * 1000 / 27, 0.05), [ff.abs.M, ff.absH.M]);
  const pc = one({ supports: ['fixed', 'pin'] });
  truth('propped cantilever: the fixed-end moment peaks at −0.1925PL (load 0.423L from the fixed end)', near(pc.absH.M, -0.19245 * 100 * 10, 0.3), pc.absH.M);
  truth('propped cantilever: the largest sagging, under the load, 0.1740PL (load 0.634L from the fixed end)', near(pc.abs.M, 174.0, 0.6), pc.abs.M);
  const cant = one({ supports: ['fixed', 'free'] });
  truth('cantilever: −PL = −1000 kNm at the root, reaction P', near(cant.absH.M, -1000, 1e-6) && near(cant.reac[0].Rq, 100, 1e-6));
  truth('cantilever: deflection limit doubled', cant.defl[0].cant && near(cant.defl[0].allow, 10000 / 600 * 2, 1e-9) && rel(cant.defl[0].w, 1e5 * 1e4 ** 3 / (3 * 210e3 * 5e8), 1e-4));
  const two = RL.design({ spans: [{ L: 8, I: 50000 }, { L: 8, I: 50000 }], supports: ['pin', 'pin', 'pin'], train: [{ P: 100 }], gG: 1, gQ: 1 });
  truth('two equal spans: the middle support takes up to P (load over it)', near(two.reac[1].Rq, 100, 1e-6));
  truth('two equal spans: the support moment peaks at −0.0962PL (load at 0.577L)', near(two.absH.M, -0.09623 * 100 * 8, 0.4), two.absH.M);
  truth('two equal spans: the end reaction reaches 1.0P and lifts by up to 0.0962P (the load in the far span)', near(two.reac[0].Rq, 100, 1e-6) && near(two.reac[0].Rqmin, -9.623, 0.05), [two.reac[0].Rq, two.reac[0].Rqmin]);
  truth('two equal spans: uplift is warned of (no permanent load)', two.warnings.some(w => /Support 1 can lift/.test(w)));
}
// ---- the design combination ----
{
  const D = one({ spans: [{ L: 8, I: 61500, G: 1.3 }], train: [{ P: 85 }, { P: 85, s: 3.2 }] });
  truth('crane runway default: Barré 68 × 3.2 = 217.6 kNm', near(D.abs.M, 217.6, 1e-6));
  const u0 = 1.35 * 1.3 * 3.2 * 4.8 / 2 + 1.5 * 217.6;   // 339.88 under the wheel; the combination peaks just beside it
  truth('M_Ed at least 1.35 × 1.3 × 3.2 × 4.8/2 + 1.5 × 217.6 = 339.88 kNm, within 0.1', D.absU.M >= u0 - 1e-6 && D.absU.M <= u0 + 0.1, D.absU.M);
  truth('R_Ed = 1.35 × 5.2 + 1.5 × 136 = 211.0 kN', D.reac.every(r => near(r.Ed, 1.35 * 5.2 + 1.5 * 136, 1e-6)));
  const Dp = one({ spans: [{ L: 8, I: 61500, G: 1.3 }], train: [{ P: 85 }, { P: 85, s: 3.2 }], phi: 1.2 }), u1 = 1.35 * 1.3 * 3.2 * 4.8 / 2 + 1.5 * 1.2 * 217.6;
  truth('φ multiplies the moving loads for strength, not for deflection', Dp.absU.M >= u1 - 1e-6 && Dp.absU.M <= u1 + 0.1 && near(Dp.defl[0].w, D.defl[0].w, 1e-9), [Dp.absU.M, u1]);
  truth('the default passes span/600', D.utilMax < 1 && D.checks.length === 1);
}
// ---- refusals ----
truth('no loads refused', throws(() => one({ train: [] }), /moving loads/));
truth('a span without a length refused', throws(() => one({ spans: [{ L: 0, I: 1 }] }), /length/));
truth('a mechanism refused (free and pinned ends)', throws(() => one({ supports: ['free', 'pin'] }), /mechanism/));
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
