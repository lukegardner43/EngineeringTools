// RC 2D Frame engine checks: The Concrete Centre TCC21 sub-frames (50 random sub-frames, outputs only), the frame against
// the exact slope-deflection sub-frame of RC Beam Analysis & Design, equilibrium, a portal by hand, the frame imperfection,
// symmetry, the effective-length k by hand, the columns against the RC Wall section model (and, with jsdom on NODE_PATH,
// against the RC Column Design page), Suggest, and input errors.
const { RCFrame, RCBeam, Wall } = require('./load');
const REF = require('./ref_tcc21.json');
let n = 0, fails = 0;
const ok = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } };
const near = (name, a, b, tol = 1e-9, scale = 1) => ok(name, Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(scale, Math.abs(b)), `got ${a}, want ${b}`);
const throws = (name, f, re) => { let e = null; try { f(); } catch (x) { e = x; } ok(name, !!e && (!re || re.test(e.message)), e ? e.message : 'no error'); };
const kNm = v => v / 1e6, kN = v => v / 1e3;

// ---------- TCC21 ----------
// Set aside: TCC21 distributes moments by a fixed number of cycles, so its error grows along long beams (up to about 2 %
// at the far end of six spans; the frame here equals the exact solution, checked below); its SLS sheet always includes the
// adjacent-span patterns and takes span 1's imposed point load for the point loads of spans 2 to 6 (Sls!E9:F9), so SLS is
// compared against a run with adjacent patterns and only where that does not arise; for one span its minimum imposed
// reaction includes the 'even spans' pattern, which loads nothing. The column below / above is the sub-frame's.
const COLS = 'DEFGHIJ';
const dim = ([B, H]) => ({ b: B, h: H });
const tccInput = (c, adj) => ({ mode: 'sub', spans: c.spans, beam: { h: c.h, bw: c.bw, hf: c.hf, shape: c.shape, beffs: c.beffs }, bay: c.bay / 1000,
  sub: { below: { H: c.Hb, far: c.farB, edge: dim(c.ce), int: dim(c.ci) }, above: c.Ha > 0 ? { H: c.Ha, far: c.farA, edge: dim(c.ceA), int: dim(c.ciA) } : null },
  fck: 30, fyk: 500, selfWeight: 'none', colSelfWeight: false, rigidAxial: true, adjacent: adj, redist: 'limited', delta: c.delta,
  sets: [{ gG: c.out['MAIN!J13'], gQ: c.out['MAIN!K14'], label: c.out['MAIN!J11'] }],
  loads: c.loads.map(l => ({ level: 1, span: l.span, type: l.type, G: l.G, Q: l.Q, a: l.a, b: l.b })), cover: { top: 35, btm: 35 } });
