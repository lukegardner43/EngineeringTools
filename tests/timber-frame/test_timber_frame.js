// Timber 2D Frame Analysis and Design. The analysis of every action is checked against the separate, verified solver of
// 2D Frame Analysis (tests/frame2d: an independent subdivided reference, the method of joints, Euler); the king post truss
// with pinned joints against statics; the member checks of EC5 against an independent restatement of 6.1-6.3; the
// combinations, the portal's imperfection, alpha_cr and second order, the deflections and the reactions.
const { TimberFrame: TF, EC5 } = require('./load.js');
const { Frame2D: FA } = require('../frame2d/load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol, abs = 0) => { n++; const ok = Math.abs(got - exp) <= Math.max(tol * Math.abs(exp), abs); if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(7)} expected ${(+exp).toPrecision(7)}`); if (!ok) fails++; return ok; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = ''; try { f(); } catch (e) { m = e.message; } const ok = re.test(m); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ': ' + (m || 'no error')}`); if (!ok) fails++; };

const TRUSS = { mat: { family: 'solid', cls: 'C24' }, sc: 2, spacing: 600, sw: true, ksys: false, combo: '6.10',
  sizes: { top: { b: 47, h: 125 }, bot: { b: 47, h: 125 }, web: { b: 47, h: 75 } }, lz: { top: 600, bot: 1800 },
  actions: { gRoof: 0.75, gCeil: 0.25, qRoof: 0.6, qCeil: 0.25, catCeil: 'A', snow: 0.5, wRoof1: -0.6, wRoof2: -0.4 } };
const PORTAL = { mat: { family: 'glulam', cls: 'GL24h' }, sc: 1, spacing: 4800, sw: true, ksys: false, combo: '6.10',
  sizes: { raf: { b: 140, h: 585 }, col: { b: 140, h: 585 } }, lz: { raf: 1200, col: 1500 },
  actions: { gRoof: 0.75, qRoof: 0.6, snow: 0.5, wRoof1: -0.6, wRoof2: -0.4, wWall1: 0.5, wWall2: -0.25 } };

// ---------- 1. every action against 2D Frame Analysis (kN, m in that tool) ----------
function crossCheck(tag, D) {
  const id = i => 'n' + i, sup = s => { const o = {}; if (s) { if (s.ux) o.ux = 'f'; if (s.uy) o.uy = 'f'; if (s.rz) o.rz = 'f'; } return o; };
  const sec = g => { const z = D.sizes[g]; return { A: z.b * z.h / 100, I: z.b * z.h ** 3 / 12 / 1e4, E: D.M.E0mean / 1000, mass: 0 }; };
  const k0 = n, f0 = fails;
  for (const [k, L] of Object.entries(D.cases)) {
    const model = { nodes: D.G.nodes.map((p, i) => ({ id: id(i), x: p.x / 1000, y: p.y / 1000, sup: sup(p.sup) })),
      members: D.G.members.map((m, mi) => ({ id: 'm' + mi, i: id(m.i), j: id(m.j), sec: sec(m.grp), relI: !!m.relI, relJ: !!m.relJ })),
      cases: [{ id: k, name: k, type: k === 'G' ? 'G' : 'Q', selfWeight: false }],
      loads: L.udl.flatMap(q => [q.wy ? { case: k, type: 'udl', member: 'm' + q.member, w1: q.wy, w2: '', a: 0, b: '', dir: 'GY' } : null,
        q.wx ? { case: k, type: 'udl', member: 'm' + q.member, w1: q.wx, w2: '', a: 0, b: '', dir: 'GX' } : null].filter(Boolean)), combos: [] };
    const A = FA.analyse(model, {}).cases[k], act = D.actions[k];
    const sc = { N: 1, M: 1 };
    D.G.members.forEach((m, mi) => act.st[mi].forEach(p => { sc.N = Math.max(sc.N, Math.abs(p.N)); sc.M = Math.max(sc.M, Math.abs(p.M)); }));
    D.G.members.forEach((m, mi) => {
      const ref = A.members['m' + mi].st;
      for (const p of act.st[mi]) {
        const q = ref.find(s => Math.abs(s.x * 1000 - p.x) < 1e-6); if (!q) continue;
        near(`${tag} ${k}: member ${mi + 1} N at ${p.x.toFixed(0)}`, p.N / 1e3, q.N, 1e-6, 1e-6 * sc.N / 1e3);
        near(`${tag} ${k}: member ${mi + 1} M at ${p.x.toFixed(0)}`, Math.abs(p.M) / 1e6, Math.abs(q.M), 1e-6, 1e-6 * sc.M / 1e6);
        near(`${tag} ${k}: member ${mi + 1} V at ${p.x.toFixed(0)}`, Math.abs(p.V) / 1e3, Math.abs(q.V), 1e-6, 1e-6 * sc.N / 1e3);
      }
    });
    const umax = Math.max(1e-9, ...D.G.nodes.map((_, i) => Math.hypot(A.nodes[id(i)].ux, A.nodes[id(i)].uy)));
    D.G.nodes.forEach((_, i) => { near(`${tag} ${k}: joint ${i} ux`, act.u[3 * i] / 1000, A.nodes[id(i)].ux, 1e-6, 1e-6 * umax); near(`${tag} ${k}: joint ${i} uy`, act.u[3 * i + 1] / 1000, A.nodes[id(i)].uy, 1e-6, 1e-6 * umax); });
    for (const R of D.reactions) { const r = A.reactions[id(R.node)]; near(`${tag} ${k}: reaction H at ${R.node}`, R.by[k].x / 1e3, r[0], 1e-6, 1e-6 * sc.N / 1e3); near(`${tag} ${k}: reaction V at ${R.node}`, R.by[k].y / 1e3, r[1], 1e-6, 1e-6 * sc.N / 1e3); }
  }
  console.log(`${fails === f0 ? 'ok  ' : 'FAIL'} ${tag}: ${n - k0} station forces, joint displacements and reactions of ${Object.keys(D.cases).join(', ')} equal 2D Frame Analysis`);
}
const geoms = [['Fink, chords continuous', TRUSS, { kind: 'truss', type: 'fink', L: 8000, pitch: 30, joints: 'chords' }],
  ['Fink, every joint pinned', TRUSS, { kind: 'truss', type: 'fink', L: 8000, pitch: 30, joints: 'pinned' }],
  ['Howe, 6 panels', TRUSS, { kind: 'truss', type: 'howe', L: 9000, pitch: 25, n: 6, joints: 'chords' }],
  ['Pratt, 8 panels', TRUSS, { kind: 'truss', type: 'pratt', L: 10000, pitch: 22.5, n: 8, joints: 'chords' }],
  ['king post', TRUSS, { kind: 'truss', type: 'kingpost', L: 6000, pitch: 35, joints: 'chords' }],
  ['parallel-chord Pratt', TRUSS, { kind: 'flat', type: 'pratt', L: 8000, n: 8, depth: 900, joints: 'chords' }],
  ['parallel-chord Warren', TRUSS, { kind: 'flat', type: 'warren', L: 9000, n: 6, depth: 1000, joints: 'pinned' }],
  ['portal, pinned bases', PORTAL, { kind: 'portal', L: 12000, he: 4000, pitch: 10, base: 'pinned' }],
  ['portal, fixed bases, flat', PORTAL, { kind: 'portal', L: 10000, he: 5000, pitch: 0, base: 'fixed' }]];
const designs = {};
for (const [tag, base, geom] of geoms) { const D = TF.design({ ...base, geom }); designs[tag] = D; crossCheck(tag, D); }

// ---------- 2. statics: the king post truss with every joint pinned, a roof load only ----------
{ const L = 6000, a = 30, g = 1.0, s = 600, D = TF.design({ ...TRUSS, geom: { kind: 'truss', type: 'kingpost', L, pitch: a, joints: 'pinned' }, sw: false, actions: { gRoof: g } });
  const w = g * s / 1000 / Math.cos(a * Math.PI / 180), H = L / 2 * Math.tan(a * Math.PI / 180), st = D.actions.G.st;
  near('king post: each reaction w L / 2', D.reactions[0].by.G.y, w * L / 2, 1e-9);
  near('king post: bottom chord tension (w L/2)(L/4)/H', st[2][0].N, w * L / 2 * (L / 4) / H, 1e-9);
  near('king post: top chord moment w (L/2)² / 8 at mid-length', Math.max(...st[0].map(p => Math.abs(p.M))), w * (L / 2) ** 2 / 8, 1e-9);
  near('king post: top chord at the apex: N = −T cos α', st[0][st[0].length - 1].N, -st[2][0].N * Math.cos(a * Math.PI / 180), 1e-9);
  near('king post: top chord at the heel: N = −T cos α − w sin α cos α × the slope length', st[0][0].N, -st[2][0].N * Math.cos(a * Math.PI / 180) - g * s / 1000 * Math.sin(a * Math.PI / 180) * (L / 2 / Math.cos(a * Math.PI / 180)), 1e-9);
  near('king post: the post is unloaded without a ceiling load', Math.abs(st[4][0].N), 0, 0, 1e-6);
  // with a ceiling load the post carries the bottom chord's mid-span reaction: 2 × 5/8 w L/2 for a chord continuous over it
  const Dc = TF.design({ ...TRUSS, geom: { kind: 'truss', type: 'kingpost', L, pitch: a, joints: 'pinned' }, sw: false, actions: { gCeil: 1 } });
  near('king post, ceiling load, pinned chord halves: the post carries w L / 2 in tension', Dc.actions.G.st[4][0].N, 1 * s / 1000 * L / 2, 1e-9); }

// ---------- 3. Pratt and Howe: which webs are in tension under gravity ----------
for (const [tag, kind, type] of [['pitched Pratt', 'truss', 'pratt'], ['pitched Howe', 'truss', 'howe'], ['parallel-chord Pratt', 'flat', 'pratt'], ['parallel-chord Howe', 'flat', 'howe']]) {
  const D = TF.design({ ...TRUSS, geom: { kind, type, L: 9000, pitch: 25, n: 6, depth: 900, joints: 'pinned' }, actions: { gRoof: 1 }, sw: false });
  const diag = D.G.members.map((m, mi) => ({ m, mi })).filter(o => o.m.grp === 'web' && Math.abs(D.G.nodes[o.m.i].x - D.G.nodes[o.m.j].x) > 1);
  const t = diag.filter(o => D.actions.G.st[o.mi][0].N > 1).length, c = diag.filter(o => D.actions.G.st[o.mi][0].N < -1).length;
  truth(`${tag}: the diagonals are in ${type === 'pratt' ? 'tension' : 'compression'} under gravity (${t} in tension, ${c} in compression)`, type === 'pratt' ? t === diag.length : c === diag.length);
}

// ---------- 4. the member checks restated from EC5 6.1-6.3 for the governing station of each group ----------
function restate(D, mm) {
  const M = D.M, sz = mm.sz, A = sz.b * sz.h, W = sz.b * sz.h ** 2 / 6, km = mm.r.c.kmod * D.ksys / M.gM;
  const kh = h => M.kind === 'solid' ? (h < 150 ? Math.min((150 / h) ** 0.2, 1.3) : 1) : (h < 600 ? Math.min((600 / h) ** 0.1, 1.1) : 1);
  const lam = (lef, d) => lef * Math.sqrt(12) / d / Math.PI * Math.sqrt(M.fc0k / M.E005), bc = M.kind === 'solid' ? 0.2 : 0.1;
  const kcOf = lr => { const k = 0.5 * (1 + bc * (lr - 0.3) + lr * lr); return lr <= 0.3 ? 1 : 1 / (k + Math.sqrt(k * k - lr * lr)); };
  const lry = lam(mm.lefY, sz.h), lrz = lam(mm.lefZ, sz.b), kcy = kcOf(lry), kcz = kcOf(lrz);
  const scrit = M.kind === 'solid' ? 0.78 * sz.b ** 2 * M.E005 / (sz.h * mm.lefZ) : null;
  const fmd = kh(sz.h) * M.fmk * km, fcd = M.fc0k * km, ftd = kh(Math.max(sz.b, sz.h)) * M.ft0k * km, fvd = M.fvk * km;
  const p = mm.p, sm = Math.abs(p.M) / W, u = {};
  if (p.N < 0) { const sc = -p.N / A; if (lry <= 0.3 && lrz <= 0.3) { u.cy = (sc / fcd) ** 2 + sm / fmd; u.cz = (sc / fcd) ** 2 + 0.7 * sm / fmd; } else { u.cy = sc / (kcy * fcd) + sm / fmd; u.cz = sc / (kcz * fcd) + 0.7 * sm / fmd; } }
  else u.t = p.N / A / ftd + sm / fmd;
  if (scrit) { const lm = Math.sqrt(M.fmk / scrit), kcr = lm <= 0.75 ? 1 : lm <= 1.4 ? 1.56 - 0.75 * lm : 1 / lm ** 2; if (kcr < 1 && sm > 0) u.ltb = p.N < 0 ? (sm / (kcr * fmd)) ** 2 + -p.N / A / (kcz * fcd) : sm / (kcr * fmd); }
  u.v = 1.5 * Math.abs(p.V) / (0.67 * A) / fvd;
  return { u, kcy, kcz };
}
for (const tag of ['Fink, chords continuous', 'Howe, 6 panels', 'parallel-chord Pratt', 'portal, pinned bases']) {
  const D = designs[tag];
  for (const g of D.used) {
    const mm = D.members.filter(m => m.grp === g).reduce((a, b) => (b.util > a.util ? b : a)), R = restate(D, mm);
    near(`${tag}, ${D.GROUPS[g].toLowerCase()}: k_c,y`, mm.BY.kc, R.kcy, 1e-12); near(`${tag}, ${D.GROUPS[g].toLowerCase()}: k_c,z`, mm.BZ.kc, R.kcz, 1e-12);
    near(`${tag}, ${D.GROUPS[g].toLowerCase()}: governing utilisation (${mm.key}) restated from EC5`, mm.util, Math.max(...Object.values(R.u)), 1e-9);
  }
}

// ---------- 5. combinations ----------
{ const D = designs['Fink, chords continuous'];
  truth('EN 1991-1-1 3.3.2: the roof imposed load is never combined with snow or wind', D.combos.every(r => !(r.f.Qr && (r.f.S || r.f.W))));
  const km = name => D.combos.find(r => r.name === name)?.c.kmod;
  truth('k_mod by the shortest action: G 0.6, Qc (A, medium) 0.8, Qr (H, short) and S 0.9, W 1.1 (service class 2)', km('1.35G') === 0.6 && km('1.35G + 1.5Qc') === 0.8 && km('1.35G + 1.5Qr') === 0.9 && km('1.35G + 1.5S') === 0.9 && km('1.35G + 1.5W') === 1.1);
  truth('wind suction on both slopes lifts the roof: 1.0G + 1.5W is checked and W is not combined with the downward actions', !!D.combos.find(r => r.name === '1.0G + 1.5W') && D.combos.every(r => !(r.f.W && (r.f.S || r.f.Qc))));
  const R = D.reactions[0].by;
  const tot = k => D.cases[k].udl.reduce((s, q) => { const m = D.G.members[q.member], a = D.G.nodes[m.i], b = D.G.nodes[m.j]; return s + q.wy * Math.hypot(b.x - a.x, b.y - a.y); }, 0);
  for (const k of Object.keys(D.cases)) near(`Fink: the vertical reactions of ${k} balance its load`, D.reactions.reduce((s, r) => s + r.by[k].y, 0), -tot(k), 1e-9, 1e-6);
  truth('Fink: wind suction gives upward reactions (negative)', D.reactions.every(r => r.by.W.y < 0)); }

// ---------- 6. deflection by superposition ----------
{ const D = designs['king post'], kd = D.kdef, uy = (k, i) => D.actions[k] ? -D.actions[k].u[3 * i + 1] : 0, N = D.G.nodes.length;
  const best = f => Math.max(...[...Array(N).keys()].map(i => Object.entries(f).reduce((s, [k, v]) => s + v * uy(k, i), 0)));
  const inst = Math.max(best({ G: 1 }), best({ G: 1, Qr: 1, Qc: 0.7 }), best({ G: 1, Qc: 1, Qr: 0.7 }), best({ G: 1, Qc: 1, S: 0.5 }), best({ G: 1, S: 1, Qc: 0.7 }));
  const fin = Math.max(best({ G: 1 + kd }), best({ G: 1 + kd, Qr: 1, Qc: 0.7 + 0.3 * kd }), best({ G: 1 + kd, Qc: 1 + 0.3 * kd, Qr: 0.7 }), best({ G: 1 + kd, Qc: 1 + 0.3 * kd, S: 0.5 }), best({ G: 1 + kd, S: 1, Qc: 0.7 + 0.3 * kd }));
  near('king post: w_inst, characteristic, the worst leading action', D.inst.val, inst, 1e-9);
  near('king post: w_net,fin = u_G(1 + k_def) + u_Q1(1 + ψ2 k_def) + Σ u_Qi(ψ0 + ψ2 k_def)', D.fin.val, fin, 1e-9); }

// ---------- 7. portals: the imperfection, alpha_cr and second order ----------
{ const D = designs['portal, pinned bases'];
  near('portal: φ = 0.005 √(5/h), h to the apex 5.06 m', D.phi, 0.005 * Math.sqrt(5 / (D.H / 1000)), 1e-12);
  truth('portal: every gravity combination both ways (φ → and φ ←)', D.combos.filter(r => !r.f.W).length === 2 * D.combos.filter(r => !r.f.W && r.name.includes('→')).length);
  const sw = designs['portal, pinned bases'].actions.W.u, e = D.G.members.filter(m => m.grp === 'col').map(m => m.j);
  near('portal: eaves sway under the characteristic wind', D.sway.dx, Math.max(...e.map(i => Math.abs(sw[3 * i]))), 1e-12); }
// alpha_cr (and second order) against 2D Frame Analysis (Euler-verified) on the same frame, E_d = E_0,mean / γ_M, the same
// factored loads and the same sway forces φ × the vertical load at each joint
function portalVsFA(tag, base, combo, tolM) {
  const D = TF.design(base), M = D.M, Ed = M.E0mean / M.gM, r = D.combos.find(x => x.name.startsWith(combo) && x.name.includes('→')), f = r.f;
  const loads = [], v = new Array(D.G.nodes.length).fill(0);
  for (const [k, fac] of Object.entries(f)) if (fac && D.cases[k]) for (const q of D.cases[k].udl) {
    const m = D.G.members[q.member], a = D.G.nodes[m.i], b = D.G.nodes[m.j], L = Math.hypot(b.x - a.x, b.y - a.y);
    if (q.wy) loads.push({ case: 'U', type: 'udl', member: 'm' + q.member, w1: q.wy * fac, w2: '', a: 0, b: '', dir: 'GY' });
    if (q.wx) loads.push({ case: 'U', type: 'udl', member: 'm' + q.member, w1: q.wx * fac, w2: '', a: 0, b: '', dir: 'GX' });
    v[m.i] += (q.wy || 0) * fac * L / 2; v[m.j] += (q.wy || 0) * fac * L / 2; }
  v.forEach((x, i) => { if (x && !D.G.nodes[i].sup) loads.push({ case: 'U', type: 'node', node: 'n' + i, Fx: D.phi * Math.abs(x) / 1e3, Fy: 0, Mz: 0 }); });
  const model = { nodes: D.G.nodes.map((p, i) => ({ id: 'n' + i, x: p.x / 1000, y: p.y / 1000, sup: p.sup ? { ux: 'f', uy: 'f', ...(p.sup.rz ? { rz: 'f' } : {}) } : {} })),
    members: D.G.members.map((m, mi) => { const z = D.sizes[m.grp]; return { id: 'm' + mi, i: 'n' + m.i, j: 'n' + m.j, sec: { A: z.b * z.h / 100, I: z.b * z.h ** 3 / 12 / 1e4, E: Ed / 1000, mass: 0 } }; }),
    cases: [{ id: 'U', name: 'U', type: 'G', selfWeight: false }], loads, combos: [{ id: 'C', name: 'C', kind: 'ULS', f: { U: 1 } }] };
  const A = FA.analyse(model, { acr: true, second: r.second }).combos.C;
  near(`${tag}: α_cr = 2D Frame Analysis with E_d (to 1 %: six elements a member here, one there)`, r.acr, A.acr, 1e-2);
  const kn = mi => r.st[mi][r.st[mi].length - 1].M / 1e6, knA = mi => A.members['m' + mi].st[A.members['m' + mi].st.length - 1].M;
  near(`${tag}: knee moment, left (${r.second ? 'second order' : 'first order'})`, Math.abs(kn(0)), Math.abs(knA(0)), tolM);
  near(`${tag}: knee moment, right`, Math.abs(kn(3)), Math.abs(knA(3)), tolM);
  return { D, r };
}
portalVsFA('flat fixed-base portal', { ...PORTAL, geom: { kind: 'portal', L: 10000, he: 5000, pitch: 0, base: 'fixed' } }, '1.35G + 1.5Qr', 1e-6);
portalVsFA('pitched pinned-base portal', { ...PORTAL, geom: { kind: 'portal', L: 12000, he: 4000, pitch: 10, base: 'pinned' } }, '1.35G + 1.5S', 1e-6);
// second order: 2D Frame Analysis takes one element a member in its geometric stiffness, this engine six, which follow a
// member's own curvature (P-δ) more closely; on a slender frame (α_cr about 4) the two agree to a few per cent
const SLENDER = { ...PORTAL, sizes: { raf: { b: 90, h: 450 }, col: { b: 90, h: 405 } }, actions: { gRoof: 0.75, snow: 0.6 }, geom: { kind: 'portal', L: 12000, he: 5500, pitch: 5, base: 'pinned' } };
portalVsFA('slender pinned-base portal', SLENDER, '1.35G + 1.5S', 0.05);
// a slender portal goes to second order, and its knee moment grows by about 1/(1 − 1/α_cr)
{ const base = SLENDER;
  const D = TF.design(base), r = D.combos.find(x => x.name.startsWith('1.35G + 1.5S') && x.name.includes('→'));
  truth(`slender pinned-base portal: α_cr ${r.acr.toFixed(2)} < 10 and second order used`, r.acr < 10 && r.second);
  // the same combination to first order: the sway (antisymmetric) part of the knee moment is amplified by about 1/(1 − 1/α_cr)
  const knee = st => st[0][st[0].length - 1].M, kneeR = st => st[3][st[3].length - 1].M;
  const D1 = TF.design({ ...base, mat: { family: 'other', props: { ...D.M, name: 'stiff', E0mean: D.M.E0mean * 50, E005: D.M.E005, gM: D.M.gM } } });
  truth('... a much stiffer frame stays first order', D1.combos.every(x => !x.second));
  const kl = Math.abs(knee(r.st)) / 1e6, kr = Math.abs(kneeR(r.st)) / 1e6;
  truth(`... the sway imperfection, amplified, makes the knees unequal (${kl.toFixed(2)} and ${kr.toFixed(2)} kNm)`, Math.abs(kr - kl) > 0.02 * (kl + kr) / 2); }

// ---------- 8. errors ----------
throws('a zero span is refused', () => TF.design({ ...TRUSS, geom: { kind: 'truss', type: 'fink', L: 0, pitch: 30 } }), /span/);
throws('a pitch of 60° or more is refused', () => TF.design({ ...TRUSS, geom: { kind: 'truss', type: 'fink', L: 8000, pitch: 65 } }), /pitch/);
throws('a missing size is refused', () => TF.design({ ...TRUSS, sizes: { top: { b: 47, h: 125 }, bot: { b: 47 } }, geom: { kind: 'truss', type: 'fink', L: 8000, pitch: 30 } }), /Bottom chord/);
throws('an unstable portal is refused', () => TF.design({ ...PORTAL, sizes: { raf: { b: 45, h: 95 }, col: { b: 45, h: 95 } }, geom: { kind: 'portal', L: 12000, he: 4000, pitch: 10, base: 'pinned' } }), /unstable|mechanism/);
console.log(`\n${n - fails}/${n} timber frame checks passed`);
process.exit(fails ? 1 : 0);
