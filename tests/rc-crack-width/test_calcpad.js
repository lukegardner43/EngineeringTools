// RC Crack Width: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// The whole calculation (the concrete at 3 and 28 days, T1 from C766 Table 3.3 with the winter and binder adjustments,
// autogenous and drying shrinkage, the restraint from the base by A5.1 and A5.2 or given, the early-age and long-term
// restrained and crack-inducing strains by Eq 3.6 or 3.12, S_r,max, the crack widths and A_s,min) is pasted into CalcPad
// (headless, tests/calcpad) and every value CalcPad works out must be the page's own: CIRIA C766's examples 1, 2 and 4
// as test_crack_width.js sets them, each restraint configuration and mode, the table's thicknesses and seasons, every
// binder, drying from one or two faces, and random walls. Its checks must give the page's verdict; no chip may show an
// error or a unit CalcPad cannot read; and the CalcPad project must open with the same values.
const fs = require('fs'), path = require('path'), { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Crack Width.html'), 'utf8');
const vc = new VirtualConsole(), errs = []; vc.on('jsdomError', e => errs.push(e.message));
const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', virtualConsole: vc }).window, d = w.document;
const H = require('../calcpad/harness.js').open();
const CalcScript = w.eval('CalcScript');
let n = 0, bad = 0, walls = 0;
const seen = new Set();
function check(tag, C, P) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), got = P.vars[it.name];
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + 1e-9;
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = P.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  if (P.warn) { bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
}
const set = o => { for (const [k, v] of Object.entries(o)) { const el = d.getElementById(k); if (!el) throw new Error('no input ' + k); el.value = String(v); el.dispatchEvent(new w.Event('change', { bubbles: true })); } };
const BASE = { T1_mode: 'table', ecd_mode: 'calc', RH: 75, dry_faces: 2, life: 50, R1_mode: 'auto', base_b: 2, base_d: 0.6, Rend_mode: '0.5', Rend2_mode: 'same', Rend_manual: 0.5, Rend2_manual: 0.5, R1_manual: 0.5, R1_lt_manual: 0.43, cement: 'CEMI', bond_mode: 'auto' };
function wall(tag, o) {
  set({ ...BASE, ...o }); w.runCalc();
  const g = w.eval('G'), Z = w.eval('fullZ');
  if (!Z) { bad++; console.log('SCRIPT', tag, d.getElementById('fullCalc').textContent.slice(0, 200)); return null; }
  walls++; seen.add(`${g.restraint_config}/${g.R1_mode}/${g.govEA}/${g.govLT}/${g.T1_mode}/${g.ecd_mode}`);
  const zn = Z[0], u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), util = Math.max(g.wk_gov / g.wmax, g.Asmin_req / g.As_pm);
  n++; if (Math.abs(Math.max(...u) - util) > 1e-12 * util || zn.util !== Math.max(...u)) { bad++; console.log('UTIL', tag, u, util, zn.util); }
  n++; if ((Math.max(...u) <= 1) !== g.pass) { bad++; console.log('VERDICT', tag, u, g.pass); }
  check(tag, zn.C, H.text(zn.C.calcpad()));
  return Z;
}
// ---------- C766's examples, as test_crack_width.js sets them ----------
const E1 = { h: 500, H: 4, L: 12, phi: 16, spacing: 200, cover: 40, fck_class: 30, cement_class: 'N', agg: 'flint', formwork: 'plywood', season: 'summer',
  T1_mode: 'given', T1_given: 26.4, ecd_mode: 'given', ecd_given: 82, restraint_config: 'base_only', R1_mode: 'manual', R1_manual: 0.47, R1_lt_manual: 0.40, bond_mode: 'auto', fyk: 500, wmax: 0.2 };
const E2 = { h: 200, H: 3, L: 15, phi: 12, spacing: 250, cover: 30, fck_class: 32, cement_class: 'N', agg: 'granite', formwork: 'plywood', season: 'summer',
  T1_mode: 'given', T1_given: 17.6, ecd_mode: 'given', ecd_given: 222, restraint_config: 'ends_only', Rend_mode: 'manual', Rend_manual: 0.17, Rend2_mode: 'same', bond_mode: 'auto', fyk: 500, wmax: 0.3 };
