// Steel frame: stiffness analysis and alpha_cr against an independent numpy solver and exact stability functions
// (reference/ref_frame.py), second-order analysis against the exact cantilever solution, combinations, imperfections and
// the member design path against the Steel Member Design beam mode.
const { EC3, Design, Frame2D: F, SECTION_DATA } = require('./load.js');
const REF = require('./ref_frame.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, scale) => { n++; const ok = Math.abs(got - exp) <= tol * (scale ?? Math.max(Math.abs(exp), 1e-30)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const g = REF.geom, E = F.E;
const portal = (fixed, A = g.A) => F.build({ nodes: [{ x: 0, y: 0, sup: fixed ? { ux: 1, uy: 1, rz: 1 } : { ux: 1, uy: 1 } }, { x: 0, y: g.h }, { x: g.Lb, y: g.h }, { x: g.Lb, y: 0, sup: fixed ? { ux: 1, uy: 1, rz: 1 } : { ux: 1, uy: 1 } }],
  members: [{ i: 0, j: 1, A, I: g.Ic }, { i: 1, j: 2, A, I: g.Ib }, { i: 3, j: 2, A, I: g.Ic }] });
const reac = (md, r, L, node) => { const K = []; return null; };
for (const fx of [true, false]) {
  const R = REF['portal_' + (fx ? 'fixed' : 'pinned')], md = portal(fx), L = { nodal: [{ node: 1, Fx: 50e3 }], udl: [{ member: 1, wy: -20 }] };
  const res = F.analyse(md, L, false);
  near(`${fx ? 'fixed' : 'pinned'} portal: eaves sway`, res.u[3], R.sway, 1e-9);
  // base reactions from the column end forces (column 1 starts at node 0, column 3 at node 3)
  const c1 = F.memberResults(md, res, 0), c3 = F.memberResults(md, res, 2);
  near(`${fx ? 'fixed' : 'pinned'} portal: base moment, left`, -c1[0].M, R.M0, 1e-6, 1e6); near(`${fx ? 'fixed' : 'pinned'} portal: base moment, right`, -c3[0].M, R.M3, 1e-6, 1e6);
  near(`${fx ? 'fixed' : 'pinned'} portal: left base vertical reaction`, -c1[0].N, R.Ry0, 1e-6); near(`${fx ? 'fixed' : 'pinned'} portal: right base vertical reaction`, -c3[0].N, R.Ry3, 1e-6);
  near(`${fx ? 'fixed' : 'pinned'} portal: left base horizontal reaction`, -c1[0].V, R.Rx0, 1e-6, 1e3);
  // alpha_cr with 1000 kN in each column only (beam axially unloaded, stiff axially)
  const mdA = portal(fx, 1e6), Lc = { nodal: [{ node: 1, Fy: -g.Pref }, { node: 2, Fy: -g.Pref }], udl: [] };
  const lin = F.analyse(mdA, Lc, false), acr = F.alphaCr(mdA, lin.ef);
  near(`${fx ? 'fixed' : 'pinned'} portal: alpha_cr vs exact stability functions`, acr, REF['acr_portal_' + (fx ? 'fixed' : 'pinned')], 2e-3);
}
// cantilever: second-order sway against the exact solution delta = H/(P k)(tan kL - kL)
{ const I = 1e8, L = 5000, P = 500e3, H = 10e3, md = F.build({ nodes: [{ x: 0, y: 0, sup: { ux: 1, uy: 1, rz: 1 } }, { x: 0, y: L }], members: [{ i: 0, j: 1, A: 1e4, I }] });
  const so = F.analyse(md, { nodal: [{ node: 1, Fx: H, Fy: -P }], udl: [] }, true), k = Math.sqrt(P / (E * I));
  near('cantilever: second-order sway = exact', so.u[3], H / (P * k) * (Math.tan(k * L) - k * L), 1e-4);
  near('cantilever: alpha_cr = pi² EI/(4L²P)', F.alphaCr(md, F.analyse(md, { nodal: [{ node: 1, Fy: -P }], udl: [] }, false).ef), Math.PI ** 2 * E * I / (4 * L * L * P), 1e-4);
  const st = F.memberResults(md, so, 0);
  near('cantilever: second-order base moment = H L + P delta', Math.abs(st[0].M), H * L + P * so.u[3], 1e-3); }
// combinations and imperfections
{ const C = F.combos('6.10', true, true);
  truth('6.10 with Q and W: 7 combinations (gravity, and ±W in three forms)', C.length === 7 && C[0].name === '1.35G + 1.5Q');
  truth('6.10a/b with Q and W: both expressions present', F.combos('6.10ab', true, true).some(c => c.name.startsWith('6.10a')) && F.combos('6.10ab', true, true).some(c => c.name.startsWith('6.10b'))); }
const sec = n => EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith(n)));
{ const col = sec('254×254×73'), bm = sec('406×178×54');
  const inp = { nodes: [{ x: 0, y: 0, sup: { ux: 1, uy: 1, rz: 1 } }, { x: 0, y: 6000 }, { x: 12000, y: 6000 }, { x: 12000, y: 0, sup: { ux: 1, uy: 1, rz: 1 } }],
    members: [{ i: 0, j: 1, sec: col, grade: 'S355', role: 'column', nLT: 1 }, { i: 1, j: 2, sec: bm, grade: 'S355', role: 'beam', nLT: 4 }, { i: 3, j: 2, sec: col, grade: 'S355', role: 'column', nLT: 1 }],
    cases: { G: { nodal: [], udl: [{ member: 1, wy: -10 }] }, Q: { nodal: [], udl: [{ member: 1, wy: -8 }] }, W: { nodal: [], udl: [] } }, rule: '6.10', imperfection: true };
  const R = F.design(inp);
  near('imperfection: phi = (1/200) alpha_h alpha_m (h = 6 m, m = 2)', R.phi, (1 / 200) * (2 / Math.sqrt(6)) * Math.sqrt(0.5 * 1.5), 1e-12);
  const c = R.combos[0], W = 12000 * (1.35 * 10 + 1.5 * 8);
  near('EHF = phi x total vertical load', c.ehf, R.phi * W, 1e-9);
  truth('gravity-only combination is run with the EHF in both directions', R.combos.filter(x => x.name.startsWith('1.35G + 1.5Q')).length === 2);
  truth('alpha_cr >= 10 here: first-order analysis', R.combos.every(x => x.acr >= 10 && !x.second));
  const vsum = R.reactions.reduce((a, r) => a + r.Ry[1], 0);
  near('vertical reactions balance the factored load (max of each support, symmetric)', vsum, W, 2e-3); }
