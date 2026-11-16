// RC 2D Frame Analysis and Design: its full calculation run through CalcPad (NODE_PATH=<dir with node_modules> node test_calcpad.js).
// Every check (the frame, each floor's beam zones, each column in and out of the plane with its detailing and shear) is
// pasted into CalcPad (headless, tests/calcpad) and every value CalcPad works out must be the tool's own: a braced and an
// unbraced four-storey frame (with wind, the global imperfection and cantilevers), and 20 random sub-frames and 8 random
// multi-storey frames, with the bars Suggest gives. No chip may show an error or a unit CalcPad cannot read, and every
// SECTION drawing must draw.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC 2D Frame Analysis and Design.html'), 'utf8');
const sb = { console, Math, Array, Set, Map, Object, Number, Error, JSON, Infinity, NaN, String, Boolean, parseFloat, isFinite, Float64Array, Int32Array, Uint8Array, Promise };
vm.createContext(sb);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1].replace(/if \(typeof module !== 'undefined'\)[^\n]*\n/g, '') + '\n;this.RCFrame = RCFrame; this.CalcScript = CalcScript; this.RCFrameScript = RCFrameScript;', sb);
const { RCFrame, CalcScript, RCFrameScript } = sb;
const H = require('../calcpad/harness.js').open();
let n = 0, bad = 0, zones = 0, frames = 0;
function check(tag, C, P) {
  for (const it of C.items) {
    if (!it.name) continue; n++;
    const exp = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), got = P.vars[it.name];
    const ok = got !== undefined && Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + (/^N_res(_\d+)*$/.test(it.name) ? 1e-2 : 1e-9);
    if (!ok) { bad++; if (bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
  }
  const er = P.chips.filter(c => c.err || c.dup); if (er.length) { bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
  if (P.warn) { bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
  const pe = (P.plots || []).filter(p => p.err); if (pe.length || (C.items.some(it => it.t === 'plot') && !(P.plots || []).length)) { bad++; console.log('PLOT', tag, pe.slice(0, 2)); }
}
function frame(tag, inp) {
  let D; try { const An = RCFrame.analyse(inp); D = RCFrame.design({ ...inp, beamBars: RCFrame.suggestBeams(An), colBars: RCFrame.suggestColumns(An) }); } catch (e) { return; }
  const Z = RCFrameScript.zones(D, inp).all; frames++;
  for (const zn of Z) { zones++; check(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad())); }
  return Z;
}
// ---------- the four-storey frames ----------
const beam = { h: 500, bw: 300, hf: 150, shape: 'T' }, edge = { b: 300, h: 300 }, int = { b: 350, h: 350 };
const base = { mode: 'frame', spans: [6, 7.5, 6], cantL: 0, cantR: 1.5, bay: 6, storeys: [4, 3.5, 3.5, 3.5].map(H => ({ H, beam, edge, int })), base: 'F',
  fck: 32, fyk: 500, cover: { top: 35, btm: 35 }, coverCol: 35, selfWeight: 'downstand', rule: '6.10ab', chequer: true, redist: 'limited', delta: 0.85,
  loads: [{ level: 'all', span: 'all', type: 'udl', G: 30, Q: 12 }, { level: 4, span: 'all', type: 'udl', G: -10, Q: -6 }, { level: 1, span: 1, type: 'point', G: 40, Q: 25, a: 3 }] };
const F = frame('braced', { ...base, braced: true });
frame('unbraced', { ...base, braced: false, wind: [25, 22, 22, 12] });
// ---------- random sub-frames and frames ----------
let seed = 4021; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let k = 0; k < 20; k++) {
  const nS = pick([1, 2, 3, 4]), spans = Array.from({ length: nS }, () => pick([4, 5, 6, 7.5])), shape = pick(['T', 'L', 'R']);
  const bm = { h: pick([400, 450, 500, 600]), bw: pick([250, 300, 350]), hf: shape === 'R' ? 0 : pick([125, 150, 200]), shape };
  const ce = { b: pick([250, 300]), h: pick([250, 300, 350]) }, ci = { b: pick([300, 350, 400]), h: pick([300, 400, 450]) }, cL = nS > 1 && rnd() < 0.25 ? pick([1, 1.5]) : 0, cR = nS > 1 && rnd() < 0.25 ? pick([1, 1.5]) : 0;
  frame(`sub${k}`, { mode: 'sub', spans, cantL: cL, cantR: cR, beam: bm, bay: pick([5, 6, 7.5]), sub: { below: { H: pick([3, 3.5, 4]), far: pick(['F', 'P']), edge: ce, int: ci }, above: rnd() < 0.8 ? { H: pick([3, 3.5]), far: pick(['F', 'P']), edge: ce, int: ci } : null },
    fck: pick([25, 30, 32, 40]), fyk: 500, rule: pick(['6.10', '6.10ab']), adjacent: rnd() < 0.4, redist: 'limited', delta: pick([1, 0.85, 0.7]), selfWeight: pick(['downstand', 'none']),
    loads: [{ level: 'all', span: 'all', type: 'udl', G: pick([20, 30, 40]), Q: pick([10, 15, 25]) }, { level: 'all', span: cL ? 1 : 0, type: 'point', G: 30, Q: 20, a: spans[0] * 0.4 }], cover: { top: 35, btm: 35 }, coverCol: pick([30, 35, 40]) });
}
for (let k = 0; k < 8; k++) {
  const nS = pick([1, 2, 3]), spans = Array.from({ length: nS }, () => pick([5, 6, 7.5])), braced = rnd() < 0.6, ns = pick([2, 3]);
  frame(`frame${k}`, { ...base, spans, cantR: rnd() < 0.3 ? 1.5 : 0, storeys: Array.from({ length: ns }, () => ({ H: pick([3.5, 4]), beam, edge, int })), braced, wind: braced ? undefined : Array.from({ length: ns }, () => pick([10, 20, 30])),
    chequer: rnd() < 0.5, fck: pick([30, 32, 40]), loads: [{ level: 'all', span: 'all', type: 'udl', G: pick([25, 30, 40]), Q: pick([10, 15]) }] });
}
// ---------- the braced frame's project: the values its checks repeat are shared once; every check still has all its values ----------
(async () => {
  const list = F.map(zn => ({ C: zn.C, title: zn.title })), sz = x => JSON.stringify(x).length;
  const P = await CalcScript.project(list, { project: 'Test' }, 'Frame'), Pn = await CalcScript.project(list, { project: 'Test' }, 'Frame', { share: false });
  // the whole calculation as one CalcPad check (.perega): its parts merged, every value still the tool's, as pasted and as opened
  { const M = CalcScript.merge(list, { title: 'Whole' }); check('one check', M, H.text(M.calcpad())); check('one check, opened', M, H.doc(M.perega({}))); }
  n++; if (P.checks.length !== F.length + 1 || !P.checks[0].shared) { bad++; console.log('FAIL the project has the wrong shape'); }
  H.project(P).slice(1).forEach((r, k) => check(`project ${r.name}`, F[k].C, r));
  n++; if (!(sz(P) < 0.85 * sz(Pn))) { bad++; console.log('FAIL sharing did not make the pack smaller', sz(P), sz(Pn)); }
  console.log(`project: ${P.checks.length} checks, ${(sz(P) / 1e6).toFixed(2)} MB with the shared values, ${(sz(Pn) / 1e6).toFixed(2)} MB without`);
  console.log(`${zones} checks of ${frames} frames`);
  console.log(`\n${n - bad}/${n} RC 2D Frame values reproduced by CalcPad`);
  process.exit(bad ? 1 : 0);
})();
