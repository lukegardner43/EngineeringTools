// Piles and Pile Groups engine, by hand: the shaft in clay (α c_u with c_u linear, integrated exactly, and capped), the
// base in clay (9 c_u), sand (K_s tan δ σ′_v with a water table, δ = φ′ or 0.8 φ′; N_q σ′_v), the UK NA model factor and the
// R1 / R4 factors (Tables A.NA.6 to A.NA.8, with and without explicit SLS verification), the DA1 actions, the rigid-cap share
// with moments, tension, block failure (Skempton's N_c), the shaft's concrete on the reduced section (EC2 2.3.4.2), the least
// length, and the refusals.
//   node tests/piles/test_piles.js
const { PileDesign: P } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol, rel = (a, b, r) => Math.abs(a - b) <= r * Math.abs(b);
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const deg = d => d * Math.PI / 180;

// ---- clay: α c_u, c_u from 60 kPa at 2 m rising 8 kPa/m; 9 c_u at the base ----
const CLAY = [{ type: 'fill', t: 2, g: 18 }, { type: 'clay', t: 30, g: 20, cu0: 60, cu1: 300, alpha: 0.5 }];
const one = { type: 'bored', shape: 'circle', D: 600, L: 20, skip: 1, selfW: false, layers: CLAY, piles: [{ x: 0, y: 0 }], G: 1000, Q: 0 };
{
  const D = P.design(one), per = Math.PI * 0.6, Ab = Math.PI * 0.09, cu = z => 60 + 8 * (z - 2);
  const Rs = per * 0.5 * (cu(2) + cu(20)) / 2 * 18;
  truth('clay shaft: π D α ∫c_u dz from 2 to 20 m = π 0.6 × 0.5 × 132 × 18 (the fill and the top metre carry nothing)', rel(D.P1.Rsc, Rs, 1e-4), [D.P1.Rsc, Rs]);
  truth('clay base: 9 c_u = 9 × 204 kPa over π 0.3²', rel(D.P1.Rbc, 9 * 204 * Ab, 1e-9));
  truth('model factor 1.4: R_s,k = R_s,cal/1.4, R_b,k = R_b,cal/1.4', rel(D.P1.Rsk, Rs / 1.4, 1e-4) && rel(D.P1.Rbk, 9 * 204 * Ab / 1.4, 1e-9));
  truth('bored R4 without SLS verification: γ_b 2.0, γ_s 1.6 (UK NA Table A.NA.7)', rel(D.P2.Rcd, D.P2.Rbk / 2.0 + D.P2.Rsk / 1.6, 1e-12) && rel(D.P1.Rcd, D.P1.Rbk + D.P1.Rsk, 1e-12));
  const S = P.design({ ...one, sls: true }), T = P.design({ ...one, test: true });
  truth('with explicit SLS verification: γ_b 1.7, γ_s 1.4', rel(S.P2.Rcd, S.P2.Rbk / 1.7 + S.P2.Rsk / 1.4, 1e-12));
  truth('a maintained load test: model factor 1.2', rel(T.P1.Rsk, Rs / 1.2, 1e-4));
  const Dr = P.design({ ...one, type: 'driven' }), Cf = P.design({ ...one, type: 'cfa' });
  truth('driven (Table A.NA.6): γ_b 1.7, γ_s 1.5; CFA (A.NA.8): 2.0, 1.6', rel(Dr.P2.Rcd, Dr.P2.Rbk / 1.7 + Dr.P2.Rsk / 1.5, 1e-12) && rel(Cf.P2.Rcd, Cf.P2.Rbk / 2.0 + Cf.P2.Rsk / 1.6, 1e-12));
  // the shaft capped at 50 kPa from where α c_u reaches it (c_u 100 kPa, at 7 m)
  const Cp = P.design({ ...one, layers: [CLAY[0], { ...CLAY[1], qmax: 50 }] }), Rcap = per * (0.5 * (60 + 100) / 2 * 5 + 50 * 13);
  truth('shaft limit 50 kPa: α c_u up to 7 m, then 50 kPa', rel(Cp.P1.Rsc, Rcap, 1e-4), [Cp.P1.Rsc, Rcap]);
  truth('DA1: combination 1 1.35 G + 1.5 Q, combination 2 1.0 G + 1.3 Q', near(P.design({ ...one, G: 1000, Q: 400 }).C.C1.pmax, 1.35 * 1000 + 1.5 * 400, 1e-9) && near(P.design({ ...one, G: 1000, Q: 400 }).C.C2.pmax, 1000 + 1.3 * 400, 1e-9));
  const W = P.design({ ...one, selfW: true });
  truth('the pile\'s own weight, 25 × π 0.3² × 20 m, a permanent load', near(W.Wp, 25 * Ab * 20, 1e-9) && near(W.C.C1.pmax, 1.35 * (1000 + W.Wp), 1e-9));
}
// ---- sand with a water table: K_s tan δ σ′_v, N_q σ′_v ----
{
  const g = 19, zw = 3, L = 12, Ks = 0.8, phi = 32, Nq = 50, per = Math.PI * 0.6, Ab = Math.PI * 0.09;
  const D = P.design({ type: 'bored', shape: 'circle', D: 600, L, zw, skip: 0, selfW: false, layers: [{ type: 'sand', t: 20, g, phi, Ks, Nq }], piles: [{ x: 0, y: 0 }], G: 500 });
  const sv = z => g * z - 9.81 * Math.max(0, z - zw), I = g * zw * zw / 2 + (g * zw) * (L - zw) + (g - 9.81) * (L - zw) ** 2 / 2;
  truth('sand shaft: π D K_s tan φ′ ∫σ′_v dz with the water at 3 m (bored: δ = φ′)', rel(D.P1.Rsc, per * Ks * Math.tan(deg(phi)) * I, 1e-4), [D.P1.Rsc, per * Ks * Math.tan(deg(phi)) * I]);
  truth('sand base: N_q σ′_v at the toe', rel(D.P1.Rbc, Nq * sv(L) * Ab, 1e-9));
  const Dr = P.design({ type: 'driven', shape: 'square', D: 350, L, zw, skip: 0, selfW: false, layers: [{ type: 'sand', t: 20, g, phi, Ks, Nq }], piles: [{ x: 0, y: 0 }], G: 500 });
  truth('driven precast 350 square: δ = 0.8 φ′, perimeter 4 × 0.35', rel(Dr.P1.Rsc, 1.4 * Ks * Math.tan(deg(0.8 * phi)) * I, 1e-4) && near(Dr.Ab, 0.1225, 1e-12));
}
// ---- the group: four piles at 1.8 m under a moment ----
const GRP = { ...one, L: 25, selfW: false, piles: [{ x: 0, y: 0 }, { x: 1.8, y: 0 }, { x: 0, y: 1.8 }, { x: 1.8, y: 1.8 }], G: 3000, Q: 1000, MxG: 0, MxQ: 150 };
{
  const D = P.design(GRP), s = 1.8;
  truth('rigid cap: P = V/4 ± M_x/2s (combination 2: (3000 + 1300)/4 ± 1.3 × 150/3.6)', near(D.C.C2.P[2], 4300 / 4 + 195 / (2 * s), 1e-9) && near(D.C.C2.P[0], 4300 / 4 - 195 / (2 * s), 1e-9), D.C.C2.P);
  truth('the most loaded pile governs combination 2', near(D.C.C2.pmax, 4300 / 4 + 195 / (2 * s), 1e-9));
  const My = P.design({ ...GRP, MxQ: 0, MyG: 300 });
  truth('M_y loads the piles at +x', near(My.C.K.P[1], 4000 / 4 + 300 / (2 * s), 1e-9) && near(My.C.K.P[0], 4000 / 4 - 300 / (2 * s), 1e-9));
  const T = P.design({ ...GRP, G: 400, Q: 0, MxG: 0, MxQ: 3000 });
  const pmin = 400 / 4 - 1.5 * 3000 / (2 * s);
  truth('tension: 1.0 G with the variable moment at 1.5, against R_t,d = R_s,k/2.0', T.checks.some(c => c.id === 't2') && near(T.checks.find(c => c.id === 't2').util, -pmin / (T.P2.Rsk / 2.0), 1e-9), T.C.C1.pmin);
  // block: 2.4 m square to 25 m, full c_u on the perimeter from 2 m (the top metre is in the fill), Skempton N_c 9 (D/B > 2.5)
  const Bk = D.block, cu = z => 60 + 8 * (z - 2), Rsb = 4 * 2.4 * (cu(2) + cu(25)) / 2 * 23, Rbb = 9 * cu(25) * 2.4 * 2.4;
  truth('block: perimeter × ∫c_u + N_c c_u B L, N_c = 9 here', rel(Bk.Rsb, Rsb, 1e-4) && rel(Bk.Rbb, Rbb, 1e-9) && near(Bk.Nc, 9, 1e-12), [Bk.Rsb, Rsb]);
  truth('Skempton N_c = 5(1 + 0.2 D/B)(1 + 0.2 B/L): 5 × 1.2 × 1.1 = 6.6 at D/B 1, B/L 0.5', near(P.skemptonNc(2, 2, 4), 6.6, 1e-12) && near(P.skemptonNc(20, 2, 2), 9, 1e-12));
  truth('block design: R/1.4/2.0 against the whole group\'s load', near(D.checks.find(c => c.id === 'block').util, D.C.C2.V / (Bk.Rcal / 1.4 / 2.0), 1e-9));
  truth('piles closer than 3 diameters: noted', P.design({ ...GRP, piles: [{ x: 0, y: 0 }, { x: 1.2, y: 0 }] , MxQ: 0}).warnings.some(w => /diameters apart/.test(w)));
  // the least length: both combinations exactly at 1.0 there
  const Lm = D.Lmin, A = P.design({ ...GRP, L: Lm });
  truth(`least length ${Lm.toFixed(2)} m: the utilisation is 1.000 there`, near(A.utilMax, 1, 0.002), A.utilMax);
}
// ---- the concrete ----
{
  const c = D => P.design({ ...one, D, layers: CLAY }).Dred * 1000;
  truth('EC2 2.3.4.2(2) cast in place: Ø350 → 330, Ø600 → 570 (0.95 d), Ø1200 → 1150; driven not reduced', near(c(350), 330, 1e-9) && near(c(600), 570, 1e-9) && near(c(1200), 1150, 1e-9) && near(P.design({ ...one, type: 'driven' }).Dred, 0.6, 1e-12));
  const D = P.design(one);
  truth('N_Rd = A_c × 0.85 f_ck/1.5', rel(D.NRd, Math.PI * 0.57 ** 2 / 4 * 0.85 * 32 / 1.5 * 1000, 1e-9));
}
// ---- refusals ----
truth('refuses: a pile below the ground given', throws(() => P.design({ ...one, L: 40 }), /below the layers/));
truth('refuses: overlapping piles', throws(() => P.design({ ...one, piles: [{ x: 0, y: 0 }, { x: 0.3, y: 0 }] }), /overlap/));
truth('refuses: a moment on piles in a line', throws(() => P.design({ ...one, piles: [{ x: 0, y: 0 }, { x: 2, y: 0 }], MxG: 50 }), /in a line/));
truth('refuses: no ground', throws(() => P.design({ ...one, layers: [] }), /at least one layer/));
truth('refuses: no load', throws(() => P.design({ ...one, G: 0, Q: 0 }), /vertical load/));
truth('refuses: α over 1', throws(() => P.design({ ...one, layers: [{ type: 'clay', t: 30, g: 20, cu0: 50, alpha: 1.2 }] }), /α is at most 1/));

console.log(`\n${pass}/${pass + fail} passed`); if (fail) process.exit(1);
