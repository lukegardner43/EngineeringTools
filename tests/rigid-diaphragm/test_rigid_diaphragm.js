// Rigid Diaphragm engine: against Mosley, Bungey and Hulse, Reinforced Concrete Design to Eurocode 2 (7th ed.), 3.5,
// Examples 3.6 (symmetric shear walls) and 3.7 (unsymmetric, with torsion) — published worked examples, outputs only;
// the wall stiffnesses against their closed forms; and the solver's general properties (equilibrium, a 90° turn of the
// whole plan, walls at an angle against an independent solution, the UK NA Figure NA.10 torsion cases, instability).
//   node tests/rigid-diaphragm/test_rigid_diaphragm.js
const { RigidDiaphragm: RD } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const byId = (D, id) => D.walls.find(w => w.id === id), fOf = (D, id, c = 0) => D.cases[c].f[D.walls.findIndex(w => w.id === id)];

// ---- Mosley et al. Example 3.7: F = 100 kN, relative stiffnesses A 20k, B 4k, C 6k, D 5k, E 5k (Figure 3.24) ----
// A, D, E run along Y at x = 0, 32, 40; B and C along X at y = 16 and 0; F acts in Y at x = 20.
const M37 = [{ id: 'A', dir: 'y', at: 0, from: 0, to: 16, type: 'k', k: 20 }, { id: 'B', dir: 'x', at: 16, from: 0, to: 12, type: 'k', k: 4 },
  { id: 'C', dir: 'x', at: 0, from: 8, to: 20, type: 'k', k: 6 }, { id: 'D', dir: 'y', at: 32, from: 0, to: 12, type: 'k', k: 5 }, { id: 'E', dir: 'y', at: 40, from: 0, to: 12, type: 'k', k: 5 }];
{
  const D = RD.design({ walls: M37, plan: { B: 40, D: 16 }, loads: { gamma: 1, tors: 'none', y: { F: 100, at: 20 } } });
  truth('3.7: centre of rotation x = 12.0 m', near(D.xr, 12.0, 1e-9));
  truth('3.7: centre of rotation y = 6.4 m', near(D.yr, 6.4, 1e-9));
  truth('3.7: M_t = 100 × (20 − 12) = 800 kNm', near(D.cases[0].T, 800, 1e-9));
  truth('3.7: Σk r² = 9415', near(D.J, 9414.4, 1e-6) && Math.round(D.J) === 9414);   // the book rounds 9414.4 up to 9415 in its table
  // the book's table: Pd, Pr, Pi (kN, to 0.1)
  const book = { A: [66.6, -20.4, 46.2], B: [0, -3.3, 3.3], C: [0, 3.3, 3.3], D: [16.7, 8.5, 25.2], E: [16.7, 11.9, 28.6] };
  for (const [id, [pd, pr, pi]] of Object.entries(book)) {
    const f = fOf(D, id);
    truth(`3.7: wall ${id} P_d ${pd}, P_r ${pr}, P_i ${pi}`, near(f.dir, pd, 0.08) && near(Math.abs(f.tor), Math.abs(pr), 0.05) && Math.sign(f.tor) === Math.sign(id === 'B' ? -1 : pr) && near(Math.abs(f.tot), pi, 0.08));
  }
  truth('3.7: the book’s forces sum to 100 kN', near(['A', 'D', 'E'].reduce((t, id) => t + fOf(D, id).tot, 0), 100, 1e-9) && near(fOf(D, 'B').tot + fOf(D, 'C').tot, 0, 1e-9));
  truth('3.7: the largest is A, 46.2 kN', byId(D, 'A') === D.top && near(D.top.F, 46.27, 0.01));
  truth('3.7: r about the centre of rotation as the book (12, 9.6, 6.4, 20, 28)', ['A', 'B', 'C', 'D', 'E'].map(id => Math.abs(byId(D, id).r)).every((r, i) => near(r, [12, 9.6, 6.4, 20, 28][i], 1e-9)));
}
// ---- Mosley et al. Example 3.6: symmetric walls, k ∝ h b³; A: 0.3 m × 20 m, B: 0.2 m × 12 m (Figure 3.23) ----
{
  const walls = [{ id: 'A1', dir: 'y', at: 0, from: 0, to: 20 }, { id: 'B1', dir: 'y', at: 10, from: 4, to: 16 }, { id: 'B2', dir: 'y', at: 20, from: 4, to: 16 }, { id: 'A2', dir: 'y', at: 30, from: 0, to: 20 }];
  const t = { A1: 300, A2: 300, B1: 200, B2: 200 };
  // as relative stiffnesses k = h b³ (the book), and as concrete walls in bending alone (k ∝ I = t L³/12)
  const rel = RD.design({ walls: walls.map(w => ({ ...w, type: 'k', k: (t[w.id] / 1000) * (w.to - w.from) ** 3 })), plan: { B: 30, D: 20 }, loads: { gamma: 1, tors: 'none', y: { F: 100 } } });
  const con = RD.design({ walls: walls.map(w => ({ ...w, type: 'concrete', t: t[w.id] })), global: { H: 12, shear: false, fck: 30 }, plan: { B: 30, D: 20 }, loads: { gamma: 1, tors: 'none', y: { F: 100 } } });
  truth('3.6: k_A = 0.3 × 20³ = 2400, k_B = 0.2 × 12³ = 346', near(byId(rel, 'A1').k, 2400, 1e-9) && near(byId(rel, 'B1').k, 345.6, 1e-9));
  for (const D of [rel, con]) {
    const tag = D === rel ? 'relative k' : 'concrete walls, bending only';
    truth(`3.6 (${tag}): P_A = 43.7 kN`, near(fOf(D, 'A1').tot, 43.7, 0.05) && near(fOf(D, 'A2').tot, 43.7, 0.05));
    truth(`3.6 (${tag}): P_B = 6.3 kN`, near(fOf(D, 'B1').tot, 6.3, 0.05) && near(fOf(D, 'B2').tot, 6.3, 0.05));
    truth(`3.6 (${tag}): no torsion, 2(43.7 + 6.3) = 100`, near(D.cases[0].T, 0, 1e-9) && near(D.walls.reduce((s, w, i) => s + D.cases[0].f[i].tot, 0), 100, 1e-9));
  }
  truth('3.6: walls all along Y, solved on Y and rotation, with a warning', rel.par && rel.xr === 15 && rel.yr === null && rel.warnings.some(x => /nothing resists load across them/.test(x)));
  truth('3.6: load in X with only Y walls is refused', throws(() => RD.design({ walls: walls.map(w => ({ ...w, type: 'k', k: 1 })), plan: { B: 30, D: 20 }, loads: { x: { F: 10 } } }), /Nothing resists the load in X/));
}