// member design path: simply supported beam in the frame engine = Steel Member Design beam mode (bending and LTB)
{ const bm = sec('406×178×54'), L = 8000;
  const R = F.design({ nodes: [{ x: 0, y: 0, sup: { ux: 1, uy: 1 } }, { x: L, y: 0, sup: { uy: 1 } }], members: [{ i: 0, j: 1, sec: bm, grade: 'S355', role: 'beam', nLT: 2 }],
    cases: { G: { nodal: [], udl: [{ member: 0, wy: -12 }] }, Q: { nodal: [], udl: [{ member: 0, wy: -9 }] } }, rule: '6.10', imperfection: false });
  const B = Design.designBeam({ sec: bm, grade: 'S355', annex: 'B', spans: [L], cantL: 0, cantR: 0, endLeft: 'pinned', endRight: 'pinned', loads: [{ case: 'G', member: 0, type: 'udl', w: 12 }, { case: 'Q', member: 0, type: 'udl', w: 9 }],
    selfWeight: false, rule: '6.10', psi0: 0.7, N: 0, restraint: [{ mode: 'points', pts: [L / 2] }], tipRestrained: {}, destab: false, defl: {}, bearing: false });
  const m = R.members[0].D.gov;
  near('frame beam: bending utilisation = beam mode', m.bending.util, B.gov.bending.util, 2e-3);
  near('frame beam: LTB utilisation = beam mode (M_cr by FE, mid-span restraint)', m.ltb.util, B.gov.ltb.util, 1e-2);
  near('frame beam: mid-span moment wL²/8', R.members[0].Mmax, 1.35 * 12 * L * L / 8 + 1.5 * 9 * L * L / 8, 1e-6); }
