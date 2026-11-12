// Tower Crane Base engine: CIRIA C761 worked examples (outputs only) — Example 2A's EQU (a 6 × 6 × 1.5 m gravity base under
// a 202 EC-B: storm from the front, M_dst = 1.22 × (4280 + 90 × 1.5) = 5386 kNm against (726 + 0.9 × 1296) × 3 = 5677 kNm) and
// Example 1's pad (1.75 × 1.75 × 0.9 m on clay c_u 100 kPa, 500 kN with 29 kN horizontal, combination 2: e 0.034 m each way,
// A′ 2.83 m², i_c 0.951, R_d 1211 kN); the C761 partial factor tables; Annex D drained; the effective areas; the base's
// bending, shear and punching by hand; and the refusals.
//   node tests/crane-base/test_crane_base.js
const { CraneBase: C, EC2 } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol, rel = (a, b, r) => Math.abs(a - b) <= r * Math.abs(b);
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const bars = { fck: 30, cB: 75, cT: 50, phiB: 25, sB: 200, phiT: 25, sT: 200, s: 2.0, a: 400 };

// ---- C761 Example 2A: EQU ----
const EX2A = { L: 6, h: 1.5, gc: 24, Gc: 724, ce: true, ground: 'drained', gs: 20, phi: 37, Df: 1.5, ...bars,
  cases: [{ k: 'ins', M: 2894, H: 40, F: 768, T: 255 }, { k: 'oosRear', M: 3320, H: 129, F: 722 }, { k: 'oosFront', M: 4280, H: 90, F: 726 }, { k: 'erect', M: 2210, H: 29, F: 505 }] };
{
  const D = C.design(EX2A), F = D.out.find(R => R.r.k === 'oosFront');
  truth('C761 Ex 2A: base weight 6 × 6 × 1.5 × 24 = 1296 kN', near(D.Gb, 1296, 1e-9));
  truth('C761 Ex 2A: EQU destabilising 1.22 × (4280 + 90 × 1.5) = 5386 kNm (book 5387)', near(F.equ.Mdst, 5386.3, 0.05), F.equ.Mdst);
  truth('C761 Ex 2A: EQU stabilising (726 × 1.0 + 0.9 × 1296) × 3 = 5677 kNm (book)', near(F.equ.Mstb, 5677.2, 0.05), F.equ.Mstb);
  truth('C761 Ex 2A: storm from the front governs EQU, utilisation 0.949', D.checks.find(c => c.id === 'equ').util > 0.948 && D.checks.find(c => c.id === 'equ').util < 0.95 && /storm from the front/.test(D.checks.find(c => c.id === 'equ').note));
  truth('C761 Ex 2A: in service, the crane\'s own weight 724 kN permanent and 44 kN variable', near(D.out[0].r.perm, 724, 1e-9) && near(D.out[0].r.vari, 44, 1e-9));
  truth('C761 Ex 2A: combination 1 in service F_d,sup = 724 × 1.35 + 44 × 1.5 + 1.35 G (book 1043.4 kN for the crane)', near(1.35 * 724 + 1.5 * 44, 1043.4, 1e-9) && near(D.out[0].comb[0].worst.tag === 'superior' ? D.out[0].comb[0].worst.V : 1.35 * (724 + 1296) + 66, 1.35 * (724 + 1296) + 66, 1e-9));
  const NC = C.design({ ...EX2A, ce: false });
  truth('not CE marked: 0.9 on the crane\'s weight', near(NC.out[2].equ.Mstb, (0.9 * 726 + 0.9 * 1296) * 3, 1e-9));
}
// ---- C761 Example 1: a single pad of the cruciform, undrained ----
const EX1 = { L: 1.75, h: 0.9, gc: 24, Gc: 0, ground: 'undrained', gs: 20, cu: 100, Df: 0.45, fck: 30, cB: 50, cT: 50, phiB: 16, sB: 200, phiT: 12, sT: 200, s: 0.8, a: 200, cases: [{ k: 'ins', M: 0, H: 29.0, F: 500, T: 0 }] };
{
  const D = C.design(EX1), c2 = D.out[0].comb[1], W = c2.worst;
  truth('C761 Ex 1: G_k = 1.75² × 0.9 × 24 = 66.2 kN', near(D.Gb, 66.15, 1e-9));
  truth('C761 Ex 1: F_d2 = 1.3 × 500 + 1.0 × 66.2 = 716 kN, M_d2 = 1.3 × 29 × 0.9 = 33.93 kNm', near(W.V, 716.15, 1e-9) && near(W.Md, 33.93, 1e-9));
  truth('C761 Ex 1: the diagonal, e = M sin 45°/F = 0.034 m each way, L′ = 1.68 m, A′ = 2.83 m²', W.dir === 'diag' && near(W.e / Math.SQRT2, 0.034, 0.0005) && near(W.Bp, 1.683, 0.001) && near(W.Rb.Ap, 2.83, 0.005), [W.dir, W.Bp]);
  truth('C761 Ex 1: s_c 1.2, i_c 0.951, c_u,d 71.4 kPa, q 9 kPa', near(W.Rb.sc, 1.2, 1e-12) && near(W.Rb.ic, 0.951, 0.001) && near(W.Rb.cud, 71.43, 0.01) && near(W.Rb.q0, 9, 1e-9));
  truth('C761 Ex 1: R_d2 = A′((π + 2) c_u,d s_c i_c + q) = 1211 kN (book; 1213 unrounded)', rel(W.Rb.R, 1211, 0.002), W.Rb.R);
  // sliding: the book takes A′ c_u,d with the superior effective area (202 kN); the engine takes the inferior vertical load
  truth('C761 Ex 1: sliding A′ c_u,d = 2.83 × 71.4 = 202 kN on the book\'s area; the engine uses the inferior load (smaller A′)', near(W.Rb.Ap * 100 / 1.4, 202, 0.5) && c2.slide.Rs < W.Rb.Ap * 100 / 1.4);
}
// ---- the partial factor tables ----
{
  const T = C.CASES;
  truth('C761 Table A3.2: in service 1.35/1.5 and 1.0/1.3; storm from the front free 1.1/1.22 and 1.0/1.06', T.ins.A32[0][0] === 1.35 && T.ins.A32[0][1] === 1.5 && T.ins.A32[1][1] === 1.3 && T.oosFront.A32[0][0] === 1.1 && T.oosFront.A32[0][1] === 1.22 && T.oosFront.A32[1][1] === 1.06);
  truth('C761 Table A3.3: in service 1.35/1.35 and 1.0/1.17; storm from the rear 1.22/1.22, 1.0/1.06', T.ins.A33[0][1] === 1.35 && T.ins.A33[1][1] === 1.17 && T.oosRear.A33[0][1] === 1.22 && T.oosRear.A33[1][1] === 1.06);
  const D = C.design({ ...EX2A, dyn: true });
  truth('loads with dynamic effects: EQU at 1.10 for the storm from the front', near(D.out[2].equ.Mdst, 1.1 * (4280 + 135), 1e-9));
}
// ---- Annex D drained and the effective areas ----
{
  const ax = C.effArea(6, 1, 'axis'), dg = C.effArea(6, 1, 'diag');
  truth('effective area: (L − 2e) × L along an axis, (L − √2 e)² on the diagonal', near(ax.Bp, 4, 1e-12) && near(ax.Lp, 6, 1e-12) && near(dg.Bp, 6 - Math.SQRT2, 1e-12) && near(dg.Lp, 6 - Math.SQRT2, 1e-12));
  const G = { mode: 'drained', g: 19, phi: 35 * Math.PI / 180, c: 0, Df: 1 }, R = C.annexD(G, { gphi: 1.25, gcu: 1.4 }, 4, 6, 2000, 100, Math.PI / 2);
  const phi = Math.atan(Math.tan(35 * Math.PI / 180) / 1.25), t = Math.tan(phi), Nq = Math.exp(Math.PI * t) * Math.tan(Math.PI / 4 + phi / 2) ** 2, Ng = 2 * (Nq - 1) * t;
  const m = (2 + 4 / 6) / (1 + 4 / 6), iq = (1 - 100 / 2000) ** m, ig = (1 - 100 / 2000) ** (m + 1), sq = 1 + 4 / 6 * Math.sin(phi), sg = 1 - 0.3 * 4 / 6;
  truth('Annex D drained: q′N_q s_q i_q + ½γB′N_γ s_γ i_γ, m_B for H along B′', rel(R.q, 19 * Nq * sq * iq + 0.5 * 19 * 4 * Ng * sg * ig, 1e-12), R.q);
}
// ---- the base ----
{
  const D = C.design(EX2A), B = D.out[2].base, L = 6, x0 = (2 + 0.4) / 2, ell = L / 2 - x0;
  const xa = Math.max(x0, L / 2 - B.A1.Bp), Mb = B.qd * ((ell) ** 2 - (xa - x0) ** 2) / 2 - B.w * ell * ell / 2;
  truth('bottom bending at the legs: q_d over the effective width less the base weight, about the legs\' face', near(B.Mbot, Mb, 1e-9), [B.Mbot, Mb]);
  truth('bottom steel by EC2\'s rectangular block at d = 1500 − 75 − 37.5', near(D.dB, 1387.5, 1e-9) && rel(D.RB.As, EC2.bendingDesign({ sec: { b: 1000, bw: 1000, hf: 0, h: 1500 }, d: 1387.5, M: Math.max(...D.out.map(R => R.base.Mbot)) * 1e6, c: EC2.concrete(30), s: EC2.steel(500) }).As, 1e-9));
  truth('most loaded leg: F/4 + M/(√2 s) at combination 1 (storm from the front: 1.1 × 726/4 + 1.22 × 4280/(√2 × 2))', near(B.Pleg, 1.1 * 726 / 4 + 1.22 * 4280 / (Math.SQRT2 * 2), 1e-9));
  const P = D.punch, d = 1387.5;
  truth('punching: the worst perimeter within 2d, v_Rd,c × 2d/a, net pressure deducted', P.am > 0 && P.am <= 2 * d + 1e-9 && near(P.vR, P.vRdc * 2 * d / P.am, 1e-9) && near(P.vEd, 1.15 * P.Vred * 1000 / (P.u * d), 1e-9));
  truth('the resultant beyond L/3 out of service: noted', D.warnings.some(w => /beyond L\/3/.test(w)));
}
// ---- refusals ----
truth('refuses: no load cases', throws(() => C.design({ ...EX2A, cases: [] }), /at least one load case/));
truth('refuses: legs that do not fit', throws(() => C.design({ ...EX2A, s: 6 }), /do not fit/));
truth('refuses: undrained without c_u', throws(() => C.design({ ...EX1, cu: 0 }), /c_u,k/));
truth('refuses: no F', throws(() => C.design({ ...EX2A, cases: [{ k: 'ins', M: 100, H: 1 }] }), /F/));

console.log(`\n${pass}/${pass + fail} passed`); if (fail) process.exit(1);
