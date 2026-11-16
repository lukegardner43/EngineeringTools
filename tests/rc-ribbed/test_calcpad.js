// RC Ribbed and Waffle Slabs: the full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every check of the full calculation (one-way: the ribs, self-weight and analysis; each support side; each span; the
// hogging on the rib and the shear where the ribs start, with the solid zone; hogging in the ribs; the topping. Waffle: the
// cells, loads and coefficients; each zone and continuous edge, the rib where it starts, the shear in the ribs at each
// edge; the topping) is pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the tool's
// own: the TCC32 slabs (outputs only, ref_tcc32.json), set cases (beams and knife edges, a cantilever, links, transverse
// ribs, line and part loads, no taper, the Mosley waffle of 8.9, restrained and simply supported panels, l_y/l_x over 2)
// and random slabs of both kinds. Every check of the tool must be in a zone with its utilisation; no chip may show an
// error or a unit CalcPad cannot read; and the CalcPad project of a slab must open check by check.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Ribbed and Waffle Slabs.html'), 'utf8');
const sb = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.RCRibbed = RCRibbed; this.RCBeam = RCBeam; this.CalcScript = CalcScript; this.RCRibbedScript = RCRibbedScript;', sb);
const { RCRibbed, RCBeam, CalcScript, RCRibbedScript } = sb;
const T32 = require('./ref_tcc32.json');
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, slabs = 0;
const kinds = new Set();
function check(tag, C, P) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), got = P.vars[it.name];
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + (/^N_res(_\d+)*$/.test(it.name) ? 1e-2 : 1e-9);
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = P.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  if (P.warn) { bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
}
// the zone a check of the tool belongs to
function keyOne(D, k) {
  if (k.zone === 'topping') return 'topping';
  if (k.zone === 'sup') { const z = D.supZ[k.j]; const side = z.sides.length > 1 ? (/\(left\)$/.test(k.where) ? 'L' : 'R') : z.sides[0].side; return `sup${k.j}${side}`; }
  if (k.zone === 'span') return `span${k.i}`;
  const e = / left/.test(k.where) ? 'L' : 'R';
  if (k.zone === 'ribstart') return `rh${k.i}${e}`;
  if (k.zone === 'ribshear' || k.zone === 'solid') return `rv${k.i}${e}`;
  if (k.zone === 'ribhog') return `rq${k.i}`;
  return '?';
}
function keyTwo(k) {
  if (k.zone === 'topping') return 'topping';
  if (k.id === 'ratio') return 'loads';
  if (/^rib/.test(k.id)) return `v${k.zone}`;
  if (/start of ribs/.test(k.where)) return `r${k.zone}`;
  return k.zone;
}
function slab(tag, inp, two) {
  let D; try { D = two ? RCRibbed.twoWay(inp) : RCRibbed.oneWay(inp); } catch (e) { return null; }
  const Z = two ? RCRibbedScript.zonesTwo(D, inp) : RCRibbedScript.zonesOne(D, inp); slabs++;
  Z.forEach(z => kinds.add(z.key.replace(/^(v|r)?[LS][12]$/, (m, p) => (p || '') + 'edge').replace(/\d+[LR]?$/, '')));
  for (const k of D.checks) {
    n++;
    const key = two ? keyTwo(k) : keyOne(D, k), z = Z.find(zn => zn.key === key);
    if (!z || (isFinite(k.util) && z.util < k.util - 1e-12)) { bad++; console.log('MISSING', tag, k.id, k.where, key, z && z.util, k.util); }
  }
  for (const zn of Z) {
    zones++;
    // bars that do not fit across the width have no clear spacing to check, and a section past the neutral axis limit fails:
    // the calculation says so, and the zone fails with the tool
    const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v), said = zn.C.items.some(it => it.t === 'p' && /do not fit across the width|not satisfied|fails\./.test(it.text)); n++;
    if (zn.util != null && isFinite(zn.util) && Math.abs(Math.max(0, ...u) - zn.util) > 1e-9 * Math.max(1, zn.util) && !(said && zn.util > Math.max(0, ...u))) { bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
    if (zn.util != null && !isFinite(zn.util) && !said) { bad++; console.log('INFINITE UTIL WITHOUT A NOTE', tag, zn.key); }
    check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
  }
  n++; const um = Math.max(...Z.map(z => z.util ?? 0)); if (!(um === D.utilMax || Math.abs(um - D.utilMax) <= 1e-9 * Math.max(1, D.utilMax))) { bad++; console.log('TOOL UTIL', tag, um, D.utilMax); }
  return Z;
}
// ---------- TCC32 ----------
const PSI2 = { Office: 0.3, Shopping: 0.6, Storage: 0.8, Dwelling: 0.3 };
T32.forEach((cs, ci) => {
  if (cs.n === 2 && cs.ends[1] === 'E') return;
  const ns = cs.n, O = cs.out, I = cs.in, endKind = t => t === 'E' ? 'fixed' : 'knife', bars = { spans: [], supports: [] };
  for (let i = 0; i < ns; i++) { const nb = O[`Bar!G${49 + 100 * i}`]; bars.spans[i] = { bottom: { n: typeof nb === 'number' ? nb : 2, phi: cs.bars[i].bc } }; }
  slab(`TCC32 ${ci}`, { spans: cs.spans.map(s => ({ L: s.L * 1000, h: s.H, solidL: s.sl, solidR: s.sr, cross: s.L * 1000 - s.sl - s.sr > 60 * cs.bw ? 1 : 0 })), rib: { hf: cs.hf, bw: cs.bw, s: cs.cen, taper: cs.taper },
    supports: Array.from({ length: ns + 1 }, (_, j) => ({ kind: j === 0 ? endKind(cs.ends[0]) : j === ns ? endKind(cs.ends[1]) : 'knife', width: 0, delta: 1 - cs.red[j] })),
    loads: cs.loads.flatMap((l, i) => [{ span: i, case: 'G', type: 'udl', w: l.G }, { span: i, case: 'Q', type: 'udl', w: l.Q }, ...l.pl.flatMap(p => [{ span: i, case: 'G', type: 'line', P: p.G, a: p.a }, { span: i, case: 'Q', type: 'line', P: p.Q, a: p.a }])]),
    sets: [{ gG: O['Uls!C16'], gQ: O['Uls!F17'], label: 'TCC' }], patterns: RCBeam.patternList(ns, false), redist: I['ACTIONS!L14'] === 2 ? 'none' : 'limited', psi2: PSI2[cs.usage], selfWeight: true, gc: 25,
    fck: cs.fck, fyk: 500, dg: 20, cover: { top: I['MAIN!J10'], btm: I['MAIN!J11'], side: I['MAIN!J12'] }, wk: { top: I['MAIN!F13'], btm: I['MAIN!F14'] }, brittle: true,
    links: { phi: I['SPANS!I21'], legs: 2, s: 150 }, bars });
});
// ---------- set cases ----------
const one = (o = {}) => ({ spans: [{ L: 7000, h: 300, solidL: 300, solidR: 750 }, { L: 7000, h: 300, solidL: 750, solidR: 300 }], rib: { hf: 100, bw: 150, s: 900, taper: 10 },
  supports: [{ kind: 'beam', width: 300 }, { kind: 'beam', width: 300, delta: 0.85 }, { kind: 'beam', width: 300 }],
  loads: [0, 1].flatMap(i => [{ span: i, case: 'G', type: 'udl', w: 1.5 }, { span: i, case: 'Q', type: 'udl', w: 5 }]),
  rule: '6.10', psi0: 0.7, psi2: 0.3, redist: 'limited', selfWeight: true, gc: 25, fck: 35, fyk: 500, dg: 20, cover: { top: 25, btm: 30, side: 30 }, wk: { top: 0.3, btm: 0.3 }, brittle: true,
  links: null, mesh: 142, transverse: 0, bars: { spans: [{ bottom: { n: 2, phi: 20 }, top: { n: 1, phi: 12 } }, { bottom: { n: 2, phi: 20 }, top: { n: 1, phi: 12 } }], supports: [{ top: { n: 3, phi: 12 } }, { top: { n: 4, phi: 20 } }, { top: { n: 3, phi: 12 } }] }, ...o });
