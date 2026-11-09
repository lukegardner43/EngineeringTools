// Steel Column Design (and its base option, now designed in Base Plate Design): node test_column_base.js
// Combinations, design actions, flexural / torsional buckling, LTB (uniform moment), SN048b and the base plate against the
// independent reference (reference/ref_column_base.py), plus wiring checks against the member design and joints engines.
const { EC3, Design, Joints, ColumnBase, JDraw, SECTION_DATA } = require('./load.js');
const REF = require('./ref_column_base.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, abs = 0) => { n++; const ok = Math.abs(got - exp) <= Math.max(tol * Math.abs(exp), abs); if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(7)} expected ${(+exp).toPrecision(7)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; if (!c || process.env.V) console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const sec = name => EC3.fromRow(SECTION_DATA.find(r => r[0] === name));
const BASE = { plate: { D: 450, B: 450, t: 30, grade: 'S275' }, fck: 30, alpha: 1.5, bolts: { size: 'M24', cls: '8.8', ex: 50, ey: 300, hef: 300, dh: 60, cEdge: 200, cracked: true }, aw: 8, awW: 6 };
const zero = { N: 0, Ry1: 0, Ry2: 0, Rz1: 0, Rz2: 0, MyT: 0, MyB: 0, MzT: 0, MzB: 0, w: 0, H: 0 };
const mk = (o = {}) => ({ sec: sec('254×254×73 UKC'), grade: 'S355', L: 4500, ky: 1, kz: 1, nLT: 1, annex: 'B', simple: false, share: 1, rule: '6.10', psiQ: 0.7, windBoth: true,
  cases: { G: { ...zero }, Q: { ...zero }, W: { ...zero } }, base: null, ...o });
const key = f => [f.G, f.Q, f.W].map(v => Math.round(v * 1e6) / 1e6).join('|');

// 1 ULS combinations (UK NA Table NA.A1.2(B))
for (const [k, rule, has, both] of [['6.10', '6.10', { Q: true, W: true }, true], ['6.10ab', '6.10ab', { Q: true, W: true }, true], ['6.10_QonlyOneWay', '6.10', { Q: true, W: true }, false], ['6.10_Gonly', '6.10', { Q: false, W: false }, true]]) {
  const got = ColumnBase.combos(rule, has, 0.7, both).map(c => key(c.f)).sort(), exp = REF.combos[k].map(([g, q, w]) => key({ G: g, Q: q, W: w })).sort();
  truth(`combinations ${k}: ${exp.length} sets, identical to the reference`, got.length === exp.length && got.every((v, i) => v === exp[i]));
}
truth('combination labels: wind reversed and G favourable', ColumnBase.combos('6.10', { Q: true, W: true }).some(c => c.label === '1.0G − 1.5W') && ColumnBase.combos('6.10ab', { Q: true, W: true }).some(c => c.label === '1.25G + 1.5Q + 0.75W'));

// 2 design actions: axial load + reactions, nominal moments (h/2 + 100, tw/2 + 100) x share, end moments, UDL, base shear, self-weight
{ const A = REF.actions, inp = mk({ L: A.L, share: A.share, cases: { G: { ...zero, ...A.cases.G }, Q: { ...zero, ...A.cases.Q }, W: { ...zero, ...A.cases.W } } });
  const F = { U1: { G: 1.35, Q: 1.5 }, U2: { G: 1.0, W: -1.5 }, U3: { G: 1.25, Q: 1.05, W: 1.5 } };
  for (const [id, f] of Object.entries(F)) {
    const a = ColumnBase.actions(inp, f), r = A.results[id];
    for (const k of ['N', 'MyT', 'MyB', 'MzT', 'MzB', 'w', 'sw', 'Nbase', 'Vbase', 'VbaseZ', 'Vres']) near(`actions ${id}: ${k}`, a[k], r[k], 1e-12, 1e-9);
    near(`actions ${id}: M_y at mid-height (end moments + w L²/8)`, a.My(A.L / 2), r.Mmid, 1e-12, 1e-6);
    near(`actions ${id}: dM/dx at the base = V_z`, (a.My(1e-3) - a.My(0)) / 1e-3, a.Vz(0), 1e-6, 1e-3);
  } }

// 3 flexural and torsional buckling through the column design (EN 1993-1-1 6.3.1)
for (const B of REF.buckling) {
  const R = ColumnBase.design(mk({ sec: sec(B.sec), grade: B.grade, L: B.L, ky: B.ky, kz: B.kz, nLT: B.nLT, cases: { G: { ...zero, N: 500e3 }, Q: { ...zero }, W: { ...zero } } })), ab = R.res[0].mem.ab;
  const tag = `${B.sec} ${B.grade} L ${B.L} ky ${B.ky} kz ${B.kz} nLT ${B.nLT}`;
  truth(`${tag}: buckling curves ${B.curves.join('/')}`, ab.curves.y === B.curves[0] && ab.curves.z === B.curves[1]);
  near(`${tag}: N_cr,y`, ab.Ncry, B.Ncry, 1e-12); near(`${tag}: N_cr,z`, ab.Ncrz, B.Ncrz, 1e-12); near(`${tag}: N_cr,T`, ab.NcrT, B.NcrT, 1e-9);
  near(`${tag}: chi_y`, ab.y.chi, B.chiY, 1e-9); near(`${tag}: chi_z`, ab.z.chi, B.chiZ, 1e-9); near(`${tag}: chi_T`, ab.T.chi, B.chiT, 1e-9);
  near(`${tag}: N_b,Rd`, ab.NbRd, B.NbRd, 1e-9);
  near(`${tag}: flexural utilisation = N_Ed (incl. self-weight) / N_b,Rd`, R.gov['m:flexural'].util, R.res[0].a.Nbase / B.NbRd, 1e-9);
}

// 4 LTB under uniform moment: FE M_cr against the closed form (C1 = 1, forks); M_b,Rd by the UK NA rolled-section rule
for (const T of REF.ltb) {
  const R = ColumnBase.design(mk({ sec: sec(T.sec), grade: T.grade, L: T.L, cases: { G: { ...zero, MyT: T.M, MyB: T.M }, Q: { ...zero }, W: { ...zero } } })), sg = R.res[0].mem.segResults[0];
  near(`${T.sec} ${T.grade} L ${T.L}: M_cr (finite elements vs closed form)`, sg.Mcr, T.Mcr, 2e-3);
  near(`${T.sec} ${T.grade} L ${T.L}: chi_LT,mod`, sg.chiMod, T.chiLT, 3e-3);
  near(`${T.sec} ${T.grade} L ${T.L}: M_b,Rd`, sg.MbRd, T.MbRd, 3e-3);
  truth(`${T.sec}: class ≤ 2 (W_pl used)`, R.res[0].mem.cls <= 2);
}

// 5 SN048b: terms, scope and the effect on the verdict
{ const s = sec('254×254×73 UKC'), cases = { G: { ...zero, N: 800e3, Ry1: 60e3, Rz1: 30e3 }, Q: { ...zero, N: 400e3, Ry1: 40e3, Rz1: 20e3 }, W: { ...zero } };
  const R = ColumnBase.design(mk({ simple: true, cases })), r = R.res.find(x => x.combo.label === '1.35G + 1.5Q'), sn = r.sn, ab = r.mem.ab;
  near('SN048: N_b,min,Rd = min(chi_y, chi_z) A f_y', sn.NbMin, Math.min(ab.y.chi, ab.z.chi) * REF.sn048.A_uc * 355, 1e-12);
  near('SN048: M_cb,z,Rd = W_pl,z f_y', sn.McbZ, REF.sn048.McbZ_uc_S355, 1e-12);
  near('SN048: M_b,y,Rd from the LT segment', sn.MbRd, r.mem.segResults[0].MbRd, 1e-12);
  near('SN048: sum of the three terms', sn.util, r.a.Nbase / sn.NbMin + r.a.MyMax / sn.MbRd + 1.5 * r.a.MzMax / sn.McbZ, 1e-12);
  near('SN048: nominal moment M_y = (R_y1 − R_y2)(h/2 + 100)', r.a.MyT, (1.35 * 60e3 + 1.5 * 40e3) * (s.h / 2 + 100), 1e-12);
  near('SN048: nominal moment M_z = (R_z1 − R_z2)(t_w/2 + 100)', r.a.MzT, (1.35 * 30e3 + 1.5 * 20e3) * (s.tw / 2 + 100), 1e-12);
  truth('SN048: psi = 0 with N/N_b,y,Rd ≤ 0.83 is within scope', sn.valid && Math.abs(sn.psiY) < 1e-12 && r.a.Nbase / sn.NbY <= 0.83);
  near('SN048 counted in the governing utilisation', R.utilMax, Math.max(...R.res.map(x => Math.max(x.mem.utilMax, x.sn.valid ? x.sn.util : 0))), 1e-12);
  const big = ColumnBase.design(mk({ simple: true, cases: { ...cases, G: { ...cases.G, N: 1500e3 } } })).res.find(x => x.combo.label === '1.35G + 1.5Q').sn;
  truth('SN048: psi_y = 0 and N/N_b,y,Rd > 0.83 is outside scope', !big.valid && big.why.some(w => /0\.83/.test(w)));
  const uz = ColumnBase.design(mk({ simple: true, cases: { ...cases, G: { ...cases.G, MzT: 5e6, MzB: 5e6 } } })).res.find(x => x.combo.label === '1.35G + 1.5Q').sn;
  truth('SN048: uniform M_z (psi_z = 1 > 0.0625) is outside scope', !uz.valid && uz.why.some(w => /ψ_z/.test(w)));
  const ud = ColumnBase.design(mk({ simple: true, cases: { ...cases, Q: { ...cases.Q, w: 1.0 } } }));
  truth('SN048: a UDL along the column is outside scope; the full 6.3.3 check governs', !ud.res.find(x => x.combo.label === '1.35G + 1.5Q').sn.valid);
  const off = ColumnBase.design(mk({ simple: false, share: 0, cases }));
  truth('without simple construction there are no nominal moments and no SN048 term', off.res.every(x => !x.sn && Math.abs(x.a.MyT) < 1e-9)); }

// 6 base plate: effective area (independent), wiring of N, M_y and the resultant shear, uplift
{ const R = ColumnBase.design(mk({ base: BASE, cases: { G: { ...zero, N: 450e3, MyB: 20e6, MzT: 4e6, H: 5e3 }, Q: { ...zero, N: 300e3, MyB: 15e6 }, W: { ...zero, H: 12e3, N: -400e3 } } }));
  const r0 = R.res[0], bp = r0.bp;
  near('base: f_jd = beta_j alpha f_cd', bp.fjd, REF.base.fjd, 1e-12); near('base: c = t sqrt(f_y/(3 f_jd))', bp.cc, REF.base.c, 1e-12);
  near('base: A_eff (T-stubs under the flanges and web)', bp.Aeff, REF.base.Aeff, 1e-12); near('base: N_j,Rd', bp.NjRd, REF.base.NjRd, 1e-12);
  for (const r of R.res) {
    const s = r.mem.sec || sec('254×254×73 UKC'), d = Joints.basePlate({ col: { h: s.h, b: s.b, tf: s.tf, tw: s.tw, r: s.r }, colFy: 355, colWpl: s.Wply, plate: BASE.plate, fck: 30, alpha: 1.5, bolts: { ...BASE.bolts, n: 2 }, aw: 8, awW: 6, N: r.a.Nbase, M: r.a.MyB, V: r.a.Vres });
    truth(`base ${r.combo.label}: checks identical to the joints engine with N = N_base, M = M_y,base, V = resultant`, d.checks.length === r.bp.checks.length && d.checks.every((c, i) => Math.abs(c.dem - r.bp.checks[i].dem) < 1e-9 && Math.abs(c.cap - r.bp.checks[i].cap) < 1e-9));
  }
  const up = R.res.find(x => x.combo.label === '1.0G + 1.5W' && x.a.Nbase < 0) || R.res.find(x => x.a.Nbase < 0);
  truth('base: an uplift combination exists (1.0G + 1.5W)', !!up);
  if (up) near('base: anchor tension under uplift and moment = (M − N z_C)/z', up.bp.FtEd, Math.max(0, (Math.abs(up.a.MyB) - up.a.Nbase * up.bp.zC) / (up.bp.zT + up.bp.zC)), 1e-12);
  near('base: shear is the resultant of V_z (end moments, w, H) and V_y (minor-axis moments)', r0.a.Vres, Math.hypot((r0.a.MyT - r0.a.MyB) / 4500 + r0.a.H, (r0.a.MzT - r0.a.MzB) / 4500), 1e-12);
  near('base: governing utilisation includes the base', R.utilMax, Math.max(...R.res.map(x => Math.max(x.mem.utilMax, x.bpUtil))), 1e-12);
  truth('base: a minor-axis base moment is flagged', ColumnBase.design(mk({ base: BASE, cases: { G: { ...zero, N: 450e3, MzB: 3e6 }, Q: { ...zero }, W: { ...zero } } })).minorBase);
  truth('base drawing renders', /<svg/.test(JDraw.draw('base', { col: '254×254×73 UKC', B: 450, D: 450, tp: 30, ex: 50, w: 300, hef: 300, dh: 60, c: 200, bolt: 'M24', aw: 8, awW: 6, fck: 30, N: 1000, M: 20, V: 10 }, nm => { const r = SECTION_DATA.find(x => x[0] === nm); return r && { h: r[2], b: r[3], tw: r[4], tf: r[5], r: r[6] }; }))); }

// 7 errors
{ const thr = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };
  truth('zero height rejected', thr(() => ColumnBase.design(mk({ L: 0 })), /height/));
  truth('bolts inside the plate edge rejected', thr(() => ColumnBase.design(mk({ base: { ...BASE, bolts: { ...BASE.bolts, ex: 120 } }, cases: { G: { ...zero, N: 100e3 }, Q: { ...zero }, W: { ...zero } } })), /anchor bolts/)); }

console.log(`\n${n - fails}/${n} column and base checks passed`); if (fails) process.exit(1);
