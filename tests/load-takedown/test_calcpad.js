// Load Take-down: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every check of the full calculation (the take-down row by row from the roof down: the area, line and point loads, the
// facades on each storey, each row's totals and the running totals below it, the floors and area carried, α_n and α_A,
// the reduced imposed load, SLS and ULS; at a transfer beam the share reaching the support followed and the beam's own
// reaction there; the base and a strip or pad; each transfer beam's reactions by statics; a hipped roof onto its walls)
// is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the tool's own: Luke's
// template's sample, the page's default, Mosley et al. Example 6.7 with α_n and α_A, 6.10a/b, footings, the hipped roof,
// facades (all storeys, one, bearing below, a spandrel, a parapet), transfer beams (standing on it and carried on at a
// support; left and right; wall to column, column to wall; a beam at the top; two beams; the take-down stopping on one;
// a cantilever) and 120 random take-downs. No chip may show an error or a unit CalcPad cannot read, and the whole
// calculation must open in CalcPad as one check with the same values.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Load Take-down.html'), 'utf8');
const sb = { console, Math, Array, Object, Number, Error, JSON, Infinity, String, Set, Map, Promise, parseFloat, isFinite };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.LoadTakedown = LoadTakedown; this.CalcScript = CalcScript; this.TakedownScript = TakedownScript;', sb);
const { LoadTakedown: LT, CalcScript, TakedownScript } = sb;
const K = require('../calcpad/zones.js').checker(CalcScript, 'Load Take-down');
const H = require('../calcpad/harness.js').open();
let Z0 = null;
function run(tag, inp) {
  let D; try { D = LT.design(inp); } catch (e) { if (!/^random/.test(tag)) console.log('THROWS', tag, e.message); return null; }
  const Z = TakedownScript.zones(D);
  // the base's SLS and ULS are the tool's, and each transfer beam and the hipped roof has its own check
  K.st.n++;
  const want = ['takedown', ...D.transfers.map((T, j) => `transfer${j}`), ...(D.hip ? ['hip'] : [])];
  if (Z.map(z => z.key).join() !== want.join() || Z.some(z => z.util !== null)) { K.st.bad++; console.log('ZONES', tag, Z.map(z => z.key)); }
  K.run(tag, Z, [], () => '', null);
  return Z;
}
// ---------- set cases ----------
const SHEET = [{ name: 'Roof', A: 3.5, aD: 1, aL: 1 }, { name: '2nd', A: 3.5, aD: 2.5, aS: 2, aL: 2.5 }, { name: '1st', A: 3.5, aD: 2.5, aS: 2, aL: 2.5 }, { name: 'wall', A: 7, aD: '=0.1*20' }];
const LV = [{ name: 'Roof', A: 3.5, aD: 1, aL: 1, h: 3.5 }, { name: '2nd', A: 3.5, aD: 2.5, aS: 2, aL: 2.5, h: 3.5 }, { name: '1st', A: 3.5, aD: 2.5, aS: 2, aL: 2.5 }];
Z0 = run('template', { type: 'wall', rows: SHEET });
run('default', { type: 'wall', red: 'none', comb: '6.10', rows: LV.map((r, i) => ({ ...r, red: i > 0 })), facades: [{ name: 'Blockwork', DL: '0.1*20', on: 'all', at: 'top' }] });
run('default, reduced', { type: 'wall', red: 'an', comb: '6.10', rows: LV.map((r, i) => ({ ...r, red: i > 0 })), facades: [{ name: 'Blockwork', DL: '0.1*20', on: 'all', at: 'top' }] });
run('line and point loads', { type: 'column', rows: [{ name: 'Beam', L: 6, lD: 2, lS: 1, lL: '3*0.5', pD: 10, pS: 2, pL: 4 }, { name: 'x', A: 2, aD: 3, L: 4, lD: 5, pD: 6 }] });
const MOS = Array.from({ length: 8 }, (_, i) => ({ name: `L${8 - i}`, A: 3.5 * 6.5, aD: 6, aL: 3, red: true }));
run('Mosley Ex 6.7', { type: 'column', red: 'none', rows: MOS });
run('Mosley Ex 6.7, α_n', { type: 'column', red: 'an', rows: MOS });
run('Mosley Ex 6.7, α_n or α_A', { type: 'column', red: 'best', rows: MOS });
run('Mosley Ex 6.7, α_A governing (2 floors of 120 m²)', { type: 'column', red: 'best', rows: MOS.slice(0, 2).map(r => ({ ...r, A: 120 })) });
run('12 floors, α_n 0.5, a roof not reduced', { type: 'column', red: 'best', comb: '6.10ab', rows: [{ name: 'Roof', A: 20, aD: 1.5, aL: 0.6 }, ...Array.from({ length: 12 }, (_, i) => ({ name: `L${12 - i}`, A: 20, aD: 5, aS: 1.5, aL: 2.5, red: true }))] });
run('6.10a/b, a wall reduced', { type: 'wall', red: 'best', comb: '6.10ab', rows: SHEET.map((r, i) => ({ ...r, red: i === 1 || i === 2 })) });
run('strip footing', { type: 'wall', qa: 100, fw: 14.4, rows: SHEET });
run('pad footing', { type: 'column', qa: 150, rows: SHEET });
run('hipped roof', { type: 'wall', rows: SHEET, hip: { B: 9, L: 20, g: 1.1, s: '0.2', q: 0.6 } });
run('hipped roof, half to the plates', { type: 'wall', rows: SHEET, hip: { B: 9, L: 20, g: 1.1, q: 0.6, f: 0.5 } });
run('facade on all storeys', { type: 'wall', rows: LV, facades: [{ name: 'Blockwork', DL: '0.1*20', on: 'all' }] });
run('a column, brick bearing below', { type: 'column', rows: LV, facades: [{ name: 'Brick', DL: 2.2, SIDL: 0.3, w: 4.5, on: 'all', at: 'below' }] });
run('one storey', { type: 'column', rows: LV, facades: [{ name: 'Curtain wall', DL: 0.6, w: 6, on: 1 }] });
run('a spandrel', { type: 'wall', rows: LV, facades: [{ name: 'Spandrel', DL: 1.5, h: 1.2, on: 'all' }] });
run('a parapet', { type: 'wall', rows: LV, facades: [{ name: 'Parapet', DL: 3, h: 1.1, on: 'top' }] });
run('the lowest storey on the base', { type: 'wall', rows: LV.map(r => ({ ...r, h: 3 })), facades: [{ DL: 1, on: 'all', at: 'below' }] });
run('a beam under the roof, facade per metre of the wall below', { type: 'column', rows: LV, facades: [{ DL: 1, w: 2, on: 'all' }], transfers: [{ L: 6, a: 2, follow: 'left', below: 'wall', spread: 1, after: 0 }] });
run('a beam under the roof, facade bearing below', { type: 'column', rows: LV, facades: [{ DL: 1, w: 2, on: 'all', at: 'below' }], transfers: [{ L: 6, a: 2, follow: 'left', after: 0 }] });
const tr = { L: 6, on: 'beam', a: 2, follow: 'left', sw: 2, after: 1 };
run('transfer, column on it, left', { type: 'column', rows: SHEET, transfers: [tr] });
run('transfer, column on it, right', { type: 'column', rows: SHEET, transfers: [{ ...tr, follow: 'right' }] });
run('transfer, floors reduced through it', { type: 'column', red: 'an', rows: SHEET.map((r, i) => (i === 1 || i === 2 ? { ...r, red: true } : r)), transfers: [tr] });
run('transfer, α_A through it', { type: 'column', red: 'best', rows: MOS.map(r => ({ ...r, A: 60 })), transfers: [{ ...tr, after: 3 }] });
run('transfer, a wall onto a column, with a point load', { type: 'wall', rows: SHEET, transfers: [{ L: 6, on: 'beam', a: 1, b: 4, follow: 'right', below: 'column', sw: 0, after: 1, loads: [{ type: 'point', a: 5, DL: 30, LL: 10 }] }] });
run('transfer, a wall reduced onto a column, α_A', { type: 'wall', red: 'best', rows: SHEET.map((r, i) => (i === 1 || i === 2 ? { ...r, red: true } : r)), transfers: [{ L: 6, on: 'beam', a: 1, b: 4, follow: 'right', below: 'column', sw: 1.5, after: 2 }] });
run('transfer, a column onto a wall', { type: 'column', rows: SHEET, transfers: [{ L: 6, on: 'beam', a: 2, follow: 'left', below: 'wall', spread: 2, after: 1 }] });
run('transfer, carried straight on at a support', { type: 'wall', rows: SHEET, transfers: [{ L: 6, on: 'support', follow: 'left', sw: 1, spread: 0.5, after: 0, loads: [{ type: 'point', a: 2, DL: 60, SIDL: 10, LL: 30 }] }] });
run('transfer, at the top', { rows: SHEET, transfers: [{ L: 6, on: 'support', follow: 'right', after: -1, loads: [{ type: 'point', a: 2, DL: 6 }] }] });
run('transfer, UDLs on it', { type: 'column', rows: SHEET, transfers: [{ L: 7, a: 3, follow: 'right', sw: 1.2, after: 2, loads: [{ type: 'udl', a: 0, b: 7, DL: 5, SIDL: 1, LL: 4 }, { type: 'udl', a: 2, b: 4, LL: 6 }] }] });
run('two transfer beams', { type: 'column', rows: SHEET, transfers: [{ L: 6, a: 2, follow: 'left', after: 0 }, { L: 8, a: 2, follow: 'right', after: 2 }] });
run('the take-down stopping on a beam', { type: 'column', rows: SHEET, qa: 150, transfers: [{ L: 8, a: 3, sw: 2, follow: 'none', after: 3 }] });
run('a cantilever, uplift', { type: 'column', rows: SHEET, transfers: [{ L: 6, a: 8, follow: 'right', sw: 0, after: 3 }] });
run('a cantilever, 6.10a/b', { type: 'column', comb: '6.10ab', rows: SHEET, transfers: [{ L: 6, a: -1.5, follow: 'right', sw: 1, after: 3, loads: [{ type: 'point', a: 3, DL: 10, LL: 5 }] }] });
// ---------- random take-downs ----------
let seed = 9173; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 120; t++) {
  const n = pick([1, 2, 3, 4, 6, 8, 11]), type = pick(['wall', 'column']), red = pick(['none', 'an', 'best']);
  const rows = Array.from({ length: n }, (_, i) => {
    const r = { name: i === 0 ? 'Roof' : `L${n - i}`, h: pick(['', 3, 3.5]) };
    if (rnd() < 0.85) Object.assign(r, { A: pick([2.25, 3.5, 12, 22.75, 60]), aD: pick([0, 1, 2.5, 6]), aS: pick([0, 0, 1.5]), aL: pick([0, 0.6, 1.5, 2.5, 5]) });
    if (rnd() < 0.25) Object.assign(r, { L: pick([1, 3, 6]), lD: pick([0, 2, 4.5]), lS: pick([0, 0.5]), lL: pick([0, 1, 3]) });
    if (rnd() < 0.2) Object.assign(r, { pD: pick([0, 5, 20]), pS: pick([0, 2]), pL: pick([0, 3, 10]) });
    if (i > 0 && rnd() < 0.7) r.red = true;
    return r;
  });
  const facades = rnd() < 0.5 ? Array.from({ length: pick([1, 1, 2]) }, () => {
    const on = pick(['all', 'all', 'top', 0, Math.min(1, n - 1)]);
    return { name: 'F', DL: pick([0.6, 2, 2.2]), SIDL: pick(['', 0.3]), h: on === 'top' ? 1.1 : pick(['', '', 1.2]), w: pick([2, 4.5]), on, at: pick(['top', 'below']) };
  }) : [];
  const transfers = rnd() < 0.45 ? Array.from({ length: pick([1, 1, 2]) }, (_, j) => {
    const L = pick([4, 6, 8]), on = rnd() < 0.8 ? 'beam' : 'support', a = pick([-1, 0.5, 2, L / 2, L - 1, L + 1]);
    return { L, on, a, b: a + pick([1, 2, 3]), follow: pick(['left', 'right', 'right', ...(j ? [] : ['none'])]), below: pick(['wall', 'column']), spread: pick([0.5, 1, 2]), sw: pick([0, 1.5, 3]), after: Math.min(n - 1, pick([-1, 0, 1, 2, n - 1])),
      loads: rnd() < 0.5 ? [{ type: pick(['point', 'udl']), a: pick([0, 1, 2]), b: pick([3, 4]), DL: pick([0, 5, 20]), SIDL: pick([0, 2]), LL: pick([0, 4, 10]) }] : [] };
  }) : [];
  run(`random ${t}`, { type, red, comb: pick(['6.10', '6.10ab']), rows, facades, transfers, qa: pick(['', 100, 150]), fw: pick([0, 0, 12]),
    hip: rnd() < 0.2 ? { B: pick([6, 9]), L: pick([9, 14, 20]), g: pick([0.8, 1.1]), s: pick(['', 0.2]), q: pick([0, 0.6]), f: pick([1, 1, 0.5]) } : null });
}
// ---------- the whole calculation, as one CalcPad check (.perega): pasted and as opened ----------
{
  const D = LT.design({ type: 'column', red: 'best', qa: 150, rows: MOS.map(r => ({ ...r, A: 60 })), facades: [{ name: 'Brick', DL: 2.2, w: 4.5, on: 'all', h: 3 }], transfers: [{ ...tr, after: 3 }], hip: { B: 9, L: 20, g: 1.1, q: 0.6 } });
  const Z = TakedownScript.zones(D), M = CalcScript.merge(Z.map(zn => ({ C: zn.C, title: zn.title })), { title: 'Load take-down' });
  K.values('one check', M, H.text(M.calcpad())); K.values('one check, opened', M, H.doc(M.perega({})));
}
K.done('take-downs');