const Z0 = wall('C766 example 1', E1);
n++; { const z = d.querySelectorAll('#fullCalc details.zone'); if (!(z.length === 1 && d.getElementById('fullCalcSection').style.display === 'block' && z[0].querySelector('[data-cp="copy"]') && /Crack control of the wall/.test(z[0].textContent))) { bad++; console.log('FAIL the page shows no full calculation with its CalcPad buttons'); } }
wall('C766 example 1, T12', { ...E1, phi: 12 });
wall('C766 example 1, restraint from the base', { ...E1, R1_mode: 'auto', base_b: 2.85, base_d: 0.8 });
wall('C766 example 2', E2);
wall('C766 example 2, T16 at 150', { ...E2, phi: 16, spacing: 150 });
wall('C766 example 2, drying shrinkage', { ...E2, ecd_mode: 'calc', RH: 80, dry_faces: 2, life: 50 });
wall('C766 example 4 section', { ...E2, h: 350, phi: 16, spacing: 150, cover: 50, fck_class: 40, agg: 'granite' });
wall('a 350 ground slab drying from one face', { ...E2, h: 350, fck_class: 40, ecd_mode: 'calc', RH: 65, dry_faces: 1, life: 50 });
// ---------- configurations, modes, the table ----------
for (const restraint_config of ['base_only', 'base_one_end', 'base_both_ends', 'ends_only'])
  for (const [R1_mode, Rend_mode, Rend2_mode] of [['auto', '0.5', 'same'], ['0.5', '0.8', '1.0'], ['manual', 'manual', 'manual'], ['auto', '1.0', '0.5']])
    wall(`${restraint_config}, R1 ${R1_mode}, ends ${Rend_mode} / ${Rend2_mode}`, { ...E1, T1_mode: 'table', ecd_mode: 'calc', restraint_config, R1_mode, Rend_mode, Rend2_mode, Rend_manual: 0.35, Rend2_manual: 0.6, base_b: 1.5, base_d: 0.5 });
for (const h of [250, 300, 450, 700, 850, 1000, 1500, 2000, 2400]) for (const season of ['summer', 'winter'])
  wall(`T1 table, h ${h}, ${season}`, { ...E1, h, season, T1_mode: 'table', formwork: h > 900 ? 'steel' : 'plywood', ecd_mode: 'calc', restraint_config: 'base_both_ends', R1_mode: 'auto' });
for (const cement of ['CEMI', 'GGBS30', 'GGBS50', 'GGBS70', 'FA20', 'FA35']) for (const cement_class of ['N', 'R', 'S'])
  wall(`${cement}, class ${cement_class}`, { ...E1, cement, cement_class, T1_mode: 'table', ecd_mode: 'calc', dry_faces: cement_class === 'S' ? 1 : 2 });
wall('good bond chosen, deep cover', { ...E1, bond_mode: 'good', cover: 60 });
wall('poor bond chosen, thin wall', { ...E2, bond_mode: 'poor' });
// ---------- random walls ----------
let seed = 766; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 40; t++) wall(`random ${t}`, { h: pick([200, 250, 300, 400, 500, 750, 1000]), H: pick([2, 3, 4, 6]), L: pick([5, 8, 12, 20]), phi: pick([10, 12, 16, 20, 25]), spacing: pick([100, 150, 200, 250]), cover: pick([30, 40, 50, 60]),
  fck_class: pick([25, 30, 32, 35, 40]), cement: pick(['CEMI', 'GGBS30', 'GGBS50', 'FA35']), cement_class: pick(['N', 'R', 'S']), agg: pick(['flint', 'quartzite', 'glacial', 'sandstone', 'silimestone', 'granite', 'basalt', 'dolerite', 'limestone', 'marble', 'lytag']),
  formwork: pick(['steel', 'plywood']), season: pick(['summer', 'winter']), T1_mode: pick(['table', 'table', 'given']), T1_given: pick([15, 25, 35]), ecd_mode: pick(['calc', 'calc', 'given']), ecd_given: pick([100, 200, 300]), RH: pick([50, 65, 80, 95]), dry_faces: pick([1, 2]), life: pick([1, 50, 100]),
  restraint_config: pick(['base_only', 'base_one_end', 'base_both_ends', 'ends_only']), R1_mode: pick(['auto', '0.5', 'manual']), R1_manual: pick([0.3, 0.6]), R1_lt_manual: pick([0.25, 0.5]), base_b: pick([1, 2, 4]), base_d: pick([0.3, 0.6, 1]),
  Rend_mode: pick(['0.5', '0.8', '1.0', 'manual']), Rend_manual: pick([0.2, 0.7]), Rend2_mode: pick(['same', '0.5', '1.0', 'manual']), Rend2_manual: pick([0.3, 0.9]), bond_mode: pick(['auto', 'poor', 'good']), fyk: 500, wmax: pick([0.1, 0.2, 0.3, 0.4]) });
// ---------- the project opens in CalcPad with the same values ----------
(async () => {
  const P = await CalcScript.project(Z0.map(zn => ({ C: zn.C, title: zn.title })), { project: 'Test' }, 'Crack control');
  // the whole calculation as one CalcPad check (.perega): its parts merged, every value still the tool's, as pasted and as opened
  { const M = CalcScript.merge(Z0.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
  H.project(P).slice(-Z0.length).forEach((r, k) => check(`project ${r.name}`, Z0[k].C, r));
  n++; if (errs.length) { bad++; console.log('PAGE ERRORS', errs.slice(0, 3)); }
  console.log(`${walls} walls; ${seen.size} kinds (configuration / R1 / governing early / long term / T1 / shrinkage)`);
  console.log(`\n${n - bad}/${n} RC Crack Width values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