// second order triggered for a slender frame (pinned bases, heavy columns loads)
{ const col = sec('152×152×23'), bm = sec('406×178×54');
  const R = F.design({ nodes: [{ x: 0, y: 0, sup: { ux: 1, uy: 1 } }, { x: 0, y: 5000 }, { x: 10000, y: 5000 }, { x: 10000, y: 0, sup: { ux: 1, uy: 1 } }],
    members: [{ i: 0, j: 1, sec: col, grade: 'S355', role: 'column', nLT: 1 }, { i: 1, j: 2, sec: bm, grade: 'S355', role: 'beam', nLT: 4 }, { i: 3, j: 2, sec: col, grade: 'S355', role: 'column', nLT: 1 }],
    cases: { G: { nodal: [{ node: 1, Fy: -40e3 }, { node: 2, Fy: -40e3 }], udl: [{ member: 1, wy: -10 }] }, Q: { nodal: [], udl: [] }, W: { nodal: [{ node: 1, Fx: 5e3 }], udl: [] } }, rule: '6.10', imperfection: true });
  truth(`slender pinned-base portal: alpha_cr < 10 (${R.acrMin.toFixed(2)}) triggers second-order analysis`, R.acrMin < 10 && R.combos.some(c => c.second)); }
// hinges on two members: each released end gets its own rotation after all the nodes' freedoms (a hinge on the second
// member used to share a number with the first member's internal nodes, and the frame was reported as a mechanism)
{ const md = F.build({ nodes: [{ x: 0, y: 0, sup: { ux: 1, uy: 1, rz: 1 } }, { x: 0, y: 4000 }, { x: 3000, y: 4000 }, { x: 6000, y: 4000 }, { x: 6000, y: 0, sup: { ux: 1, uy: 1, rz: 1 } }],
    members: [{ i: 0, j: 1, A: 1e4, I: 1e8 }, { i: 1, j: 2, A: 1e4, I: 2e8, relI: true }, { i: 2, j: 3, A: 1e4, I: 2e8, relJ: true }, { i: 4, j: 3, A: 1e4, I: 1e8 }] });
  const res = F.analyse(md, { nodal: [], udl: [{ member: 1, wy: -10 }, { member: 2, wy: -10 }] }, false);
  const b1 = F.memberResults(md, res, 1), b2 = F.memberResults(md, res, 2), c1 = F.memberResults(md, res, 0);
  near('beam pinned to both columns through hinges on two members: mid-span moment wL²/8', b1[b1.length - 1].M, 10 * 6000 * 6000 / 8, 1e-6);
  near('... no moment at the hinges', Math.abs(b1[0].M) + Math.abs(b2[b2.length - 1].M), 0, 1e-6, 1e6);
  near('... no moment into the column', Math.abs(c1[0].M), 0, 1e-6, 1e6);
  // per-member E (timber frames): halving E doubles the deflection of a determinate beam
  const mdE = F.build({ nodes: [{ x: 0, y: 0, sup: { ux: 1, uy: 1 } }, { x: 6000, y: 0, sup: { uy: 1 } }], members: [{ i: 0, j: 1, A: 1e4, I: 1e8, E: 105000 }] });
  const mdS = F.build({ nodes: [{ x: 0, y: 0, sup: { ux: 1, uy: 1 } }, { x: 6000, y: 0, sup: { uy: 1 } }], members: [{ i: 0, j: 1, A: 1e4, I: 1e8 }] });
  const dE = Math.min(...F.analyse(mdE, { nodal: [], udl: [{ member: 0, wy: -10 }] }, false).u), dS = Math.min(...F.analyse(mdS, { nodal: [], udl: [{ member: 0, wy: -10 }] }, false).u);
  near('a member with its own E (half of steel) deflects twice as much', dE / dS, 2, 1e-9); }
// axial force along a member loaded along its length (a column's weight; a sloping rafter): N varies within each element
{ const md = F.build({ nodes: [{ x: 0, y: 0, sup: { ux: 1, uy: 1, rz: 1 } }, { x: 0, y: 4000 }], members: [{ i: 0, j: 1, A: 1e4, I: 1e8 }] });
  const st = F.memberResults(md, F.analyse(md, { nodal: [], udl: [{ member: 0, wy: -2 }] }, false), 0);
  near('column under its weight: N = -w L at the base', st[0].N, -8000, 1e-9); near('... -w L/2 at mid-height', st.find(p => Math.abs(p.x - 2000) < 1e-6).N, -4000, 1e-9);
  near('... -w (L - x) one twelfth up, inside the first element', st[1].N, -2 * (4000 - st[1].x), 1e-9); near('... 0 at the free top', st[st.length - 1].N, 0, 1e-9, 1); }
console.log(`\n${n - fails}/${n} frame checks passed`);
if (fails) process.exit(1);
