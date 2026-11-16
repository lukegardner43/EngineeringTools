// Precast Connections: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// The calculation of each kind of connection (a bearing: f_Rd, the column of Tables 10.2 and 10.3, a_1 to a_3 and the
// tolerances, (10.6), the stress, a dry connection, a soft pad; a half-joint: the share of each model, the node at the
// hangers, the ties, the bearing node, the strut, the nib's shear and the anchorages; a grouted sleeve splice: N, M about
// each axis with N_Ed, (5.39), shear across the bed and the maker's data) is pasted into CalcPad (headless, tests/calcpad)
// and every value CalcPad works out must be the tool's own: set cases of each and random connections. Every check of the
// tool must be in the calculation with its utilisation; no chip may show an error or a unit CalcPad cannot read; and the
// CalcPad project must open with the same values.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Precast Connections.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.Precast = Precast; this.CalcScript = CalcScript; this.PrecastScript = PrecastScript;', sb);
const { Precast, CalcScript, PrecastScript } = sb;
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, joints = 0;
const kinds = {};
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
function joint(tag, inp) {
  let R; try { R = Precast.design(inp); } catch (e) { return null; }
  let Z; try { Z = PrecastScript.zones(R); } catch (e) { bad++; console.log('SCRIPT', tag, e.message); return null; }
  joints++; kinds[R.mode] = (kinds[R.mode] || 0) + 1;
  const zn = Z[0], u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), said = zn.C.items.some(it => it.t === 'p' && /not satisfied/.test(it.text));
  // every check of the tool, finite, is one of the calculation's
  for (const k of R.checks) { n++; if (isFinite(k.util) && !u.some(v => Math.abs(v - k.util) <= 1e-9 * Math.max(1, k.util))) { if (!said || k.util <= Math.max(0, ...u)) { bad++; console.log('MISSING', tag, k.id, k.util); } } }
  n++; if (isFinite(R.util) && Math.abs(Math.max(0, ...u) - R.util) > 1e-9 * Math.max(1, R.util) && !(said && R.util > Math.max(0, ...u))) { bad++; console.log('UTIL', tag, u, R.util); }
  n++; if (!isFinite(R.util) && !said) { bad++; console.log('INFINITE UTIL WITHOUT A NOTE', tag); }
  check(tag, zn.C, H.text(zn.C.calcpad()));
  return Z;
}
// ---------- set cases ----------
const BB = { mode: 'bearing', FEd: 300, row: 'beam', support: 'rc30', fckSupported: 40, fckSupporting: 40, conn: 'bedded', fckBed: 30, b1: 300, aProv: 250, span: 8000, ln: 8000, sup2: 'precast', detail: 'straight', cEnd: 25 };
const Z0 = joint('bearing, bedded', BB);
joint('bearing, dry, wide', { ...BB, conn: 'dry', b1: 800 });
joint('bearing, pad with steel', { ...BB, conn: 'pad', fbedPad: 10, tPad: 10, lpad: 150, AsPad: 400 });
joint('bearing, pad, no steel given', { ...BB, conn: 'pad', fbedPad: 10, tPad: 10, lpad: 150 });
joint('bearing, short seating', { ...BB, aProv: 120 });
joint('bearing, line support on brickwork', { ...BB, row: 'line', support: 'brick', FEd: 60, b1: 1000, detail: 'cont', isolated: true, movement: 10 });
joint('bearing, brickwork over 0.4 f_cd', { ...BB, row: 'ribbed', support: 'brick', FEd: 400, b1: 200, aProv: 200 });
joint('bearing, in situ, vertical loops, plain concrete', { ...BB, support: 'plain', fckSupporting: 25, sup2: 'insitu', detail: 'vloop', rBend: 40 });
joint('bearing, on steel, exposed tendons', { ...BB, support: 'steel', detail: 'exposed', FEd: 500, b1: 200 });
const HB = { mode: 'half', VEd: 200, h: 600, hn: 300, b: 300, av: 100, lend: 250, lp: 100, bp: 250, fck: 40, cover: 30, phiL: 10, nTie: 4, phiTie: 16, nibEnd: 'loop', phimTie: 128, lin: 700,
  nHang: 3, legsHang: 2, phiHang: 12, sHang: 50, nBot: 3, phiBot: 25, botEnd: 'bent', alpha: 0 };
