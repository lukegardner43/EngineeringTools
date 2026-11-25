// Steel Member Design, angles: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node
// test_calcpad_angles.js). Every part (the section from its dimensions, its steel and class; tension: the gross section, the
// net section of an angle connected by one leg or the welded end, block tearing; compression: the cross-section, buckling by
// Annex BB.1.2 with torsional buckling or by the buckling lengths with torsional-flexural buckling; a pair's interconnections)
// is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the engine's own, for the cases
// of the independent reference (ref_angles.json: every size single and back to back, in tension and compression) and a few
// set ones (Class 4, one bolt, the short leg connected). Every check must sit in a part with its utilisation.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Member Design.html'), 'utf8');
const block = id => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const sb = { console, Math, Float64Array, Int32Array, Uint8Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3=EC3;this.Angle=Angle;this.ANGLE_DATA=ANGLE_DATA;this.CalcScript=CalcScript;this.AngleScript=AngleScript;', sb);
const { Angle, ANGLE_DATA, CalcScript, AngleScript } = sb;
const K = require('../calcpad/zones.js').checker(CalcScript, 'Steel Member Design');
const REF = require('./ref_angles.json');
const row = nm => ANGLE_DATA.find(r => r[0] === nm);
const ZONE = { axial: R => R.N < 0 ? 'net' : 'flexural', net: () => 'net', block: () => 'net', flexural: () => 'flexural', packs: () => 'packs' };
function run(tag, inp) {
  const R = Angle.design(inp), Z = AngleScript.zones(R, inp);
  K.run(tag, Z, Object.entries(R.gov).map(([id, g]) => ({ id, util: g.util })), id => ZONE[id](R), R.utilMax);
}
const only = process.argv[2] ? +process.argv[2] : Infinity;
let i = 0;
for (const c of REF) {
  if (i++ >= only) break;
  const a = Angle.fromRow(row(c.name)), s = c.kind === 'pair' ? Angle.pair(a, c.gap) : a;
  run(`${c.kind} ${c.name} ${c.grade} N ${(c.N / 1e3).toFixed(0)} kN`, { sec: s, grade: c.grade, L: c.L, N: c.N, method: c.method, k: c.k, conn: c.conn, pack: c.pack });
}
// set cases: Class 4 single and pair; one bolt; the short leg by bolts; S460; a long BB strut where v-v governs
const A = nm => Angle.fromRow(row(nm));
run('Class 4 200×200×16 EA S460, BB.1.2', { sec: A('200×200×16'), grade: 'S460', L: 4000, N: 900e3, method: 'BB', k: { y: 1, z: 1, v: 1 }, conn: { type: 'bolts', n: 3, d0: 26, p1: 80, e1: 50, e2: 60 } });
run('Class 4 pair 2 × 200×200×16 EA S355', { sec: Angle.pair(A('200×200×16'), 12), grade: 'S355', L: 5000, N: 1800e3, k: { y: 1, z: 1 }, pack: 1200 });
run('one bolt in tension, 90×90×7 EA', { sec: A('90×90×7'), grade: 'S275', L: 2000, N: -60e3, conn: { type: 'bolts', n: 1, d0: 18, e1: 30, e2: 40 } });
run('short leg bolted, 150×75×10 UA', { sec: A('150×75×10'), grade: 'S355', L: 3000, N: -250e3, conn: { type: 'bolts', leg: 'short', n: 3, d0: 22, p1: 65, e1: 35, e2: 30 } });
run('concentric unequal strut, 200×100×12 UA, torsional-flexural', { sec: A('200×100×12'), grade: 'S355', L: 1200, N: 300e3, method: 'Lcr', k: { u: 1, v: 1 } });
run('BB.1.2 equal strut, 120×120×10 EA, welded', { sec: A('120×120×10'), grade: 'S275', L: 3500, N: 150e3, method: 'BB', k: { y: 1, z: 1, v: 0.7 }, conn: { type: 'welded' } });
K.done('angle members');
