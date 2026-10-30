// BS EN 1993-1-5 section 6 web bearing against reference/ref_bearing.py, plus a hand calculation and beam integration.
const { EC3, Design, SECTION_DATA, PFC_DATA } = require('./load.js');
const REF = require('./ref_bearing.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, quiet) => {
  n++;
  const ok = Math.abs(got - exp) <= tol * Math.abs(exp);
  if (!ok) { fails++; console.log(`FAIL ${name}: got ${got} expected ${exp}`); } else if (!quiet) console.log(`ok   ${name}: ${(+got).toPrecision(5)}`);
};
let compared = 0;
for (const c of REF) {
  const key = c.desig.replace(/ x /g, '×') + ' ';
  const row = (c.kind === 'PFC' ? PFC_DATA : SECTION_DATA).find(r => r[0].startsWith(key));
  if (!row) continue;           // sections excluded from the shipped table
  const s = c.kind === 'PFC' ? EC3.fromRowPFC(row) : EC3.fromRow(row), fy = EC3.yieldStrength(c.grade, Math.max(s.tw, s.tf));
  near(`${s.name} ${c.grade} type ${c.type} ss=${c.ss} c=${c.c}`, EC3.webBearing(s, fy, { ss: c.ss, c: c.c, type: c.type }).FRd, c.FRd, 1e-9, true);
  compared++;
}
console.log(`${compared} reference cases compared (types a and c, UKB/UKC/PFC, S275-S460)`);
// hand calculation: 457x191x67 UKB S355 (tw 8.5, tf 12.7, b 189.9, h 453.4), type (a), ss = 100 mm
{
  const s = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('457×191×67'))), fy = 355;
  const hw = 453.4 - 25.4, m1 = Math.min(189.9, 8.5 + 30 * Math.sqrt(235 / 355) * 12.7) / 8.5, m2 = 0.02 * (hw / 12.7) ** 2;
  const ly = 100 + 2 * 12.7 * (1 + Math.sqrt(m1 + m2)), Fcr = 0.9 * 6 * 210000 * 8.5 ** 3 / hw, lam = Math.sqrt(ly * 8.5 * 355 / Fcr);
  near('hand: 457x191x67 type (a) ss = 100, F_Rd (kN)', EC3.webBearing(s, fy, { ss: 100, type: 'a' }).FRd / 1e3, Math.min(1, 0.5 / lam) * ly * 8.5 * 355 / 1e3, 1e-12);
}
// beam integration: simply supported, central point load; end supports type (c), point load type (a)
{
  const sec = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('457×191×67')));
  const r = Design.designBeam({ sec, grade: 'S355', spans: [6000], loads: [{ case: 'G', member: 0, type: 'point', P: 200e3, a: 3000 }], selfWeight: false, rule: '6.10', psi0: 0.7,
    restraint: [{ mode: 'top' }], ssSupport: 80, ssPoint: 60, cEnd: 20 });
  const sup = r.bearing.filter(b => b.where === 'support'), pt = r.bearing.find(b => b.where === 'point load');
  n++; const ok = sup.length === 2 && sup.every(b => b.type === 'c') && pt && pt.type === 'a';
  console.log(`${ok ? 'ok  ' : 'FAIL'} beam: two end supports type (c), point load type (a)`); if (!ok) fails++;
  near('beam: support force = ULS reaction', sup[0].F, 1.35 * 100e3, 1e-9);
  near('beam: point load force', pt.F, 1.35 * 200e3, 1e-9);
  const fy = 355, W = sec.Wely;
  near('beam: 7.2 interaction (eta2 + 0.8 eta1)/1.4 at the point load', pt.u72,
    (pt.F / EC3.webBearing(sec, fy, { ss: 60, type: 'a' }).FRd + 0.8 * (1.35 * 200e3 * 6000 / 4) / (W * fy)) / 1.4, 1e-6);
  near('beam: end support uses c = 20 mm', sup[0].wb.kF, Math.min(6, 2 + 6 * (80 + 20) / (453.4 - 25.4)), 1e-12);
}
// continuous beam: internal support is type (a); cantilever end support is type (a)
{
  const sec = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('457×191×67')));
  const r = Design.designBeam({ sec, grade: 'S355', spans: [5000, 5000], cantR: 1500, loads: [0, 1, 2].map(m => ({ case: 'G', member: m, type: 'udl', w: 20 })), selfWeight: false, rule: '6.10', psi0: 0.7,
    restraint: [{ mode: 'top' }, { mode: 'top' }, { mode: 'ends' }], tipRestrained: { R: true } });
  const types = r.bearing.map(b => b.type).join('');
  n++; const ok = types === 'caa'; console.log(`${ok ? 'ok  ' : 'FAIL'} continuous beam with right cantilever: support types ${types} (expected caa)`); if (!ok) fails++;
}
console.log(`${n - fails}/${n} web bearing checks passed`);
process.exit(fails ? 1 : 0);
