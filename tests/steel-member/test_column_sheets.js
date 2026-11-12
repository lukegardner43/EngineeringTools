// Steel Member Design (member mode) against Luke's two column-design workbooks: UKB/UKC, and hollow sections.
// ref_column_sheets.json holds the workbooks' outputs only (recalculated in LibreOffice); the workbooks are private and are
// not in this repository. Each case was run with the tool's class, C1 (C2 = 0) and Cm typed in, and with the workbook's own
// section properties, so every intermediate value can be compared like for like.
//
// Where a workbook departs from BS EN 1993-1-1 the test does not copy it. It rebuilds the right value from the workbook's
// own intermediates and checks the tool against that:
//   - k_zy is 0 in the workbooks whenever M_z = 0 (it multiplies M_y in (6.62)); Table B.2 / B.1 values are used here;
//   - k_zz of hollow sections uses the I-section row of Table B.1 in the workbook; the RHS row is used here;
//   - class 3 interaction factors use the class 1-2 expressions in the workbook; the class 3 column of Tables B.1/B.2 here;
//   - M_N,z,Rd of I-sections: the workbook takes a = (A - 2 h_w t_w)/A <= 0.5 instead of (A - 2 b t_f)/A (6.2.9.1(5));
//   - hollow sections: the workbook takes chi_LT = 1; the tool checks RHS lateral-torsional buckling (I_w = 0).
// Where the tool is deliberately more conservative the test checks the tool's own value from the workbook's:
//   - a web that is class 4 in pure compression: N_Rk = A_eff f_y in the buckling checks even when the section is class 1-3
//     under the combined actions (the workbooks use the gross area); lambda is checked as lambda_workbook sqrt(A_eff/A).
const { EC3, Design } = require('./load.js');
const RAW = require('./ref_column_sheets.json');
const REF = { sections: RAW.sections, cases: RAW.cases.map(a => { const c = {}; RAW.caseFields.forEach((k, i) => c[k] = a[i]);
  const s = {}; RAW.sheetFields.forEach((k, i) => s[k] = c.sheet[i]); c.sheet = s;
  c.typed = { cls: c.cls, C1: c.C1, Cmy: c.Cmy, Cmz: c.Cmz, CmLT: c.CmLT }; return c; }) };