const Z1 = slab('two spans on beams', one());
slab('one span on knife edges', one({ spans: [{ L: 6000, h: 300, solidL: 0, solidR: 0 }], supports: [{ kind: 'knife', width: 0 }, { kind: 'knife', width: 0 }], loads: [{ span: 0, case: 'Q', type: 'udl', w: 4 }] }));
slab('transverse ribs, 6.10a/b, adjacent', one({ spans: [{ L: 7000, h: 300, solidL: 300, solidR: 750, cross: 2 }, { L: 7000, h: 300, solidL: 750, solidR: 300, cross: 2 }], rule: '6.10ab', adjacent: true }));
slab('heavy, no links', one({ loads: [0, 1].flatMap(i => [{ span: i, case: 'Q', type: 'udl', w: 15 }]) }));
slab('heavy, links', one({ loads: [0, 1].flatMap(i => [{ span: i, case: 'Q', type: 'udl', w: 15 }]), links: { phi: 8, legs: 2, s: 150 } }));
slab('a cantilever', one({ spans: [{ L: 1500, h: 300, solidL: 0, solidR: 600 }, { L: 7000, h: 300, solidL: 750, solidR: 300 }], supports: [{ kind: 'free' }, { kind: 'beam', width: 300 }, { kind: 'beam', width: 300 }] }));
slab('line and part loads, no taper, no mesh', one({ rib: { hf: 75, bw: 125, s: 600, taper: 0 }, mesh: 0, loads: [{ span: 0, case: 'G', type: 'line', P: 6, a: 0.6 }, { span: 0, case: 'Q', type: 'part', w: 4, a: 0.2, b: 2 }, { span: 1, case: 'Q', type: 'udl', w: 3 }, { span: 1, case: 'G', type: 'line', P: 4, a: 6.6 }] }));
slab('three spans, knife and fixed ends, no self-weight', one({ spans: [6000, 8000, 6000].map(L => ({ L, h: 350, solidL: 450, solidR: 450 })), supports: [{ kind: 'knife', width: 200 }, { kind: 'beam', width: 400 }, { kind: 'beam', width: 400, delta: 0.8 }, { kind: 'fixed', width: 300 }],
  loads: [0, 1, 2].flatMap(i => [{ span: i, case: 'G', type: 'udl', w: 6 }, { span: i, case: 'Q', type: 'udl', w: 4 }]), selfWeight: false, redist: 'none',
  bars: { spans: [0, 1, 2].map(() => ({ bottom: { n: 2, phi: 16 }, top: { n: 0, phi: 10 } })), supports: [{ top: { n: 2, phi: 12 } }, { top: { n: 4, phi: 16 } }, { top: { n: 4, phi: 16 } }, { top: { n: 3, phi: 16 } }] } }));
