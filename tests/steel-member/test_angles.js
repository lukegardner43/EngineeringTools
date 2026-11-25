// Angles, single and back to back, in axial tension and compression, against the independent reference
// reference/ref_angles.py -> ref_angles.json (outline polygons integrated, numpy roots), and the published section tables
// (British Steel EA and UA datasheets, Corus 2005 tables): the properties the tool works out from the dimensions.
const L = process.env.ANGLE_SRC ? (() => {        // development: the scratchpad sources
  const vm = require('vm'), fs = require('fs'), d = process.env.ANGLE_SRC, sb = { console, Math, Array, Object, Number, Error, JSON, Set, Map, Float64Array, Int32Array };
  vm.createContext(sb);
  vm.runInContext(['sections/sections.js', 'engine/ec3.js', 'engine/angle.js'].map(f => fs.readFileSync(d + '/' + f, 'utf8')).join('\n') + ';this.EC3=EC3;this.Angle=Angle;this.ANGLE_DATA=ANGLE_DATA;', sb);
  return sb; })() : require('./load.js');
const { EC3, Angle, ANGLE_DATA } = L;
const REF = require('./ref_angles.json');
let fails = 0, n = 0;
const bad = [];
function near(name, got, exp, tol) {
  n++;
  const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-9);
  if (!ok) { fails++; bad.push(`FAIL ${name}: got ${got} expected ${exp}`); }
}
function check(name, c) { n++; if (!c) { fails++; bad.push(`FAIL ${name}`); } }
const row = nm => ANGLE_DATA.find(r => r[0] === nm);

// the published tables: A, centroid and I_y, I_z within 0.5%; I_u and I_v within 0.7%, except where the table is out of
// step with itself (I_u + I_v ≠ I_y + I_z, or a value off its neighbours): 120×120×8 and ×15, 150×150×18 (sizes outside the
// standard range), 200×200×18 (I_v 1050 where 16, 20 and 24 mm give 960, 1170, 1380), 200×150×18
const loose = new Set(['120×120×8', '120×120×15', '150×150×18', '200×200×18', '200×150×18']);
check('angles: 41 sizes, 20 equal and 21 unequal', ANGLE_DATA.length === 41 && ANGLE_DATA.filter(r => r[2] === r[3]).length === 20);
for (const r of ANGLE_DATA) {
  const s = Angle.fromRow(r), T = s.tab;
  for (const k of ['A', 'zc', 'yc', 'Iy', 'Iz']) near(`${s.name} ${k} against the table`, s[k], T[k], 0.005);
  for (const k of ['Iu', 'Iv']) near(`${s.name} ${k} against the table`, s[k], T[k], loose.has(r[0]) ? 0.017 : 0.007);
  near(`${s.name}: I_u + I_v = I_y + I_z`, s.Iu + s.Iv, s.Iy + s.Iz, 1e-12);
  check(`${s.name}: named ${s.equal ? 'EA' : 'UA'}`, new RegExp(`^\\d+×\\d+×\\d+ ${s.equal ? 'EA' : 'UA'}$`).test(s.name));
}
// the reference cases
let nc = 0;
for (const c of REF) {
  const a = Angle.fromRow(row(c.name)), s = c.kind === 'pair' ? Angle.pair(a, c.gap) : a, tag = `${c.kind} ${c.name} ${c.grade} N ${(c.N / 1e3).toFixed(0)} kN`;
  for (const [k, v] of Object.entries(c.props)) near(`${tag} ${k}`, k === 'tan_alpha' ? Math.tan(a.alpha) : k === 'u0abs' ? Math.abs(a.u0) : k === 'v0abs' ? Math.abs(a.v0) : a[k], v, k === 'v0abs' && v < 1e-6 ? Infinity : 2e-6);
  if (c.pairProps) for (const [k, v] of Object.entries(c.pairProps)) near(`${tag} pair ${k}`, s[k], v, 2e-6);
  const inp = { sec: s, grade: c.grade, L: c.L, N: c.N, method: c.method, k: c.k, conn: c.conn, pack: c.pack };
  let R; try { R = Angle.design(inp); } catch (e) { fails++; n++; bad.push(`FAIL ${tag}: ${e.message}`); continue; }
  const e = c.exp;
  check(`${tag} class`, R.cls === e.cls);
  if (c.N < 0) {
    near(`${tag} N_pl,Rd`, R.tension.Npl, e.Npl, 1e-5);
    near(`${tag} N_u,Rd (${c.conn.type})`, R.tension.Nu, e.Nu, 1e-5);
    if (e.Nbt) near(`${tag} block tearing`, R.tension.Nbt, e.Nbt, 1e-5);
  } else {
    near(`${tag} A_eff`, R.classify.Aeff, e.Aeff, 1e-5);
    for (const [m, v] of Object.entries(e.Nb)) { const md = R.buckling.modes.find(q => q.key === m); check(`${tag} mode ${m} present`, !!md); if (md) near(`${tag} N_b,Rd ${m}`, md.NbRd, v, 1e-5); }
  }
  if (e.packs != null) near(`${tag} packs`, R.gov.packs.util, e.packs, 1e-7);
  near(`${tag} utilisation`, R.utilMax, e.util, 1e-5);
  nc++;
}
console.log(`${nc} reference cases (single and back to back; tension bolted and welded; compression by BB.1.2 and by buckling lengths)`);
// by hand: 100×100×10 EA in S275, two M20 bolts in 22 mm holes, p1 = 70 (3.18d0), e1 = 40, e2 = 45: β2 = 0.4 + 0.3(3.18 − 2.5)/2.5
{ const s = Angle.fromRow(row('100×100×10')), R = Angle.design({ sec: s, grade: 'S275', L: 3000, N: -200e3, conn: { type: 'bolts', n: 2, d0: 22, p1: 70, e1: 40, e2: 45 } });
  const beta = 0.4 + 0.3 * (70 / 22 - 2.5) / 2.5;
  near('100×100×10 EA: β₂ by hand', R.tension.beta, beta, 1e-12);
  near('100×100×10 EA: N_u,Rd = β₂(A − d₀t)f_u/1.1', R.tension.Nu, beta * (s.A - 220) * 410 / 1.1, 1e-12);
  near('100×100×10 EA: block tearing', R.tension.Nbt, 0.5 * 410 * (45 - 11) * 10 / 1.25 + 275 * (40 + 70 - 1.5 * 22) * 10 / Math.sqrt(3), 1e-12); }
