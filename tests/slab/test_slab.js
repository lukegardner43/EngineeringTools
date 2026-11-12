// Ground-Bearing Slab engine against Concrete Society TR34 (4th edition), outputs only. TR34 has no worked examples, so these
// are hand checks of each step against the report's own equations and tables:
//  - Table 6.1 (f_ctm and E_cm to one figure for C25/30 to C40/50);
//  - the flexural strength, M_un, the fibre and fabric sagging moments, l and λ (and λl = (3/11.52)^¼, from their definitions);
//  - Meyerhof's internal, edge and corner capacities at a/l 0 and 0.2 and the interpolation between; the pair closer than 2h
//    as one load on the combined area; the pair and quad formulas; the joint (edge / 0.85 + dowels, at most internal);
//  - the round bar dowel (shear 0.6 f_yd A_v, bearing d_d² √(f_cd f_yd)[√(1 + α²) − α]) and the number within 0.9l;
//  - punching perimeters, v_max, v_Rd,c (the minimum and the fabric formula), v_f, and the ground reaction inside 2d;
//  - Hetényi's line load (4λM_un, 3λM_un at an edge) and the random UDL 5.95λ²M_un;
//  - Appendix E's fatigue thickness (Equations E1, E2, E3), and the refusals.
//   node tests/slab/test_slab.js
const { GroundSlab: G } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const PI = Math.PI;

// ---- Table 6.1 ----
{
  const T = [[25, 2.6, 31], [28, 2.8, 32], [30, 2.9, 33], [32, 3.0, 33], [35, 3.2, 34], [40, 3.5, 35]];
  truth('Table 6.1: f_ctm 2.6, 2.8, 2.9, 3.0, 3.2, 3.5 and E_cm 31, 32, 33, 33, 34, 35 kN/mm² for C25/30 to C40/50', T.every(([f, t, e]) => { const c = G.concrete(f); return near(c.fctm, t, 0.05) && near(c.Ecm / 1000, e, 0.5) && c.fcm === f + 8; }), T.map(([f]) => { const c = G.concrete(f); return [c.fctm, c.Ecm]; }));
  truth('Table 6.1: cube strengths 30, 35, 37, 40, 45, 50', [25, 28, 30, 32, 35, 40].map(f => G.CLASSES[f]).join() === '30,35,37,40,45,50');
  truth('7.2: load factors racking 1.2, other static 1.5, materials handling 1.6', G.GAMMA.racking === 1.2 && G.GAMMA.static === 1.5 && G.GAMMA.dynamic === 1.6);
}

