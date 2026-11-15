// RC Section Design Toolkit: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every formula the tool writes for CalcPad is evaluated by CalcPad itself (headless, tests/calcpad) and must give the
// tool's own value: TCC11's 120 cases (rectangular, flanged, slabs, with shear), 80 random beams (links, two layers,
// compression steel, hogging flanges, f_ck up to 70, SLS moments from an analysis), and random torsion, crack width and
// anchorage cases. No chip may show a unit mismatch. The .perega file of a case must open with the same values.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Section Design Toolkit.html'), 'utf8');
const sb = { console, Math, Array, Object, Number, Error, JSON, Infinity, String, Set, Map, parseFloat, isFinite };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + ';this.EC2=EC2;this.EC2Section=EC2Section;this.EC2Toolkit=EC2Toolkit;this.CalcScript=CalcScript;this.EC2Script=EC2Script;', sb);
const { EC2, EC2Section, CalcScript, EC2Script } = sb;
const TCC = require('./ref_tcc11.json');
const H = require('../calcpad/harness.js').open();
const SYS = { 'SIMPLY SUPPORTED': 'ss', 'END SPAN': 'end', 'INTERIOR SPAN': 'interior' };
let n = 0, bad = 0;
function run(tag, inp, mode = 'sec') {
  const R = mode === 'sec' ? EC2Section.design(inp) : mode === 'tor' ? sb.EC2Toolkit.torsion(inp) : mode === 'crk' ? sb.EC2Toolkit.crackWidth(inp) : sb.EC2Toolkit.anchorage(inp);
  const C = mode === 'sec' ? EC2Script.section(inp, R) : mode === 'tor' ? EC2Script.torsion(inp, R) : mode === 'crk' ? EC2Script.crackWidth(inp, R) : EC2Script.anchorage(inp, R);
  const P = H.text(C.calcpad());
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), got = P.vars[it.name];
    const ok = got !== undefined && (Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + (it.name === 'N_res' ? 1e-2 : 1e-12));
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = P.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  // No chip may be in CalcPad's 'Check these definitions' box (up to 603846b every forced unit, [#] or [#N/mm2], was; fixed in 0d11b15)
  if (P.warn) { bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
  // the section's SECTION line is drawn by CalcPad from the names (since CalcPad ecee29e)
  const pe = (P.plots || []).filter(p => p.err); if (pe.length || (C.items.some(it => it.t === 'plot') && !(P.plots || []).length)) { bad++; console.log('PLOT', tag, pe.slice(0, 2)); }
  return { C, R, P };
}
setTimeout(() => {
  let first = null;
  TCC.rect.forEach((cs, i) => { const I = cs.in, O = cs.out;
    const inp = { kind: 'beam', shape: 'rect', moment: 'sagging', b: I.D11, h: I.D10, fck: +I.M4, fyk: 500, cover: I.G11, coverComp: I.G12, phiLink: 0, bar: { phi: I.F11, n: O.M30 }, comp: O.M15 > 0 ? { phi: I.F12, n: O.M17 } : null, MEd: I.D7 * 1e6, gk: I.D12, qk: I.D13, psi2: 0.6, delta: I.D8, ae: 15, wk: 0.3, defl: { system: SYS[I.H6], span: I.D9, brittle: true } };
    const r = run('rect' + i, inp); if (!first) first = r; });
  TCC.tee.forEach((cs, i) => { const I = cs.in, O = cs.out, hog = I.H6 === 'SUPPORT', b = hog ? I.D11 : O.O7;
    run('tee' + i, { kind: 'beam', shape: 'flanged', moment: hog ? 'hogging' : 'sagging', b, bw: I.D10, hf: I.D12, h: I.D9, fck: +I.M4, fyk: 500, cover: I.G11, coverComp: I.G12, phiLink: 0, bar: { phi: I.F11, n: O.M33 }, comp: { phi: I.F12, n: O.M17 }, MEd: I.D6 * 1e6, gk: I.D13, qk: I.D14, psi2: 0.6, delta: I.D7, ae: 15, wk: 0.3, defl: hog ? null : { system: SYS[I.H6], span: I.D8, brittle: true } }); });
  TCC.slab.forEach((cs, i) => { const I = cs.in, O = cs.out; if (!(O.M20 > 0)) return;
    run('slab' + i, { kind: 'slab', h: I.D10, fck: +I.M4, fyk: 500, cover: I.D12, bar: { phi: I.D11, s: O.M20 }, MEd: I.D7 * 1e6, gk: O.G9, qk: I.G10, psi2: 0.3, delta: I.D8, ae: 15, wk: 0.3, defl: { system: SYS[I.H13], span: I.D9, brittle: true }, shear: { VEd: 60e3 + 10e3 * (i % 5), w: 20 } }); });
  // random beams with shear links, flanged, two layers, compression steel, high strength, SLS from an analysis
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
  for (let i = 0; i < 80; i++) {
    const fl = rnd() < 0.4, hog = fl && rnd() < 0.4, h = pick([350, 450, 600, 750, 900]), b = pick([250, 300, 400]), fck = pick([25, 30, 40, 50, 60, 70]);
    const inp = { kind: 'beam', shape: fl ? 'flanged' : 'rect', moment: hog ? 'hogging' : 'sagging', b: fl ? b * pick([2, 3, 5]) : b, bw: b, hf: fl ? pick([100, 150, 200]) : undefined, h, fck, fyk: 500, cover: pick([25, 30, 40]), phiLink: pick([8, 10, 12]), dg: 20,
      bar: { phi: pick([16, 20, 25, 32]), n: pick([2, 3, 4, 5, 6]), layers: pick([1, 1, 2]) }, comp: rnd() < 0.4 ? { phi: pick([12, 16, 20]), n: pick([2, 3]) } : null,
      MEd: (0.05 + 0.25 * rnd()) * b * (h - 60) ** 2 * fck, gk: 10 + 20 * rnd(), qk: 5 + 20 * rnd(), psi2: pick([0.3, 0.6]), delta: pick([1, 0.9, 0.8]), ae: 15, wk: pick([0.2, 0.3, 0.4]), xdMax: rnd() < 0.5 ? 0.45 : null,
      defl: hog ? null : { system: pick(['ss', 'end', 'interior', 'cantilever']), span: pick([4000, 6000, 8000, 10000]), brittle: rnd() < 0.7 },
      shear: rnd() < 0.8 ? { VEd: (0.2 + 1.5 * rnd()) * b * h, w: pick([0, 25]), link: { phi: pick([8, 10, 12]), legs: pick([2, 3, 4]), s: pick([100, 150, 200, 300]) } } : null };
    if (rnd() < 0.2) { inp.Mk = inp.MEd * 0.6; inp.Mqp = inp.MEd * 0.45; }
    try { run('beam' + i, inp); } catch (e) { console.log('beam' + i, e.message); }
  }
  for (let i = 0; i < 30; i++) { const fck = pick([25, 30, 40, 55]);
    try { run('tor' + i, { b: pick([250, 300, 400]), h: pick([450, 600, 750]), fck, fyk: 500, cover: 30, phiLink: pick([8, 10, 12]), phiBar: pick([12, 16, 20]), legs: 2, s: pick([100, 150, 200]), nBars: pick([4, 6, 8]), TEd: (5 + 60 * rnd()) * 1e6, VEd: (20 + 250 * rnd()) * 1e3, Asl: 942 + 2000 * rnd() }, 'tor'); } catch (e) { console.log('tor' + i, e.message); } }
  for (let i = 0; i < 30; i++) { const slab = rnd() < 0.5, ten = rnd() < 0.3;
    try { run('crk' + i, { kind: ten ? 'tension' : 'flexure', h: pick([250, 300, 500, 700]), b: slab ? 1000 : pick([300, 400]), fck: pick([30, 40, 60]), cover: pick([30, 40, 50]), phi: pick([12, 16, 20, 25]), n: slab ? null : pick([3, 4, 5]), s: slab ? pick([100, 150, 200]) : null, Mqp: ten ? 0 : (20 + 150 * rnd()) * 1e6, Nqp: ten ? (100 + 400 * rnd()) * 1e3 : 0, ae: pick([10, 15]), kt: pick([0.4, 0.6]), wmax: 0.3 }, 'crk'); } catch (e) { console.log('crk' + i, e.message); } }
  for (let i = 0; i < 30; i++) { const ten = rnd() < 0.7;
    try { run('anc' + i, { phi: pick([10, 16, 25, 32, 40]), fck: pick([25, 30, 40, 60]), fyk: 500, good: rnd() < 0.6, tension: ten, bent: rnd() < 0.3, cd: pick([20, 40, 60, 100]), lappedPct: pick([25, 33, 50, 100]), ss: rnd() < 0.3 ? 300 : null }, 'anc'); } catch (e) { console.log('anc' + i, e.message); } }
  // the .perega of the first case opens in CalcPad with the same values, and its inputs are CalcPad's own chips
  { const D = H.doc(first.C.perega({ project: 'Test', job: '1' })); n++;
    const ok = first.C.items.filter(i => i.name).every(it => { const e = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), g = D.vars[it.name]; return g !== undefined && Math.abs(g - e) <= 1e-6 * Math.abs(e) + (it.name === 'N_res' ? 1e-2 : 1e-12); }) && !D.chips.some(c => c.err || c.dup) && !D.warn;
    if (!ok) { bad++; console.log('FAIL the .perega does not open with the same values'); }
    const own = H.text(first.C.calcpad()), mine = H.w.document; void mine; n++;
    const P = H.doc(first.C.perega({})), a = P.chips.filter(c => first.C.items.some(i => i.t === 'in' && i.name === c.name));
    if (!(a.length && a.every(c => Math.abs(c.val - own.vars[c.name]) <= 1e-12 * Math.abs(c.val) + 1e-15))) { bad++; console.log('FAIL the .perega inputs differ from CalcPad\'s own'); } }
  console.log(`\n${n - bad}/${n} RC Section values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
}, 400);