let n = 0, fails = 0;
const stats = {}, failLines = [];
function check(q, id, got, exp, tol) {
  n++; const s = stats[q] || (stats[q] = { n: 0, worst: 0, at: null });
  s.n++;
  const d = typeof exp === 'string' ? (got === exp ? 0 : Infinity) : Math.abs(got - exp) / Math.max(Math.abs(exp), 1e-9);
  if (!(d <= s.worst)) { s.worst = d; s.at = id; }
  if (!(d <= tol)) { fails++; if (failLines.length < 40) failLines.push(`FAIL ${q} case ${id}: tool ${got} workbook ${exp}`); }
}
function secOf(c) {
  const p = REF.sections[c.sec];
  if (c.kind === 'I') return { shape: 'I', nw: 1, name: c.sec, h: p.h, b: p.b, tw: p.tw, tf: p.tf, r: p.r, A: p.A, Iy: p.Iy, Iz: p.Iz,
    Wely: p.Wely, Welz: p.Welz, Wply: p.Wply, Wplz: p.Wplz, It: p.It, Iw: p.Iw, rolled: true };
  const g = c.kind === 'CHS' ? EC3.chs({ d: p.h, t: p.t }) : EC3.rhs({ h: p.h, b: p.b, t: p.t });
  return { ...g, A: p.A, Iy: p.Iy, Iz: p.Iz, Wely: p.Wely, Welz: p.Welz, Wply: p.Wply, Wplz: p.Wplz, It: p.It };
}
const curve = s => String(s).replace(/^curve\s*/i, '').toLowerCase();
let skippedT = 0, kzyZero = 0, kzyCases = 0, notHeld = 0, n62 = 0, nEff = 0, mnzOver = 0;
for (const c of REF.cases) {
  const sec = secOf(c), w = c.sheet, ty = c.typed, M = c.My * 1e6, Mz = c.Mz * 1e6, N = c.N * 1e3;
  const MyB = c.shape === 'tri' ? 0 : c.shape === 'rev' ? -M / 2 : M;
  const o = Design.designMember({ sec, grade: c.grade, L: c.L, N, MyB, MyT: M, MzB: Mz, MzT: Mz, Lcr: { y: c.Ly, z: c.Lz, LT: c.LLT }, annex: 'B' });
  const ab = o.ab, id = c.id, I = c.kind === 'I';
  if (o.cls > 3) continue;                                     // class 4: outside the workbooks
  check('class typed in = tool class', id, Math.min(o.cls, 3), ty.cls, 0);
  check('f_y', id, o.fy, w.fy, 0);
  // flexural buckling, 6.3.1
  check('N_cr,y', id, ab.Ncry / 1e3, w.Ncry, 1e-5); check('N_cr,z', id, ab.Ncrz / 1e3, w.Ncrz, 1e-5);
  const effA = ab.A < sec.A - 1e-6;
  if (effA) {
    nEff++; check('lambda_y with A_eff (class 4 web in compression)', id, ab.lamY, w.lamY * Math.sqrt(ab.A / sec.A), 1e-5);
    check('lambda_z with A_eff (class 4 web in compression)', id, ab.lamZ, w.lamZ * Math.sqrt(ab.A / sec.A), 1e-5);
  } else { check('lambda_y', id, ab.lamY, w.lamY, 1e-5); check('lambda_z', id, ab.lamZ, w.lamZ, 1e-5); }
  check('buckling curve y-y', id, ab.curves.y, curve(w.curveY), 0); check('buckling curve z-z', id, ab.curves.z, curve(w.curveZ), 0);
  if (!effA) { check('chi_y', id, ab.y.chi, w.chiY, 1e-5); check('chi_z', id, ab.z.chi, w.chiZ, 1e-5);
    check('N_b,y,Rd', id, ab.y.chi * ab.NRk / 1e3, w.NbyRd, 1e-5); check('N_b,z,Rd', id, ab.z.chi * ab.NRk / 1e3, w.NbzRd, 1e-5); }
  // cross-section resistances, 6.2.5 and 6.2.9 (class 1-2; the CHS N-M curve differs: the tool uses the exact plastic one)
  const sc = EC3.sectionCheck(sec, o.fy, N, M, (M - MyB) / c.L, Mz, 0);
  if (o.cls <= 2) {
    check('M_pl,y,Rd', id, sc.Mply / 1e6, w.Mcy, 1e-5); check('M_pl,z,Rd', id, sc.Mplz / 1e6, w.Mcz, 1e-5);
    if (c.kind !== 'CHS' && !sc.allowY) check('M_N,y,Rd (6.36 / 6.39)', id, sc.MNy / 1e6, w.MNy, 1e-5);
    if (c.kind === 'RHS') check('M_N,z,Rd (6.40)', id, sc.MNz / 1e6, w.MNz, 1e-5);
    if (I) { const a = Math.min(0.5, (sec.A - 2 * sec.b * sec.tf) / sec.A), nn = N / (sec.A * o.fy);
      check('M_N,z,Rd (6.37/6.38, a = (A - 2bt_f)/A)', id, sc.MNz / 1e6, nn <= a ? w.Mcz : w.Mcz * (1 - ((nn - a) / (1 - a)) ** 2), 1e-5);
      if (nn > a && nn <= 0.5 && N > 0) mnzOver++; }
  }
  // lateral-torsional buckling, 6.3.2.2-6.3.2.3 + UK NA (I-sections); C1 typed in from the tool, C2 = 0
  const lt = o.segResults[0];
  if (I && lt) {
    check('M_cr', id, lt.Mcr / 1e6, w.Mcr, 1e-5); check('lambda_LT', id, lt.lamLT, w.lamLT, 1e-5);
    check('LT curve', id, lt.curve, curve(w.curveLT), 0);
    if (lt.ignored && w.lamLT > 0.4) { check('chi_LT = 1 where M_Ed/M_cr <= 0.16 (6.3.2.2(4))', id, lt.chiMod, 1, 0); notHeld++; }
    else if (lt.ignored) { check('chi_LT,mod = 1 where lambda_LT <= 0.4', id, lt.chiMod, w.chiLTmod, 0); check('M_b,Rd', id, lt.MbRd / 1e6, w.MbRd, 1e-5); }   // f is not used there
    else { check('chi_LT', id, lt.chi, w.chiLT, 1e-5); check('f', id, lt.f, w.f, 1e-5); check('chi_LT,mod', id, lt.chiMod, w.chiLTmod, 1e-5);
      check('M_b,Rd', id, lt.MbRd / 1e6, w.MbRd, 1e-5); }
  }
  // interaction, 6.3.3 + Annex B, rebuilt from the workbook's own terms where the workbook departs from the code
  const ir = o.gov.interaction && o.gov.interaction.ir;
  if (!ir || !(c.N > 0 || c.Mz > 0)) continue;
  if (c.LLT < c.L && c.shape !== 'uni') continue;
  if (effA) continue;                                          // n_y, n_z with A_eff: not comparable             // windows along the member: the workbook takes M_max with the worst chi_LT
  const cl = Math.min(o.cls, 3), ny = w.a61, nz = w.a62, lz = w.lamZ, ly = w.lamY;
  const kyy = cl <= 2 ? ty.Cmy * Math.min(1 + (ly - 0.2) * ny, 1 + 0.8 * ny) : ty.Cmy * Math.min(1 + 0.6 * ly * ny, 1 + 0.6 * ny);
  const kzz = cl === 3 ? ty.Cmz * Math.min(1 + 0.6 * lz * nz, 1 + 0.6 * nz)
    : I ? ty.Cmz * Math.min(1 + (2 * lz - 0.6) * nz, 1 + 1.4 * nz) : ty.Cmz * Math.min(1 + (lz - 0.2) * nz, 1 + 0.8 * nz);
  const kyz = cl <= 2 ? 0.6 * kzz : kzz;
  const a = ty.CmLT - 0.25;
  const kzy = !I ? (cl <= 2 ? 0.6 : 0.8) * kyy
    : cl <= 2 ? (lz < 0.4 ? Math.min(0.6 + lz, 1 - 0.1 * lz * nz / a) : Math.max(1 - 0.1 * lz * nz / a, 1 - 0.1 * nz / a))
    : Math.max(1 - 0.05 * lz * nz / a, 1 - 0.05 * nz / a);
  if (ab.T && ab.T.chi < ab.z.chi - 1e-9) { skippedT++; continue; }          // torsional buckling governs n_z in the tool
  check('k_yy', id, ir.kyy, kyy, 1e-5); check('k_zz', id, ir.kzz, kzz, 1e-5); check('k_yz', id, ir.kyz, kyz, 1e-5); check('k_zy', id, ir.kzy, kzy, 1e-5);
  if (I && cl <= 2) { check('k_yy = workbook', id, ir.kyy, w.kyy, 1e-5); check('k_zz = workbook (I)', id, ir.kzz, w.kzz, 1e-5); if (c.Mz > 0) check('k_zy = workbook (M_z > 0)', id, ir.kzy, w.kzy, 1e-5); }
  if (c.N > 0 && c.My > 0 && c.Mz === 0) { kzyCases++; if (w.kzy === 0) kzyZero++; }
  // per-unit terms from the workbook: My/(chi_LT My,Rk), Mz/Mz,Rk (hollow: the workbook's chi_LT = 1, the tool's own taken)
  const chiS = I ? w.chiLTmod : 1, chiT = I ? (lt ? lt.chiMod : 1) : (lt ? lt.chiMod : 1);
  const my = w.kyy ? w.b61 / w.kyy * chiS / chiT : 0, mz = w.kyz ? w.c61 / w.kyz : 0;
  check('(6.61)', id, ir.u61, ny + kyy * my + kyz * mz, 1e-5);
  check('(6.62)', id, ir.u62, nz + kzy * my + kzz * mz, 1e-5); n62++;
}
const label = q => q.padEnd(48);
for (const [q, s] of Object.entries(stats)) console.log(`${s.worst <= 1e-5 || q.includes('class') || q.includes('curve') ? 'ok  ' : '    '} ${label(q)} ${String(s.n).padStart(5)} cases, worst ${(s.worst * 100).toExponential(1)} %${s.at != null ? ' (case ' + s.at + ')' : ''}`);
failLines.forEach(l => console.log(l));
console.log(`\nworkbook k_zy = 0 with N + M_y and no M_z: ${kzyZero} of ${kzyCases} cases (the workbooks' error; Table B.1/B.2 used above)`);
console.log(`workbook M_N,z,Rd unreduced although a < n <= 0.5: ${mnzOver} cases (the workbooks' error; 6.38 used above)`);
console.log(`A_eff in the buckling checks (class 4 web in pure compression; the workbooks use A): ${nEff} cases, interaction not compared`);
console.log(`not compared: ${skippedT} interaction cases where torsional buckling governs n_z in the tool; ${notHeld} cases with M_Ed/M_cr <= 0.16 (chi_LT = 1 by 6.3.2.2(4))`);
console.log(`\n${n - fails}/${n} column workbook checks passed`);
process.exit(fails ? 1 : 0);