// an unequal angle connected by its short leg sees the equal angle of that leg
{ const s = Angle.fromRow(row('150×75×10')), R = Angle.design({ sec: s, grade: 'S355', L: 2000, N: -100e3, conn: { type: 'welded', leg: 'short' } }), q = Angle.single({ h: 75, b: 75, t: 10, r1: s.r1, r2: s.r2, It: 0 });
  near('150×75×10 UA welded by its short leg: the area of a 75×75×10 equal angle (4.13)', R.tension.Nu, q.A * 355, 1e-12);
  const R2 = Angle.design({ sec: s, grade: 'S355', L: 2000, N: -100e3, conn: { type: 'welded', leg: 'long' } });
  near('… by its long leg: the gross area', R2.tension.Nu, s.A * 355, 1e-12); }
// refusals: one bolt with BB.1.2 in compression, minimum spacings, a historic grade, no axial force
for (const [nm, inp, re] of [
  ['one bolt in compression by BB.1.2', { method: 'BB', N: 50e3, conn: { type: 'bolts', n: 1, d0: 22, e1: 40, e2: 45 } }, /6\.2\.9/],
  ['e1 below 1.2d0', { N: -50e3, conn: { type: 'bolts', n: 2, d0: 22, p1: 70, e1: 20, e2: 45 } }, /Table 3\.3/],
  ['a historic grade', { grade: 'BS15', N: -50e3, conn: { type: 'welded' } }, /S235 to S460/],
  ['no axial force', { N: 0, conn: { type: 'welded' } }, /tension or compression/]]) {
  let msg = ''; try { Angle.design({ sec: Angle.fromRow(row('100×100×10')), grade: 'S275', L: 3000, ...inp }); } catch (e) { msg = e.message; }
  check(`refused: ${nm}`, re.test(msg));
}
bad.slice(0, 30).forEach(l => console.log(l));
console.log(`${n - fails}/${n} angle checks passed`);
process.exit(fails ? 1 : 0);