// ---- the default fibre slab: 175 mm C32/40, k 0.05, f_R 3.5 / 3.4 / 3.2 / 3.0 ----
const BASE = { h: 175, fck: 32, k: 0.05, reo: 'fibre', fR1: 3.5, fR2: 3.4, fR3: 3.2, fR4: 3.0, joint: { interlock: true, dowels: 'bar', dd: 20, sd: 300, open: 5 } };
const R1 = { ref: 'R1', kind: 'racking', P: 60, x: 100, y: 100, loc: 'internal', n: 2, sx: 300 };
const R2 = { ref: 'R2', kind: 'racking', P: 60, x: 100, y: 100, loc: 'joint' };
const F1 = { ref: 'F1', kind: 'dynamic', P: 45, x: 150, y: 150, loc: 'joint' };
const D = G.design({ ...BASE, points: [R1, R2, F1], lines: [{ ref: 'L1', w: 20, where: 'remote' }], udl: 50 });
const fctm = 0.3 * 32 ** (2 / 3), Ecm = 22000 * 4 ** 0.3;
{
  truth('6.3.1: f_ctd,fl = 3.024 × (1.6 − 0.175)/1.5 = 2.873 N/mm²', near(D.fctdfl, fctm * 1.425 / 1.5, 1e-9) && near(D.fctdfl, 2.873, 0.001), D.fctdfl);
  truth('M_un = M_n = 2.873 × 175²/6 = 14.66 kNm/m', near(D.Mun, 2.8728 * 30625 / 6000, 0.002) && D.Mn === D.Mun, D.Mun);
  truth('6.3.3: σ_r1 = 0.45 × 3.5 = 1.575, σ_r4 = 0.37 × 3.0 = 1.11; M_p = 175² (0.29 × 1.11 + 0.16 × 1.575)/1.5 = 11.72 kNm/m', near(D.sr1, 1.575, 1e-9) && near(D.sr4, 1.11, 1e-9) && near(D.Mp, 30625 * (0.29 * 1.11 + 0.16 * 1.575) / 1500, 1e-9) && near(D.Mp, 11.72, 0.005), D.Mp);
  truth('7.4: M_p/M_un = 0.80 ≥ 0.5: utilisation 0.5/0.80', near(D.checks.find(c => c.id === 'ratio').util, 0.5 / (D.Mp / D.Mun), 1e-9) && near(D.ratio, 0.80, 0.005));
  truth('7.5: l = [33 346 × 175³/(12 × 0.96 × 0.05)]^¼ = 746 mm', near(D.l, (Ecm * 175 ** 3 / (12 * 0.96 * 0.05)) ** 0.25, 1e-6) && near(D.l, 746, 0.5), D.l);
  truth('7.11: λ = (3 × 0.05/(33 346 × 175³))^¼ = 0.957 /m, and λl = (3/11.52)^¼ = 0.714 whatever the slab', near(D.lam * 1000, 0.957, 0.0005) && near(D.lam * D.l, (3 / 11.52) ** 0.25, 1e-9), D.lam * 1000);
  truth('6.4: d = 0.75h = 131 mm for a fibre slab; k_s = 1 + √(200/131) capped at 2', near(D.d, 131.25, 1e-9) && D.ks === 2);
  truth('6.4.1: v_max = 0.5 × 0.6(1 − 32/250) × 32/1.5 = 5.58 N/mm²', near(D.vmax, 0.5 * 0.6 * (1 - 32 / 250) * 32 / 1.5, 1e-9) && near(D.vmax, 5.58, 0.005));
  truth('6.4.2: v_Rd,c = 0.035 × 2^1.5 × √32 = 0.560, v_f = 0.015 × (3.5 + 3.4 + 3.2 + 3.0) = 0.197 N/mm²', near(D.vRdc, 0.035 * 2 ** 1.5 * Math.sqrt(32), 1e-9) && near(D.vf, 0.1965, 1e-9));
}

// ---- Meyerhof (7.8) ----
{
  const Mp = 10, Mn = 15, l = 800, M = Mp + Mn;
  truth('internal: 2π(M_p + M_n) at a/l 0', near(G.single('internal', Mp, Mn, 0, l).P, 2 * PI * M, 1e-9));
  truth('internal: 4π(M_p + M_n)/(1 − a/3l) from a/l 0.2 (at 0.2 and 0.3)', near(G.single('internal', Mp, Mn, 160, l).P, 4 * PI * M / (1 - 0.2 / 3), 1e-9) && near(G.single('internal', Mp, Mn, 240, l).P, 4 * PI * M / (1 - 0.1), 1e-9));
  truth('edge: π(M_p + M_n)/2 + 2M_n at 0; [π(M_p + M_n) + 4M_n]/(1 − 2a/3l) from 0.2', near(G.single('edge', Mp, Mn, 0, l).P, PI * M / 2 + 2 * Mn, 1e-9) && near(G.single('edge', Mp, Mn, 200, l).P, (PI * M + 4 * Mn) / (1 - 2 * 0.25 / 3), 1e-9));
  truth('corner: 2M_n at 0; 4M_n/(1 − a/l) from 0.2', near(G.single('corner', Mp, Mn, 0, l).P, 2 * Mn, 1e-9) && near(G.single('corner', Mp, Mn, 160, l).P, 4 * Mn / 0.8, 1e-9));
  const mid = loc => near(G.single(loc, Mp, Mn, 80, l).P, (G.single(loc, Mp, Mn, 0, l).P + G.single(loc, Mp, Mn, 160, l).P) / 2, 1e-9);
  truth('7.8.3: linear in a/l between 0 and 0.2 (a/l 0.1 the mean), for all three', mid('internal') && mid('edge') && mid('corner'));
  truth('7.8.2: the pair at x: [2π + 1.8x/l] at 0, [4π/(1 − a/3l) + 1.8x/(l − a/2)] from 0.2', near(G.multi(Mp, Mn, 0, l, 500), (2 * PI + 1.8 * 500 / l) * M, 1e-9) && near(G.multi(Mp, Mn, 200, l, 500), (4 * PI / (1 - 0.25 / 3) + 1.8 * 500 / (l - 100)) * M, 1e-9));
}

