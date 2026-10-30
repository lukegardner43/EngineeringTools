// ConnectionCheck joints engine: T-stubs, effective lengths, fin plate and end plate tying, base plate (effective area,
// Table 6.7 bending, anchors) and the RHS tension splice against reference/ref_joints.py (independent methods).
const { Joints: J } = require('./load.js');
const REF = require('./ref_joints.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };
const cap = (list, id) => { const c = list.find(x => x.id === id); if (!c) throw new Error('missing check ' + id); return c.cap * (c.unit === 'kN' ? 1e3 : c.unit === 'kNm' ? 1e6 : 1); };

// materials
truth('S275 t=10: fy 275, fu 410', J.mat('S275', 10).fy === 275 && J.mat('S275', 10).fu === 410);
truth('S355 t=25: fy 345, fu 470', J.mat('S355', 25).fy === 345 && J.mat('S355', 25).fu === 470);
// T-stubs
REF.tstub.forEach((r, i) => { const [l1, l2, t, f, m, nn, Ft, nb, o] = r.args; const T = J.tstub({ leff1: l1, leff2: l2, tf: t, f, m, n: nn, Ft, nb, gm: o.gm ?? 1, prying: o.prying ?? true });
  near(`T-stub ${i + 1}: mode 1`, T.F1, r.F1, 1e-12); if (r.F2 !== null) near(`T-stub ${i + 1}: mode 2`, T.F2, r.F2, 1e-12); near(`T-stub ${i + 1}: resistance`, T.F, r.F, 1e-12); });
REF.leff.forEach((r, i) => { const [m, e, nr, p, e1] = r.args; const L = J.leffRows({ m, e, nr, p, e1: e1 ?? Infinity });
  near(`l_eff rows ${i + 1}: mode 1`, L.l1, r.l[0], 1e-12); near(`l_eff rows ${i + 1}: mode 2`, L.l2, r.l[1], 1e-12); });
// fin plate tying
{ const F = REF.fin, C = J.finExtra({ bolt: J.bolt('M20'), n: 3, p1: 70, e1: 50, e2p: 50, e2w: 40, tp: 10, hp: 200, tw: 9.9, aw: 8, plate: J.mat('S275', 10), beam: J.mat('S355', 9.9),
    hb: 460, tsup: 17.3, supp: J.mat('S355', 17.3), suppWeb: false, T: 75e3, V: 150e3 });
  near('fin tying: bolt shear', cap(C, 'T1'), F.bolts, 1e-9); near('fin tying: bearing on the plate', cap(C, 'T2'), F.bear_p, 1e-9); near('fin tying: bearing on the beam web', cap(C, 'T3'), F.bear_w, 1e-9);
  near('fin tying: plate in tension (net / block / gross)', cap(C, 'T4'), F.plate, 1e-9); near('fin tying: beam web in tension', cap(C, 'T5'), F.web, 1e-9); near('fin tying: welds (transverse)', cap(C, 'T6'), F.weld, 1e-9);
  near('fin detailing: t_p ≤ 0.5 d (S275)', cap(C, 'D1'), F.tmax, 1e-12);
  truth('fin: all P358 extra checks present', ['D1', 'D2', 'S1', 'S2', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'].every(id => C.some(c => c.id === id)));
  const C0 = J.finExtra({ bolt: J.bolt('M20'), n: 3, p1: 70, e1: 50, e2p: 50, e2w: 40, tp: 10, hp: 200, tw: 9.9, aw: 8, plate: J.mat('S275', 10), beam: J.mat('S355', 9.9), hb: 460, tsup: 0, supp: null, T: 0, V: 150e3 });
  truth('fin: no tying checks when T = 0', !C0.some(c => c.id.startsWith('T'))); }
// end plate tying
{ const E = REF.endplate, C = J.endPlateTying({ bolt: J.bolt('M20'), nr: 3, p1: 70, e1: 40, g: 90, ex: 30, tp: 10, hp: 220, tw: 9.9, aw: 6, plate: J.mat('S275', 10), beam: J.mat('S355', 9.9),
    colFlange: { tf: 17.3, tw: 10.3, r: 12.7, b: 256.3, fu: 470 }, T: 75e3 });
  near('end plate tying: T-stub resistance', cap(C, 'T1'), E.plate, 1e-9); near('end plate tying: beam web', cap(C, 'T2'), E.web, 1e-9);
  near('end plate tying: welds', cap(C, 'T3'), E.weld, 1e-9); near('end plate tying: column flange T-stub', cap(C, 'T4'), E.flange, 1e-9);
  throws('end plate: bolts inside the weld rejected', () => J.endPlateTying({ bolt: J.bolt('M20'), nr: 2, p1: 70, e1: 40, g: 20, ex: 30, tp: 10, hp: 200, tw: 9.9, aw: 6, plate: J.mat('S275', 10), beam: J.mat('S355', 9.9), T: 75e3 }), /m ≤ 0/); }
// base plate
{ const B = REF.base, base = { col: { h: 254.1, b: 254.6, tf: 14.2, tw: 8.6, r: 12.7 }, colFy: 345, plate: { B: 400, D: 450, t: 25, grade: 'S275' }, fck: 25, alpha: 1.5,
    bolts: { size: 'M24', cls: '8.8', n: 2, ex: 50, ey: 300, hef: 300, dh: 60, cEdge: 200, cracked: true }, aw: 8, awW: 6 };
  const R0 = J.basePlate({ ...base, N: 600e3, M: 0, V: 40e3 });
  near('base: f_jd', R0.fjd, B.fjd, 1e-12); near('base: c = t √(fy/(3 fjd))', R0.cc, B.c, 1e-12);
  near('base: effective area (rasterised Chebyshev offset)', R0.Aeff, B.Aeff, 2e-3);
  near('base: tension T-stub (row outside the flange, no prying)', R0.ts.F, B.Tplate, 1e-9); near('base: F_T,Rd', R0.FT, B.FT, 1e-9); near('base: F_C,Rd', R0.FC, B.FC, 1e-9);
  for (const c of B.mrd) { const R = J.basePlate({ ...base, N: c.N, M: c.M, V: 40e3 });
    near(`base: M_j,Rd (Table 6.7) = proportional statics, N = ${c.N / 1e3} kN, M = ${c.M / 1e6} kNm`, R.MjRd, c.MRd, 1e-9); near(`base: bolt tension F_T,Ed for the same loads`, R.FtEd, c.FtEd, 1e-9); }
  const A = REF.anchor; near('anchors: concrete cone N_Rd,c', R0.NRdc, A.NRdc, 1e-9); near('anchors: pull-out N_Rd,p', R0.NRdp, A.NRdp, 1e-9);
  near('anchors: pry-out V_Rd,cp', cap(R0.checks, 'B7'), A.VRdcp, 1e-9);
  throws('base: plate smaller than the column rejected', () => J.basePlate({ ...base, plate: { B: 200, D: 450, t: 25, grade: 'S275' }, N: 1, M: 0, V: 0 }), /at least as large/); }
// RHS splice
{ const S = REF.splice, R = J.rhsSplice({ sec: { h: 200, b: 200, t: 10 }, secGrade: 'S355', plate: { t: 25, grade: 'S275', B: 340 }, bolt: J.bolt('M24', '8.8'), nb: 3, m: 50, e: 40, aw: 8, N: 600e3 });
  near('RHS splice: N_Rd = 2 F_T,Rd (T-stub l_eff = B/2)', R.NRd, S.NRd, 1e-12); near('RHS splice: mode 1', R.ts.F1, S.modes[0], 1e-12); near('RHS splice: mode 2', R.ts.F2, S.modes[1], 1e-12);
  near('RHS splice: section tension', R.Npl, S.Npl, 1e-12); near('RHS splice: weld', R.Fw, S.weld, 1e-12); }
// steel to concrete
REF.s2c.forEach((r, i) => {
  const inp = i === 0 ? { V: 120e3, e: 80, T: 75e3, rows: 2, p: 200, g: 150, plate: { h: 300 }, size: 'M20', cls: '8.8', hef: 150, dh: 35, fck: 32, cracked: true, c1: 0, hMember: 250 }
    : { V: 80e3, e: 60, T: 0, rows: 3, p: 100, g: 120, plate: { h: 300 }, size: 'M16', cls: '4.6', hef: 120, dh: 30, fck: 30, cracked: false, c1: 150, hMember: 200 };
  const R = J.steelToConcrete(inp);
  r.rowT.forEach((t, k) => near(`s2c ${i + 1}: row ${k + 1} tension`, R.rowT[k], t, 1e-12));
  near(`s2c ${i + 1}: N_Rd,s`, R.NRds, r.NRds, 1e-12); near(`s2c ${i + 1}: V_Rd,s`, R.VRds, r.VRds, 1e-12);
  near(`s2c ${i + 1}: steel interaction`, R.checks.find(c => c.id === 'A1').dem, r.steel, 1e-12);
  near(`s2c ${i + 1}: concrete cone`, R.NRdc, r.NRdc, 1e-12); near(`s2c ${i + 1}: pull-out`, R.NRdp, r.NRdp, 1e-12); near(`s2c ${i + 1}: pry-out`, R.VRdcp, r.VRdcp, 1e-12);
  if (r.VRdc !== null) near(`s2c ${i + 1}: concrete edge`, R.VRdc, r.VRdc, 1e-12); else truth(`s2c ${i + 1}: no edge check when remote`, !Number.isFinite(R.VRdc));
  near(`s2c ${i + 1}: concrete interaction`, R.checks.find(c => c.id === 'A6').dem, r.inter, 1e-12);
});
// moment end plate: published worked example (HEB 140 column, IPE 220 beam, S235, extended end plate 140 x 12, 6 M16 8.8,
// alpha 5.99; masesoft 'Design example of a joint with extended end plate'): component values, distribution and M_j,Rd
{ J.GR.S235 = { fy: [[16, 235], [40, 225]], fu: 360, bw: 0.8 };
  const base = { type: 'column', beta: 1, beam: { h: 220, b: 110, tf: 9.2, tw: 5.9, r: 12, Wpl: 285e3, grade: 'S235' }, col: { h: 140, b: 140, tf: 12, tw: 7, r: 12, A: 4300, grade: 'S235' },
    plate: { bp: 140, tp: 12, ext: 70, grade: 'S235' }, bolt: J.bolt('M16'), rows: [40, 110, 250], w: 80, af: 5, aw: 3, alpha: 5.99, M: 10e6, V: 10e3 };
  const R = J.momentEndPlate(base), F = (i, j, k) => R.comp(i, j).find(c => c.k === k).F / 1e3;
  near('P398 example: column flange m = 26.9', R.mC, 26.9, 1e-9); near('P398 example: end plate m = 33.66', R.mP, 33.66, 2e-4); near('P398 example: m_x = 24.34', R.mx, 24.34, 2e-4);
  near('P398 example: A_vc = 1312', R.Avc, 1312, 1e-9); near('P398 example: V_wp,Rd = 160.2 kN', R.Vwp / 1e3, 160.2, 1e-3); near('P398 example: F_c,fb,Rd = 317.7 kN', R.Ffb / 1e3, 317.7, 1e-3);
  near('P398 example: row 1 column flange 138.5 kN', F(0, 0, 'cfb'), 138.5, 1e-3); near('P398 example: rows 1-2 column flange 254.7 kN', F(0, 1, 'cfb'), 254.7, 1e-3);
  near('P398 example: rows 1-3 column flange 391.7 kN', F(0, 2, 'cfb'), 391.7, 1e-3); near('P398 example: row 1 column web 179.0 kN', F(0, 0, 'cwt'), 179.0, 1e-3);
  near('P398 example: rows 1-3 column web 245.4 kN', F(0, 2, 'cwt'), 245.4, 1e-3); near('P398 example: row 1 end plate (extension) 97.3 kN', F(0, 0, 'epb'), 97.3, 1e-3);
  near('P398 example: row 2 end plate (alpha m) 138.8 kN', F(1, 1, 'epb'), 138.8, 1e-3); near('P398 example: row 3 end plate 131.0 kN', F(2, 2, 'epb'), 131.0, 1e-3);
  near('P398 example: rows 2-3 end plate 261.2 kN', F(1, 2, 'epb'), 261.2, 1e-3); near('P398 example: row 2 beam web 279.5 kN', F(1, 1, 'bwt'), 279.5, 1e-3);
  near('P398 example: rows 2-3 beam web 473.6 kN', F(1, 2, 'bwt'), 473.6, 1e-3);
  near('P398 example: final row 1 force 97.3 kN', R.rows[0].F / 1e3, 97.3, 1e-3); near('P398 example: final row 2 force 62.9 kN (panel shear)', R.rows[1].F / 1e3, 62.9, 1e-3);
  near('P398 example: final row 3 force 0', R.rows[2].F, 0, 0); near('P398 example: M_j,Rd = 34.91 kNm', R.MjRd / 1e6, 34.91, 1e-3);
  near('P398 example: column web compression (published 190.7; b_eff with the weld throat)', R.Fcwc / 1e3, 190.7, 0.02);
  near('P398 example: V_Rd (rows 1-2 at (1 - 1/1.4) F_v,Rd, row 3 full)', R.VRd / 1e3, 189.48, 1e-3);
  // behaviour
  const N = J.momentEndPlate({ ...base, alpha: null });
  truth('without alpha the first row uses the unstiffened pattern (lower end plate resistance)', N.comp(1, 1).find(c => c.k === 'epb').F < R.comp(1, 1).find(c => c.k === 'epb').F);
  const B0 = J.momentEndPlate({ ...base, beta: 0 });
  truth('two-sided balanced (beta = 0): no panel shear limit, omega = 1, higher M_j,Rd', B0.MjRd > R.MjRd && !B0.checks.some(c => c.id === 'M3'));
  const Sp = J.momentEndPlate({ ...base, type: 'splice', col: null });
  truth('splice: no column components', Sp.comp(0, 0).every(c => !['cfb', 'cwt'].includes(c.k)));
  near('splice: limit is the beam flange in compression', Sp.Flim, Sp.Ffb, 1e-12);
  truth('row forces never exceed the compression limit in total', R.rows.reduce((a, r) => a + r.F, 0) <= R.Flim + 1e-6);
  const St = J.momentEndPlate({ ...base, beta: 0, stiffComp: true, plate: { ...base.plate, tp: 25 }, bolt: J.bolt('M16', '10.9') });
  truth('1.9 F_t,Rd rule applied when a row exceeds it (thick plate, beta 0, stiffened)', St.rows.every(r => r.F <= Math.max(...St.rows.map(x => x.F)) + 1e-9) && (St.rows[0].F <= 1.9 * St.Ftb || St.rows.slice(1).every(r => r.F <= St.rows[0].F * r.h / St.rows[0].h + 1e-6)));
  throws('row inside the flange rejected', () => J.momentEndPlate({ ...base, rows: [40, 75, 250] }), /within the beam flange/);
  throws('gauge wider than the plate rejected', () => J.momentEndPlate({ ...base, w: 150 }), /gauge/);
}
console.log(`\n${n - fails}/${n} joint checks passed`);
if (fails) process.exit(1);
