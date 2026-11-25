// Elliptical hollow sections (hot-finished, BS EN 10210-2) against Tata Steel's Celsius 355 EHS tables (the Blue Book's
// EHS pages, reference/ehs_tata_tables.json): the properties from the dimensions; the classes in compression, in bending
// about each axis and in compression with bending; N_b,Rd about both axes over 1 to 14 m in compression alone (A_eff = A√x
// for Class 4) and with bending (the reduced strength A x); M_c,Rd and V_c,Rd; and M_b,Rd (6.3.2.2, curve d).
const L = process.env.EHS_SRC ? (() => {        // development: the scratchpad sources
  const vm = require('vm'), fs = require('fs'), d = process.env.EHS_SRC, sb = { console, Math, Array, Object, Number, Error, JSON, Set, Map, Float64Array, Int32Array, Infinity };
  vm.createContext(sb);
  vm.runInContext(['sections/sections.js', 'engine/beam.js', 'engine/ec3.js', 'engine/design.js'].map(f => fs.readFileSync(d + '/' + f, 'utf8')).join('\n') + ';this.EC3=EC3;this.Design=Design;this.EHS_DATA=EHS_DATA;', sb);
  return sb; })() : require('./load.js');
const { EC3, Design, EHS_DATA } = L;
const T = require('./reference/ehs_tata_tables.json');
let fails = 0, n = 0;
const bad = [];
function near(name, got, exp, tol) { n++; if (!(Math.abs(got - exp) <= tol * Math.abs(exp))) { fails++; bad.push(`FAIL ${name}: got ${got} expected ${exp}`); } }
function check(name, c) { n++; if (!c) { fails++; bad.push(`FAIL ${name}`); } }
const sec = (size, t) => { const [h, b] = size.split('x').map(Number); return EC3.ehs({ h, b, t }); };
const fy = 355;
// the published values are to three figures: within half a unit of the third figure, and 0.4% for the properties
const r3 = v => 0.5 * 10 ** (Math.floor(Math.log10(Math.abs(v))) - 2) / Math.abs(v) + 2e-3;
check('EHS: the eleven Celsius sizes', EHS_DATA.length === 11);
for (const r of EHS_DATA) {
  const s = EC3.ehs({ h: r[0], b: r[1], t: r[2] }), nm = `${r[0]}×${r[1]}×${r[2]}`;
  [['A', s.A / 100, r[4]], ['I_y', s.Iy / 1e4, r[5]], ['I_z', s.Iz / 1e4, r[6]], ['W_el,y', s.Wely / 1e3, r[7]], ['W_el,z', s.Welz / 1e3, r[8]], ['W_pl,y', s.Wply / 1e3, r[9]],
    ['W_pl,z', s.Wplz / 1e3, r[10]], ['I_t', s.It / 1e4, r[11]], ['W_t', s.Wt / 1e3, r[12]]].forEach(([k, g, e]) => near(`${nm} ${k}`, g, e, 0.004));
  near(`${nm} mass`, s.mass, r[3], 0.004);
}
for (const r of T.compression.rows) {
  const s = sec(r.size, r.t), tag = `${r.size}×${r.t} compression`;
  check(`${tag}: Class 4 marked where the tables mark it`, (EC3.classify(s, fy, 1, false).cls === 4) === (T.combined.rows.find(q => q.size === r.size && q.t === r.t).cls === 4));
  T.compression.L.forEach((Lm, i) => { const ab = Design.axialBuckling(s, fy, 'S355', 1, Lm * 1000, Lm * 1000, Lm * 1000);
    near(`${tag} N_b,y,Rd at ${Lm} m`, ab.y.chi * ab.NRk / 1e3, r.N.y[i], 0.008); near(`${tag} N_b,z,Rd at ${Lm} m`, ab.z.chi * ab.NRk / 1e3, r.N.z[i], 0.008);
    check(`${tag}: a closed section, no torsional mode`, ab.torsionalMode === 'none'); });
}
for (const r of T.bending) {
  const s = sec(r.size, r.t), tag = `${r.size}×${r.t} bending`, sy = EC3.sectionCheck(s, fy, 0, 100e6, 0), sz = EC3.sectionCheck(s, fy, 0, 0, 0, 100e6, 0);
  check(`${tag}: class about y-y ${r.clsY}`, sy.clsY === r.clsY); check(`${tag}: class about z-z ${r.clsZ}`, sz.clsZ === r.clsZ);
  near(`${tag} M_c,y,Rd`, sy.MyRd / 1e6, r.McyRd, r3(r.McyRd)); near(`${tag} M_c,z,Rd`, sz.MzRd / 1e6, r.MczRd, r3(r.MczRd)); near(`${tag} V_c,Rd`, EC3.shear(s, fy).VRd / 1e3, r.VcRd, r3(r.VcRd));
}
for (const r of T.combined.rows) {
  const s = sec(r.size, r.t), tag = `${r.size}×${r.t} with bending`, sc = EC3.sectionCheck(s, fy, 100e3, 10e6, 0, 10e6, 0), c = EC3.ehsCombined(s);
  check(`${tag}: class ${r.cls} (from the compression)`, sc.cls.cls === r.cls && sc.comb);
  // N_pl,Rd: Tata's A is to three figures (142 cm² for 500×250×12.5, 142.3 from the dimensions)
  near(`${tag} N_pl,Rd`, sc.NRdV / 1e3, r.NplRd, r3(r.NplRd) + 0.002); near(`${tag} M_c,y,Rd`, sc.MyRd / 1e6, r.McyRd, r3(r.McyRd)); near(`${tag} M_c,z,Rd`, sc.MzRd / 1e6, r.MczRd, r3(r.MczRd));
  T.combined.L.forEach((Lm, i) => {
    const ab = Design.axialBuckling(c, fy, 'S355', 1, Lm * 1000, Lm * 1000, Lm * 1000);
    near(`${tag} N_b,y,Rd at ${Lm} m`, ab.y.chi * ab.NRk / 1e3, r.Nby[i], 0.008); near(`${tag} N_b,z,Rd at ${Lm} m`, ab.z.chi * ab.NRk / 1e3, r.Nbz[i], 0.008);
    // M_b,Rd under a uniform moment near M_c,Rd (so 6.3.2.2(4) does not set it aside)
    const m = Design.designMember({ sec: s, grade: 'S355', L: Lm * 1000, N: 1, MyB: r.McyRd * 0.99e6, MyT: r.McyRd * 0.99e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 }), lt = m.segResults[0];
    near(`${tag} M_b,Rd at ${Lm} m`, lt.MbRd / 1e6, r.MbRd[i], r3(r.MbRd[i]) + 0.002);
  });
}
// a member by hand: 400×200×10 EHS, S355, L = 5 m, N = 800 kN with M_y = 60 kNm at the top: Class 4 by the compression
// (D_e/t = 400²/200/10 = 80 > 90ε² = 59.6), x = 59.58/80; the cross-section n + M/M_c ≤ 1 with A x f_y and W_el,y x f_y
{ const s = EC3.ehs({ h: 400, b: 200, t: 10 }), e2 = 235 / 355, x = 90 * e2 / 80;
  const R = Design.designMember({ sec: s, grade: 'S355', L: 5000, N: 800e3, MyB: 0, MyT: 60e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
  const top = EC3.sectionCheck(R.sec, 355, 800e3, 60e6, 60e6 / 5000);
  near('400×200×10 at the top: n + M_y/M_c,y,Rd', top.uNM, 800e3 / (s.A * x * 355) + 60e6 / (s.Wely * x * 355), 1e-12);
  near('400×200×10: N_b,Rd with A x', R.ab.NRk, s.A * x * 355, 1e-12);
  check('400×200×10: closed, Annex B Table B.1', R.gov.interaction && R.gov.interaction.ir.table === 'B.1'); }
bad.slice(0, 30).forEach(l => console.log(l));
console.log(`${n - fails}/${n} EHS checks passed (Tata Steel Celsius 355 EHS tables)`);
process.exit(fails ? 1 : 0);
