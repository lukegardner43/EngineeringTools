// 2D frame analysis: portal (all member load types, self weight, wind, combination), statically determinate Pratt truss,
// continuous beam with a hinge and a spring, three-span beam, against the independent subdivided / condensed reference
// (reference/ref_frame2d.py), the method of joints and the three-moment equation; second order against the exact
// cantilever solution; alpha_cr against Euler and a fine scipy eigen solution; EN 1990 combination generation.
const { Frame2D: F } = require('./load.js');
const REF = require('./ref_frame2d.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, abs = 0) => { n++; const ok = Math.abs(got - exp) <= Math.max(tol * Math.abs(exp), abs); if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(7)} expected ${(+exp).toPrecision(7)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
let summary = {};
const cmp = (tag, js, py, model) => {
  const sc = { R: Math.max(1, ...Object.values(py.reactions).flat().map(Math.abs)), u: Math.max(1e-6, ...Object.values(py.nodes).flat().map(Math.abs)) };
  let k0 = n, f0 = fails;
  for (const [nid, R] of Object.entries(py.reactions)) R.forEach((v, j) => near(`${tag}: reaction ${nid}[${j}]`, js.reactions[nid][j], v, 1e-6, 1e-6 * sc.R));
  for (const [nid, u] of Object.entries(py.nodes)) if (model.nodes.some(q => q.id === nid)) [js.nodes[nid].ux, js.nodes[nid].uy].forEach((v, j) => near(`${tag}: displacement ${nid}[${j}]`, v, u[j], 1e-6, 1e-7 * sc.u));
  for (const mem of model.members) {
    const L = js.members[mem.id].L, pyst = py.members[mem.id], jsst = js.members[mem.id].st;
    const skip = model.loads.filter(l => l.member === mem.id && l.type !== 'udl').map(l => l.a === '' || l.a == null ? L / 2 : l.a);
    const fsc = { N: Math.max(1, ...pyst.map(p => Math.abs(p.N))), V: Math.max(1, ...pyst.map(p => Math.abs(p.V))), M: Math.max(1, ...pyst.map(p => Math.abs(p.M))), d: Math.max(1e-6, ...pyst.map(p => Math.hypot(p.dx, p.dy))) };
    for (let k = 1; k < 48; k++) {
      const x = L * k / 48; if (skip.some(a => Math.abs(a - x) < 1e-6)) continue;
      const p = pyst.find(q => Math.abs(q.x - x) < 1e-9), q = jsst.find(s => Math.abs(s.x - x) < 1e-9); if (!p || !q) continue;
      near(`${tag}: ${mem.id} N(${x.toFixed(2)})`, q.N, p.N, 1e-6, 2e-6 * fsc.N); near(`${tag}: ${mem.id} V(${x.toFixed(2)})`, q.V, p.V, 1e-6, 2e-6 * fsc.V); near(`${tag}: ${mem.id} M(${x.toFixed(2)})`, q.M, p.M, 1e-6, 2e-6 * fsc.M);
      near(`${tag}: ${mem.id} dx(${x.toFixed(2)})`, q.dx, p.dx, 1e-5, 1e-5 * fsc.d); near(`${tag}: ${mem.id} dy(${x.toFixed(2)})`, q.dy, p.dy, 1e-5, 1e-5 * fsc.d);
    }
  }
  console.log(`${fails === f0 ? 'ok  ' : 'FAIL'} ${tag}: ${n - k0} reactions, displacements and station values against the reference`);
};
for (const key of ['portal', 'truss', 'beam', 'three']) {
  const R = REF[key], A = F.analyse(R.model, {});
  for (const [cid, py] of Object.entries(R.cases)) cmp(`${key} case ${cid}`, A.cases[cid], py, R.model);
  for (const [cid, py] of Object.entries(R.combos)) cmp(`${key} combination ${cid}`, A.combos[cid], py, R.model);
}
// method of joints (statically determinate truss)
{ const A = F.analyse(REF.truss.model, {}).cases.G; let ok = true, k = 0;
  for (const [id, N] of Object.entries(REF.truss.joints)) { const st = A.members[id].st; n++; k++; if (!(Math.abs(st[0].N - N) < 1e-6 * Math.max(1, Math.abs(N)) && Math.abs(st[st.length - 1].N - N) < 1e-6 * Math.max(1, Math.abs(N)))) { ok = false; fails++; console.log('FAIL', id, st[0].N, N); } }
  console.log(`${ok ? 'ok  ' : 'FAIL'} truss: ${k} bar forces equal the method of joints`);
  truth('truss: bars carry no bending (nodal loads only)', Object.values(A.members).every(m => Math.max(...m.st.map(p => Math.abs(p.M))) < 1e-9)); }
// three-moment equation
{ const A = F.analyse(REF.three.model, {}).cases.G; near('three spans: M_B by the three-moment equation', A.members.s1.st[A.members.s1.st.length - 1].M, REF.three.MB, 1e-9); near('three spans: M_C', A.members.s3.st[0].M, REF.three.MC, 1e-9);
  near('three spans: reactions sum to the load', Object.values(A.reactions).reduce((a, r) => a + r[1], 0), 10 * 20, 1e-12); }
// hinge and spring behaviour
{ const A = F.analyse(REF.beam.model, {}).cases.G, m2 = A.members.m2.st;
  near('Gerber hinge: zero moment at the released end', m2[m2.length - 1].M, 0, 0, 1e-9);
  near('spring support: reaction = -k u', A.reactions.C[1], -30000 * A.nodes.C.uy, 1e-12); }
// second order and alpha_cr
{ const { EI, L, Pcr } = REF.euler, sec = { A: 85.5, I: 29400, E: 210, mass: 0 };
  const mk = P => ({ nodes: [{ id: 'A', x: 0, y: 0, sup: { ux: 'f', uy: 'f', rz: 'f' } }, { id: 'B', x: 0, y: L }], members: [{ id: 'M', i: 'A', j: 'B', sec }], cases: [{ id: 'G', name: 'G', type: 'G' }], loads: [{ case: 'G', type: 'node', node: 'B', Fy: -P, Fx: 10 }], combos: [{ id: 'U', name: 'U', kind: 'ULS', f: { G: 1 } }] });
  for (const r of [0.1, 0.25, 0.5]) { const P = r * Pcr, k = Math.sqrt(P / EI), exact = 10 / (P * k) * (Math.tan(k * L) - k * L), A = F.analyse(mk(P), { second: true, acr: true }).combos.U;
    near(`cantilever P = ${r} P_cr: alpha_cr = 1/${r} (Euler; exact member stiffness)`, A.acr, 1 / r, 1e-6); near(`cantilever P = ${r} P_cr: second-order tip sway (exact tan solution)`, A.nodes.B.ux, exact, r < 0.4 ? 1e-3 : 4e-3); }
  const pin = { nodes: [{ id: 'A', x: 0, y: 0, sup: { ux: 'f', uy: 'f' } }, { id: 'B', x: 0, y: 6, sup: { ux: 'f' } }], members: [{ id: 'M', i: 'A', j: 'B', sec }], cases: [{ id: 'G', name: 'G', type: 'G' }], loads: [{ case: 'G', type: 'node', node: 'B', Fy: -100 }], combos: [{ id: 'U', name: 'U', kind: 'ULS', f: { G: 1 } }] };
  near('pinned strut: alpha_cr = pi^2 EI / L^2 / P', F.analyse(pin, { acr: true }).combos.U.acr, Math.PI ** 2 * EI / 36 / 100, 1e-6);
  const col = (top, extra = {}) => ({ ...pin, nodes: [{ id: 'A', x: 0, y: 0, sup: { ux: 'f', uy: 'f', rz: 'f' } }, { id: 'B', x: 0, y: 6, sup: top }], ...extra });
  near('clamped-guided column (top rotation and sway held): alpha_cr = 4 pi^2 EI / L^2 / P from the clamped-member count J0', F.analyse(col({ ux: 'f', rz: 'f' }), { acr: true }).combos.U.acr, 4 * Math.PI ** 2 * EI / 36 / 100, 1e-6);
  near('sway column, top rotation held: alpha_cr = pi^2 EI / L^2 / P', F.analyse(col({ rz: 'f' }), { acr: true }).combos.U.acr, Math.PI ** 2 * EI / 36 / 100, 1e-6);
  near('propped cantilever: alpha_cr = 20.1907 EI / L^2 / P (tan kL = kL)', F.analyse(col({ ux: 'f' }), { acr: true }).combos.U.acr, 4.493409457909064 ** 2 * EI / 36 / 100, 1e-6);
  { const stiff = { A: 1e4, I: 1e9, E: 210, mass: 0 }, cs = { ...sec, A: 1e6 }, h = 5, P = 400;   // axially rigid columns so the beam cannot rotate
    const pf = { nodes: [{ id: 'A', x: 0, y: 0, sup: { ux: 'f', uy: 'f', rz: 'f' } }, { id: 'B', x: 0, y: h }, { id: 'C', x: 8, y: h }, { id: 'D', x: 8, y: 0, sup: { ux: 'f', uy: 'f', rz: 'f' } }],
      members: [{ id: 'c1', i: 'A', j: 'B', sec: cs }, { id: 'b', i: 'B', j: 'C', sec: stiff }, { id: 'c2', i: 'D', j: 'C', sec: cs }], cases: [{ id: 'G', name: 'G', type: 'G' }],
      loads: [{ case: 'G', type: 'node', node: 'B', Fy: -P }, { case: 'G', type: 'node', node: 'C', Fy: -P }], combos: [{ id: 'U', name: 'U', kind: 'ULS', f: { G: 1 } }] };
    near('fixed-base portal with a rigid beam: sway alpha_cr = pi^2 EI / h^2 / P', F.analyse(pf, { acr: true }).combos.U.acr, Math.PI ** 2 * EI / h / h / P, 1e-4); }
  { const { stab, kStab, kgLocal, kLocal } = F, c0 = stab(0.0499999), c1 = stab(0.0500001), t0 = stab(-899.9999), t1 = stab(-900.0001);
    near('stability functions continuous at the series switch (s)', c0[0], c1[0], 1e-7); near('stability functions continuous at the series switch (sc)', c0[1], c1[1], 1e-7);
    near('tension stability functions continuous at the asymptotic switch', t0[0], t1[0], 1e-6);
    near('stability functions: s(pi^2) = 2.4674 (pinned far end s(1 - c^2) = 0 at Euler)', stab(Math.PI ** 2)[0] * (1 - (stab(Math.PI ** 2)[1] / stab(Math.PI ** 2)[0]) ** 2), 0, 0, 1e-9);
    const Ks = kStab(1e6, 5e4, 4, 5), Kl = kLocal(1e6, 5e4, 4), Kg = kgLocal(-5, 4);
    near('exact stiffness matches the consistent geometric stiffness to first order in P', Ks[2][2], Kl[2][2] + Kg[2][2], 1e-8); near('... sway term', Ks[1][1], Kl[1][1] + Kg[1][1], 1e-8); }
  near('portal alpha_cr against a fine scipy eigen solution (axial force varies along the sloping beam: mean of end values vs station mean)', F.analyse(REF.portal.model, { acr: true }).combos.U1.acr, REF.portal.acr, 1e-4);
  for (const k of ['multi', 'braced']) { const A = F.analyse(REF[k].model, { acr: true }); for (const [id, v] of Object.entries(REF[k].acr)) near(`${k} frame (releases, bars, self weight) ${id}: alpha_cr against a fine scipy eigen solution`, A.combos[id].acr, v, 1e-5); }
  const T = F.analyse(REF.truss.model, { acr: true });
  truth('no compression: alpha_cr infinite', F.analyse({ ...pin, loads: [{ case: 'G', type: 'node', node: 'B', Fy: 100 }] }, { acr: true }).combos.U.acr === Infinity); }
// errors and mechanisms
{ let msg = ''; try { F.analyse({ ...REF.three.model, nodes: REF.three.model.nodes.map(q => ({ ...q, sup: { uy: 'f' } })) }); } catch (e) { msg = e.message; } truth('mechanism detected and named', /Unstable structure.*x/.test(msg));
  msg = ''; try { F.analyse({ ...REF.three.model, members: [{ id: 'z', i: 'A', j: 'A', sec: { A: 1, I: 1, E: 210 } }] }); } catch (e) { msg = e.message; } truth('zero-length member rejected', /zero length/.test(msg)); }
// EN 1990 combinations (UK NA)
{ const cs = [{ id: 'G', name: 'G', type: 'G' }, { id: 'Q', name: 'Q', type: 'Q' }, { id: 'W', name: 'W', type: 'W' }, { id: 'W2', name: 'W2', type: 'W' }];
  const C = F.en1990(cs), has = (kind, f) => C.some(c => c.kind === kind && Object.keys({ ...f, ...c.f }).every(k => Math.abs((c.f[k] || 0) - (f[k] || 0)) < 1e-12));
  truth('6.10: 1.35G + 1.5Q + 0.75W with each wind case in turn', has('ULS', { G: 1.35, Q: 1.5, W: 0.75 }) && has('ULS', { G: 1.35, Q: 1.5, W2: 0.75 }));
  truth('wind cases are alternatives, never added together', !C.some(c => c.f.W && c.f.W2));
  truth('6.10: 1.35G + 1.05Q + 1.5W', has('ULS', { G: 1.35, Q: 1.05, W: 1.5 })); truth('uplift: 1.0G + 1.5W', has('ULS', { G: 1.0, W: 1.5 }));
  truth('SLS characteristic: G + Q + 0.5W and G + W + 0.7Q', has('SLS', { G: 1, Q: 1, W: 0.5 }) && has('SLS', { G: 1, W: 1, Q: 0.7 }));
  const D = F.en1990(cs.slice(0, 2), '6.10ab'); truth('6.10a / 6.10b: 1.35G + 1.05Q and 1.25G + 1.5Q', D.some(c => c.f.G === 1.35 && Math.abs(c.f.Q - 1.05) < 1e-12) && D.some(c => c.f.G === 1.25 && c.f.Q === 1.5)); }
console.log(`\n${n - fails}/${n} frame analysis checks passed`); if (fails) process.exit(1);