// ---- the point loads of the default slab ----
{
  const [p1, p2, p3] = D.loads, a1 = Math.sqrt(10000 / PI);
  truth('R1: 1.2 × 60 = 72 kN per upright; a 100 × 100 plate is a 56.4 mm radius', near(p1.Pd, 72, 1e-9) && near(p1.a1, a1, 1e-9));
  const A = PI * a1 * a1 + 2 * a1 * 300;
  truth('R1: back-to-back at 300 mm < 2h = 350: one load of 144 kN on πa² + 2a·x, a 118 mm radius', near(p1.a, Math.sqrt(A / PI), 1e-9) && near(p1.a, 118.1, 0.1) && near(p1.Ptot, 144, 1e-9), p1.a);
  truth('R1: P_u = the single internal capacity at that radius, 316 kN; utilisation 0.456', near(p1.Pu, G.single('internal', D.Mp, D.Mn, p1.a, D.l).P, 1e-9) && near(p1.Pu, 315.7, 0.1) && near(p1.util, 144 / p1.Pu, 1e-12), p1.Pu);
  const R1far = G.design({ ...BASE, points: [{ ...R1, sx: 400 }] }).loads[0];
  truth('R1 at 400 mm ≥ 2h: the pair formula (Equations 27, 28), at most twice the single', near(R1far.Pu, Math.min(G.multi(D.Mp, D.Mn, a1, D.l, 400), 2 * G.single('internal', D.Mp, D.Mn, a1, D.l).P), 1e-9) && near(R1far.a, a1, 1e-9));
  // the dowel
  const fyd = 500 / 1.15, fcd = 32 / 1.5, Av = 0.9 * PI * 100, al = 3 * 2.5 * Math.sqrt(fcd / fyd) / 20;
  const dw = D.dowel;
  truth('6.5.1: Ø20 dowel: shear 0.6 × 434.8 × 0.9 × 314 = 73.8 kN', near(dw.Psh, 0.6 * fyd * Av / 1000, 1e-9) && near(dw.Psh, 73.8, 0.05), dw.Psh);
  truth('6.5.1: bearing and bending with a 5 mm opening: α = 3 × 2.5 √(21.3/434.8)/20 = 0.083, 20² √(21.3 × 434.8)[√(1 + α²) − α] = 35.5 kN, governs', near(dw.alpha, al, 1e-12) && near(dw.Pmax, 400 * Math.sqrt(fcd * fyd) * (Math.sqrt(1 + al * al) - al) / 1000, 1e-9) && near(dw.P, 35.5, 0.05) && dw.P === dw.Pmax, dw.Pmax);
  truth('7.9: dowels within 0.9l either side at 300 mm: 2 × 0.9 × 746/300 = 4.48, so 159 kN', near(dw.n, 1.8 * D.l / 300, 1e-9) && near(dw.Y, dw.n * dw.P, 1e-9) && near(dw.Y, 158.8, 0.3), dw.Y);
  const edge2 = G.single('edge', D.Mp, D.Mn, a1, D.l).P, int2 = G.single('internal', D.Mp, D.Mn, a1, D.l).P;
  truth('R2 at a joint: min(internal 237, edge 106/0.85 + 159) = 237 kN', near(p2.Pu, Math.min(int2, edge2 / 0.85 + dw.Y), 1e-9) && near(p2.Pu, int2, 1e-9) && near(int2, 237.3, 0.1), [p2.Pu, edge2]);
  const NJ = G.design({ ...BASE, joint: { interlock: false, dowels: 'none' }, points: [R2] }).loads[0];
  truth('R2 at an undowelled joint with no interlock: the free edge capacity', near(NJ.Pu, edge2, 1e-9));
  const IJ = G.design({ ...BASE, joint: { interlock: true, dowels: 'none' }, points: [R2] }).loads[0];
  truth('R2 with aggregate interlock only (sawn joints): edge/0.85', near(IJ.Pu, edge2 / 0.85, 1e-9));
  const GJ = G.design({ ...BASE, joint: { interlock: false, dowels: 'given', sd: 250, Pd: 20 }, points: [R2] }).loads[0];
  truth('a proprietary dowel, 20 kN at 250 mm: edge + 2 × 0.9l/250 × 20', near(GJ.Pu, Math.min(int2, edge2 + 1.8 * D.l / 250 * 20), 1e-9));
  // punching
  const d = 131.25;
  truth('R2 punching at a joint (an edge): u₀ = x + 2y = 300, u₁ = 300 + 2π × 131 = 1125 mm', p2.geo === 'edge' && near(p2.u0, 300, 1e-9) && near(p2.u1, 300 + 2 * PI * d, 1e-9));
  const Rp = 2.4 * (d / D.l) ** 2 * 72 + 0.8 * (2 * 100 + 100) * d * 72 / D.l ** 2;
  truth('R2: the ground inside 2d, 2.4 (d/l)² P + 0.8 (2y + x) d P/l² = 9.4 kN', near(p2.Rp, Rp, 1e-9) && near(Rp, 9.42, 0.01), p2.Rp);
  truth('R2: at the face 72 ≤ 5.58 × 300 × 131 = 220 kN; at 2d (72 − 9.4) ≤ (0.560 + 0.197) × 1125 × 131 = 112 kN', near(p2.Ppmax, D.vmax * 300 * d / 1000, 1e-9) && near(p2.Pp, (D.vRdc + D.vf) * p2.u1 * d / 1000, 1e-9) && near(D.checks.find(c => c.id === 'punch1').util, (72 - Rp) / p2.Pp, 1e-9));
  truth('R1 punching: the pair together, 144 kN on u₀ = 2(400 + 100) = 1000 mm', near(p1.Pshear, 144, 1e-9) && near(p1.u0, 1000, 1e-9) && near(p1.u1, 1000 + 4 * PI * d, 1e-9));
  const sc = Math.min(1, 0.2 * D.l / Math.sqrt(400 * 100 / PI));
  truth('R1: the internal ground reaction 1.4 (d/l)² P + 0.47 (x + y) d P/l², the plate within a = 0.2l', near(p1.Rp, 1.4 * (d / D.l) ** 2 * 144 + 0.47 * (400 + 100) * sc * d * 144 / D.l ** 2, 1e-9));
  truth('F1: 1.6 × 45 = 72 kN on a 150 × 150 plate', near(p3.Pd, 72, 1e-9) && near(p3.a1, 150 / Math.sqrt(PI), 1e-9));
  const C = G.design({ ...BASE, points: [{ ref: 'C1', kind: 'static', P: 20, x: 100, y: 100, loc: 'corner' }] }).loads[0];
  truth('a free corner: u₀ = x + y, u₁ adds πd, no ground reaction; capacity 2M_n to 4M_n/(1 − a/l)', near(C.u0, 200, 1e-9) && near(C.u1, 200 + PI * d, 1e-9) && C.Rp === 0 && near(C.Pu, G.single('corner', D.Mp, D.Mn, a1, D.l).P, 1e-9));
  const Q = G.design({ ...BASE, points: [{ ref: 'Q', kind: 'racking', P: 50, x: 100, y: 100, loc: 'internal', n: 4, sx: 1000, sy: 800 }] }).loads[0];
  const s1 = G.single('internal', D.Mp, D.Mn, a1, D.l).P, pr = s => Math.min(G.multi(D.Mp, D.Mn, a1, D.l, s), 2 * s1);
  truth('four loads 1000 × 800: the least of four singles, the pairs and the quad formula (Equations 29, 30)', near(Q.Pu, Math.min(4 * s1, 2 * pr(1000), 2 * pr(800), G.multi(D.Mp, D.Mn, a1, D.l, 1800)), 1e-9) && near(Q.Ptot, 4 * 60, 1e-9));
}

