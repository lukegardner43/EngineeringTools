// Windpost: loads, member checks, deflection, ties and reactions against hand calculation; LTB against the closed-form
// C1 expression; orientation, cantilever and restraint behaviour.
const { EC3, Windpost: W, SECTION_DATA, PFC_DATA } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };
const { E, G } = EC3;
const base = { grade: 'S355', H: 3500, sys: 'ss', wk: 1.2e-3, b: 3000, alpha: 1, restraint: { mode: 'ends' }, deflDiv: 360, ties: { s: 450, n: 1, FRd: 2000 }, fixRd: 0 };

// ---------- simply supported PFC ----------
{ const sec = EC3.fromRowPFC(PFC_DATA.find(r => r[0].startsWith('150×90×24'))), R = W.design({ ...base, sec }), g = R.R.gov;
  const q = 1.2e-3 * 3000, M = 1.5 * q * 3500 ** 2 / 8, V = 1.5 * q * 3500 / 2;
  near('q_k = w_k x width x share', R.q, q, 1e-12);
  near('M_Ed = 1.5 q H²/8', Math.abs(g.bending.M), M, 1e-6); near('V_Ed = 1.5 q H/2', Math.abs(g.shear.V), V, 1e-6);
  const fy = 355, cls = g.bending.sc.cls.cls, Wy = cls <= 2 ? sec.Wply : sec.Wely;
  near('bending utilisation = M / (W fy)', g.bending.util, M / (Wy * fy), 1e-6);
  const d = 5 * q * 3500 ** 4 / (384 * E * sec.Iy);
  near('deflection = 5 q H⁴/(384 E I)', Math.abs(R.R.memDefl[0].wQ), d, 1e-4); near('deflection utilisation (H/360)', g.deflection.util, d / (3500 / 360), 1e-4);
  near('tie force F_Ed = 1.5 w_k (b/2) s', R.ties.FEd, 1.5 * 1.2e-3 * 1500 * 450, 1e-12); near('tie utilisation', R.ties.util, 1.5 * 1.2e-3 * 1500 * 450 / 2000, 1e-12);
  R.reac.forEach(r => near(`reaction at ${r.x}: 1.5 q H / 2`, r.VEd, V, 1e-6));
  const R2 = W.design({ ...base, sec, ties: { s: 450, n: 2, FRd: 2000 } }); near('two ties per level halve the tie force', R2.ties.FEd, R.ties.FEd / 2, 1e-12);
  const R3 = W.design({ ...base, sec, deflDiv: 500 }); near('deflection limit H/500', R3.R.gov.deflection.util, d / (3500 / 500), 1e-4);
  const R4 = W.design({ ...base, sec, fixRd: 5000 }); near('fixing utilisation = V_Ed / V_Rd', R4.checks.find(c => c.k === 'fix').util, V / 5000, 1e-6);
}
// ---------- LTB of an unrestrained UKB against the C1 formula (UDL, forks, load at the shear centre) ----------
{ const sec = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('203×133×25'))), H = 6000;
  const R = W.design({ ...base, sec, H, wk: 1.5e-3 }), l = R.R.gov.ltb;
  const Pz = Math.PI ** 2 * E * sec.Iz / H ** 2, Mcr = 1.127 * Pz * Math.sqrt(sec.Iw / sec.Iz + G * sec.It / Pz);
  near('M_cr (FE) vs C1 = 1.127 closed form', l.Mcr, Mcr, 0.015);
  truth('LTB reduces the resistance (chi_LT < 1)', l.chiMod < 1);
  const Rp = W.design({ ...base, sec, H, wk: 1.5e-3, restraint: { mode: 'points', pts: [1500, 3000, 4500] } });
  truth('restraint at the tie positions raises M_cr', Rp.R.gov.ltb.Mcr > 2 * l.Mcr);
}
// ---------- cantilever (parapet) ----------
{ const sec = EC3.rhs({ h: 150, b: 100, t: 6.3 }), H = 1500, R = W.design({ ...base, sec, H, sys: 'cant' }), g = R.R.gov, q = 3.6;
  near('cantilever M_Ed = 1.5 q H²/2', Math.abs(g.bending.M), 1.5 * q * H * H / 2, 1e-6);
  near('cantilever tip deflection = q H⁴/(8 E I)', Math.abs(R.R.memDefl[0].wQ), q * H ** 4 / (8 * E * sec.Iy), 1e-4);
  near('cantilever deflection limit uses the same ratio', R.R.memDefl[0].lim, H / 360, 1e-12);
  const b = R.reac.find(r => r.type === 'fixed'); near('base moment', b.MEd, 1.5 * q * H * H / 2, 1e-6); near('base shear', b.VEd, 1.5 * q * H, 1e-6);
}
// ---------- RHS orientation and CHS ----------
{ const maj = EC3.rhs({ h: 150, b: 100, t: 5 }), min = EC3.rhs({ h: 100, b: 150, t: 5 });
  const Ra = W.design({ ...base, sec: maj }), Rb = W.design({ ...base, sec: min });
  near('orientation: minor-axis deflection ratio = Iy/Iz', Math.abs(Rb.R.memDefl[0].wQ) / Math.abs(Ra.R.memDefl[0].wQ), maj.Iy / maj.Iz, 1e-4);
  const Rc = W.design({ ...base, sec: EC3.chs({ d: 114.3, t: 5 }) });
  truth('CHS: no lateral-torsional buckling reduction', !Rc.R.gov.ltb || Rc.R.gov.ltb.chiMod === 1);
}
throws('zero wind rejected', () => W.design({ ...base, sec: EC3.rhs({ h: 150, b: 100, t: 5 }), wk: 0 }), /positive/);
console.log(`\n${n - fails}/${n} windpost checks passed`);
if (fails) process.exit(1);