REF.cases.forEach((c, k) => {
  const O = c.out, tag = `TCC21 #${k + 1} (${c.n} span${c.n > 1 ? 's' : ''})`, tol = c.n >= 6 ? 3.5e-2 : 5e-3;
  const An = RCFrame.analyse(tccInput(c, false)), bi = RCFrame.beamInput(An, 0, null), A = RCBeam.analyse(bi), P = A.P;
  const A2 = RCBeam.analyse(RCFrame.beamInput(RCFrame.analyse(tccInput(c, true)), 0, null));
  const Msc = Math.max(...A.supM.map(m => kNm(m.elastic)), ...A.spanM.map(m => kNm(m.elastic)));
  const Vsc = Math.max(...A.env.map(e => Math.max(...e.VmaxE.map(Math.abs), ...e.VminE.map(Math.abs)))) / 1e3;
  const q1 = c.loads.some(l => l.type === 'point' && l.span === 0 && l.Q > 0), slsOK = !c.loads.some(l => l.type === 'point' && l.span > 0 && (l.Q > 0 || q1));
  const slsMax = (arr, j) => { let m = 0; for (const s of arr) { if (j > 0) m = Math.max(m, s.hog[j - 1][1]); if (j < c.n) m = Math.max(m, s.hog[j][0]); } return m; };
  for (let j = 0; j <= c.n; j++) {
    const col = COLS[j];
    near(`${tag} support ${j + 1}: elastic M`, kNm(A.supM[j].elastic), O[`ACTIONS!${col}25`], tol, Msc);
    near(`${tag} support ${j + 1}: redistributed M`, kNm(A.supM[j].redist), O[`ACTIONS!${col}26`], tol, Msc);
    if (slsOK) { near(`${tag} support ${j + 1}: characteristic M`, kNm(slsMax(A2.sls.k, j)), O[`ACTIONS!${col}23`], 1.5e-2, Msc); near(`${tag} support ${j + 1}: quasi-permanent M`, kNm(slsMax(A2.sls.qp, j)), O[`ACTIONS!${col}24`], 1.5e-2, Msc); }
  }
  for (let i = 0; i < c.n; i++) {
    const col = COLS[i];
    near(`${tag} span ${i + 1}: elastic M`, kNm(A.spanM[i].elastic), O[`ACTIONS!${col}33`], tol, Msc);
    near(`${tag} span ${i + 1}: redistributed M`, kNm(A.spanM[i].redist), O[`ACTIONS!${col}34`], tol, Msc);
    if (slsOK) { near(`${tag} span ${i + 1}: characteristic M`, kNm(A2.spanM[i].Mk), O[`ACTIONS!${col}31`], 1.5e-2, Msc); near(`${tag} span ${i + 1}: quasi-permanent M`, kNm(A2.spanM[i].Mqp), O[`ACTIONS!${col}32`], 1.5e-2, Msc); }
    const e = A.env[i], last = e.x.length - 1, row = i < 3 ? [52, 53] : [56, 57], cL = 'DFH'[i % 3], cR = 'EGI'[i % 3];
    near(`${tag} span ${i + 1}: elastic shear, left`, kN(Math.max(Math.abs(e.VmaxE[0]), Math.abs(e.VminE[0]))), O[`ACTIONS!${cL}${row[0]}`], tol, Vsc);
    near(`${tag} span ${i + 1}: elastic shear, right`, kN(Math.max(Math.abs(e.VmaxE[last]), Math.abs(e.VminE[last]))), O[`ACTIONS!${cR}${row[0]}`], tol, Vsc);
    near(`${tag} span ${i + 1}: redistributed shear, left`, kN(Math.max(Math.abs(e.Vmax[0]), Math.abs(e.Vmin[0]))), O[`ACTIONS!${cL}${row[1]}`], tol, Vsc);
    near(`${tag} span ${i + 1}: redistributed shear, right`, kN(Math.max(Math.abs(e.Vmax[last]), Math.abs(e.Vmin[last]))), O[`ACTIONS!${cR}${row[1]}`], tol, Vsc);
  }
  const all = An.B.combos.find(cb => cb.pat.key === 'all');
  const Csc = Math.max(...[60, 61, 62, 63].flatMap(r => COLS.split('').map(col => Math.abs(+O[`ACTIONS!${col}${r}`] || 0))));
  for (let j = 0; j <= c.n; j++) {
    const col = COLS[j], E = An.ends(all.f), up = E[`c1_${j}`], lo = E[`c0_${j}`];
    const mx = id => Math.max(...An.B.combos.map(cb => { const e = An.ends(cb.f)[id]; return id.startsWith('c1') ? Math.abs(e[2]) : Math.abs(e[5]); }));
    if (up) { near(`${tag} support ${j + 1}: column above, all spans`, Math.abs(up[2]), Math.abs(O[`ACTIONS!${col}60`]), tol, Csc); near(`${tag} support ${j + 1}: column above, largest`, mx(`c1_${j}`), O[`ACTIONS!${col}62`], tol, Csc); }
    near(`${tag} support ${j + 1}: column below, all spans`, Math.abs(lo[5]), Math.abs(O[`ACTIONS!${col}61`]), tol, Csc); near(`${tag} support ${j + 1}: column below, largest`, mx(`c0_${j}`), O[`ACTIONS!${col}63`], tol, Csc);
  }
  // reactions: ULS with the redistributed moments (as TCC21), characteristic ones elastic
  const reac = f => { const E = An.ends(f), hog = bi.spans.map((_, i) => { const e = E[An.B.G.levels[0].mem[i].id]; return [e[2] * 1e6, -e[5] * 1e6]; });
    const loads = A.raw.map((r, i) => [...r.G.map(l => ({ ...l, w: (l.w || 0) * (f.G || 0), P: (l.P || 0) * (f.G || 0) })), ...r.Q.map(l => ({ ...l, w: (l.w || 0) * (f[`Q0_${i}`] || 0), P: (l.P || 0) * (f[`Q0_${i}`] || 0) }))]);
    return RCBeam.reactions(P, loads, hog).map(kN); };
  const U = A.cases.filter(cs => cs.uls), Rall = U.find(cs => cs.key.includes('|all')).RR.map(kN), Ruls = U.map(cs => cs.RR.map(kN)), Rg = reac({ G: 1 });
  const qPat = An.B.pats.map(pt => { const f = {}; for (let i = 0; i < c.n; i++) if (pt.on(0, i)) f[`Q0_${i}`] = 1; return reac(f); });
  const Rsc = Math.max(...Ruls.flat().map(Math.abs));
  for (let j = 0; j <= c.n; j++) {
    const col = COLS[j];
    near(`${tag} support ${j + 1}: reaction, all spans`, Rall[j], O[`MAIN!${col}55`], 2e-3, Rsc);
    near(`${tag} support ${j + 1}: reaction, largest ULS`, Math.max(...Ruls.map(r => r[j])), O[`MAIN!${col}56`], 2e-3, Rsc);
    near(`${tag} support ${j + 1}: reaction, characteristic G`, Rg[j], O[`MAIN!${col}57`], 2e-3, Rsc);
    near(`${tag} support ${j + 1}: reaction, imposed max`, Math.max(...qPat.map(r => r[j])), O[`MAIN!${col}58`], 2e-3, Rsc);
    near(`${tag} support ${j + 1}: reaction, imposed min`, Math.min(...qPat.map(r => r[j]), ...(c.n === 1 ? [0] : [])), O[`MAIN!${col}59`], 2e-3, Rsc);
  }
});

