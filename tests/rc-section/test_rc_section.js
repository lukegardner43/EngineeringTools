// RC Section Design Toolkit: node test_rc_section.js
// 1 The Concrete Centre TCC11 (RECT~BEAM, TEE~BEAM, SLAB, SHEAR), recalculated in LibreOffice for 120 randomised cases
//   (ref_tcc11.json, outputs only): every quantity computed the same way must agree; the documented method differences are
//   checked as bounds (see the notes at the end of this file).
// 2 The independent Python reference (reference/ref_rc_section.py): flanged sections with the block in the web, strain
//   compatibility resistance, torsion, calculated crack width, anchorage and laps.
// 3 Clause identities and engine behaviour.
const { EC2, EC2Section, EC2Toolkit } = require('./load.js');
const TCC = require('./ref_tcc11.json'), REF = require('./ref_rc_section.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, abs = 0) => { n++; const ok = Math.abs(got - exp) <= Math.max(tol * Math.abs(exp), abs); if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(7)} expected ${(+exp).toPrecision(7)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; if (!c || process.env.V) console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const SYS = { 'SIMPLY SUPPORTED': 'ss', 'END SPAN': 'end', 'INTERIOR SPAN': 'interior' };
const S500 = EC2.steel(500), AREA = (k, phi) => k * Math.PI * phi * phi / 4;
const T9 = 1e-9, T6 = 1e-6;   // TCC rounds nothing we compare except f_ctm in A_s,min (to ~1e-7)

// ---------- 1 TCC11 ----------
TCC.rect.forEach((cs, i) => { const I = cs.in, O = cs.out, t = `TCC11 rect ${i} (${I.D11}×${I.D10} C${I.M4}, ${I.D7} kNm, δ ${I.D8})`;
  const R = EC2Section.design({ kind: 'beam', shape: 'rect', moment: 'sagging', b: I.D11, h: I.D10, fck: +I.M4, fyk: 500, cover: I.G11, coverComp: I.G12, phiLink: 0,
    bar: { phi: I.F11, n: O.M30 }, comp: O.M15 > 0 ? { phi: I.F12, n: O.M17 } : null, MEd: I.D7 * 1e6, gk: I.D12, qk: I.D13, psi2: 0.6, delta: I.D8, ae: 15, wk: 0.3,
    defl: { system: SYS[I.H6], span: I.D9, brittle: true } });
  near(`${t}: d`, R.d, O.M7, T9); near(`${t}: x/d limit`, R.bd.xlim / R.d, O.M8, T9); near(`${t}: z`, R.bd.z, O.M11, T9);
  near(`${t}: A_s2,req`, R.bd.As2 || 0, O.M15, T9, 1e-9); near(`${t}: A_s,req`, R.bd.As, O.M21, T9); near(`${t}: A_s,min (9.2.1.1)`, R.AsMin, O.M22, T6);
  near(`${t}: 100ρ`, 100 * R.defl.rho, O.M33, T9); near(`${t}: basic l/d (7.16)`, R.defl.base, O.M41, T9); near(`${t}: F2`, R.defl.F2, O.M44, T9);
  // TCC takes σs from A_s = min(A_s,prov, 1.75 A_s,req): same cracked-section engine, same steel
  const AsT = Math.min(O.M31, 1.75 * O.M21), cr = EC2.cracked({ sec: { b: I.D11 }, As: AsT, d: R.d, As2: O.M18 || 0, d2: I.G12 + I.F12 / 2, ae: 15, M: R.Mk });
  near(`${t}: σs characteristic`, cr.ss, O.M39, T9); near(`${t}: σs quasi-permanent`, cr.ss * R.Mqp / R.Mk, O.M48, T9);
  near(`${t}: Table 7.3N max spacing`, EC2.tableLookup(EC2.T73, 0.3, cr.ss * R.Mqp / R.Mk), Math.min(O.M49, 300), T9);
});
TCC.tee.forEach((cs, i) => { const I = cs.in, O = cs.out, hog = I.H6 === 'SUPPORT', b = hog ? I.D11 : O.O7, inFl = hog || 0.8 * O.M10 <= I.D12 + 1e-9;
  const t = `TCC11 tee ${i} (${hog ? 'support' : I.H6.toLowerCase()}, b ${Math.round(b)} bw ${I.D10} hf ${I.D12} h ${I.D9})`;
  const R = EC2Section.design({ kind: 'beam', shape: 'flanged', moment: hog ? 'hogging' : 'sagging', b, bw: I.D10, hf: I.D12, h: I.D9, fck: +I.M4, fyk: 500, cover: I.G11, coverComp: I.G12, phiLink: 0,
    bar: { phi: I.F11, n: O.M33 }, comp: { phi: I.F12, n: O.M17 }, MEd: I.D6 * 1e6, gk: I.D13, qk: I.D14, psi2: 0.6, delta: I.D7, ae: 15, wk: 0.3,
    defl: hog ? null : { system: SYS[I.H6], span: I.D8, brittle: true } });
  near(`${t}: d`, R.d, O.M7, T9);
  if (inFl && !(O.M15 > 0)) {
    near(`${t}: x`, R.bd.x, O.M10, T9); near(`${t}: z`, R.bd.z, O.M11, T9); near(`${t}: A_s,req`, R.bd.As, O.M21, T9);
    if (!hog) near(`${t}: 100ρ (on b_w d)`, 100 * R.bd.As / (I.D10 * R.d), O.M36, T9);
  } else {   // block in the web: exact integration here, TCC's simplified flange + web split is conservative
    const ex = R.bd.As + (R.bd.As2 || 0), tc = O.M21 + (O.M15 || 0);
    truth(`${t}: block in the web: exact A_s ${Math.round(ex)} ≤ TCC simplified ${Math.round(tc)} and within 10%`, ex <= tc * (1 + 1e-9) && ex >= 0.9 * tc);
  }
  if (!hog) { near(`${t}: F1·F2`, R.defl.F2 * R.defl.F1, O.M47, T9);
    near(`${t}: basic l/d with TCC's ρ, ρ′`, EC2Section.baseRatio(+I.M4, O.M36 / 100, O.M37 / 100, EC2.KSYS[SYS[I.H6]]), O.M44, T9); }
  // SLS: TCC's flanged cracked section differs (see notes); the same steel gives σs within 10%
  const AsT = Math.min(O.M34, 1.75 * O.M21), sec = hog ? { b: I.D10 } : { b, bw: I.D10, hf: I.D12 }, cr = EC2.cracked({ sec, As: AsT, d: R.d, As2: O.M18 || 0, d2: I.G12 + I.F12 / 2, ae: 15, M: R.Mk });
  truth(`${t}: σs characteristic ${cr.ss.toFixed(1)} within 10% of TCC ${O.M42.toFixed(1)}`, Math.abs(cr.ss - O.M42) <= 0.1 * O.M42);
});
TCC.slab.forEach((cs, i) => { const I = cs.in, O = cs.out, t = `TCC11 slab ${i} (h ${I.D10} C${I.M4}, ${I.D7} kNm/m)`;
  if (typeof O.M20 !== 'number') { truth(`${t}: TCC found no bar spacing (skipped)`, true); return; }
  const R = EC2Section.design({ kind: 'slab', h: I.D10, fck: +I.M4, fyk: 500, cover: I.D12, bar: { phi: I.D11, s: O.M20 }, MEd: I.D7 * 1e6, gk: O.G9, qk: I.G10, psi2: 0.3, delta: I.D8, ae: 15, wk: 0.3,
    defl: { system: SYS[I.H13], span: I.D9, brittle: true } });
  near(`${t}: d`, R.d, O.M7, T9); near(`${t}: x`, R.bd.x, O.M9, T9); near(`${t}: z`, R.bd.z, O.M11, T9); near(`${t}: A_s,req`, R.bd.As, O.M12, T9);
  near(`${t}: A_s,min`, R.AsMin, O.M14, T6); if (typeof O.M21 === 'number') near(`${t}: A_s,prov`, R.arr.As, O.M21, T9);
  near(`${t}: 100ρ`, 100 * R.defl.rho, O.M23, T9); near(`${t}: M quasi-permanent`, R.Mqp / 1e6, O.M26, T9); near(`${t}: M characteristic`, R.Mk / 1e6, O.O26, T9);
  if (typeof O.M21 === 'number') { const cr = EC2.cracked({ sec: { b: 1000 }, As: Math.min(O.M21, 1.75 * O.M12), d: R.d, ae: 15, M: R.Mk }); near(`${t}: σs characteristic`, cr.ss, O.O28, T9); }
  near(`${t}: basic l/d`, R.defl.base, O.M30, T9); near(`${t}: F2`, R.defl.F2, O.M33, T9);
});
TCC.shear.forEach((cs, i) => { const I = cs.in, O = cs.out, t = `TCC11 shear ${i} (bw ${I.H8} d ${I.G8} C${I.M1}, V ${I.G11} kN)`;
  const c = EC2.concrete(+I.M1), Asl = AREA(I.C12, I.C11), d = I.G8, bw = I.H8;
  const vc = EC2.shearConcrete({ bw, d, Asl, c }), VEdd = (I.G11 - I.H11 * d / 1000) * 1e3, des = EC2.shearDesign({ bw, d, VEd: VEdd, VEdStrut: I.G11 * 1e3, c, fywk: 500 });
  near(`${t}: ν`, c.nu, O.M4, T9); near(`${t}: k`, vc.k, O.M10, T9); near(`${t}: ρ_l`, vc.rho, O.M9, T9); near(`${t}: V_Rd,c`, vc.VRdc / 1e3, O.M11, T9); near(`${t}: V_Ed at d`, VEdd / 1e3, O.M8, T9);
  if (typeof O.M6 === 'number') { near(`${t}: cot θ`, des.cot, O.M6, T9); near(`${t}: V_Rd,max`, des.VRdmax / 1e3, O.M7, T9); near(`${t}: A_sw/s`, des.AswS, O.M14, T9); }
  near(`${t}: A_sw/s min`, des.AswSmin, O.M12, T9); near(`${t}: s_l,max`, des.slMax, O.M17, T9);
});

// ---------- 2 independent Python reference ----------
for (const [i, F] of REF.flanged.entries()) {
  const c = EC2.concrete(F.fck), bd = EC2.bendingDesign({ sec: { b: F.b, bw: F.bw, hf: F.hf, h: F.h }, d: F.d, M: F.M, c, s: S500, delta: 1, xdMax: 0.45 }), t = `flanged ${i} (block in the web, b ${F.b} bw ${F.bw} hf ${F.hf})`;
  truth(`${t}: block below the flange, singly reinforced`, !bd.inFlange && !bd.doubly);
  near(`${t}: x`, bd.x, F.x, 1e-3); near(`${t}: z`, bd.z, F.z, 1e-4); near(`${t}: A_s`, bd.As, F.As, 1e-4);
}
for (const [i, P] of REF.resist.entries()) {
  const c = EC2.concrete(P.fck), sec = { b: P.b, bw: P.bw, hf: P.hf, h: P.h }, r = EC2.bendingResistance({ sec, layers: P.layers.map(([As, d]) => ({ As, d })), c, s: S500 }), t = `resistance ${i} (${P.hf ? 'flanged' : 'rectangular'}, ${P.layers.length} layers)`;
  near(`${t}: neutral axis x`, r.x, P.x, 2e-3); near(`${t}: M_Rd`, r.MRd, P.MRd, 1e-3);
}
for (const [i, T] of REF.torsion.entries()) {
  const c = EC2.concrete(T.fck), r = EC2.torsion({ b: T.b, h: T.h, cEdge: T.cEdge, c, TEd: T.TEd, cot: T.cot }), t = `torsion ${i} (${T.b}×${T.h}, cot θ ${T.cot})`;
  for (const k of ['tef', 'Ak', 'uk', 'TRdc', 'TRdmax', 'AswS1', 'Asl']) near(`${t}: ${k}`, r[k], T[k], T9);
}
for (const [i, K] of REF.crack.entries()) {
  const r = EC2Toolkit.crackWidth({ kind: 'flexure', b: K.b, h: K.h, fck: K.fck, cover: K.cover, phi: K.phi, n: K.n, Mqp: K.M, ae: K.ae, kt: K.kt, wmax: 0.3 }), t = `crack width ${i} (${K.n}H${K.phi} in ${K.b}×${K.h})`;
  near(`${t}: x`, r.x, K.x, T9); near(`${t}: σs`, r.ss, K.ss, T9); near(`${t}: h_c,ef`, r.hcef, K.hc, T9); near(`${t}: ρ_p,eff`, r.rho, K.rho, T9);
  near(`${t}: ε_sm − ε_cm`, r.de, K.de, T9); near(`${t}: s_r,max`, r.sr, K.sr, T9); near(`${t}: w_k`, r.wk, K.wk, T9);
}
for (const A of REF.anchor) {
  const r = EC2Toolkit.anchorage({ phi: A.phi, fck: A.fck, fyk: 500, good: A.good, tension: true, bent: false, cd: A.cd, lappedPct: A.lapped }).a, t = `anchorage H${A.phi} ${A.good ? 'good' : 'poor'} bond`;
  for (const [k, e] of [['fbd', 'fbd'], ['lbrqd', 'lbrqd'], ['lbd', 'lbd'], ['l0', 'l0'], ['a2', 'a2'], ['a6', 'a6']]) near(`${t}: ${k}`, r[k], A[e], T9);
}

// ---------- 3 clause identities and behaviour ----------
{ const c = EC2.concrete(30);
  near('C30: f_ctm = 0.30 f_ck^(2/3)', c.fctm, 0.3 * 30 ** (2 / 3), 1e-12); near('C30: f_cd = 0.85 × 30/1.5 (UK NA α_cc)', c.fcd, 17, 1e-12); near('C30: ν = 0.6(1 − 30/250)', c.nu, 0.528, 1e-12);
  near('C30: E_cm = 22 (f_cm/10)^0.3 GPa', c.Ecm, 22000 * 3.8 ** 0.3, 1e-12);
  const bd = EC2.bendingDesign({ sec: { b: 1000, h: 300 }, d: 250, M: 1e9, c, s: S500, delta: 1, xdMax: 0.45 });
  near("K′ at x/d = 0.45, δ = 1: 0.168 (UK practice 0.167)", bd.Kp, 0.8 * 0.45 * 0.85 / 1.5 * (1 - 0.4 * 0.45), 1e-12);
  const bd2 = EC2.bendingDesign({ sec: { b: 300, h: 600 }, d: 540, M: 150e6, c, s: S500 }), r2 = EC2.bendingResistance({ sec: { b: 300, h: 600 }, layers: [{ As: bd2.As, d: 540 }], c, s: S500 });
  near('designed A_s gives M_Rd = M_Ed back (strain compatibility, yielded)', r2.MRd, 150e6, 1e-9);
  const bd3 = EC2.bendingDesign({ sec: { b: 300, h: 600 }, d: 540, d2: 50, M: 600e6, c, s: S500 });
  truth('high moment: compression steel at the x/d limit', bd3.doubly && bd3.As2 > 0 && Math.abs(bd3.x - 0.45 * 540) < 1e-9);
  const r3 = EC2.bendingResistance({ sec: { b: 300, h: 600 }, layers: [{ As: bd3.As2, d: 50 }, { As: bd3.As, d: 540 }], c, s: S500 });
  near('doubly reinforced: provided A_s, A_s2 give M_Rd ≥ M_Ed', Math.min(r3.MRd, 600e6), 600e6, 1e-3);
  near('x/d limit with 30% redistribution: (0.7 − 0.4)/1.0 = 0.30', EC2.xdLimit(c, 0.7, 0.45), 0.3, 1e-12);
  const sh = EC2.shearDesign({ bw: 300, d: 540, VEd: 200e3, c });
  truth('low shear: cot θ = 2.5', sh.cot === 2.5); near('A_sw/s = V/(z f_ywd cot θ)', sh.AswS, 200e3 / (0.9 * 540 * 500 / 1.15 * 2.5), 1e-12);
  const shr = EC2.shearResistance({ bw: 300, d: 540, AswS: sh.AswS, c }); near('shear resistance of those links = V_Ed', shr.VRd, 200e3, 1e-9);
  const an = EC2.anchorage({ phi: 16, c, good: true, tension: true, cd: 16 }); near('H16 C30 good bond: l_b,rqd = (φ/4) f_yd/f_bd', an.lbrqd, 4 * (500 / 1.15) / (2.25 * c.fctd), 1e-12);
  truth('anchorage minimum governs short bars', EC2.anchorage({ phi: 10, c, ss: 20 }).lbd === 100);
  near('C60: λ = 0.8 − 10/400', EC2.concrete(60).lambda, 0.775, 1e-12); near('C60 shear capped at C50: ν', EC2.concrete(60).nu, 0.6 * 0.8, 1e-12);
}
{ // full design: checks present, slab and beam, usage ψ2, suggestion-style search keeps A_s,prov ≥ A_s,req
  const base = { kind: 'beam', shape: 'rect', moment: 'sagging', b: 300, h: 600, fck: 32, fyk: 500, cover: 30, coverComp: 30, phiLink: 10, dg: 20, bar: { phi: 25, n: 4 }, comp: { phi: 16, n: 2 },
    MEd: 300e6, gk: 20, qk: 15, psi2: 0.3, delta: 1, ae: 15, wk: 0.3, defl: { system: 'ss', span: 7000, brittle: true }, shear: { VEd: 250e3, w: 60, link: { phi: 10, legs: 2, s: 200 } } };
  const R = EC2Section.design(base), ids = R.checks.map(k => k.id);
  truth(`beam design: bending, minimum steel, crack control, deflection and shear checks (${ids.join(', ')})`, ['bend', 'defl'].every(k => ids.includes(k)) && R.checks.length >= 6 && R.steps.length > 10);
  near('beam d = h − cover − link − φ/2', R.d, 600 - 30 - 10 - 12.5, 1e-12);
  truth('M_Rd of 4H25 > 300 kNm and the bending utilisation agrees', R.res.MRd > 300e6 && Math.abs(R.checks.find(k => k.id === 'bend').util - 300e6 / R.res.MRd) < 1e-9);
  const R2 = EC2Section.design({ ...base, bar: { phi: 25, n: 3 } }); truth('3H25: fewer bars, higher bending utilisation', R2.checks.find(k => k.id === 'bend').util > R.checks.find(k => k.id === 'bend').util);
  const Rl = EC2Section.design({ ...base, bar: { phi: 20, n: 8, layers: 2 } }); truth('two layers: d measured to the centroid, below single-layer d', Rl.d < 600 - 30 - 10 - 10 && Rl.arr.layers.length === 2);
  const Rs = EC2Section.design({ kind: 'slab', h: 225, fck: 30, fyk: 500, cover: 25, bar: { phi: 12, s: 150 }, MEd: 35e6, gk: 7, qk: 2.5, psi2: 0.3, delta: 1, ae: 15, wk: 0.3, defl: { system: 'end', span: 5500, brittle: true } });
  near('slab A_s,prov H12 @ 150 = 754 mm²/m', Rs.arr.As, AREA(1, 12) * 1000 / 150, 1e-12); near('slab d', Rs.d, 225 - 25 - 6, 1e-12);
  truth('usage categories: ψ2 B office 0.3, E storage 0.8', EC2Section.USAGE.B[1] === 0.3 && EC2Section.USAGE.E[1] === 0.8);
  let threw = false; try { EC2Section.design({ ...base, fck: 8 }); } catch (e) { threw = /f_ck/.test(e.message); } truth('f_ck out of range rejected', threw);
}
{ // torsion: interaction picks the flattest strut that works; crack-free case needs no designed steel
  const T = EC2Toolkit.torsion({ b: 300, h: 600, fck: 30, fyk: 500, cover: 30, phiLink: 10, phiBar: 16, legs: 2, s: 150, nBars: 8, TEd: 25e6, VEd: 150e3, Asl: AREA(3, 20) });
  truth('torsion: cot θ in 1…2.5 and interaction ≤ 1', T.cot >= 1 && T.cot <= 2.5 && T.t.inter <= 1 + 1e-9);
  const T0 = EC2Toolkit.torsion({ b: 300, h: 600, fck: 30, fyk: 500, cover: 30, phiLink: 10, phiBar: 16, legs: 2, s: 150, nBars: 8, TEd: 1e6, VEd: 10e3, Asl: AREA(3, 20) });
  truth('small torsion: crack-free (6.31), no designed torsion steel', T0.t.crackFree && T0.AslT === 0);
  const Ct = EC2Toolkit.crackWidth({ kind: 'tension', b: 1000, h: 300, fck: 30, cover: 40, phi: 16, s: 150, Nqp: 300e3, kt: 0.4, wmax: 0.2 });
  near('axial tension: σs = N/(2 A_s) per face', Ct.ss, 300e3 / (2 * AREA(1, 16) * 1000 / 150), 1e-12); truth('axial tension uses k2 = 1.0 (s_r,max above flexure value)', Ct.sr > 3.4 * 40 + 0.8 * 0.5 * 0.425 * 16 / Ct.rho);
}

console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
/* Documented differences from TCC11 (v4.7), all on the conservative side for TCC or a choice of method:
   - TCC uses A_s = min(A_s,prov, 1.75 A_s,req) for σs; the tool uses the provided steel (the tests feed TCC's rule in to compare).
   - TEE~BEAM with the stress block in the web: TCC uses the simplified flange + web split (Concrete Centre "How to" method); the
     tool integrates the rectangular block over the actual section, giving up to ~10% less steel.
   - TEE~BEAM deflection: TCC takes ρ′ from the compression bars provided; the tool uses A_s2,req (7.4.2 ρ′ = required).
   - TEE~BEAM SLS: TCC's cracked flanged section is simplified; the tool solves the transformed T-section exactly.
   - TCC extrapolates Table 7.3N below σs = 160 N/mm²; the tool caps the spacing at the table's 300 mm.
   - Minimum crack steel: TCC takes k (7.1) from the beam width; the tool takes k from the smaller of h and b as 7.3.2(2) intends.
   - Span/depth: both cap l/d at 40K with the UK NA notes; F3 = 310/σs ≤ 1.5. */