// ---- line loads and UDL ----
{
  const full = 4 * D.lam * 1000 * D.Mun;
  truth('7.11: line load capacity 4λM_un = 4 × 0.957 × 14.66 = 56.1 kN/m', near(D.lines[0].cap, full, 1e-9) && near(full, 56.1, 0.05), full);
  const E = G.design({ ...BASE, lines: [{ w: 20, where: 'edge', dist: 0 }, { w: 20, where: 'edge', dist: 3.2 }, { w: 20, where: 'joint', dist: 0.5 / D.lam / 1000 }] }).lines;
  truth('at a free edge 3λM_un, back to 4λM_un at 3/λ = 3.13 m; at a joint halfway over 1/λ: 3.5λM_un', near(E[0].cap, 0.75 * full, 1e-9) && near(E[1].cap, full, 1e-9) && near(E[2].cap, 0.875 * full, 1e-9));
  truth('7.12: UDL 5.95 λ² M_un = 79.9 kN/m², worst on strips π/λ = 3.28 m wide, π/2λ = 1.64 m apart', near(D.udl.cap, 5.95 * (D.lam * 1000) ** 2 * D.Mun, 1e-9) && near(D.udl.cap, 79.9, 0.05) && near(D.udl.strip, 3.28, 0.005) && near(D.udl.aisle, 1.64, 0.005));
  truth('the default slab passes at 0.626, the reinforcement ratio and the UDL governing', near(D.utilMax, 0.626, 0.0005) && D.checks.length === 9, D.utilMax);
}