// ---- wall stiffness against the closed forms ----
{
  const E = 22 * ((32 + 8) / 10) ** 0.3, G = E / 2.4;
  truth('E_cm(C32/40) = 33.35 GPa (BS EN 1992-1-1 Table 3.1)', near(RD.Ecm(32), 33.35, 0.005) && near(E, RD.Ecm(32), 1e-12));
  const run = (wall, glob) => RD.design({ walls: [{ id: 'W', dir: 'y', at: 0, from: 0, to: 6, ...wall }, { id: 'V', dir: 'y', at: 10, from: 0, to: 6, type: 'k', k: 1 }, { id: 'X', dir: 'x', at: 0, from: 0, to: 4, type: 'k', k: 1 }], global: { H: 3, ...glob }, plan: { B: 10, D: 6 }, loads: { y: { F: 10 } } }).walls[0];
  const I = 200 * 6000 ** 3 / 12, A = 200 * 6000, H = 3000;
  truth('concrete cantilever: k = 1/(H³/3EI + 1.2H/GA)', near(run({ type: 'concrete', t: 200 }, { fck: 32 }).k, 1 / (H ** 3 / (3 * E * I) + 1.2 * H / (G * A)), 1e-9));
  truth('concrete fixed both ends: k = 1/(H³/12EI + 1.2H/GA)', near(run({ type: 'concrete', t: 200 }, { fck: 32, fix: 'fixed' }).k, 1 / (H ** 3 / (12 * E * I) + 1.2 * H / (G * A)), 1e-9));
  truth('bending only: k = 3EI/H³', near(run({ type: 'concrete', t: 200 }, { fck: 32, shear: false }).k, 3 * E * I / H ** 3, 1e-9));
  truth('cracked: factor 0.5 halves E and G', near(run({ type: 'concrete', t: 200 }, { fck: 32, crack: 0.5 }).k, 0.5 / (H ** 3 / (3 * E * I) + 1.2 * H / (G * A)), 1e-9));
  const Em = 6, Gm = 0.4 * 6, Im = 215 * 6000 ** 3 / 12, Am = 215 * 6000;
  truth('masonry: E = 1000 f_k, G = 0.4E (BS EN 1996-1-1 3.7.2, 3.7.3)', near(run({ type: 'masonry', t: 215 }, { fk: 6 }).k, 1 / (H ** 3 / (3 * Em * Im) + 1.2 * H / (Gm * Am)), 1e-9));
  const Ld = Math.hypot(6000, 3000), Ah = 1250;
  truth('bracing, X tension only: k = E A cos²α/L_d', near(run({ type: 'brace', A: 12.5, arr: 'xt' }, {}).k, 210 * Ah * (6000 / Ld) ** 2 / Ld, 1e-9));
  truth('bracing, X both diagonals: twice that', near(run({ type: 'brace', A: 12.5, arr: 'xb' }, {}).k, 2 * 210 * Ah * (6000 / Ld) ** 2 / Ld, 1e-9));
  const Lc = Math.hypot(3000, 3000);
  truth('bracing, chevron: 2 E A cos²α/L_d to mid-bay', near(run({ type: 'brace', A: 12.5, arr: 'chev' }, {}).k, 2 * 210 * Ah * (3000 / Lc) ** 2 / Lc, 1e-9));
  const br = RD.design({ walls: [{ id: 'W', dir: 'y', at: 0, from: 0, to: 6, type: 'brace', A: 12.5, arr: 'xt' }, { id: 'V', dir: 'y', at: 10, from: 0, to: 6, type: 'brace', A: 12.5, arr: 'xt' }], global: { H: 3 }, plan: { B: 10, D: 6 }, loads: { gamma: 1, tors: 'none', y: { F: 20, at: 5 } } }).walls[0];
  truth('bracing: diagonal force N = F L_d/w (10 kN × 6.708/6)', near(br.F, 10, 1e-9) && near(br.N, 10 * Ld / 6000, 1e-9));
}

