// Raft Foundation engine: a uniformly loaded raft settles uniformly with no moment (w = q/k_s); a long narrow raft under a
// line load across it against Hetényi's infinite beam on an elastic foundation (w₀ = Pλ/2k, M₀ = P/4λ); the bed in
// compression only (a raft loaded at one end lifts at the other, every spring pushing and the load balanced); equilibrium;
// the bending steel against EC2's rectangular block for the worst element; punching with the net upward pressure deducted;
// the page's default raft; and the refusals.
//   node tests/raft/test_raft.js
const { RaftFoundation: R, EC2 } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol, rel = (a, b, r) => Math.abs(a - b) <= r * Math.abs(b);
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const mesh = { fck: 32, cBtm: 50, cTop: 40, phiB: 16, sB: 200, phiT: 12, sT: 200 };

// ---- a uniformly loaded raft ----
{
  const D = R.design({ Lx: 6, Ly: 4, h: 300, ...mesh, ks: 20000, qa: 100, gk: 5, qk: 3 });
  const q = 25 * 0.3 + 5 + 3;
  const w = D.bedNodes.map(n => D.K.u[3 * n]), mx = Math.max(...Array.from({ length: D.M.nEl }, (_, e) => Math.abs(D.U.R[6 * e]) + Math.abs(D.U.R[6 * e + 1])));
  truth('uniform load: w = q/k_s at every node, p = q', w.every(v => rel(v, q / 20000, 1e-6)) && rel(D.pMax, q, 1e-6), [w[0], q / 20000]);
  truth('uniform load: no moment anywhere', mx < 1e-6, mx);
  truth('uniform load: the bed carries the whole load', rel(D.bedK, q * 24, 1e-9) && near(D.totG + D.totQ, q * 24, 1e-6));
}
// ---- Hetényi: an infinite beam on an elastic foundation, a line load across a long narrow raft ----
{
  // the raft's own weight (7.5 kPa) keeps it on the bed where the infinite beam would pull (−0.043 w₀ at π/λ); it adds a uniform sw/k_s
  const P = 100, ks = 15000, h = 0.3, Lx = 30, D = R.design({ Lx, Ly: 1, h: 300, ...mesh, ks, walls: [{ x0: 15, y0: 0, x1: 15, y1: 1, G: P, Q: 0 }], mesh: 0.1 });
  const E = D.c.Ecm * 1000, EI = E * h ** 3 / 12, lam = (ks / (4 * EI)) ** 0.25;
  const nodes = D.bedNodes.filter(n => Math.abs(D.M.X(n) - 15) < 1e-9), w0 = nodes.reduce((s, n) => s + D.K.u[3 * n], 0) / nodes.length - 7.5 / ks;
  truth(`Hetényi: w₀ = Pλ/2k_s = ${(P * lam / (2 * ks) * 1000).toFixed(3)} mm under the line (within 2%: plate, not beam)`, rel(w0, P * lam / (2 * ks), 0.02), [w0 * 1000, P * lam / (2 * ks) * 1000]);
  // the moment at the centre of the element beside the line, x = el/2 from it: M = P/4λ e^(−λx)(cos λx − sin λx)
  let e0 = -1, best = Infinity; for (let e = 0; e < D.M.nEl; e++) { const dx = D.elC[2 * e] - 15; if (dx > 0 && dx < best) { best = dx; e0 = e; } }
  const x = best, Mh = P / (4 * lam) * Math.exp(-lam * x) * (Math.cos(lam * x) - Math.sin(lam * x));
  truth(`Hetényi: M = P/4λ e^(−λx)(cos λx − sin λx) = ${Mh.toFixed(2)} kNm/m beside the line (within 2%)`, rel(D.K.R[6 * e0], Mh, 0.02), [D.K.R[6 * e0], Mh]);
  // the deflection changes sign at x = 3π/4λ: the bed lifts beyond it only where the uplift exceeds nothing (no self-weight here)
  truth('Hetényi: no lift-off with the self-weight', D.lifted === 0);
  truth('Hetényi: the bed carries the line load and the raft', rel(D.bedK, P + 7.5 * 30, 1e-6), D.bedK);
}
// ---- a raft loaded near one end lifts at the other ----
{
  const D = R.design({ Lx: 8, Ly: 2, h: 250, ...mesh, ks: 30000, rc: 1e-9, columns: [{ x: 0.4, y: 1, cx: 300, cy: 300, G: 200, Q: 0 }] });
  truth('compression only: the far end lifts, no spring pulls, the load is balanced', D.lifted > 0 && D.bedNodes.every(n => D.pK[n] >= 0) && rel(D.bedK, 200, 1e-6) && D.warnings.some(w => /lifts off/.test(w)), [D.lifted, D.bedK]);
}
// ---- the page's default raft ----
const DEFC = []; for (const y of [0.5, 4.5, 8.5]) for (const x of [0.5, 5.5, 10.5]) { const n = (x === 5.5 ? 1 : 0) + (y === 4.5 ? 1 : 0); DEFC.push({ x, y, cx: 300, cy: 300, G: [100, 180, 300][n], Q: [30, 60, 100][n] }); }
const DEF = { Lx: 11, Ly: 9, h: 350, ...mesh, ks: 15000, qa: 100, wlim: 25, gk: 1.5, qk: 2.5, psi2: 0.3, wk: 0.3, columns: DEFC };
{
  const D = R.design(DEF);
  truth('default: passes at 0.878, punching at the middle column governing', near(D.utilMax, 0.878, 0.0005) && [...D.checks].sort((a, b) => b.util - a.util)[0].id === 'punch', D.utilMax);
  truth('default: G = 25 × 0.35 × 99 + 1.5 × 99 + ΣG = 2434.8 kN, Q = 2.5 × 99 + ΣQ = 707.5 kN', near(D.totG, 25 * 0.35 * 99 + 1.5 * 99 + 1420, 1e-6) && near(D.totQ, 2.5 * 99 + 460, 1e-6), [D.totG, D.totQ]);
  truth('default: equilibrium of the bed', rel(D.bedK, D.totG + D.totQ, 1e-6));
  const L = D.layer[0], W = L.worst, As = EC2.bendingDesign({ sec: { b: 1000, bw: 1000, hf: 0, h: 350 }, d: L.d, M: W.m * 1e6, c: D.c, s: EC2.steel(500) }).As;
  truth('bending: the worst bottom x element needs A_s by the rectangular block', rel(W.req, As, 1e-9) && near(L.d, 350 - 50 - 8, 1e-12) && near(W.util, As / (Math.PI * 64 * 1000 / 200), 1e-9), [W.req, As]);
  truth('bending: the moment is the Wood–Armer bottom x of the ULS field', near(W.m, Math.abs(D.WA[4 * W.e]), 1e-9));
  const c5 = D.punch[4], c1 = D.punch[0];
  truth('punching: C5 internal, C1 corner, C2 edge', c5.type === 'internal' && c1.type === 'corner' && D.punch[1].type === 'edge');
  truth('punching: the net upward pressure deducted = ground − 1.35(self-weight + g_k) − 1.5 q_k', near(c5.q, c5.pAv - (1.35 * (25 * 0.35 + 1.5) + 1.5 * 2.5), 1e-9) && near(c5.pin.q, c5.q, 1e-12) && near(c5.VEd, 1.35 * 300 + 1.5 * 100, 1e-9));
  truth('punching: without links, max(v_Ed,0/v_Rd,max, v_Ed/v_Rd,c)', near(c5.util, Math.max(c5.R.vEd0 / c5.R.vRdmax, c5.R.vEd1 / c5.R.vRdc), 1e-12));
  const T = R.design({ ...DEF, h: 300 });
  truth('300 mm: the middle column needs links (a note) and fails without them', T.checks.find(c => c.id === 'punch').util > 1 && T.warnings.some(w => /shear links/.test(w)));
  const S = R.design({ ...DEF, ks: 5000 });
  truth('a third of the k_s: settles between 2 and 3 times as much (the raft, relatively stiffer, spreads the load)', S.wMax > D.wMax * 2 && S.wMax < D.wMax * 3, S.wMax / D.wMax);
  const N = R.design({ ...DEF, qa: 0 });
  truth('no allowable: noted, not checked', !N.checks.some(c => c.id === 'bear') && N.warnings.some(w => /allowable/.test(w)));
  const Wd = R.design({ ...DEF, columns: [], walls: [{ x0: 0.3, y0: 0.3, x1: 10.7, y1: 0.3, G: 40, Q: 10 }, { x0: 0.3, y0: 8.7, x1: 10.7, y1: 8.7, G: 40, Q: 10 }] });
  truth('walls: two 40 + 10 kN/m walls carried, no punching', near(Wd.totG - (25 * 0.35 + 1.5) * 99, 2 * 40 * 10.4, 1e-6) && !Wd.punch.length && rel(Wd.bedK, Wd.totG + Wd.totQ, 1e-6));
}
// ---- refusals ----
truth('refuses: a column off the raft', throws(() => R.design({ ...DEF, columns: [{ x: 11, y: 4, cx: 300, cy: 300, G: 100 }] }), /not wholly on the raft/));
truth('refuses: a diagonal wall', throws(() => R.design({ ...DEF, walls: [{ x0: 0, y0: 0, x1: 5, y1: 5, G: 10 }] }), /along x or along y/));
truth('refuses: no load', throws(() => R.design({ ...DEF, columns: [], gk: 0, qk: 0 }), /some load/));
truth('refuses: a thickness out of range', throws(() => R.design({ ...DEF, h: 100 }), /150 to 2000/));
truth('refuses: no k_s', throws(() => R.design({ ...DEF, ks: NaN }), /subgrade/));

console.log(`\n${pass}/${pass + fail} passed`); if (fail) process.exit(1);