// ---- fabric, plain, fibres with bars ----
{
  const F = G.design({ h: 175, fck: 32, k: 0.05, reo: 'fabric', As: 393, cover: 50, phi: 10, points: [{ ref: 'P', kind: 'static', P: 40, x: 150, y: 150 }] });
  truth('fabric A393 at 50 cover: d = 175 − 50 − 5 = 120 mm; M_p = 0.95 × 393 × 500 × 120/1.15 = 19.48 kNm/m', near(F.d, 120, 1e-9) && near(F.Mp, 0.95 * 393 * 500 * 120 / 1.15 / 1e6, 1e-9) && near(F.Mp, 19.48, 0.005), F.Mp);
  truth('fabric at least 0.08%: 140 mm²/m against 393', near(F.checks.find(c => c.id === 'fab').util, 140 / 393, 1e-9));
  const rho = 393 / 120000, ks = Math.min(2, 1 + Math.sqrt(200 / 120)), vf = 0.18 / 1.5 * ks * Math.cbrt(100 * rho * 32), vm = 0.035 * ks ** 1.5 * Math.sqrt(32);
  truth('fabric punching: v_Rd,c = max(0.12 k_s (100ρ f_ck)^⅓, 0.035 k_s^1.5 √f_ck), no fibre term', near(F.vRdc, Math.max(vf, vm), 1e-9) && F.vf === 0);
  const P = G.design({ h: 200, fck: 32, k: 0.05, reo: 'plain', points: [{ ref: 'P', kind: 'static', P: 40, x: 150, y: 150 }] });
  truth('plain: M_p = M_un, no reinforcement checks, a warning', P.Mp === P.Mun && !P.checks.some(c => c.id === 'ratio') && P.warnings.some(w => /Plain concrete/.test(w)));
  const B = G.design({ ...BASE, reo: 'fibreBar', As: 200, cover: 40, phi: 10, points: [R2] });
  truth('fibres with bars under 0.15%: the fibre moment + A_s f_yk (d − 0.048h)/1.15', near(B.Mp, 30625 * (0.29 * 1.11 + 0.16 * 1.575) / 1500 + 200 * 500 * (130 - 0.048 * 175) / 1.15 / 1e6, 1e-9));
  const S = G.design({ ...BASE, fibreType: 'synthetic', points: [R2] });
  truth('macro-synthetic fibres: no v_f, and a creep warning', S.vf === 0 && S.warnings.some(w => /creep/.test(w)));
}

