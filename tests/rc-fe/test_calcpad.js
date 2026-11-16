// RC Slab FE Design: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every part of the full calculation (the slab, its loads and the analysis; each of the four layers of steel at the element
// where it governs: the Wood–Armer moment from m_x, m_y, m_xy, the bending design of a 1 m strip, A_s,min, the mesh and the
// zone's bars, A_s,max and crack control; shear without links; punching at each column; the long-term deflection of each
// bay with creep and shrinkage) is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be
// the tool's own: the slabs of test_rc_fe.js (a flat slab on nine columns, a slab on walls and edges with an opening and
// every kind of load, a continuous panel, a one-way slab), variations and random slabs. The plate analysis is given (its
// moments, shears and deflections, each with where it was taken); everything after it is a formula. Every check of the
// tool must be in a part with its utilisation; no chip may show an error or a unit CalcPad cannot read; and the CalcPad
// project of a slab must open part by part.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Slab FE Design.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.SlabFEM = SlabFEM; this.PlateFEM = PlateFEM; this.CalcScript = CalcScript; this.SlabFEScript = SlabFEScript;', sb);
const { SlabFEM, PlateFEM, CalcScript, SlabFEScript } = sb;
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, slabs = 0;
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
const KEY = ['bx', 'by', 'tx', 'ty'];
const keyOf = (R, k) => k.where === 'Slab' ? (/^Shear/.test(k.name) ? 'shear' : KEY[R.LN.findIndex(nm => k.name.startsWith(nm))]) : /^Column /.test(k.where) ? 'p' + k.where.slice(7) : /^Bay /.test(k.where) ? 'defl' : '?';
function slab(tag, inp) {
  let R; try { R = SlabFEM.design(inp); } catch (e) { console.log('(no design:', tag, e.message + ')'); return null; }
  let Z; try { Z = SlabFEScript.zones(R); } catch (e) { bad++; console.log('SCRIPT', tag, e.stack.split('\n').slice(0, 3).join(' ')); return null; }
  slabs++;
  for (const k of R.checks) {
    n++; kinds.add(k.name.replace(/^(Bottom|Top) steel along [xy]/, 'steel').replace(/^Punching \((internal|edge|corner)\)/, m => (kinds.add(m), 'Punching')));
    const z = Z.find(zn => zn.key === keyOf(R, k));
    if (!z || (isFinite(k.util) && z.util < k.util - 1e-12)) { bad++; console.log('MISSING', tag, k.where, k.name, keyOf(R, k), z && z.util, k.util); }
  }
  for (const zn of Z) {
    zones++;
    // the punching layout's own checks (tangential spacing, each perimeter's legs) are met by the layout and are not the tool's
    const u = zn.C.items.filter(it => it.t === 'chk' && !(/^p/.test(zn.key) && /^U_(st|sw|mn)\d/.test(it.name))).map(it => it.v), said = zn.C.items.some(it => it.t === 'p' && /not satisfied|Not satisfied/.test(it.text)); n++;
    if (zn.util != null && isFinite(zn.util) && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util) && !(said && zn.util > Math.max(0, ...u))) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    if (zn.util != null && !isFinite(zn.util) && !said) { bad++; console.log('INFINITE UTIL WITHOUT A NOTE', tag, zn.key); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  n++; const um = Math.max(...Z.map(z => z.util ?? 0)); if (!(um === R.utilMax || Math.abs(um - R.utilMax) <= 1e-9 * Math.max(1, R.utilMax))) { bad++; console.log('TOOL UTIL', tag, um, R.utilMax); }
  return Z;
}
// ---------- the Wood–Armer rules, every branch: CalcPad's IF chain against the engine ----------
{
  let s = 77; const r = () => (s = s * 16807 % 2147483647) / 2147483647 * 2 - 1;
  const C = CalcScript.create({ title: 'Wood–Armer', tool: 'test', standard: '' }), branch = new Set();
  for (let t = 0; t < 120; t++) {
    const mx = 60 * r(), my = 60 * r(), mxy = 40 * r(), w = PlateFEM.woodArmer(mx, my, mxy), a = Math.abs(mxy);
    branch.add(`${mx + a < 0}${my + a < 0}${mx - a > 0}${my - a > 0}`);
    C.given(`mx${t}`, mx, 'kNm/m', '', '', ''); C.given(`my${t}`, my, 'kNm/m', '', '', ''); C.given(`mt${t}`, mxy, 'kNm/m', '', '', '');
    for (let k = 0; k < 4; k++) C.calc(`w${k}_${t}`, SlabFEScript.waExpr(k, `mx${t}`, `my${t}`, `mt${t}`), Math.abs(w[k]), 'kNm/m', '', '');
  }
  check('Wood–Armer rules', C, H.text(C.calcpad()));
  n++; if (branch.size < 6) { bad++; console.log('FAIL the random moments miss branches of the Wood–Armer rules', [...branch]); }
}
// ---------- the slabs of test_rc_fe.js ----------
const base = { fck: 32, fyk: 500, h: 250, coverTop: 25, coverBtm: 25, phi: 12, spansX: [7.5, 7.5], spansY: [6, 6], over: { L: 0.3, R: 0.3, B: 0.3, T: 0.3 }, edges: { L: 'free', R: 'free', B: 'free', T: 'free' },
  columns: { at: [], cx: 450, cy: 400, above: { H: 3.5, far: 'F' }, below: { H: 3.5, far: 'F' }, footprint: true, model: 'elastic' }, gk: 1.5, qk: 5, density: 25, perim: 4, psi0: 0.7, psi2: 0.3, rule: '6.10ab', patterns: true, wk: 0.3, beta: 'factors', meshTop: 'auto', meshBtm: 'auto', zone: 1.0, longTerm: { RH: 50, t0: 28 } };
const all = (nx, ny) => { const a = []; for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) a.push([i, j]); return a; };
const F0 = { ...base, columns: { ...base.columns, at: all(2, 2) } };
const Z0 = slab('flat slab on nine columns', F0);
slab('walls, edges, an opening, every load', { ...base, spansX: [6, 4], spansY: [5], over: { L: 0, R: 0, B: 0, T: 0 }, edges: { L: 'pinned', R: 'fixed', B: 'pinned', T: 'free' }, perim: 3,
  walls: [{ x0: 6, y0: 0, x1: 6, y1: 3, kind: 'pinned' }], openings: [{ x0: 1, y0: 3.5, x1: 2, y1: 4.5 }], columns: { ...base.columns, at: [[1, 1]] },
  loads: [{ type: 'patch', case: 'Q', q: 3, x0: 7, y0: 1, x1: 9, y1: 2 }, { type: 'line', case: 'G', q: 6, x0: 2.5, y0: 2, x1: 5, y1: 2 }, { type: 'point', case: 'Q', P: 20, x: 3, y: 1 }] });