// ---- general properties ----
// equilibrium in every case, for an irregular plan with all three wall types
const PLAN = [{ id: 'A', dir: 'y', at: 0, from: 3, to: 12, type: 'concrete', t: 200 }, { id: 'B', dir: 'y', at: 20, from: 6, to: 10, type: 'masonry', t: 215 },
  { id: 'C', dir: 'y', at: 23, from: 6, to: 10, type: 'brace', A: 10, arr: 'xb' }, { id: 'D', dir: 'x', at: 6, from: 20, to: 23, type: 'k', k: 40 },
  { id: 'E', dir: 'x', at: 10, from: 20, to: 23, type: 'concrete', t: 250 }, { id: 'F', dir: 'x', at: 15, from: 0, to: 6, type: 'concrete', t: 200 }];
const base = { walls: PLAN, global: { H: 10.5, fck: 32, fk: 5 }, plan: { B: 30, D: 15 }, loads: { gamma: 1.5, tors: 'na10', x: { F: 100 }, y: { F: 200 } } };
{
  const D = RD.design(base);
  truth('six cases: X and Y each at the centre and ± b/6', D.cases.length === 6 && D.cases.map(c => c.short).join() === 'X,X +T,X −T,Y,Y +T,Y −T');
  truth('equilibrium in every case (ΣF and ΣM)', D.cases.every(c => c.eq < 1e-12));
  truth('each force = direct + torsional part', D.cases.every(c => c.f.every(f => near(f.tot, f.dir + f.tor, 1e-9))));
  truth('direct parts share F by stiffness in its direction', D.cases.every(c => near(c.f.reduce((s, f, i) => s + (D.walls[i].dir === c.dir ? f.dir : 0), 0), c.F, 1e-9) && D.walls.every((w, i) => w.dir === c.dir || near(c.f[i].dir, 0, 1e-9))));
  truth('torsional parts = k r T/J', D.cases.every(c => D.walls.every((w, i) => near(c.f[i].tor, w.k * w.r * c.T / D.J, 1e-9))));
  truth('γ: F_Ed = 1.5 F_k', near(D.cases[0].F, 150, 1e-9) && near(D.cases[3].F, 300, 1e-9));
  truth('NA.10: 0.65 F at b/6 from the centre of each face', near(D.cases[1].F, 0.65 * 150, 1e-9) && near(D.cases[1].at, 7.5 + 2.5, 1e-9) && near(D.cases[5].at, 15 - 5, 1e-9));
  truth('design force = the largest over the cases', D.walls.every((w, i) => near(w.F, Math.max(...D.cases.map(c => Math.abs(c.f[i].tot))), 1e-12)));
  truth('force per metre = F_Ed/L', D.walls.every(w => near(w.v, w.F / w.L, 1e-12)));
  // the centre of rigidity is where a force causes no rotation
  const at = RD.design({ ...base, loads: { gamma: 1, tors: 'none', y: { F: 50, at: D.xr }, x: { F: 50, at: D.yr } } });
  truth('a load through the centre of rigidity does not turn the floor', at.cases.every(c => near(c.ph, 0, 1e-15) && near(c.T, 0, 1e-9)));
  const f85 = RD.design({ ...base, loads: { ...base.loads, flc: 0.85 } });
  truth('NA.10 with the lack-of-correlation factor taken out: 0.65F/0.85', near(f85.cases[1].F, 0.65 * 150 / 0.85, 1e-9));
  const ecc = RD.design({ ...base, loads: { ...base.loads, tors: 'ecc', e: 0.05 } });
  truth('± e × b: full F at ± 0.05b', near(ecc.cases[1].F, 150, 1e-9) && near(ecc.cases[1].at, 7.5 + 0.75, 1e-9) && near(ecc.cases[2].at, 7.5 - 0.75, 1e-9));
  const none = RD.design({ ...base, loads: { ...base.loads, tors: 'none' } });
  truth('no torsion allowance: one case each way', none.cases.length === 2);
  truth('drift: the corners’ characteristic movement against H/300', D.checks.some(c => c.id === 'drift') && near(D.drift.dl, 35, 1e-9) && D.cases.every(c => c.drift > 0));
}
// a 90° turn of the whole plan gives the same wall forces
{
  // (x, y) → (15 − y, x): walls along X become walls along Y and the reverse; a load in Y becomes one in −X
  const turn = w => w.dir === 'x' ? { ...w, dir: 'y', at: 15 - w.at } : { ...w, dir: 'x', at: w.at, from: 15 - w.to, to: 15 - w.from };
  const A = RD.design({ ...base, loads: { gamma: 1, tors: 'none', y: { F: 100, at: 13 } } });
  const B = RD.design({ ...base, walls: PLAN.map(turn), plan: { B: 15, D: 30 }, loads: { gamma: 1, tors: 'none', x: { F: 100, at: 13 } } });
  truth('90° turn: the same |forces| in every wall', A.walls.every((w, i) => near(Math.abs(A.cases[0].f[i].tot), Math.abs(B.cases[0].f[i].tot), 1e-9)));
  truth('90° turn: the centre of rigidity turns with it', near(B.yr, A.xr, 1e-9) && near(B.xr, 15 - A.yr, 1e-9));
}
// walls at an angle against an independent solution (Cramer's rule on K)
{
  const walls = [{ id: 'P', dir: 'a', theta: 30, at: 2, from: 0, to: 6, type: 'k', k: 12 }, { id: 'Q', dir: 'a', theta: 120, at: 14, from: 4, to: 8, type: 'k', k: 7 },
    { id: 'R', dir: 'x', at: 10, from: 3, to: 11, type: 'k', k: 9 }, { id: 'S', dir: 'y', at: 9, from: 1, to: 5, type: 'k', k: 4 }];
  const D = RD.design({ walls, plan: { B: 16, D: 12 }, loads: { gamma: 1, tors: 'none', x: { F: 30, at: 5 }, y: { F: 20, at: 7 } } });
  const ws = walls.map(w => { const t = (w.dir === 'x' ? 0 : w.dir === 'y' ? 90 : w.theta) * Math.PI / 180, x = w.dir === 'x' ? (w.from + w.to) / 2 : w.at, y = w.dir === 'x' ? w.at : (w.from + w.to) / 2;
    return { k: w.k * 1000, a: [Math.cos(t), Math.sin(t), x * Math.sin(t) - y * Math.cos(t)] }; });
  const K = [0, 1, 2].map(i => [0, 1, 2].map(j => ws.reduce((s, w) => s + w.k * w.a[i] * w.a[j], 0)));
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const cramer = P => [0, 1, 2].map(c => det(K.map((r, i) => r.map((v, j) => (j === c ? P[i] : v)))) / det(K));
  const ok = D.cases.every(c => { const P = c.dir === 'x' ? [c.F, 0, -c.at * c.F] : [0, c.F, c.at * c.F], d = cramer(P); return ws.every((w, i) => near(c.f[i].tot, w.k * (w.a[0] * d[0] + w.a[1] * d[1] + w.a[2] * d[2]), 1e-8)); });
  truth('walls at 30° and 120°: forces as an independent solution', ok);
  truth('walls at an angle: a load through the centre of rigidity does not turn the floor', RD.design({ walls, plan: { B: 16, D: 12 }, loads: { gamma: 1, tors: 'none', x: { F: 30, at: D.yr }, y: { F: 20, at: D.xr } } }).cases.every(c => near(c.ph, 0, 1e-14)));
  truth('a wall at 0° or 90° is the same as one along X or Y', (() => { const a = RD.design({ walls: walls.map(w => w.id === 'R' ? { ...w, dir: 'a', theta: 0, at: 7, from: 9.5, to: 10.5 } : w), plan: { B: 16, D: 12 }, loads: { gamma: 1, tors: 'none', x: { F: 30, at: 5 } } });
    return a.cases[0].f.every((f, i) => near(f.tot, D.cases[0].f[i].tot, 1e-9)); })());
}
// racking strength (PD 6693-1 20.3): shares in proportion to F_i,v,Rd; with no eccentricity every wall in the direction is equally used
{
  const walls = [{ id: 'G1', dir: 'y', at: 0, from: 0, to: 8, FRd: 12 }, { id: 'G2', dir: 'y', at: 10, from: 0, to: 8, FRd: 12 }, { id: 'P', dir: 'y', at: 5, from: 2, to: 6, FRd: 6 },
    { id: 'F1', dir: 'x', at: 0, from: 0, to: 10, FRd: 15 }, { id: 'F2', dir: 'x', at: 8, from: 0, to: 10, FRd: 15 }];
  const D = RD.design({ basis: 'strength', walls, plan: { B: 10, D: 8 }, loads: { gamma: 1.5, tors: 'none', y: { F: 12 } } });
  truth('strength: k = F_i,v,Rd and no drift check', D.walls.every(w => w.k === w.FRd) && !D.checks.some(c => c.id === 'drift') && !D.real);
  truth('strength: symmetric, so every Y wall used to 18/30', ['G1', 'G2', 'P'].every(id => near(byId(D, id).util, 18 / 30, 1e-9)));
  const E = RD.design({ basis: 'strength', walls, plan: { B: 10, D: 8 }, loads: { gamma: 1.5, tors: 'ecc', e: 0.1, y: { F: 12 } } });
  // T = 18 × 1 = 18 kNm about x_r = 5; J = 12 × 5² × 2 + 15 × 4² × 2 = 1080; G2 takes 7.2 + 12 × 5 × 18/1080 = 8.2 kN
  truth('strength with ± e: the orthogonal walls take the torsion too (20.3 d)): F1 = F2 = 15 × 4 × 18/1080', near(byId(E, 'F1').F, 1, 1e-9) && near(byId(E, 'F2').F, 1, 1e-9));
  truth('strength with ± e: G1 and G2 take 7.2 + 1.0 = 8.2 kN', near(byId(E, 'G1').F, 8.2, 1e-9) && near(byId(E, 'G2').F, 8.2, 1e-9) && near(byId(E, 'P').F, 7.2 * 6 / 12, 1e-9));
  truth('strength: a wall without F_i,v,Rd is refused', throws(() => RD.design({ basis: 'strength', walls: [...walls, { id: 'Z', dir: 'x', at: 4, from: 0, to: 2 }], plan: { B: 10, D: 8 }, loads: { y: { F: 1 } } }), /Z: racking strength/));
}
// refusals and warnings
{
  const k = (id, dir, at, from, to) => ({ id, dir, at, from, to, type: 'k', k: 1 });
  truth('walls all on one line are refused', throws(() => RD.design({ walls: [k('A', 'y', 0, 0, 4), k('B', 'y', 0, 5, 9)], plan: { B: 5, D: 9 }, loads: { y: { F: 1 } } }), /all lie on one line/));
  truth('walls whose lines meet at one point are refused', throws(() => RD.design({ walls: [k('A', 'y', 0, 1, 4), k('B', 'x', 0, 1, 4), { id: 'C', dir: 'a', theta: 45, at: 2, from: 1, to: 3, type: 'k', k: 1 }], plan: { B: 5, D: 5 }, loads: { y: { F: 1 } } }), /meet at one point/));
  truth('two walls with one name are refused', throws(() => RD.design({ walls: [k('A', 'y', 0, 0, 4), k('A', 'x', 0, 0, 4)], plan: { B: 5, D: 5 }, loads: { y: { F: 1 } } }), /Two walls are called A/));
  truth('a wall with no length is refused', throws(() => RD.design({ walls: [k('A', 'y', 0, 2, 2)], plan: { B: 5, D: 5 }, loads: { y: { F: 1 } } }), /start and end are the same/));
  truth('no load is refused', throws(() => RD.design({ walls: PLAN, global: { H: 3 }, plan: { B: 30, D: 15 }, loads: {} }), /Give the horizontal load/));
  truth('a wall outside the plan is flagged', RD.design({ walls: [...PLAN.slice(0, 5), { ...PLAN[5], at: 18 }], global: { H: 3 }, plan: { B: 30, D: 15 }, loads: { y: { F: 1 } } }).warnings.some(x => /F lies partly outside the plan/.test(x)));
  truth('F_Rd given: a check per wall', (() => { const D = RD.design({ ...base, walls: PLAN.map(w => ({ ...w, FRd: 400 })) }); return D.walls.every(w => D.checks.some(c => c.id === 'w:' + w.id && near(c.util, w.F / 400, 1e-12))); })());
}
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
