// Steel masonry support: angle properties against a 2D occupancy grid, the continuous-angle model against a frame FE,
// spanning angle / plate / fixings by hand (reference/ref_masonry.py), material data and behaviour.
const { EC3, Masonry: M } = require('./load.js');
const REF = require('./ref_masonry.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, scale) => { n++; const ok = Math.abs(got - exp) <= tol * (scale ?? Math.max(Math.abs(exp), 1e-30)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, cond) => { n++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };

// ---------- angle properties ----------
for (const a of REF.angles) {
  const s = M.angle(a.dims);
  for (const k of ['A', 'zc', 'Iy', 'Wtop', 'Wbot']) near(`${a.name}: ${k}`, s[k], a[k], 1.5e-3);
}
{ const s = M.angle({ h: 100, b: 100, t: 10, r: 12, r2: 6 });
  near('100x100x10 (BS EN 10056-1: r1 = 12, r2 = 6): A = 19.2 cm²', s.A / 1e2, 19.2, 3e-3); near('100x100x10: I = 177 cm⁴', s.Iy / 1e4, 177, 3e-3); }
// ---------- material ----------
{ const m = M.material({ grade: '1.4404', form: 'P' }, 8); truth('1.4404 plate: fy 220, fu 520, E 200 GPa, n 7, gM0 1.1', m.fy === 220 && m.fu === 520 && m.E === 200000 && m.n === 7 && m.gM0 === 1.1);
  const c = M.material({ grade: '1.4301', form: 'C' }, 6); truth('1.4301 cold rolled strip: fy 230, fu 540', c.fy === 230 && c.fu === 540);
  throws('cold rolled strip limited to 8 mm', () => M.material({ grade: '1.4301', form: 'C' }, 10), /8 mm/);
  const s = M.material({ grade: 'S355' }, 20); truth('S355, t = 20: fy 345, gM0 1.0', s.fy === 345 && s.gM0 === 1);
  near('secant modulus at 0.5 fy (1.4404, n = 7)', M.secant(m, 110), 200000 / (1 + 0.002 * 200000 / 110 * 0.5 ** 7), 1e-12);
  near('secant modulus equals E for carbon steel', M.secant(s, 300), 210000, 0); }

const base = { grade: '1.4404', form: 'P', gM0: 1.1, gM1: 1.1, gG: 1.35, gQ: 1.5, loadAt: 'centre', overhangMax: 34, deflLim: 1.5, leaf: { t: 102.5, c: 50, H: 3, rho: 20 }, Gx: 0, Qx: 0 };
// ---------- continuous angle on fixings ----------
{ const F = REF.fixed, R = M.design({ ...base, type: 'fixed', angle: { h: 150, b: 140, t: 8, r: 8, cold: true }, fix: { s: 500, z: 110, dm: 19, NRd: 10e3, VRd: 8e3, k: 1 } }), f = R.fix;
  near('fixed: Gk = rho t H', R.Gk, F.Gk, 1e-12); near('fixed: e = c + t_leaf/2', R.e, F.e, 1e-12);
  near('fixed: W per fixing', f.W, F.W, 1e-12); near('fixed: T = W e / z', f.T, F.T, 1e-12); near('fixed: V = W', f.V, F.V, 1e-12);
  near('fixed: horizontal leg moment at the root', f.mh, F.mh, 1e-12); near('fixed: vertical leg moment at the bend', f.mv, F.mv, 1e-12); near('fixed: m_Rd', f.mRd, F.mRd, 1e-12);
  near('fixed: secant modulus (Ramberg-Osgood)', f.Es, F.Es, 1e-9);
  near('fixed: load-point deflection = frame FE', f.d, F.defl, 2e-3);
  near('fixed: corner moment of the frame FE = w e\'', F.Mc_frame, F.Mc, 1e-6);
  near('fixed: punching B_p,Rd', f.BpRd, F.BpRd, 1e-12); near('fixed: linear fixing interaction', f.inter, F.inter, 1e-12);
  truth('fixed: overhang within the limit (12.5 mm)', R.checks[0].util < 1 && Math.abs(R.overhang - 12.5) < 1e-9);
  const R2 = M.design({ ...base, type: 'fixed', angle: { h: 150, b: 140, t: 8, r: 8, cold: true }, fix: { s: 500, z: 110, dm: 19, NRd: 10e3, VRd: 8e3, k: 2 } });
  near('fixed: interaction with exponent 2', R2.fix.inter, (F.T / 10e3) ** 2 + (F.V / 8e3) ** 2, 1e-12);
  const R3 = M.design({ ...base, type: 'fixed', loadAt: 'toe', angle: { h: 150, b: 140, t: 8, r: 8, cold: true }, fix: { s: 500, z: 110, dm: 19, NRd: 10e3, VRd: 8e3, k: 1 } });
  truth('fixed: load at the toe gives e = b and a larger fixing tension', R3.e === 140 && R3.fix.T > f.T);
  throws('fixed: fixing below the bend is rejected', () => M.design({ ...base, type: 'fixed', angle: { h: 150, b: 140, t: 8, r: 8, cold: true }, fix: { s: 500, z: 12, dm: 19, NRd: 10e3, VRd: 8e3, k: 1 } }), /vertical leg/);
  const Rc = M.design({ ...base, grade: 'S355', type: 'fixed', angle: { h: 150, b: 140, t: 8, r: 8, cold: true }, fix: { s: 500, z: 110, dm: 19, NRd: 10e3, VRd: 8e3, k: 1 } });
  truth('fixed: carbon steel uses E = 210 GPa (no secant reduction)', Rc.fix.Es === 210000);
}
// ---------- spanning angle ----------
{ const S = REF.span, R = M.design({ ...base, grade: 'S275', type: 'span', leaf: { ...base.leaf, c: 0 }, angle: { h: 150, b: 90, t: 10, r: 12, r2: 4.8, cold: false }, span: { L: 1200, spanRatio: 500, restrainTwist: false } }), s = R.span;
  near('span: e', R.e, S.e, 1e-12); near('span: M = wL²/8', s.M, S.M, 1e-12); near('span: V', s.V, S.V, 1e-12);
  near('span: M_Rd = Wel,min fy', s.MRd, S.MRd, 2e-3); near('span: torque at the bracket', s.Ttor, S.Ttor, 1e-12);
  near('span: St Venant shear stress', s.tauT, S.tauT, 1e-9); near('span: shear stress from V', s.tauV, S.tauV, 1e-12);
  near('span: twist at SLS', s.phiK, S.phi, 1e-9); near('span: deflection at the load point', s.d, S.d, 2e-3);
  near('span: stress ratio psi of the vertical leg', s.psi, S.psi, 3e-3); near('span: Class 3 limit 21 eps sqrt(k_sigma)', s.lim3, S.lim3, 1e-3);
  const Rr = M.design({ ...base, grade: 'S275', type: 'span', leaf: { ...base.leaf, c: 0 }, angle: { h: 150, b: 90, t: 10, r: 12, r2: 4.8, cold: false }, span: { L: 1200, spanRatio: 500, restrainTwist: true } });
  truth('span: twist restrained by the masonry removes the torsion', Rr.span.Ttor === 0 && Rr.span.phiK === 0);
  throws('span: stainless spanning angle rejected', () => M.design({ ...base, type: 'span', angle: { h: 150, b: 90, t: 10, r: 12, cold: false }, span: { L: 1200, spanRatio: 500 } }), /carbon steel/);
  throws('span: slender vertical leg (Class 4) rejected', () => M.design({ ...base, grade: 'S355', type: 'span', leaf: { ...base.leaf, c: 0 }, angle: { h: 200, b: 90, t: 6, r: 8, cold: false }, span: { L: 1200, spanRatio: 500 } }), /Class 4/);
}
// ---------- plate under a beam ----------
{ const P = REF.plate, R = M.design({ ...base, grade: 'S355', type: 'plate', leaf: { ...base.leaf, c: 0 }, plate: { t: 15, p: 120, bf: 190, weld: 6, sx: 0, vL: 0 } }), p = R.plate;
  near('plate: a = c + t_leaf/2 from the flange tip', p.a, P.a, 1e-12); near('plate: m_Ed', p.mEd, P.mEd, 1e-12); near('plate: m_Rd', p.mRd, P.mRd, 1e-12);
  near('plate: near weld T = w(bf + a)/bf', p.T, P.T, 1e-12); near('plate: F_w,Rd', p.FwRd, P.FwRd, 1e-12); near('plate: deflection', p.d, P.d, 1e-12);
  const R2 = M.design({ ...base, grade: 'S355', type: 'plate', leaf: { ...base.leaf, c: 0 }, plate: { t: 15, p: 120, bf: 190, weld: 6, sx: 200, vL: 50 } });
  truth('plate: longitudinal stress reduces m_Rd', R2.plate.mRd < p.mRd); near('plate: weld resultant with longitudinal shear', R2.plate.res, Math.hypot(P.T, 50), 1e-12);
}
// ---------- behaviour ----------
throws('masonry not on the support', () => M.design({ ...base, type: 'fixed', leaf: { ...base.leaf, c: 160 }, angle: { h: 150, b: 140, t: 8, r: 8, cold: true }, fix: { s: 500, z: 110, dm: 19, NRd: 10e3, VRd: 8e3, k: 1 } }), /does not bear/);
{ const R = M.design({ ...base, type: 'fixed', angle: { h: 150, b: 100, t: 8, r: 8, cold: true }, fix: { s: 500, z: 110, dm: 19, NRd: 10e3, VRd: 8e3, k: 1 } });
  truth('overhang beyond the limit fails and the load moves to the toe', R.checks[0].util > 1 && R.e === 100 && R.warnings.some(w => /toe/.test(w))); }
console.log(`\n${n - fails}/${n} masonry support checks passed`);
if (fails) process.exit(1);