const tw = (o = {}) => ({ lx: 7200, ly: 8100, h: 350, rib: { hf: 100, bw: 150, s: 900, taper: 10 }, margin: 900, edges: { L1: true, L2: false, S1: true, S2: false }, method: 'restrained',
  gk: 1.5, qk: 4, selfWeight: true, gc: 25, rule: '6.10', psi2: 0.3, fck: 35, fyk: 500, cover: { top: 25, btm: 30, side: 30 }, wk: { top: 0.3, btm: 0.3 }, links: null, mesh: 142,
  bars: { x: { n: 2, phi: 20 }, y: { n: 2, phi: 16 }, L1: { n: 4, phi: 16 }, S1: { n: 4, phi: 16 } }, ...o });
const Z2 = slab('waffle', tw(), true);
slab('waffle, simply supported', tw({ method: 'simple' }), true);
slab('waffle, links, 6.10a/b, all edges continuous', tw({ links: { phi: 8, legs: 2, s: 200 }, rule: '6.10ab', edges: { L1: true, L2: true, S1: true, S2: true }, bars: { x: { n: 2, phi: 20 }, y: { n: 2, phi: 16 }, L1: { n: 4, phi: 16 }, L2: { n: 4, phi: 16 }, S1: { n: 4, phi: 16 }, S2: { n: 4, phi: 16 } } }), true);
slab('waffle, l_y/l_x over 2', tw({ ly: 16000 }), true);
slab('Mosley 8.9', { lx: 6000, ly: 6000, h: 200, rib: { hf: 60, bw: 125, s: 400, taper: 0 }, margin: 600, edges: { L1: true, L2: true, S1: true, S2: true }, method: 'restrained',
  gk: 6.0, qk: 2.5, selfWeight: false, rule: '6.10', psi2: 0.3, fck: 25, fyk: 500, cover: { top: 30, btm: 30 }, wk: { top: 0.3, btm: 0.3 }, links: null,
  bars: { x: { n: 2, phi: 10 }, y: { n: 2, phi: 10 }, L1: { n: 2, phi: 10 }, L2: { n: 2, phi: 10 }, S1: { n: 2, phi: 10 }, S2: { n: 2, phi: 10 } } }, true);
