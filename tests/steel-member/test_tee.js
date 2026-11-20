// Tees cut from UKB and UKC against the independent reference reference/ref_tee.py -> ref_tee.json (strip integration,
// Table 5.2 and EN 1993-1-5 Table 4.2 from the text, stress blocks, the torsional-flexural quadratic, a Galerkin M_cr with
// the Wagner term), and against published tee data (centroid, I about both axes: structural tees cut from UBs).
const { EC3, Design, SECTION_DATA } = require('./load.js');
const REF = require('./ref_tee.json');
let fails = 0, n = 0;
const bad = [];
function near(name, got, exp, tol) {
  n++;
  const ok = (got === exp) || (Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-9));
  if (!ok) { fails++; bad.push(`FAIL ${name}: got ${got} expected ${exp}`); }
}
const mk = p => EC3.tee({ ...p, productStd: 'BS EN 10025-2' });

// published: structural tees cut from UBs (BS 5950 tables): the parent UB, centroid from the outside of the flange (cm),
// I about the axis parallel to the flange (cm⁴), I about the stem's axis (cm⁴). The tables used older, slightly different
// dimensions of some parents and a depth 0.05 to 0.1 mm under half the parent's: agreement to 1.5 %.
const PUB = [['914×305×253 UKB', 12.0, 32700, 6650], ['762×267×134 UKB', 10.3, 12100, 2390], ['686×254×125 UKB', 8.85, 8980, 2190], ['610×305×149 UKB', 6.45, 7410, 4650],
  ['533×210×82 UKB', 6.75, 3530, 1000], ['457×191×67 UKB', 5.46, 2030, 726], ['457×152×52 UKB', 6.04, 1670, 322], ['254×102×22 UKB', 3.45, 223, 59.7]];
let worst = 0;
for (const [p, c, Iy, Iz] of PUB) {
  const r = SECTION_DATA.find(x => x[0] === p), t = EC3.tee(EC3.fromRow(r));
  for (const [got, tab] of [[t.c / 10, c], [t.Iy / 1e4, Iy], [t.Iz / 1e4, Iz]]) { near(`published ${p}`, got, tab, 0.015); worst = Math.max(worst, Math.abs(got / tab - 1)); }
}
console.log(`published tees: ${PUB.length}, worst deviation ${(worst * 100).toFixed(2)} %`);

// every UKB and UKC tee: properties by strips
for (const c of REF.props) {
  const t = mk(c.parent);
  for (const [k, v] of Object.entries(c.exp)) near(`${t.name} ${k}`, t[k], v, k === 'zp' ? 2e-3 : k === 'zj' ? 5e-4 : 2e-4);
}
console.log(`${REF.props.length} tees: A, centroid, I_y, I_z, W_el (flange, toe, z), W_pl (y, z), plastic neutral axis, shear centre, z_j`);

// cross-sections: class (flange and stem), shear, plastic N-M, elastic and effective
for (const c of REF.sections) {
  const t = mk(c.parent), e = c.exp, tag = `${t.name} ${c.grade} N ${(c.N / 1e3).toFixed(0)} My ${(c.My / 1e6).toFixed(1)}`;
  const sc = EC3.sectionCheck(t, c.fy, c.N, c.My, c.V, c.Mz, c.Vz);
  near(`${tag} class`, sc.cls.cls, e.cls, 0); near(`${tag} flange class`, sc.cls.flange.cls, e.fcls, 0); near(`${tag} stem class`, sc.cls.web.cls, e.wcls, 0);
  if (e.alpha != null) near(`${tag} alpha`, sc.cls.web.alpha, e.alpha, 5e-4 / Math.max(Math.abs(e.alpha), 1e-9));   // to 5e-4 (the reference's strips)
  if (e.ks != null) near(`${tag} k_sigma`, sc.cls.web.ks, e.ks, 2e-3);
  near(`${tag} A_v`, sc.shear.Av, e.Av, 1e-3); near(`${tag} N_Rd`, sc.NRd, e.NRd, 3e-3);
  if (e.MNy !== undefined && Math.abs(c.My) > 1e-6) near(`${tag} M_N,y,Rd`, sc.MNy, e.MNy, 3e-3);
  near(`${tag} utilisation`, sc.uM, e.uM, 4e-3);
}
console.log(`${REF.sections.length} cross-sections: class, shear area, N_Rd, M_N,y,Rd, the bending utilisation (plastic, elastic, effective)`);

// flexural and torsional-flexural buckling
for (const c of REF.axial) {
  const t = mk(c.parent), ab = Design.axialBuckling(t, c.fy, c.grade, 1, c.Lcry, c.Lcrz, c.LT), tag = `${t.name} ${c.grade} ${c.Lcry}/${c.Lcrz}`;
  near(`${tag} N_cr,TF`, ab.NcrTF, c.exp.NcrTF, 2e-4); near(`${tag} N_b,Rd`, ab.NbRd, c.exp.NbRd, 3e-3);
}
console.log(`${REF.axial.length} members in compression: N_cr,TF about the stem's axis, N_b,Rd (curve c)`);

// lateral-torsional buckling, each sign of the moment
for (const c of REF.ltb) {
  const t = mk(c.parent), Mf = x => c.MA + (c.MB - c.MA) * x / c.L, Mmax = Math.max(Math.abs(c.MA), Math.abs(c.MB));
  const lt = Design.ltb(t, c.fy, 1, { L: c.L, M: Mf, Mref: Mmax, Mmax, restraints: [{ x: 0, type: 'fork' }, { x: c.L, type: 'fork' }], forkFork: true }, { nEl: 24 });
  for (const e of c.exp) {
    const r = lt.signs.find(s => s.sgn === e.sgn), tag = `${t.name} L ${c.L} M ${(c.MA / 1e6).toFixed(1)}/${(c.MB / 1e6).toFixed(1)} sign ${e.sgn}`;
    if (!r) { near(`${tag} found`, 0, 1, 0); continue; }
    near(`${tag} class`, r.cls, e.cls, 0); near(`${tag} M_cr`, r.Mcr, e.Mcr, 2e-3); near(`${tag} M_b,Rd`, r.MbRd, e.MbRd, 3e-3);
  }
}
console.log(`${REF.ltb.length} members in bending: M_cr (finite elements against a Galerkin series with the Wagner term) and M_b,Rd for each sign`);

bad.slice(0, 60).forEach(b => console.log(b));
console.log(`\n${n - fails}/${n} tee checks passed`);
process.exit(fails ? 1 : 0);