slab('continuous panel', { ...base, spansX: [7.5], spansY: [7.5], over: {}, edges: { L: 'continuous', R: 'continuous', B: 'continuous', T: 'continuous' }, perim: 0, columns: { ...base.columns, cy: 450, at: all(1, 1) }, patterns: false });
slab('one-way slab on two edges', { ...base, spansX: [6], spansY: [6, 6, 6], over: {}, edges: { L: 'pinned', R: 'pinned', B: 'free', T: 'free' }, perim: 0, columns: { ...base.columns, at: [] }, patterns: false, loads: [], mesh: 0.3 });
// ---------- variations ----------
slab('6.10, all bays, pinned columns, beta calculated', { ...F0, rule: '6.10', patterns: false, beta: 'calc', columns: { ...F0.columns, model: 'pinned', footprint: false } });
slab('C50, given creep and shrinkage, one face drying, w_k 0.2', { ...F0, fck: 50, wk: 0.2, longTerm: { RH: 70, t0: 14, faces: 1, phi: 2.5, ecs: 400e-6 } });
slab('C55, meshes given, none at the bottom, outer layers along y', { ...F0, fck: 55, meshTop: { phi: 12, s: 200 }, meshBtm: 'none', outerTop: 'y', outerBtm: 'y', coverBtm: 30, longTerm: { RH: 60, t0: 7, faces: 1 } });
slab('thin and heavy: compression steel, zones out of bars', { ...F0, h: 180, qk: 15, gk: 3, spansX: [8.5, 8.5], spansY: [7.5, 7.5], mesh: 0.4 });
slab('no long-term analysis, coarse zones', { ...F0, longTerm: { on: false }, zone: 2.5, mesh: 0.4 });
slab('fixed edges, cantilever overhangs', { ...base, spansX: [6, 6], spansY: [5], over: { L: 0, R: 1.5, B: 0, T: 1.2 }, edges: { L: 'fixed', R: 'free', B: 'fixed', T: 'free' }, columns: { ...base.columns, at: [[1, 1], [2, 1], [2, 0]] }, mesh: 0.35 });
// ---------- random slabs ----------
let seed = 4419; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 10; t++) {
  const nx = pick([1, 2, 3]), ny = pick([1, 2]), sx = Array.from({ length: nx }, () => pick([5, 6, 7.5])), sy = Array.from({ length: ny }, () => pick([5, 6, 7]));
  const edge = () => pick(['free', 'free', 'pinned', 'continuous', 'fixed']);
  const at = all(nx, ny).filter(() => rnd() < 0.8);
  slab(`random ${t}`, { ...base, fck: pick([28, 32, 40, 50]), h: pick([200, 225, 250, 300]), coverTop: pick([20, 25, 35]), coverBtm: pick([20, 25, 30]), phi: pick([10, 12, 16]), spansX: sx, spansY: sy,
    over: { L: pick([0, 0.3]), R: pick([0, 0.3, 1]), B: pick([0, 0.3]), T: pick([0, 0.5]) }, edges: { L: edge(), R: edge(), B: edge(), T: edge() }, columns: { ...base.columns, at, cx: pick([300, 400, 500]), cy: pick([300, 400]), model: pick(['elastic', 'pinned']) },
    gk: pick([0.5, 1.5, 3]), qk: pick([2.5, 5, 7.5]), perim: pick([0, 0, 4]), rule: pick(['6.10ab', '6.10']), patterns: rnd() < 0.6, wk: pick([0.2, 0.3, 0.4]), beta: pick(['factors', 'calc']), zone: pick([1, 1.5]), mesh: 0.4,
    meshTop: pick(['auto', 'auto', 'none', { phi: 10, s: 200 }]), meshBtm: pick(['auto', { phi: 12, s: 150 }]), outerTop: pick(['x', 'y']), outerBtm: pick(['x', 'y']), longTerm: { RH: pick([50, 65, 80]), t0: pick([7, 28]), faces: pick([1, 2]), on: rnd() < 0.85 } });
}
// ---------- the project of a slab opens in CalcPad part by part with the same values ----------
(async () => {
  const list = Z0.map(zn => ({ C: zn.C, title: zn.title }));
  const P = await CalcScript.project(list, { project: 'Test' }, 'RC slab FE');
  n++; if (P.checks.length !== Z0.length + 1 || !P.checks[0].shared) { bad++; console.log('FAIL the project has the wrong shape'); }
  H.project(P).slice(1).forEach((r, k) => check(`project ${r.name}`, Z0[k].C, r));
  console.log(`project: ${P.checks.length} checks, ${(JSON.stringify(P).length / 1e3).toFixed(0)} kB`);
  console.log(`${zones} parts of ${slabs} slabs; checks: ${[...kinds].sort().join('; ')}`);
  console.log(`\n${n - bad}/${n} RC Slab FE values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