const Z1 = joint('half-joint', HB);
joint('half-joint, inclined bars', { ...HB, alpha: 0.5, nInc: 2, phiInc: 20, beta: 45, nNibL: 2, legsNibL: 2, phiNibL: 10 });
joint('half-joint, all inclined, no links', { ...HB, alpha: 1, nInc: 3, phiInc: 20, beta: 50 });
joint('half-joint, straight ends, H given', { ...HB, nibEnd: 'straight', botEnd: 'straight', hRule: 'value', HEd: 30, lend: 400 });
joint('half-joint, 600 kN', { ...HB, VEd: 600 });
joint('half-joint, no hangers, end plate', { ...HB, nHang: 0, nibEnd: 'plate' });
joint('half-joint, deep beam, poor bond', { ...HB, h: 900, hn: 450, VEd: 350, phiTie: 20, phiBot: 32 });
const SB = { mode: 'splice', b: 400, h: 400, nb: 3, nh: 3, phi: 25, Ds: 45, cover: 35, phiL: 10, fckCol: 40, fckLow: 35, fckGrout: 60, NEd: 1500, Mh: 150, Mb: 0, VEd: 60, capMode: 'full', leMin: 200, leProv: 220, fgMin: 50, cReq: 40, surface: 'smooth', dg: 20 };
const Z2 = joint('splice', SB);
joint('splice, both axes', { ...SB, Mb: 90, surface: 'rough' });
joint('splice, in tension, rated below the bar', { ...SB, NEd: -400, Mh: 40, capMode: 'value', Fk: 180, surface: 'indented' });
joint('splice, short embedment, weak grout', { ...SB, leProv: 150, fgMin: 70 });
joint('splice, beyond the section', { ...SB, NEd: 12000, Mh: 50 });
joint('splice, wide sleeves', { ...SB, Ds: 90, nb: 4, nh: 4, cReq: 50 });
// ---------- random connections ----------
let seed = 1094; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 60; t++) {
  const m = t % 3;
  if (m === 0) joint(`random bearing ${t}`, { mode: 'bearing', FEd: pick([50, 150, 300, 600]), row: pick(['line', 'ribbed', 'beam']), support: pick(['steel', 'rc30', 'plain', 'brick']), fckSupported: pick([30, 40, 50]), fckSupporting: pick([30, 35, 40]),
    conn: pick(['bedded', 'dry', 'pad']), fckBed: pick([20, 30]), fbedPad: pick([5, 10]), tPad: pick([0, 10]), AsPad: pick([0, 300]), lpad: pick([0, 0, 120]), b1: pick([200, 300, 600, 1000]), aProv: pick([100, 150, 250, 350]),
    span: pick([4000, 8000, 15000]), ln: pick([4000, 8000]), sup2: pick(['precast', 'insitu']), detail: pick(['cont', 'straight', 'exposed', 'vloop']), cEnd: pick([0, 25, 40]), rBend: pick([0, 40]), isolated: rnd() < 0.3, movement: pick([0, 0, 10]) });
  else if (m === 1) joint(`random half-joint ${t}`, { mode: 'half', VEd: pick([100, 200, 350, 500]), h: pick([500, 600, 800, 1000]), hn: pick([250, 300, 400]), b: pick([250, 300, 400]), av: pick([80, 100, 150]), lend: pick([250, 300, 400]), lp: pick([80, 100]), bp: pick([200, 250]),
    fck: pick([35, 40, 50, 60]), cover: pick([25, 30, 40]), phiL: pick([0, 8, 10]), nTie: pick([2, 3, 4]), phiTie: pick([16, 20, 25]), nibEnd: pick(['loop', 'straight', 'plate']), phimTie: pick([0, 128, 160]), lin: pick([300, 500, 800]),
    nHang: pick([0, 2, 3, 4]), legsHang: pick([2, 4]), phiHang: pick([10, 12]), sHang: pick([40, 60]), nBot: pick([2, 3, 4]), phiBot: pick([20, 25, 32]), botEnd: pick(['bent', 'straight']), phimBot: pick([0, 200]),
    alpha: pick([0, 0, 0.3, 0.5]), nInc: pick([2, 3]), phiInc: pick([16, 20]), beta: pick([40, 45, 55]), nNibL: pick([0, 2]), legsNibL: 2, phiNibL: 10, hRule: rnd() < 0.3 ? 'value' : 'auto', HEd: pick([0, 20, 50]) });
  else joint(`random splice ${t}`, { mode: 'splice', b: pick([300, 400, 500]), h: pick([300, 400, 600]), nb: pick([2, 3, 4]), nh: pick([2, 3, 4]), phi: pick([16, 20, 25, 32]), Ds: pick([40, 45, 55]), cover: pick([30, 35, 40]), phiL: pick([0, 8, 10]),
    fckCol: pick([30, 40, 50, 60]), fckLow: pick([30, 35, 45]), fckGrout: pick([40, 60, 80]), NEd: pick([-500, 0, 800, 2500, 5000]), Mh: pick([0, 50, 150, 300]), Mb: pick([0, 0, 80]), VEd: pick([0, 40, 120]),
    capMode: pick(['full', 'value']), Fk: pick([150, 250]), leMin: pick([150, 200]), leProv: pick([180, 220]), fgMin: pick([40, 55]), cReq: pick([30, 45]), surface: pick(['vsmooth', 'smooth', 'rough', 'indented']), dg: pick([10, 20]) });
}
// ---------- the projects open in CalcPad with the same values ----------
(async () => {
  for (const [Z, nm] of [[Z0, 'Bearing'], [Z1, 'Half-joint'], [Z2, 'Splice']]) {
    const P = await CalcScript.project(Z.map(zn => ({ C: zn.C, title: zn.title })), { project: 'Test' }, nm);
    H.project(P).slice(-Z.length).forEach((r, k) => check(`project ${nm}`, Z[k].C, r));
  }
  console.log(`${joints} connections: ${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  console.log(`\n${n - bad}/${n} Precast Connections values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