// ---------- the frame against RC Beam's exact sub-frame (slope-deflection, no axial shortening) ----------
let seed = 7919; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
for (let k = 0; k < 40; k++) {
  const nS = pick([1, 2, 3, 4, 5]), spans = Array.from({ length: nS }, () => pick([4, 5, 6, 7.5, 8])), shape = pick(['T', 'L', 'R']);
  const beam = { h: pick([400, 450, 500, 600]), bw: pick([250, 300, 350]), hf: shape === 'R' ? 0 : pick([125, 150, 200]), shape };
  const ce = { b: pick([250, 300]), h: pick([250, 300, 350]) }, ci = { b: pick([300, 350, 400]), h: pick([300, 400, 450]) }, cL = nS > 1 && rnd() < 0.25 ? pick([1, 1.5, 2]) : 0, cR = nS > 1 && rnd() < 0.25 ? pick([1, 1.5]) : 0;
  const inp = { mode: 'sub', spans, cantL: cL, cantR: cR, beam, bay: pick([5, 6, 7.5]), sub: { below: { H: pick([3, 3.5, 4]), far: pick(['F', 'P']), edge: ce, int: ci }, above: rnd() < 0.8 ? { H: pick([3, 3.5]), far: pick(['F', 'P']), edge: ce, int: ci } : null },
    fck: 30, selfWeight: 'none', colSelfWeight: false, rigidAxial: true, rule: pick(['6.10', '6.10ab']), adjacent: rnd() < 0.4, redist: 'limited', delta: pick([1, 0.85, 0.7]),
    loads: [{ level: 'all', span: 'all', type: 'udl', G: pick([20, 30, 40]), Q: pick([10, 15, 25]) }, { level: 'all', span: cL ? 1 : 0, type: 'point', G: 30, Q: 20, a: spans[0] * 0.4 }], cover: { top: 35, btm: 35 } };
  const An = RCFrame.analyse(inp), bi = RCFrame.beamInput(An, 0, null), A = RCBeam.analyse(bi);
  const ref = RCBeam.analyse({ ...bi, caseList: undefined, slsList: undefined, solveCase: undefined, sets: An.B.sets, adjacent: inp.adjacent });
  const tag = `exact sub-frame #${k + 1}`, sc = Math.max(...ref.supM.map(m => m.elastic), ...ref.spanM.map(m => m.elastic));
  ok(`${tag}: same cases`, A.cases.length === ref.cases.length);
  A.supM.forEach((m, j) => { near(`${tag} support ${j + 1} elastic`, m.elastic, ref.supM[j].elastic, 1e-3, sc); near(`${tag} support ${j + 1} redistributed`, m.redist, ref.supM[j].redist, 1e-3, sc); });
  A.spanM.forEach((m, i) => { near(`${tag} span ${i + 1}`, m.redist, ref.spanM[i].redist, 1e-3, sc); near(`${tag} span ${i + 1} M_k`, m.Mk, ref.spanM[i].Mk, 1e-3, sc); near(`${tag} span ${i + 1} M_qp`, m.Mqp, ref.spanM[i].Mqp, 1e-3, sc); });
}

