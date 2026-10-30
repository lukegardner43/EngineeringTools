// Hollowcore support beam: section properties (ASB datasheet, Slimflor geometry) against independent strip integration,
// M_cr with load height and monosymmetry against a Ritz series, the transverse plastic moment against linear programming,
// a full design case against hand calculation / closed-form torsion (reference/ref_hollowcore.py) and behaviour checks.
const { EC3, SecProps, Torsion, Hollowcore: H, SECTION_DATA } = require('./load.js');
const REF = require('./ref_hollowcore.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, scale, quiet) => { n++; const ok = Math.abs(got - exp) <= tol * (scale ?? Math.max(Math.abs(exp), 1e-30)); if (!ok || !quiet) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, cond) => { n++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };
const row = nm => SECTION_DATA.find(r => r[0].startsWith(nm));

// ---------- ASB: datasheet transcription and geometry ----------
for (const ref of REF.asb) {
  const r = H.ASB_DATA.find(x => x[0] === ref.name), s = H.asb(r, 'S355'), g = s.geom, p = ref.geom, t = ref.table;
  for (const k of ['A', 'zc', 'Iy', 'Iz', 'Wpl', 'zpna']) near(`${ref.name}: polygon ${k} = strip integration`, k === 'Wpl' ? g.Wply : g[k], p[k], 2e-4, null, true);
  // datasheet against the nominal geometry (the datasheet rounds; ASB top flange is patterned)
  near(`${ref.name}: datasheet A vs geometry`, s.A, p.A, 6e-3); near(`${ref.name}: datasheet Iy vs geometry`, s.Iy, p.Iy, 6e-3);
  near(`${ref.name}: datasheet Iz vs geometry`, s.Iz, p.Iz, 6e-3); near(`${ref.name}: datasheet Wpl vs geometry`, s.Wply, p.Wpl, 8e-3);
  near(`${ref.name}: datasheet elastic NA vs geometry`, s.zc, p.zc, 0.5, 1); near(`${ref.name}: datasheet plastic NA vs geometry`, s.zpna, p.zpna, 1.0, 1);
  near(`${ref.name}: Wel top = Iy / (D - zc)`, s.Welt, s.Iy / (s.H - s.zc), 6e-3); near(`${ref.name}: Wel bottom = Iy / zc`, s.Welb, s.Iy / s.zc, 6e-3);
  near(`${ref.name}: datasheet Iw = thin-walled hs² I1 I2/(I1 + I2)`, s.Iw, ref.Iw, 6e-3);
  near(`${ref.name}: shear centre`, s.zs, ref.zs, 1e-9); near(`${ref.name}: Wagner z_j`, s.zj, ref.zj, 2e-3);
  truth(`${ref.name}: z_j < 0 (larger flange in tension under sagging)`, s.zj < 0);
  const C = H.classify(s); truth(`${ref.name}: Class 1 in bending (stocky ASB)`, C.cls === 1);
}
// ---------- Slimflor geometry ----------
{ const d = REF.slimflor.dims, s = H.slimflor(row('254×254×89'), 'S355', d.bp, d.tp), p = REF.slimflor.geom;
  for (const [k, v] of [['A', s.A], ['zc', s.zc], ['Iy', s.Iy], ['Iz', s.Iz], ['zpna', s.zpna], ['Wpl', s.Wply], ['Welt', s.Welt], ['Welb', s.Welb]]) near(`Slimflor ${k}`, v, p[k], 3e-4);
  near('Slimflor shear centre (thin-walled)', s.zs, REF.slimflor.zs, 1e-9); near('Slimflor Iw', s.Iw, REF.slimflor.Iw, 1e-9); near('Slimflor z_j', s.zj, REF.slimflor.zj, 2e-3);
  near('Slimflor fy = min(UKC, plate)', s.fy, 345, 0); near('Slimflor Av = UKC shear area', s.Av, EC3.shear(EC3.fromRow(row('254×254×89')), 345).Av, 1e-12);
  const sc = Torsion.sectorial(s); near('Slimflor omega at the plate tip', sc.flanges[2].w, REF.slimflor.omega[2], 1e-9);
  near('Slimflor: sum I_k (z_k - z_s) = 0', s.flanges.reduce((a, f) => a + f.t * f.b ** 3 / 12 * (f.z - s.zs), 0), 0, 1e-9, s.Iy * 100);
}
// ---------- M_cr: FE with load height and Wagner term vs Ritz ----------
for (const c of REF.mcr) {
  const lam = EC3.mcrFE({ L: c.L, EIz: c.EIz, GIt: c.GIt, EIw: c.EIw, hs: 0, M: x => x * (c.L - x) / 2, q: () => 1, P: [], a: c.a, zj: c.zj, restraints: [{ x: 0, type: 'fork' }, { x: c.L, type: 'fork' }], nEl: 48 });
  near(`M_cr ${c.name}`, lam * c.L * c.L / 8, c.Mcr, 3e-3);
}
// ---------- transverse plastic moment vs LP ----------
for (const c of REF.mtrans) near(`m_trans t=${c.t} f=${c.f} sx=${c.sx}`, H.mTrans(c.t, c.f, c.sx), c.m, 2e-3, c.t * c.t * c.f / 4);
near('m_trans is zero at sx = f', H.mTrans(15, 355, 355), 0, 0, 1);

// ---------- full design case: 457x191x82 UKB S355, planks on the top flange ----------
const base = { grade: 'S355', L: 6000, LA: 7500, LB: 7500, gp: 2.9e-3, gt: 1.2e-3, gs: 1.0e-3, q: 3.5e-3, qc: 0.75e-3, line: { g: 0, q: 0, e: 0 }, gap: 30, brgMin: 75, atTip: false,
  gG: 1.35, gQ: 1.5, restraints: [], rotLimitDeg: 2, deflQ: 360, deflT: 250, finalTorsion: false, weldLeg: 6 };
{ const U = REF.ukb, R = H.design({ ...base, sec: H.rolled(row('457×191×82'), 'S355'), bearOn: 'top' }), f = R.final;
  near('UKB: available bearing (b - gap)/2', R.brg.avail, U.avail, 1e-12); near('UKB: plank reaction eccentricity', R.brg.e, U.e, 1e-12);
  near('UKB: final w_Ed', f.wEd, U.wF, 1e-9); near('UKB: M_Ed', f.MEd, U.MEd, 1e-9); near('UKB: V_Ed', f.VEd, U.VEd, 1e-9);
  near('UKB: M_c,Rd = Wpl fy', f.McRd, U.McRd, 1e-9); near('UKB: V_pl,Rd', f.Vpl, U.Vpl, 1e-9);
  near('UKB: construction dead deflection', f.defl.dC, U.dC, 1e-9); near('UKB: finishes deflection', f.defl.dS, U.dS, 1e-9); near('UKB: imposed deflection', f.defl.dQ, U.dQ, 1e-9);
  const c1 = R.constr.find(c => c.id === '1A');
  near('UKB stage 1A: mid-span twist at ULS (closed form)', c1.mid.phi, U.phiU_mid, 2e-3);
  near('UKB stage 1A: max twist at SLS (closed form)', c1.R.gov.rotation.rot, U.phiS_mid, 2e-3);
  near('UKB stage 1A: mid-span bimoment', Math.abs(c1.mid.B), Math.abs(U.B1_mid), 5e-3);
  near('UKB stage 1A: mid-span M', Math.abs(c1.mid.M), U.M1_mid, 1e-6);
  near('UKB stage 1A: flange tip stress', c1.mid.tip.s, U.sig_tip, 5e-3);
  { const g0 = 82 * 9.81e-3, wp = 2.9e-3 * 3750, wc = 0.75e-3 * 3750;
    near('UKB stage 1A: load height = weighted plank height h/2 above the shear centre (self weight at 0)', c1.aLoad, 230 * (1.35 * wp + 1.5 * wc) / (1.35 * (g0 + wp) + 1.5 * wc), 1e-9); }
  const lF = R.local.find(l => l.id === 'F' && l.sd === 'A');
  near('UKB local F/A: plank reaction q_Ed', lF.qEd, U.qA, 1e-9); near('UKB local F/A: m_Ed', lF.mEd, U.mEd, 1e-9);
  near('UKB local F/A: sigma_x (top flange, final)', lF.sx, U.sx, 1e-9); near('UKB local F/A: m_Rd', lF.mRd, U.mRd, 1e-9);
  truth('UKB: cases 1A, 1B, 2A, 2B, 2AB', R.constr.map(c => c.id).join() === '1A,1B,2A,2B,2AB');
  truth('UKB: stage 2AB (equal spans, both sides) has no torsion', Math.max(...R.constr.find(c => c.id === '2AB').R.pts.map(p => Math.abs(p.phi))) < 1e-12);
  truth('UKB: stage 1B twists the other way to 1A', Math.sign(R.constr.find(c => c.id === '1B').mid.phi) === -Math.sign(c1.mid.phi));
  near('UKB: 1A and 1B mirror images', Math.abs(R.constr.find(c => c.id === '1B').mid.phi), Math.abs(c1.mid.phi), 1e-9);
  truth('UKB: utilMax is the largest check', R.utilMax === Math.max(...R.checks.map(c => c.util)));
  // reaction at the flange tip increases the eccentricity, the torsion and the local moment
  const T2 = H.design({ ...base, sec: H.rolled(row('457×191×82'), 'S355'), bearOn: 'top', atTip: true });
  near('UKB: reaction at the edge of the support e = b/2', T2.brg.e, 191.3 / 2, 1e-12);
  truth('UKB: larger e gives larger twist', T2.constr[0].R.gov.rotation.rot > c1.R.gov.rotation.rot);
  // lateral restraint at mid-span raises M_cr
  const T3 = H.design({ ...base, sec: H.rolled(row('457×191×82'), 'S355'), bearOn: 'top', restraints: [3000] });
  truth('UKB: a mid-span lateral restraint raises M_cr', T3.constr[0].R.gov.member.seg.Mcr > c1.R.gov.member.seg.Mcr);
}
// ---------- Slimflor weld case ----------
{ const W = REF.slim_weld, d = REF.slimflor.dims;
  const R = H.design({ ...base, sec: H.slimflor(row('254×254×89'), 'S355', d.bp, d.tp), bearOn: 'bottom', gap: 10 });
  near('Slimflor: available bearing on the plate', R.brg.avail, W.avail, 1e-12); near('Slimflor: reaction eccentricity', R.brg.e, W.e, 1e-12);
  truth('Slimflor: bearing on the plate, lever from the flange tip', R.brg.el === 'plate' && Math.abs(R.brg.lever - (W.e - d.b / 2)) < 1e-9);
  const caseF = R.local.find(l => l.id === 'F' && l.sd === 'A');
  near('Slimflor: final plank reaction', caseF.qEd, W.qA, 1e-9);
  // the governing weld check is the final stage (largest loads and shear)
  truth('Slimflor: weld governed by the final stage', R.weld.id === 'F');
  near('Slimflor weld: transverse (balanced + prying 3m/b)', R.weld.T, W.T, 1e-9); near('Slimflor weld: longitudinal VS/(2I)', R.weld.vL, W.vL, 2e-4);
  near('Slimflor weld: resultant', R.weld.res, W.res, 2e-4); near('Slimflor weld: F_w,Rd', R.weld.FwRd, W.FwRd, 1e-12);
  truth('Slimflor: LTB uses the general case, curve d', R.s.ltb.method === '6.3.2.2' && R.s.ltb.curve === 'd');
  truth('Slimflor: plate load is below the shear centre (stabilising)', R.constr[0].aLoad < 0);
  // unbalanced (stage 1) weld pull = q (e + b/2)/b on the loaded side
  const c1 = R.constr.find(c => c.id === '1A'), qA = c1.q.A, mA = qA * (R.brg.e - d.b / 2);
  const T1 = qA + mA / d.b;
  near('Slimflor weld stage 1A: T = q(e + b/2)/b', T1, qA * (R.brg.e + d.b / 2) / d.b, 1e-12);
}
// ---------- classification: rolled sections agree with the EC3 engine ----------
{ let agree = 0, tot = 0;
  for (const r of SECTION_DATA.filter(r => /UK[BC]$/.test(r[0]))) for (const gr of ['S275', 'S355']) {
    const s = H.rolled(r, gr); let c1; try { c1 = H.classify(s).cls; } catch (e) { c1 = 4; }
    const c2 = EC3.classify(s, s.fy, 0, true).cls; tot++; if (c1 === c2) agree++; else console.log('  mismatch', r[0], gr, c1, c2);
  }
  near(`classification of ${tot} rolled sections agrees with the EC3 engine`, agree, tot, 0, 1);
}
// ---------- behaviour ----------
{ const ukb = H.rolled(row('457×191×82'), 'S355');
  const R = H.design({ ...base, sec: ukb, bearOn: 'top', LB: 0 });
  truth('edge beam: cases 1A and 2A only', R.constr.map(c => c.id).join() === '1A,2A');
  truth('edge beam: stage 2A has torsion', R.constr[1].R.gov.rotation.rot > 0);
  throws('ASB with planks on the top flange is rejected', () => H.design({ ...base, sec: H.asb(H.ASB_DATA[0], 'S355'), bearOn: 'top' }), /bottom flange/);
  throws('no bearing when the gap exceeds the flange', () => H.design({ ...base, sec: ukb, bearOn: 'top', gap: 200 }), /No bearing/);
  throws('Slimflor plate narrower than the flange', () => H.slimflor(row('254×254×89'), 'S355', 200, 15), /wider/);
  const Rb = H.design({ ...base, sec: H.rolled(row('305×305×137'), 'S355'), bearOn: 'bottom', gap: 10 });
  truth('bottom flange: warning when the plank end sits on the root radius', Rb.warnings.some(w => /root radius/.test(w)));
  truth('bottom flange: warning when the plank ends lie beneath the top flange', Rb.warnings.some(w => /beneath the top flange/.test(w)));
  const Rt = H.design({ ...base, sec: ukb, bearOn: 'top', finalTorsion: true, line: { g: 5, q: 0, e: 150 } });
  truth('final torsion option adds the beam-alone torsion cases', Rt.finalT.length === 3 && Rt.checks.some(c => c.k.startsWith('ft_')));
  truth('final torsion: continuous lateral restraint (no LTB check)', Rt.finalT.every(c => !c.R.gov.member || c.R.gov.member.seg.Mcr === Infinity || !Number.isFinite(c.R.gov.member.seg.Mcr)));
  const Rh = H.design({ ...base, sec: ukb, bearOn: 'top', L: 9000, LA: 9000, LB: 9000 });
  truth('heavier case utilisations increase', Rh.utilMax > R.utilMax);
}
console.log(`\n${n - fails}/${n} hollowcore checks passed`);
if (fails) process.exit(1);