// ---------- random slabs ----------
let seed = 3232; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let t = 0; t < 30; t++) {
  const ns = pick([1, 2, 2, 3]), h = pick([250, 300, 350, 400]), rib = { hf: pick([60, 75, 100]), bw: pick([125, 150]), s: pick([600, 750, 900]), taper: pick([0, 10, 12]) };
  const spans = Array.from({ length: ns }, () => ({ L: pick([5000, 6500, 8000]), h, solidL: pick([0, 300, 600]), solidR: pick([0, 300, 600]), cross: pick([0, 0, 1]) }));
  const kinds = Array.from({ length: ns + 1 }, (_, j) => j === 0 || j === ns ? pick(['knife', 'beam', 'beam', 'fixed']) : pick(['knife', 'beam']));
  const ld = []; for (let i = 0; i < ns; i++) { ld.push({ span: i, case: 'G', type: 'udl', w: pick([1, 2, 3]) }, { span: i, case: 'Q', type: 'udl', w: pick([2.5, 4, 7.5]) }); if (rnd() < 0.3) ld.push({ span: i, case: 'G', type: 'line', P: pick([3, 8]), a: pick([1, 2.5]) }); }
  slab(`random one-way ${t}`, { spans, rib, supports: kinds.map(k => ({ kind: k, width: k === 'knife' ? pick([0, 200]) : pick([250, 300, 450]), delta: pick([1, 0.85, 0.75]) })), loads: ld,
    rule: pick(['6.10', '6.10ab']), psi0: 0.7, psi2: pick([0.3, 0.6]), adjacent: rnd() < 0.3, redist: pick(['limited', 'none']), selfWeight: rnd() < 0.85, gc: 25, fck: pick([30, 35, 40]), fyk: 500, dg: 20,
    cover: { top: 25, btm: pick([25, 30]), side: pick([25, 30]) }, wk: { top: 0.3, btm: 0.3 }, brittle: rnd() < 0.7, links: rnd() < 0.4 ? { phi: pick([6, 8]), legs: 2, s: pick([150, 200]) } : null, mesh: pick([0, 142, 193]),
    bars: { spans: spans.map(() => ({ bottom: { n: pick([1, 2, 2]), phi: pick([16, 20, 25]) }, top: { n: pick([0, 1, 2]), phi: pick([10, 12]) } })), supports: kinds.map(() => ({ top: { n: pick([2, 3, 4]), phi: pick([12, 16, 20]) } })) } });
  const lx = pick([5000, 6000, 7200, 8000]), simple = rnd() < 0.3, ed = { L1: rnd() < 0.6, L2: rnd() < 0.6, S1: rnd() < 0.6, S2: rnd() < 0.6 };
  slab(`random waffle ${t}`, { lx, ly: lx * pick([1, 1.15, 1.4, 1.8, 2.2]), h: pick([300, 350, 425]), rib: { hf: pick([75, 100]), bw: pick([125, 150]), s: pick([750, 900]), taper: pick([0, 10]) }, margin: pick([0, 600, 900]),
    edges: ed, method: simple ? 'simple' : 'restrained', gk: pick([1, 2]), qk: pick([2.5, 4, 5]), selfWeight: rnd() < 0.85, gc: 25, rule: pick(['6.10', '6.10ab']), psi0: 0.7, psi2: 0.3, fck: pick([30, 35]), fyk: 500,
    cover: { top: 25, btm: 30, side: 30 }, wk: { top: 0.3, btm: 0.3 }, links: rnd() < 0.3 ? { phi: 8, legs: 2, s: 200 } : null, mesh: pick([0, 142]),
    bars: { x: { n: 2, phi: pick([16, 20]) }, y: { n: 2, phi: pick([12, 16]) }, L1: { n: pick([3, 4]), phi: 16 }, L2: { n: 4, phi: 16 }, S1: { n: 3, phi: pick([12, 16]) }, S2: { n: 3, phi: 16 } } }, true);
}
// ---------- the projects open in CalcPad check by check with the same values ----------
(async () => {
  for (const [Z, nm] of [[Z1, 'Ribbed slab'], [Z2, 'Waffle panel']]) {
    const list = Z.map(zn => ({ C: zn.C, title: zn.title }));
    const P = await CalcScript.project(list, { project: 'Test' }, nm);
    // the whole calculation as one CalcPad check (.perega): its parts merged, every value still the tool's, as pasted and as opened
    { const M = CalcScript.merge(list, { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
    n++; if (P.checks.length !== Z.length + 1 || !P.checks[0].shared) { bad++; console.log('FAIL the project has the wrong shape'); }
    H.project(P).slice(1).forEach((r, k) => check(`project ${nm} ${r.name}`, Z[k].C, r));
    console.log(`project ${nm}: ${P.checks.length} checks, ${(JSON.stringify(P).length / 1e3).toFixed(0)} kB`);
  }
  console.log(`${zones} checks of ${slabs} slabs; kinds: ${[...kinds].sort().join(', ')}`);
  console.log(`\n${n - bad}/${n} RC Ribbed and Waffle values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
