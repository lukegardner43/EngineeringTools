// Hollow sections (SHS/RHS/CHS, hot-finished and cold-formed) and parallel flange channels against the independent
// reference reference/ref_shapes.py -> ref_shapes.json, plus published section data (Tata Celsius SHS, British Steel PFC).
const { EC3, Design, PFC_DATA } = require('./load.js');
const fs = require('fs'), path = require('path');
const REF = require('./ref_shapes.json');
let fails = 0, n = 0;
const bad = [];
function near(name, got, exp, tol, quiet) {
  n++;
  const ok = (got === exp) || (Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-9));
  if (!ok) { fails++; bad.push(`FAIL ${name}: got ${got} expected ${exp}`); }
  else if (!quiet) console.log(`ok   ${name}: ${(+got).toPrecision(5)}`);
}
const mk = c => c.kind === 'RHS' ? EC3.rhs({ h: c.h, b: c.b, t: c.t, cold: c.cold }) : c.kind === 'CHS' ? EC3.chs({ d: c.d, t: c.t, cold: c.cold })
  : EC3.fromRowPFC(PFC_DATA.find(r => r[0] === c.name));

// published data: Tata Celsius SHS (S460NH page; properties are grade independent)
const tata = fs.readFileSync(path.join(__dirname, 'reference', 'shs_tata_s460.csv'), 'utf8').trim().split('\n').slice(1).map(l => l.split(','));
let worst = 0;
for (const [size, t, mass, A, I, i, Wel, Wpl, It, Wt] of tata) {
  const b = +size.split(' x ')[0], s = EC3.rhs({ h: b, b, t: +t });
  for (const [got, tab, tol] of [[s.A / 1e2, +A, 0.006], [s.Iy / 1e4, +I, 0.006], [s.Wely / 1e3, +Wel, 0.006], [s.Wply / 1e3, +Wpl, 0.006], [s.It / 1e4, +It, 0.006], [s.Wt / 1e3, +Wt, 0.006], [s.mass, +mass, 0.006]]) {
    near(`Tata ${size}x${t}`, got, tab, tol, true); worst = Math.max(worst, Math.abs(got / tab - 1));
  }
}
console.log(`Tata Celsius SHS: ${tata.length} sections, worst deviation ${(worst * 100).toFixed(2)}% (table rounding)`);

let nc = 0;
for (const c of REF) {
  const s = mk(c), fy = EC3.yieldStrength(c.grade, Math.max(s.tf, s.tw)), e = c.exp;
  const tag = `${c.kind} ${s.name} ${c.grade}${c.cold ? ' cold' : ''}`;
  if (c.props) for (const [k, v] of Object.entries(c.props)) near(`${tag} ${k}`, s[k], v, k === 'It' || k === 'Wt' ? 1e-9 : 4e-3, true);
  const sc = EC3.sectionCheck(s, fy, c.N, c.My, c.V, c.Mz, c.Vz);
  near(`${tag} class`, sc.cls.cls, e.cls, 0, true);
  near(`${tag} uV`, sc.uV, e.uV, 4e-3, true);
  near(`${tag} uM`, sc.uM, e.uM, e.Weff ? 6e-3 : 4e-3, true);
  if (e.Aeff !== undefined && c.N > 0) near(`${tag} Aeff`, EC3.aeffCompression(s, fy).Aeff, e.Aeff, 4e-3, true);
  if (e.Weff) near(`${tag} Weff`, EC3.weffBending(s, fy).Weff, e.Weff, 6e-3, true);
  const ab = Design.axialBuckling(s, fy, c.grade, 1, c.L, c.L, c.L);
  if (e.NbRd !== undefined) near(`${tag} Nb,Rd L=${c.L}`, ab.NbRd, e.NbRd, 4e-3, true);
  if (e.NcrTF) near(`${tag} Ncr,TF`, ab.NcrTF, e.NcrTF, 1e-9, true);
  nc++;
}
console.log(`${nc} reference cases (RHS/SHS, CHS, PFC: properties, class, shear, N-M, Aeff/Weff, flexural and torsional-flexural buckling)`);
// LTB: CHS not susceptible; RHS uses Iw = 0 in the FE model (closed form check for uniform moment)
{ const s = EC3.rhs({ h: 300, b: 100, t: 6.3 }), L = 8000;
  const lam = EC3.mcrFE({ L, EIz: EC3.E * s.Iz, GIt: EC3.G * s.It, EIw: 0, hs: s.h - s.t, M: () => 1, restraints: [{ x: 0, type: 'fork' }, { x: L, type: 'fork' }] });
  near('RHS 300x100x6.3 Mcr, uniform moment, Iw = 0', lam, Math.PI / L * Math.sqrt(EC3.E * s.Iz * EC3.G * s.It), 2e-3);
  const r = Design.designBeam({ sec: EC3.chs({ d: 219.1, t: 8 }), grade: 'S355', spans: [9000], loads: [{ case: 'G', member: 0, type: 'udl', w: 5 }], selfWeight: false, rule: '6.10', psi0: 0.7, restraint: [{ mode: 'ends' }] });
  n++; const ok = r.gov.ltb.chiMod === 1 && r.gov.ltb.Mcr === Infinity; console.log(`${ok ? 'ok  ' : 'FAIL'} CHS: no lateral-torsional buckling (chi_LT = ${r.gov.ltb.chiMod})`); if (!ok) fails++; }
bad.slice(0, 25).forEach(l => console.log(l));
console.log(`${n - fails}/${n} shape checks passed`);
process.exit(fails ? 1 : 0);