// ---- fatigue (Appendix E) ----
{
  const ax = [6000, 3500], esa = (6000 / 8160) ** 4 + (3500 / 8160) ** 4;
  const F = G.design({ h: 200, fck: 32, k: 0.05, reo: 'fabric', As: 252, cover: 50, phi: 8, points: [{ ref: 'P', kind: 'dynamic', P: 40, x: 150, y: 150 }], fat: { on: true, axles: ax, passes: 2e6, solid: false } });
  const L = esa * 2, h2 = 1935 * L ** 0.196 / 39 ** 0.68;
  truth('E1: (6000/8160)⁴ + (3500/8160)⁴ standard axles × 2 million passes; E2 with f_cm = 32 + 7: h ≥ 1935 L^0.196/39^0.68', near(F.fat.esa, esa, 1e-12) && near(F.fat.L, L, 1e-12) && near(F.fat.hreq, h2, 1e-9) && F.fat.eq === 'E2', F.fat.hreq);
  const F3 = G.design({ h: 200, fck: 32, k: 0.05, reo: 'fabric', As: 393, cover: 50, phi: 10, points: [{ ref: 'P', kind: 'dynamic', P: 40, x: 150, y: 150 }], fat: { on: true, axles: ax, passes: 2e6, solid: true } });
  const esaS = (1.3 * 6000 / 8160) ** 4 + (1.3 * 3500 / 8160) ** 4, L3 = esaS * 2;
  truth('E3 over 300 mm²/m, solid tyres × 1.3: h ≥ 9141 L^0.209/(39^0.663 × 393^0.296)', near(F3.fat.hreq, 9141 * L3 ** 0.209 / (39 ** 0.663 * 393 ** 0.296), 1e-9) && F3.fat.eq === 'E3');
}

// ---- refusals ----
truth('refused: under 150 mm (7.1)', throws(() => G.design({ ...BASE, h: 140, points: [R2] }), /150 mm/));
truth('refused: C20/25 (Table 6.1)', throws(() => G.design({ ...BASE, fck: 20, points: [R2] }), /C25\/30 to C40\/50/));
truth('refused: fibres without f_R1 and f_R4', throws(() => G.design({ ...BASE, fR4: '', points: [R2] }), /f_R4/) && throws(() => G.design({ ...BASE, fR1: 0, points: [R2] }), /f_R1 and f_R4/));
truth('refused: fibres with 0.15% bars or more (6.3.5)', throws(() => G.design({ ...BASE, reo: 'fibreBar', As: 263, points: [R2] }), /0\.15%/));
truth('refused: the fatigue check on a fibre slab (Appendix E Note 2)', throws(() => G.design({ ...BASE, points: [R2], fat: { on: true, axles: [5000], passes: 1e6 } }), /not for fibre/));
truth('refused: no loads', throws(() => G.design({ ...BASE }), /at least one load/));
truth('refused: axles over 25 t', throws(() => G.design({ h: 200, fck: 32, k: 0.05, reo: 'plain', points: [R2], fat: { on: true, axles: [26000], passes: 1e6 } }), /25 000/));

console.log(`\n${pass}/${pass + fail} passed`); if (fail) process.exit(1);