// ---------- multi-storey frames: equilibrium, the imperfection, no redistribution when unbraced ----------
const beam = { h: 500, bw: 300, hf: 150, shape: 'T' }, edge = { b: 300, h: 300 }, int = { b: 350, h: 350 };
const base = { mode: 'frame', spans: [6, 7.5, 6], cantL: 0, cantR: 1.5, bay: 6, storeys: [4, 3.5, 3.5, 3.5].map(H => ({ H, beam, edge, int })), base: 'F',
  fck: 32, fyk: 500, cover: { top: 35, btm: 35 }, coverCol: 35, selfWeight: 'downstand', rule: '6.10ab', chequer: true, redist: 'limited', delta: 0.85,
  loads: [{ level: 'all', span: 'all', type: 'udl', G: 30, Q: 12 }, { level: 4, span: 'all', type: 'udl', G: -10, Q: -6 }, { level: 1, span: 1, type: 'point', G: 40, Q: 25, a: 3 }] };
const wind = [25, 22, 22, 12];
{
  const Ab = RCFrame.analyse({ ...base, braced: true }), Au = RCFrame.analyse({ ...base, braced: false, wind });
  for (const [nm, An] of [['braced', Ab], ['unbraced', Au]]) {
    const B = An.B, VG = B.G.levels.reduce((t, L) => t + L.VG, 0), rG = An.reac({ G: 1 });
    near(`${nm}: ΣR_y = Σ permanent load`, Object.values(rG).reduce((t, r) => t + r[1], 0), VG, 1e-9);
    const q = {}; B.G.levels.forEach((L, li) => L.spans.forEach((_, i) => { q[`Q${li}_${i}`] = 1; }));
    near(`${nm}: ΣR_y = Σ imposed load`, Object.values(An.reac(q)).reduce((t, r) => t + r[1], 0), B.G.levels.reduce((t, L) => t + L.VQ.reduce((a, b) => a + b, 0), 0), 1e-9);
  }
  near('unbraced: ΣR_x = −Σ wind', Object.values(Au.reac({ W: 1 })).reduce((t, r) => t + r[0], 0), -wind.reduce((a, b) => a + b, 0), 1e-9);
  ok('braced: no wind cases or imperfection forces', !Ab.B.hasW && !Ab.B.imperf && Ab.B.combos.every(cb => !cb.wind));
  const H = 14.5, aH = Math.min(1, Math.max(2 / 3, 2 / Math.sqrt(H))), aM = Math.sqrt(0.5 * (1 + 1 / 4));
  near('θ_i = α_h α_m / 200 (5.2(5)): α_h = 2/√l, α_m = √(0.5(1 + 1/m)), m = 4 columns', Au.B.thetaI, aH * aM / 200, 1e-12);
  const cb = Au.B.combos.find(c => c.key === '6.10b|all|→'), V = Au.B.G.levels.map((L, li) => cb.f.G * L.VG + L.spans.reduce((t, _, i) => t + (cb.f[`Q${li}_${i}`] || 0) * L.VQ[i], 0));
  V.forEach((v, li) => near(`imperfection force at floor ${li + 1} = θ_i × the floor's vertical load`, cb.f[`H${li}`], Au.B.thetaI * v, 1e-12));
  ok('imperfection both ways in the gravity combinations', Au.B.combos.some(c => c.key === '6.10b|all|←' && c.f.H0 < 0));
  ok('wind both ways, wind leading and with favourable permanent load', ['→', '←'].every(d => Au.B.combos.some(c => c.wind && c.key.endsWith(d))) && Au.B.combos.some(c => c.wind && c.set.gG === 1 && c.set.gQ === 0 && Math.abs(c.f.W) === 1.5));
  const Bu = RCFrame.beams(Au, null);
  ok('unbraced: no redistribution', Bu.every(b => b.A.supM.every(m => Math.abs(m.redist - m.elastic) < 1e-6 * Math.max(1, m.elastic))));
  const Bb = RCFrame.beams(Ab, null);
  ok('braced: internal supports redistributed to δ = 0.85', Bb.every(b => b.A.supM.slice(1, 3).every(m => Math.abs(m.redist / m.elastic - 0.85) < 1e-9)));
  ok('chequerboard patterns in a multi-storey frame', Ab.B.pats.some(p => p.key === 'chq1') && Ab.B.pats.some(p => p.key === 'chq2'));
}
// ---------- a portal by hand: rigid beam, fixed bases, H at the top -> each column end H h/4 ----------
{
  const P = RCFrame.analyse({ mode: 'frame', spans: [6], bay: 6, storeys: [{ H: 4, beam: { h: 4000, bw: 2000, hf: 0, shape: 'R' }, edge: { b: 300, h: 300 }, int: { b: 300, h: 300 } }], base: 'F', braced: false, wind: [100], imperf: false,
    fck: 32, selfWeight: 'none', colSelfWeight: false, loads: [], cover: { top: 35, btm: 35 } });
  const E = P.ends({ W: 1 });
  for (const id of ['c0_0', 'c0_1']) { near(`portal ${id}: base moment H h / 4`, Math.abs(E[id][2]), 100 * 4 / 4, 0.02); near(`portal ${id}: top moment H h / 4`, Math.abs(E[id][5]), 100 * 4 / 4, 0.02); near(`portal ${id}: shear H / 2`, Math.abs(E[id][1]), 50, 1e-4); }
}
// ---------- symmetry: a symmetric braced frame under symmetric load ----------
{
  const An = RCFrame.analyse({ ...base, spans: [6, 7.5, 6], cantR: 0, braced: true, loads: [{ level: 'all', span: 'all', type: 'udl', G: 30, Q: 12 }] }), E = An.ends(An.B.combos[0].f);
  for (let s = 0; s < 4; s++) { near(`symmetry: storey ${s + 1} edge column moments`, E[`c${s}_0`][5], -E[`c${s}_3`][5], 1e-9, 1); near(`symmetry: storey ${s + 1} internal column moments`, E[`c${s}_1`][5], -E[`c${s}_2`][5], 1e-9, 1); }
}
// ---------- a braced one-storey frame is the sub-frame with no columns above ----------
{
  const common = { spans: [5, 6, 5], bay: 5, fck: 30, selfWeight: 'downstand', loads: [{ level: 'all', span: 'all', type: 'udl', G: 25, Q: 10 }], cover: { top: 30, btm: 30 }, redist: 'limited', delta: 0.8 };
  const bm = { h: 450, bw: 300, hf: 125, shape: 'T' }, e1 = { b: 300, h: 300 }, i1 = { b: 350, h: 350 };
  const Fr = RCFrame.beams(RCFrame.analyse({ ...common, mode: 'frame', storeys: [{ H: 3.5, beam: bm, edge: e1, int: i1 }], base: 'F', braced: true }), null)[0];
  const Sb = RCFrame.beams(RCFrame.analyse({ ...common, mode: 'sub', beam: bm, sub: { below: { H: 3.5, far: 'F', edge: e1, int: i1 }, above: null } }), null)[0];
  Fr.A.supM.forEach((m, j) => near(`one storey = sub-frame: support ${j + 1}`, m.redist, Sb.A.supM[j].redist, 1e-12, 1));
  Fr.A.spanM.forEach((m, i) => near(`one storey = sub-frame: span ${i + 1}`, m.redist, Sb.A.spanM[i].redist, 1e-12, 1));
}
// ---------- effective length: k by hand at an internal joint (5.8.3.2(3)-(5)) ----------
{
  const An = RCFrame.analyse({ ...base, braced: true }), G = An.B.G, m = G.members.find(q => q.id === 'c1_1');
  const L = G.levels.find(q => q.l === 2), Ib = L.P0.spans[0].I, Ib2 = L.P0.spans[1].I, EIl = (b, h, H) => b * h ** 3 / 12 / H;
  const want = (EIl(350, 350, 3500) + EIl(350, 350, 3500)) / (2 * 0.5 * (Ib / 6000 + Ib2 / 7500));
  near('k at the top of an internal column: columns above and below over 2 × 0.5 EI/L of the beams', RCFrame.jointK(An, m, 'top').k, want, 1e-12);
  const Bot = RCFrame.jointK(An, G.members.find(q => q.id === 'c0_1'), 'bot');
  ok('k = 0.1 at a fixed base', Bot.k === 0.1);
  const Au = RCFrame.analyse({ ...base, braced: false, wind });
  near('unbraced: beams count 6EI/L', RCFrame.jointK(Au, m, 'top').k, Math.max(0.1, want * 2 / 6), 1e-12);
  const C = RCFrame.columns(An, null).find(c => c.id === 'c1_1');
  near('l₀ in the plane by (5.15)', C.l0in, Wall.effLength(3500 - 500, true, C.k1.k, C.k2.k, false), 1e-12);
  near('clear height: storey less the beam depth', C.l, 3000, 1e-12);
}
// ---------- columns: the axis check against the RC Wall section model (per metre, two faces of bars) ----------
for (let k = 0; k < 40; k++) {
  const h = pick([150, 200, 250, 300]), s = pick([100, 150, 200]), pv = pick([10, 12, 16, 20]), cov = pick([25, 30, 40]), fck = pick([25, 30, 32, 40]), l = pick([2500, 3500, 4500]), braced = k % 4 !== 3;
  const NEd = Math.round(1000 * h * 0.85 * fck / 1.5 * (0.05 + 0.6 * rnd()) / 1000), Mt = Math.round(rnd() * 0.08 * NEd * h / 1000 * 10) / 10, Mb = pick([Mt, -Mt * 0.5, 0, -Mt]), k1 = pick([0.1, 0.5, 1, 2]), k2 = pick([0.1, 0.5, 1, 2]), phief = pick([1, 1.5, 2]);
  const R = Wall.panel({ h, l, fck, fyk: 500, cover: cov, phiV: pv, sV: s, phiH: 8, sH: 200, NEd, Mtop: Mt, Mbot: Mb, braced, k1, k2, phief, eimode: 'ah', hOutside: false });
  const d2 = cov + pv / 2, S = { b: 1000, h, fcd: 0.85 * fck / 1.5, fyd: 500 / 1.15, layers: [{ d: d2, A: Math.PI * pv * pv / 4 * 1000 / s }, { d: h - d2, A: Math.PI * pv * pv / 4 * 1000 / s }] };
  const r = RCFrame.colAxis(S, { NEd, Mtop: Mt, Mbot: Mb, l, l0: R.l0, braced, phief, fck, addImp: true, nbalPk: Wall.nPeak(S) });
  const tag = `column axis vs wall panel #${k + 1}`;
  near(`${tag}: λ_lim`, r.lambdaLim, R.lambdaLim, 1e-12); near(`${tag}: M₂`, r.M2, R.M2, 1e-9, 1); near(`${tag}: M_Ed`, r.MEd, R.MEd, 1e-12); near(`${tag}: M_Rd`, r.MRd, R.MRd, 1e-12);
}
// ---------- columns against the RC Column Design page (needs jsdom on NODE_PATH) ----------
let colPage = null; try { colPage = require('../rc-column/load.js'); } catch (e) { console.log('(jsdom not found: the RC Column Design page comparison is skipped)'); }
if (colPage) {
  const w = colPage.load(); w.eval('fcd = function(f){ return 0.85*f/1.5; }');
  for (let k = 0; k < 30; k++) {
    const b = pick([300, 350, 400, 500]), h = pick([300, 400, 500, 600]), phi = pick([16, 20, 25]), nb = pick([2, 3, 4]), nh = pick([2, 3, 4]), cov = pick([30, 35, 40]), lk = 8, fck = pick([30, 32, 40]), l = pick([3000, 3500, 4500, 6000]), braced = k % 3 !== 2;
    const d2 = cov + lk + phi / 2; if ((b - 2 * d2) / Math.max(1, nb - 1) - phi < 25 || (h - 2 * d2) / Math.max(1, nh - 1) - phi < 25) continue;
    const S = { ...RCFrame.colLayers({ b, h }, { phi, nb, nh }, d2, 'in'), fcd: 0.85 * fck / 1.5, fyd: 500 / 1.15 }, So = { ...RCFrame.colLayers({ b, h }, { phi, nb, nh }, d2, 'out'), fcd: 0.85 * fck / 1.5, fyd: 500 / 1.15 };
    const NEd = Math.round(b * h * 0.85 * fck / 1.5 * (0.05 + 0.6 * rnd()) / 1000), Mt = Math.round(rnd() * 0.1 * NEd * h / 1000 * 10) / 10, Mb = pick([Mt, -Mt * 0.5, 0, -Mt]), k1 = pick([0.1, 0.5, 1, 2]), k2 = pick([0.1, 0.5, 1, 2]), phief = pick([1.5, 2]);
    const ri = RCFrame.colAxis(S, { NEd, Mtop: Mt, Mbot: Mb, l, l0: Wall.effLength(l, braced, k1, k2, false), braced, phief, fck, addImp: true, nbalPk: Wall.nPeak(S) });
    const ro = RCFrame.colAxis(So, { NEd, Mtop: 0, Mbot: 0, l, l0: l, braced: true, phief, fck, addImp: true, nbalPk: Wall.nPeak(So) });
    const base2 = { rb: b, rh: h, rfck: fck, rfyk: 500, rcov: cov, rlink: lk, rnx: nb, rdx: phi, rny: nh, rdy: phi, ned: NEd, mtop: Mt, mbot: Mb, mtopy: 0, mboty: 0, clen: l, cleny: l, phief, mufi: 0.7, eimode: 'ah', ktop: k1, kbot: k2, ktopy: k1, kboty: k2 };
    const L1 = colPage.run(w, { ...base2, braced }), L2 = colPage.run(w, { ...base2, braced: true, pinned: true }), tag = `column vs RC Column Design #${k + 1}`;
    near(`${tag}: l₀`, ri.l0, L1.rx.l0, 1e-12); near(`${tag}: M_Ed in the plane`, ri.MEd, L1.rx.MEd, 1e-9); near(`${tag}: M_Rd in the plane`, ri.MRd, L1.McapXX, 1e-9);
    near(`${tag}: M_Ed out of the plane`, ro.MEd, L2.ry.MEd, 1e-7); near(`${tag}: M_Rd out of the plane`, ro.MRd, L2.McapYY, 1e-9);
  }
}
// ---------- Suggest: every check passes ----------
for (const [nm, inp] of [['braced', { ...base, braced: true }], ['unbraced', { ...base, braced: false, wind }], ['sub-frame', { mode: 'sub', spans: [6, 7.5, 6], bay: 5, beam: { h: 500, bw: 300, hf: 150, shape: 'T' }, sub: { below: { H: 3.75, far: 'F', edge: { b: 300, h: 300 }, int: { b: 350, h: 350 } }, above: { H: 3.5, far: 'F', edge: { b: 300, h: 300 }, int: { b: 350, h: 350 } } }, fck: 32, cover: { top: 30, btm: 30 }, loads: [{ level: 'all', span: 'all', type: 'udl', G: 35, Q: 15 }], delta: 0.85 }]]) {
  const An = RCFrame.analyse(inp), D = RCFrame.design({ ...inp, beamBars: RCFrame.suggestBeams(An), colBars: RCFrame.suggestColumns(An) });
  ok(`Suggest (${nm}): every check passes`, D.util <= 1 + 1e-9, `util ${D.util}`);
}
// ---------- input errors ----------
throws('no spans', () => RCFrame.analyse({ ...base, spans: [] }), /at least one span/);
throws('zero storey height', () => RCFrame.analyse({ ...base, storeys: [{ ...base.storeys[0], H: 0 }] }), /height/);
throws('point load beyond the span', () => RCFrame.analyse({ ...base, loads: [{ level: 1, span: 0, type: 'point', G: 10, Q: 0, a: 9 }] }), /outside span/);
throws('sub-frame without the columns below', () => RCFrame.analyse({ mode: 'sub', spans: [5], beam, sub: {}, fck: 30, loads: [], cover: { top: 30, btm: 30 } }), /columns below/);
throws('bars that do not fit the column', () => RCFrame.columns(RCFrame.analyse({ ...base, braced: true }), [{ edge: { phi: 40, nb: 2, nh: 2 }, int: { phi: 40, nb: 2, nh: 2 } }].concat([null, null, null]).map((x, k) => k === 0 ? x : null).map(x => x), m => m.storey === 0).length && RCFrame.columns(RCFrame.analyse({ ...base, braced: true, coverCol: 140 }), null), /do not fit/);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
