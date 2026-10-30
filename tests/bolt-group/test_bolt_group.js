// Bolt group: elastic distribution and EN 1993-1-8 resistances by hand; ICR against reference/ref_icr.py (scipy).
const { BoltGroup: B } = process.env.ENGINE ? require(process.env.ENGINE) : require('./load.js');
const REF = require('./ref_icr.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol = 1e-9, quiet = false) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-9); if (!ok || !quiet) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truthy = (name, v) => { n++; console.log(`${v ? 'ok  ' : 'FAIL'} ${name}`); if (!v) fails++; };
// 4 rows x 2 columns, p1 = 70, p2 = 90, e1 = e2 = 40; vertical load 100 kN downward at 215 mm right of the centroid
const g = B.grid({ rows: 4, cols: 2, p1: 70, p2: 90, e1: 40, e2: 40 });
{ const el = B.elastic(g.bolts, { Fz: -100e3, ya: 85 + 215, za: 145 });
  const J = 8 * 45 ** 2 + 4 * (35 ** 2 + 105 ** 2), T = -100e3 * 215;
  near('elastic: J = sum r²', el.J, J);
  // corner bolt (130, 250): fy = -T (z - zc)/J, fz = F/n + T (y - yc)/J
  const fy = -T * 105 / J, fz = -100e3 / 8 + T * 45 / J;
  const k = g.bolts.findIndex(b => b.y === 130 && b.z === 250);
  near('elastic: corner bolt horizontal component', el.forces[k].fy, fy); near('elastic: corner bolt vertical component', el.forces[k].fz, fz);
  near('elastic: corner bolt resultant (kN)', Math.max(...el.forces.map(f => f.F)) / 1e3, Math.hypot(fy, fz) / 1e3); }
// pure moment: bolt force T r / J perpendicular to the radius
{ const el = B.elastic(g.bolts, { T: 10e6, ya: 0, za: 0 }), J = 8 * 45 ** 2 + 4 * (35 ** 2 + 105 ** 2);
  near('pure moment: outer bolt force T r_max / J', Math.max(...el.forces.map(f => f.F)), 10e6 * Math.hypot(45, 105) / J); }
// ICR: vertical eccentric loads against the independent scipy solution
for (const c of REF) { const gg = B.grid({ rows: c.rows, cols: c.cols, p1: c.p1, p2: c.cols > 1 ? c.p2 : 0, e1: 40, e2: 40 });
  const cen = B.centroid(gg.bolts), r = B.icr(gg.bolts, { Fz: -1, ya: cen.yc + c.e, za: cen.zc });
  near(`ICR ${c.rows}x${c.cols}, e = ${c.e}: C`, r.C, c.C, 1e-5, true); }
console.log(`${REF.length} ICR cases compared with scipy`);
{ const r = B.icr(g.bolts, { T: 1, ya: 0, za: 0 });                 // pure moment: M_ult = sum R_i r_i about the centroid
  const R = r0 => Math.pow(1 - Math.exp(-10 * 0.34 * r0 / Math.hypot(45, 105)), 0.55);
  near('ICR pure moment: M_ult / R_ult', r.C, 4 * (R(Math.hypot(45, 35)) * Math.hypot(45, 35) + R(Math.hypot(45, 105)) * Math.hypot(45, 105)), 1e-6); }
// resistances, M20 8.8, threads in the shear plane, single shear; S275 plate 10 mm (fu 410)
{ const bp = B.boltProps(20, '8.8', { threadsInShear: true, planes: 1 });
  near('Fv,Rd = 0.6 fub As / 1.25 (kN)', bp.FvRd / 1e3, 0.6 * 800 * 245 / 1.25 / 1e3);
  near('Ft,Rd = 0.9 fub As / 1.25 (kN)', bp.FtRd / 1e3, 0.9 * 800 * 245 / 1.25 / 1e3);
  near('10.9: alpha_v = 0.5', B.boltProps(20, '10.9').av, 0.5);
  near('shank in the shear plane: 0.6 fub A / 1.25', B.boltProps(20, '10.9', { threadsInShear: false }).FvRd, 0.6 * 1000 * Math.PI * 100 / 1.25);
  const end = B.bearing(bp, 410, 10, { e1: 40, p1: 70, e2: 40, p2: 90, end: true, edge: true });
  near('bearing, end and edge bolt: alpha_d = e1/3d0', end.ad, 40 / 66);
  near('bearing, end and edge bolt: k1 = min(2.8e2/d0 - 1.7, 1.4p2/d0 - 1.7, 2.5)', end.k1, 2.5);
  near('bearing, end and edge bolt: Fb,Rd (kN)', end.FbRd / 1e3, 2.5 * (40 / 66) * 410 * 20 * 10 / 1.25 / 1e3);
  const inner = B.bearing(bp, 410, 10, { e1: 40, p1: 70, e2: 40, p2: 60, end: false, edge: false });
  near('bearing, inner bolt: alpha_d = p1/3d0 - 1/4', inner.ad, 70 / 66 - 0.25);
  near('bearing, inner bolt: k1 = min(1.4 p2/d0 - 1.7, 2.5)', inner.k1, 1.4 * 60 / 22 - 1.7); }
// geometry classification for the 4x2 grid
{ const geo = B.geometry(g.bolts, g.plate);
  const corner = geo[g.bolts.findIndex(b => b.y === 40 && b.z === 40)], innerRow = geo[g.bolts.findIndex(b => b.y === 40 && b.z === 110)];
  truthy('bottom-left bolt: end bolt for vertical force, end bolt for horizontal force', corner.endZ && corner.endY);
  truthy('second-row bolt: inner for vertical force, end for horizontal force', !innerRow.endZ && innerRow.endY);
  near('second-row bolt: p1 (vertical) = 70', innerRow.pz, 70); near('edge distance e2 for a vertical force = 40', corner.ey, 40); }
// out-of-plane: moment about a pivot line at the bottom edge; forces proportional to distance
{ const o = B.outOfPlane(g.bolts, { My: 50e6, pivotZ: 0 }), S = 2 * (40 ** 2 + 110 ** 2 + 180 ** 2 + 250 ** 2);
  near('pivot method: top bolt tension My z / sum z²', Math.max(...o.map(x => x.t)), 50e6 * 250 / S); }
// combined shear and tension, long joint
{ const one = B.grid({ rows: 8, cols: 1, p1: 70, p2: 0, e1: 40, e2: 40 }), d = 20;
  const r = B.check({ bolts: one.bolts, plate: one.plate, d, cls: '8.8', planes: 1, plates: [{ t: 10, fu: 410 }], act: { Fz: -400e3, ya: 40, za: one.plate.z1 / 2, N: 80e3 } });
  const Lj = 7 * 70, bLf = Math.max(0.75, 1 - (Lj - 15 * d) / (200 * d));
  near('long joint: beta_Lf', r.bLf, bLf);
  const F = 400e3 / 8, t = 80e3 / 8, FvRd = 0.6 * 800 * 245 / 1.25, FtRd = 0.9 * 800 * 245 / 1.25;
  near('combined: Fv/(beta Fv,Rd) + Ft/(1.4 Ft,Rd)', r.gov.uvt, F / (bLf * FvRd) + t / (1.4 * FtRd)); }
console.log(`${n - fails}/${n} bolt group checks passed`);
process.exit(fails ? 1 : 0);
