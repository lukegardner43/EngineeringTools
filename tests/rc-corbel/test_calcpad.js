// RC Corbel and Nib Design: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// The full calculation (the node limits, the strut-and-tie model of CCIP-057, node 1, a precast bearing, the shear limit,
// the links of PD 6687-1 B.4, hanger steel and the anchorage of the tie at both ends, with a welded bar) of set corbels and
// nibs and 120 random ones is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the
// tool's own; the calculation's checks must be the tool's, and no chip may show an error or a unit CalcPad cannot read.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Corbel and Nib Design.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.K = Corbel; this.CS = CalcScript; this.KS = CorbelScript;', sb);
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, runs = 0; const kinds = new Set();
function check(tag, C, Pc) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : sb.CS.toSI(it.v, it.unit), got = Pc.vars[it.name];
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + 1e-9;
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = Pc.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  if (Pc.warn) { bad++; console.log('BAD UNIT', tag, Pc.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
}
function run(tag, inp) {
  let R; try { R = sb.K.design(inp); } catch (e) { return; } runs++;
  const C = sb.KS.script(R); kinds.add(`${R.nib ? 'nib' : 'corbel'} ${R.linkKind}${R.welded ? ' welded' : ''}${R.hang ? ' hang' : ''}${R.fRd !== null ? ' ' + inp.bearing : ''}${R.front.straight ? ' straightF' : ''}`);
  const u = C.items.filter(it => it.t === 'chk').map(it => it.v); n++;
  if (isFinite(R.util) && Math.abs(Math.max(...u) - R.util) > 1e-9 * Math.max(1, R.util)) { bad++; console.log('UTIL', tag, u, R.util); }
  check(tag, C, H.text(C.calcpad())); return C;
}
const BASE = { mode: 'corbel', fck: 40, FEd: 625, hRule: '0.2', aH: 0, ac: 200, hc: 505, hf: 300, lc: 400, lp: 150, bp: 400, b: 500, cover: 35, phiLink: 10, phi: 20, n: 4, nLink: 4, phiCl: 10, hcol: 500, coverCol: 35, linkCol: 10, phiCol: 32 };
run('CCIP-057 5.4 corbel', BASE);
run('fck60', { mode: 'corbel', fck: 60, FEd: 900, hRule: 'value', HEd: 0, ac: 160, hc: 730, lc: 400, lp: 200, bp: 300, b: 450, cover: 35, phiLink: 10, phi: 20, n: 4, nLink: 5, phiCl: 10, hcol: 450 });
run('nib hanging', { ...BASE, mode: 'nib', FEd: 120, hRule: 'value', HEd: 0, ac: 100, hc: 300, hf: 250, lc: 200, lp: 100, phi: 12, s: 150, sNl: 200, phiNl: 8, hcol: 300, phiCol: 16, hanging: true, phiH: 10, sH: 150 });
run('welded dry', { ...BASE, frontAnch: 'welded', phiT: 16, bearing: 'dry' });
run('bedded aH', { ...BASE, bearing: 'bedded', fbed: 20, aH: '', hRule: 'value', HEd: 50 });
let seed = 77; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 120; t++) {
  const nib = rnd() < 0.35, hc = nib ? pick([250, 300, 400]) : pick([400, 500, 650, 800]), lc = nib ? pick([150, 200, 250]) : pick([300, 400, 500]), lp = pick([100, 150, 200]);
  run('r' + t, { mode: nib ? 'nib' : 'corbel', fck: pick([30, 32, 40, 50, 60, 70]), fyk: 500, FEd: nib ? pick([60, 120, 200, 300]) : pick([200, 400, 625, 900, 1300]), hRule: pick(['0.2', 'value']), HEd: pick([0, 30, 80]), aH: pick([null, 0, 50]),
    ac: Math.max(lp / 2, pick([0.3, 0.4, 0.5, 0.6]) * lc), hc, hf: hc * pick([0.6, 1]), lc, lp, bp: pick([200, 300, 400]), b: pick([400, 450, 500, 600]), cover: pick([25, 35, 40]), phiLink: pick([8, 10]), phi: pick([12, 16, 20, 25, 32, 40]), n: pick([3, 4, 5]), s: pick([100, 150, 200]),
    nLink: pick([0, 3, 4, 6]), phiCl: pick([8, 10, 12]), phiNl: pick([0, 8, 10]), sNl: pick([150, 200]), hcol: pick([300, 400, 500, 700]), coverCol: 35, linkCol: 10, phiCol: pick([16, 25, 32]), phimF: pick([0, 0, 100, 200]), phimS: pick([0, 160]),
    frontAnch: rnd() < 0.3 ? 'welded' : 'bend', phiT: pick([14, 16, 20, 25]), bearing: pick(['none', 'dry', 'bedded']), fbed: pick([15, 25]), hanging: nib && rnd() < 0.5, phiH: 10, sH: pick([100, 150, 200]) });
}
console.log(`${runs} corbels and nibs: ${[...kinds].sort().join(', ')}`);
console.log(`\n${n - bad}/${n} RC Corbel and Nib values reproduced by CalcPad`);
process.exit(bad ? 1 : 0);
