// Raft Foundation: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part of the full calculation (the raft, its loads with their totals by formula, the factors and the bed; the
// contact pressure k_s w and the settlement; each of the four layers of steel at the element where it governs: the
// Wood–Armer moment, the bending design of a 1 m strip, A_s,min and crack control; shear without links; punching at each
// column without links, V_Ed from the column's loads and the net upward ground pressure taken off) is pasted into CalcPad
// (headless, tests/calcpad) and every value CalcPad works out must be the tool's own: the rafts of test_raft.js, variations
// (walls only, a soft bed that lets the raft lift, edge and corner columns, a column that punches through, no allowable
// pressure, the crack tables run out) and random rafts. The plate on its bed is given (its settlements, moments and shears,
// each with where it was taken); everything after it is a formula. Every check of the tool must be in a part with its
// utilisation; no chip may show an error or a unit CalcPad cannot read; and the CalcPad project of a raft must open part by part.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Raft Foundation.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.RaftFoundation = RaftFoundation; this.CalcScript = CalcScript; this.RaftScript = RaftScript;', sb);
const { RaftFoundation, CalcScript, RaftScript } = sb;
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, rafts = 0;
const kinds = new Set();
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
const LAYERS = ['bx', 'by', 'tx', 'ty'];
// the checks taken over the layers (A_s,min, crack control) and over the columns (punching) are in the part where they govern
const keysOf = k => /^(bear|settle)$/.test(k.id) ? ['ground'] : /^bend\d$/.test(k.id) ? [LAYERS[+k.id.slice(4)]] : /^(min|crack)$/.test(k.id) ? LAYERS : k.id === 'shear' ? ['shear'] : k.id === 'punch' ? null : ['?'];
function raft(tag, inp) {
  let R; try { R = RaftFoundation.design(inp); } catch (e) { console.log('(no design:', tag, e.message + ')'); return null; }
  let Z; try { Z = RaftScript.zones(R); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  rafts++;
  for (const k of R.checks) {
    n++; kinds.add(k.id);
    const keys = keysOf(k), cand = Z.filter(zn => keys ? keys.includes(zn.key) : /^c\d+$/.test(zn.key)), zu = Math.max(-1, ...cand.map(zn => zn.util ?? -1));
    if (!cand.length || zu < k.util - 1e-12 && isFinite(k.util)) { bad++; console.log('MISSING', tag, k.id, zu, k.util); }
    if (!isFinite(k.util) && isFinite(zu)) { bad++; console.log('MISSING (fails)', tag, k.id); }
  }
  for (const zn of Z) {
    zones++;
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), said = zn.C.items.some(it => it.t === 'p' && /not satisfied|Not satisfied/.test(it.text)); n++;
    if (zn.util != null && isFinite(zn.util) && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util) && !(said && zn.util > Math.max(0, ...u))) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    if (zn.util != null && !isFinite(zn.util) && !said) { bad++; console.log('INFINITE UTIL WITHOUT A NOTE', tag, zn.key); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  n++; const um = Math.max(...Z.map(z => z.util ?? 0)); if (!(um === R.utilMax || Math.abs(um - R.utilMax) <= 1e-9 * Math.max(1, R.utilMax))) { bad++; console.log('TOOL UTIL', tag, um, R.utilMax); }
  return Z;
}
// ---------- the rafts of test_raft.js ----------
const mesh = { fck: 32, cBtm: 50, cTop: 40, phiB: 16, sB: 200, phiT: 12, sT: 200 };
const DEFC = []; for (const y of [0.5, 4.5, 8.5]) for (const x of [0.5, 5.5, 10.5]) { const k = (x === 5.5 ? 1 : 0) + (y === 4.5 ? 1 : 0); DEFC.push({ x, y, cx: 300, cy: 300, G: [100, 180, 300][k], Q: [30, 60, 100][k] }); }
const DEF = { Lx: 11, Ly: 9, h: 350, ...mesh, ks: 15000, qa: 100, wlim: 25, gk: 1.5, qk: 2.5, psi2: 0.3, wk: 0.3, columns: DEFC };
const Z0 = raft('nine columns', DEF);
raft('uniform load, no columns', { Lx: 6, Ly: 4, h: 300, ...mesh, ks: 20000, qa: 100, gk: 5, qk: 3 });
raft('a wall across a long strip', { Lx: 30, Ly: 1, h: 300, ...mesh, ks: 15000, walls: [{ x0: 15, y0: 0, x1: 15, y1: 1, G: 100, Q: 0 }], mesh: 0.25 });
raft('a column at the end of a strip', { Lx: 8, Ly: 2, h: 250, ...mesh, ks: 30000, rc: 1e-9, columns: [{ x: 0.4, y: 1, cx: 300, cy: 300, G: 200, Q: 0 }] });
raft('300 thick', { ...DEF, h: 300 });
raft('a soft bed', { ...DEF, ks: 5000 });
raft('no allowable pressure', { ...DEF, qa: 0 });
raft('walls along the edges', { ...DEF, columns: [], walls: [{ x0: 0.3, y0: 0.3, x1: 10.7, y1: 0.3, G: 40, Q: 10 }, { x0: 0.3, y0: 8.7, x1: 10.7, y1: 8.7, G: 40, Q: 10 }] });
// ---------- variations ----------
raft('a heavy column punches through; w_k 0.2', { ...DEF, h: 300, wk: 0.2, columns: [...DEFC.slice(0, 4), { x: 5.5, y: 4.5, cx: 300, cy: 300, G: 1200, Q: 600 }, ...DEFC.slice(5)] });
raft('an eccentric load: the raft lifts', { Lx: 8, Ly: 6, h: 400, ...mesh, ks: 10000, qa: 150, columns: [{ x: 1, y: 1, cx: 400, cy: 400, G: 900, Q: 300 }, { x: 7, y: 5, cx: 400, cy: 400, G: 50, Q: 0 }], gk: 0, qk: 0 });
raft('C50, light mesh: the crack tables run out', { ...DEF, fck: 50, phiB: 10, sB: 300, phiT: 10, sT: 300, h: 300, wk: 0.2 });
raft('thick and stiff, columns at the corners', { Lx: 7, Ly: 7, h: 900, ...mesh, ks: 40000, qa: 300, columns: [[0.25, 0.25], [6.75, 0.25], [0.25, 6.75], [6.75, 6.75], [3.5, 3.5]].map(([x, y], i) => ({ x, y, cx: 500, cy: 500, G: i === 4 ? 2500 : 800, Q: i === 4 ? 900 : 250 })), gk: 2, qk: 5 });
// ---------- random rafts ----------
let seed = 7313; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 14; t++) {
  const Lx = pick([6, 9, 12]), Ly = pick([5, 8]), nc = pick([0, 2, 4, 6]), cols = [];
  for (let i = 0; i < nc; i++) cols.push({ x: +(0.3 + rnd() * (Lx - 0.6)).toFixed(2), y: +(0.3 + rnd() * (Ly - 0.6)).toFixed(2), cx: pick([300, 400]), cy: pick([300, 400]), G: pick([150, 400, 800]), Q: pick([50, 150, 300]) });
  const walls = rnd() < 0.4 ? [{ x0: 0.5, y0: 0.5, x1: Lx - 0.5, y1: 0.5, G: pick([20, 50]), Q: pick([0, 10]) }] : [];
  raft(`random ${t}`, { Lx, Ly, h: pick([300, 400, 500, 600]), fck: pick([30, 32, 40]), cBtm: pick([40, 50, 75]), cTop: pick([30, 40]), phiB: pick([12, 16, 20]), sB: pick([150, 200]), phiT: pick([10, 12, 16]), sT: pick([150, 200, 250]),
    ks: pick([5000, 15000, 40000]), qa: pick([0, 100, 200]), wlim: pick([20, 25, 50]), gk: pick([0, 1.5, 3]), qk: pick([1.5, 2.5, 5]), psi2: pick([0.3, 0.6]), wk: pick([0.2, 0.3, 0.4]), columns: cols, walls: nc || walls.length ? walls : [{ x0: 1, y0: 1, x1: 1, y1: Ly - 1, G: 30, Q: 5 }], mesh: 0.4 });
}
// ---------- the project of a raft opens in CalcPad part by part with the same values ----------
(async () => {
  const list = Z0.map(zn => ({ C: zn.C, title: zn.title }));
  const P = await CalcScript.project(list, { project: 'Test' }, 'Raft');
  n++; if (P.checks.length !== Z0.length + 1 || !P.checks[0].shared) { bad++; console.log('FAIL the project has the wrong shape'); }
  H.project(P).slice(1).forEach((r, k) => check(`project ${r.name}`, Z0[k].C, r));
  console.log(`project: ${P.checks.length} checks, ${(JSON.stringify(P).length / 1e3).toFixed(0)} kB`);
  console.log(`${zones} parts of ${rafts} rafts; checks: ${[...kinds].sort().join(', ')}`);
  console.log(`\n${n - bad}/${n} Raft Foundation values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
