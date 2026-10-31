// RC Beam Analysis & Design: node test_rc_beam.js
// 1 The independent Python reference (reference/ref_rc_beam.py): every load arrangement of 14 random beams solved as a frame
//   with the columns as members (numpy), redistribution by superposed corrections; end moments, reactions, envelopes,
//   exact span maxima, SLS envelopes and design support moments agree to 1e-8.
// 2 The Concrete Centre TCC41 (ref_tcc41.json, 75 beams recalculated in LibreOffice, outputs only): analysis within TCC's
//   truncated moment distribution (~1e-3), the design quantities computed the same way to 1e-9; method differences as notes.
// 3 Behaviour: cantilevers, encastré and knife-edge supports, the rules for support moments, suggestions, curtailment, errors.
const { EC2, EC2Section, RCBeam, RCBeamDesign } = require('./load.js');
const REF = require('./ref_rc_beam.json'), TCC = require('./ref_tcc41.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, scale = null) => { n++; const e = Math.abs(got - exp) / Math.max(Math.abs(scale ?? exp), 1e-9); const ok = e <= tol; if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(8)} expected ${(+exp).toPrecision(8)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; if (!c || process.env.V) console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, fn, re) => { let m = ''; try { fn(); } catch (e) { m = e.message; } truth(`${name} (${m || 'no error'})`, re.test(m)); };

// ---------- 1 independent frame reference ----------
REF.cases.forEach((C, ci) => {
  const m = C.model, R = C.res, ns = m.spans.length, inp = { ...m, patterns: RCBeam.patternList(ns, m.adjacent) };
  const A = RCBeam.analyse(inp), tag = `ref ${ci} (${ns} span${ns > 1 ? 's' : ''}, ${m.supports.map(s => s.kind).join('/')})`;
  const Ms = Math.max(1, ...R.Mmax, ...R.spanMax.map(s => s.elastic)), Rs = Math.max(1, ...R.Rmax.map(Math.abs));
  const Vs = Math.max(1, ...R.stations.flat().map(s => Math.max(Math.abs(s.VmaxR), Math.abs(s.VminR))));
  truth(`${tag}: ${R.cases.length} load arrangements`, A.cases.length === R.cases.length);
  R.cases.forEach((c, p) => {
    for (let i = 0; i < ns; i++) for (const k of [0, 1]) { near(`${tag} case ${p} span ${i + 1} ${k ? 'right' : 'left'} end moment, elastic`, A.cases[p].hog[i][k], c.hog[i][k], 1e-8, Ms); near(`${tag} case ${p} span ${i + 1} ${k ? 'right' : 'left'} end moment, redistributed`, A.cases[p].hogR[i][k], c.hogR[i][k], 1e-8, Ms); }
    for (let j = 0; j <= ns; j++) { near(`${tag} case ${p} reaction ${j + 1}`, A.cases[p].R[j], c.R[j], 1e-8, Rs); near(`${tag} case ${p} reaction ${j + 1}, redistributed`, A.cases[p].RR[j], c.RR[j], 1e-8, Rs); }
  });
  R.stations.forEach((st, i) => st.forEach(s => {
    const eR = RCBeam.envAt(A, i, s.x, 'R'), eL = RCBeam.envAt(A, i, s.x, 'L'), at = `${tag} span ${i + 1} x = ${s.x.toFixed(0)}`;
    for (const k of ['MmaxE', 'MminE', 'Mmax', 'Mmin', 'MmaxD', 'MminD', 'MkMax', 'MkMin', 'MqMax', 'MqMin']) near(`${at}: ${k}`, eR[k], s[k], 1e-8, Ms);
    near(`${at}: V max (right of x)`, eR.Vmax, s.VmaxR, 1e-8, Vs); near(`${at}: V min (right of x)`, eR.Vmin, s.VminR, 1e-8, Vs);
    near(`${at}: V max (left of x)`, eL.Vmax, s.VmaxL, 1e-8, Vs); near(`${at}: V min (left of x)`, eL.Vmin, s.VminL, 1e-8, Vs);
  }));
  R.spanMax.forEach((s, i) => { const t = `${tag} span ${i + 1}`;
    near(`${t}: exact sagging maximum, elastic`, A.spanM[i].elastic, s.elastic, 1e-8, Ms); near(`${t}: in equilibrium after redistribution`, A.spanM[i].equilibrium, s.equilibrium, 1e-8, Ms);
    near(`${t}: design (≥ δ_f × elastic)`, A.spanM[i].redist, s.design, 1e-8, Ms); near(`${t}: SLS characteristic`, A.spanM[i].Mk, s.Mk, 1e-8, Ms); near(`${t}: SLS quasi-permanent`, A.spanM[i].Mqp, s.Mqp, 1e-8, Ms); });
  R.Rmax.forEach((r, j) => near(`${tag} support ${j + 1}: largest ULS reaction`, A.Rmax[j], r, 1e-8, Rs));
  const D = RCBeamDesign.design({ ...inp, selfWeight: 'none', fck: 30, fyk: 500, cover: { top: 30, btm: 30 }, phiLink: 8, wk: { top: 0.3, btm: 0.3 } }, { analysis: A });
  R.design.forEach((sd, j) => { if (!sd) { truth(`${tag} support ${j + 1}: free end, no support design`, D.supZ[j] === null); return; }
    sd.forEach(x => { const z = D.supZ[j].sides.find(y => y.side === x.side), t = `${tag} support ${j + 1}${x.side}`;
      near(`${t}: moment at the face`, z.Mface, x.Mface, 1e-8, Ms); near(`${t}: centreline`, z.Mcl, x.Mcl, 1e-8, Ms); near(`${t}: design moment (${z.rule})`, z.Mdes, x.Mdes, 1e-8, Ms); }); });
});

// ---------- 2 TCC41 ----------
const PSI2 = { Office: 0.3, Shopping: 0.6, Storage: 0.8, Dwelling: 0.3 }, SB = [8, 38, 74, 104, 140, 170], COLS = 'CDEFGHIJKLMN';
const MD = 2e-3;   // TCC41 stops its moment distribution after a fixed number of cycles
const counts = {};
const tccNear = (k, got, exp, tol, scale) => { counts[k] = (counts[k] || 0) + 1; near(k, got, exp, tol, scale); };
TCC.cases.forEach((cs, ci) => {
  const ns = cs.n, O = cs.out, tag = `TCC41 ${ci} (${ns} spans)`;
  const spans = cs.spans.map(s => ({ L: s.L * 1000, h: s.h, bw: s.bw, hf: s.hf, shape: s.type, beff: s.type === 'R' ? s.bw : s.beff, bay: 5000 }));
  const supports = cs.sups.map((s, j) => s.kind === 'K' ? { kind: 'knife', width: 0, delta: 1 - cs.red[j] } : { kind: 'column', width: s.below.H, delta: 1 - cs.red[j],
    above: s.above ? { L: s.above.L * 1000, b: s.above.B, h: s.above.H, far: s.above.far } : null, below: { L: s.below.L * 1000, b: s.below.B, h: s.below.H, far: s.below.far } });
  const loads = cs.loads.flatMap((l, i) => [{ span: i, case: 'G', type: 'udl', w: l.G }, { span: i, case: 'Q', type: 'udl', w: l.Q },
    ...(l.pl || []).flatMap(p => [{ span: i, case: 'G', type: 'point', P: p.G, a: p.a }, { span: i, case: 'Q', type: 'point', P: p.Q, a: p.a }]),
    ...(l.pu ? [{ span: i, case: 'G', type: 'part', w: l.pu.G, a: l.pu.a, b: l.pu.b }, { span: i, case: 'Q', type: 'part', w: l.pu.Q, a: l.pu.a, b: l.pu.b }] : [])]);
  const inp = { spans, supports, loads, sets: [{ gG: O['Uls!C8'], gQ: O['Uls!F9'], label: 'TCC' }], patterns: RCBeam.patternList(ns, false), redist: cs.in['ACTIONS!L14'] === 2 ? 'none' : 'limited',
    psi2: PSI2[cs.usage], selfWeight: 'none', fck: cs.fck, fyk: 500, dg: 20, cover: { top: cs.in['MAIN!J9'], btm: cs.in['MAIN!J10'] }, phiLink: cs.bars[0].link, legs: 2, wk: { top: cs.in['MAIN!H9'], btm: cs.in['MAIN!H10'] }, brittle: true };
  const A = RCBeam.analyse(inp), Mref = Math.max(...A.supM.map(s => s.elastic), ...A.spanM.map(s => s.elastic)) / 1e6, Rref = Math.max(...A.Rmax) / 1e3;
  // support moments per pattern (all, odd, even) and side; TCC also scales a sagging support moment by beta+, so those are left out
  [['elastic', 185, 'hog'], ['redistributed', 198, 'hogR']].forEach(([nm, r0, key]) => {
    for (let p = 0; p < 3 && p < A.cases.length - 1; p++) for (let j = 0; j <= ns; j++) for (const side of ['L', 'R']) {
      if ((side === 'L' && j === 0) || (side === 'R' && j === ns)) continue;
      const got = (side === 'L' ? A.cases[p][key][j - 1][1] : A.cases[p][key][j][0]) / 1e6; if (key === 'hogR' && got < 0) continue;
      tccNear(`support moments per pattern, ${nm}`, got, O[`Uls!${COLS[2 * (j + 1) + (side === 'R' ? 1 : 0) - 3]}${r0 + p}`], MD, Mref);
    } });
  for (let j = 0; j <= ns; j++) { tccNear('largest support moment, elastic', A.supM[j].elastic / 1e6, O[`ACTIONS!${'DEFGHIJ'[j]}23`], MD, Mref); tccNear('largest support moment, redistributed', A.supM[j].redist / 1e6, O[`ACTIONS!${'DEFGHIJ'[j]}24`], MD, Mref);
    tccNear('largest ULS reaction', A.Rmax[j] / 1e3, O[`MAIN!${'DEFGHIJ'[j]}58`], MD, Rref); tccNear('reaction under 1.0 G_k', A.cases[A.cases.length - 1].R[j] / 1e3, O[`MAIN!${'DEFGHIJ'[j]}59`], MD, Rref); }
  for (let i = 0; i < ns; i++) { tccNear('span moment, elastic', A.spanM[i].elastic / 1e6, O[`ACTIONS!${'DEFGHI'[i]}29`], MD, Mref); tccNear('span moment, redistributed (floor 1 − max adjacent redistribution)', A.spanM[i].redist / 1e6, O[`ACTIONS!${'DEFGHI'[i]}30`], MD, Mref);
    if (A.spanM[i].elastic > 0.02 * Mref * 1e6) tccNear('span δ', A.spanM[i].delta, O[`ACTIONS!${'DEFGHI'[i]}31`], 3e-3); }
  const D = RCBeamDesign.design(inp, { analysis: A }), c = EC2.concrete(cs.fck), st = EC2.steel(500);
  for (let i = 0; i < ns; i++) {
    const b0 = SB[i], bb = 94 * i, s = A.P.spans[i], bar = cs.bars[i], g = k => O[`SPANS!${k}`], bv = k => O[`Bar!G${k + bb}`], t = `${tag} span ${i + 1}`;
    const sL = D.supZ[i] && D.supZ[i].sides.find(x => x.i === i), sR = D.supZ[i + 1] && D.supZ[i + 1].sides.find(x => x.i === i), sag = D.spanZ[i].sag, e = A.env[i];
    const kL = cs.sups[i].kind === 'K', kR = cs.sups[i + 1].kind === 'K';
    // design moments at the supports: TCC = max(0.25 M_span, face of the redistributed envelope floored at 0.7 x elastic, 0.65 M_cl)
    const tccDes = (x, xc) => { const f = Math.max(0, -RCBeam.envAt(A, i, x).Mmin, -0.7 * RCBeam.envAt(A, i, x).MminE), cl = Math.max(0, -RCBeam.envAt(A, i, xc).Mmin); return Math.max(0.25 * sag.M, f, 0.65 * cl); };
    for (const [nm, col, z, kn, x, xc, j] of [['left', 'F', sL, kL, cs.sups[i].below && cs.sups[i].below.H / 2, 0, i], ['right', 'L', sR, kR, cs.sups[i + 1].below && s.L - cs.sups[i + 1].below.H / 2, s.L, i + 1]]) {
      if (!z || kn) continue;
      tccNear('support design moment by TCC\'s rule', tccDes(x, xc) / 1e6, g(`${col}${b0 + 1}`), MD, Mref);
      const interior = j > 0 && j < ns, bound = interior ? Math.max(-RCBeam.envAt(A, i, x).Mmin, -0.7 * RCBeam.envAt(A, i, x).MminE, 0.65 * -RCBeam.envAt(A, i, xc).Mmin) : tccDes(x, xc);
      counts['tool support moment ≥ TCC (no β₁ at interior supports)'] = (counts['tool support moment ≥ TCC (no β₁ at interior supports)'] || 0) + 1;
      truth(`${t} ${nm}: tool's design moment ${(z.Mdes / 1e6).toFixed(2)} ≥ TCC's rule without β₁ at interior supports ${(bound / 1e6).toFixed(2)} kNm`, z.Mdes >= bound * (1 - 1e-9));
    }
    tccNear('span design moment', sag.M / 1e6, g(`I${b0 + 1}`), MD, Mref);
    const lay2 = ['E', 'H', 'K'].some(k => (g(`${k}${b0 + 7}`) || 0) > 0 || (g(`${k}${b0 + 11}`) || 0) > 0), lk = bar.link;
    if (!lay2) { tccNear('effective depth, top bars', s.h - inp.cover.top - lk - bar.tl / 2, g(`F${b0 + 3}`), 1e-9); tccNear('effective depth, top bars', s.h - inp.cover.top - lk - bar.tr / 2, g(`L${b0 + 3}`), 1e-9); tccNear('effective depth, bottom bars', s.h - inp.cover.btm - lk - bar.bc / 2, g(`I${b0 + 3}`), 1e-9); }
    // steel areas from TCC's moment, d and delta: singly reinforced within x/d 0.6 and (spans) the block within h_f
    const asAt = (M, sec, d, dl, span) => { const r = EC2.bendingDesign({ sec, d, d2: 50, M, c, s: st, delta: Math.min(1, dl), xdMax: null }); return r.doubly || (span && 0.8 * r.x > s.hf) ? null : EC2.bendingDesign({ sec, d, d2: 50, M, c, s: st, delta: dl, xdMax: null }); };
    for (const [col, z, kn] of [['F', sL, kL], ['L', sR, kR]]) if (z && !kn && !(g(`${col}${b0 + 5}`) > 0)) { const r = asAt(g(`${col}${b0 + 1}`) * 1e6, { b: s.bw, h: s.h }, g(`${col}${b0 + 3}`), g(`${col}${b0 + 2}`), false); if (r) tccNear('A_s at a support (TCC M, d, δ)', r.As, g(`${col}${b0 + 4}`), 1e-9); }
    if (!(g(`I${b0 + 5}`) > 0)) { const r = asAt(g(`I${b0 + 1}`) * 1e6, s.shape === 'R' ? { b: s.bw, h: s.h } : { b: s.beff, bw: s.bw, hf: s.hf, h: s.h }, g(`I${b0 + 3}`), g(`I${b0 + 2}`), true); if (r) tccNear('A_s in a span (TCC M, d, δ)', r.As, g(`I${b0 + 4}`), 1e-9); }
    // shear: V_Rd,c with TCC's d and top steel; V at the face, V_Rd,max and link spacing where TCC's V_cl - w a holds (UDL only, no reversal)
    const udlOnly = !((cs.loads[i].pl || []).length || cs.loads[i].pu);
    for (const [col, end, kn] of [['F', 'L', kL], ['L', 'R', kR]]) {
      const sh = D.spanZ[i].sh[end]; if (!sh || kn) continue;
      const d = g(`${col}${b0 + 3}`); tccNear('V_Rd,c (TCC d, top steel)', EC2.shearConcrete({ bw: s.bw, d, Asl: g(`${col}${b0 + 9}`), c }).VRdc / 1e3, g(`${col}${b0 + 15}`), 1e-9);
      const pos = end === 'L' ? RCBeam.envAt(A, i, sh.face).Vmax >= -RCBeam.envAt(A, i, sh.face).Vmin : -RCBeam.envAt(A, i, sh.face, 'L').Vmin >= RCBeam.envAt(A, i, sh.face, 'L').Vmax;
      if (!udlOnly || !pos) continue;
      tccNear('V_Ed at the face', sh.Vface / 1e3, g(`${col}${b0 + 14}`), MD);
      const w = cs.loads[i].G * O['Uls!C8'] + cs.loads[i].Q * O['Uls!F9'], des = EC2.shearDesign({ bw: s.bw, d, VEd: sh.Vface - w * d, VEdStrut: sh.Vface, c, fywk: 500 });
      tccNear('V_Rd,max at the strut angle', des.VRdmax / 1e3, g(`${col}${b0 + 16}`), MD); tccNear('link spacing required', 2 * Math.PI * lk * lk / 4 / Math.max(des.AswS, des.AswSmin), g(`${col}${b0 + 17}`), MD);
    }
    // span/depth: rho on b_w d + (b_eff - b_w) h_f, the basic ratio, sigma_s on TCC's section, allowed l/d
    if (!(bv(36) > 0.01)) continue;
    if (!cs.loads.some(l => (l.pl || []).length)) tccNear('SLS characteristic span moment (TCC samples 20 points)', A.spanM[i].Mk / 1e6, bv(36), 5e-3, Mref);
    const fl = s.shape !== 'R', d = g(`I${b0 + 3}`);
    tccNear('area for ρ in 7.16', fl ? s.bw * d + (s.beff - s.bw) * s.hf : s.bw * d, bv(8), 1e-9);
    tccNear('basic l/d (7.16) with TCC ρ, ρ′', Math.min(100, EC2Section.baseRatio(cs.fck, bv(40) / 100, bv(41) / 100, EC2.KSYS[sag.sys])), Math.min(100, bv(42)), 1e-9);
    const ss = EC2.cracked({ sec: { b: fl ? s.beff : s.bw }, As: bv(54), d, As2: bv(69), d2: bv(19), ae: O['Bar!T3'], M: bv(36) * 1e6 }).ss;
    tccNear('σ_s (TCC: rectangle b_eff, its α_e and bars)', ss, bv(39), 1e-9);
    const F1 = fl ? Math.max(0.8, 1 - 0.1 * (s.beff / s.bw - 1)) : 1, F2 = s.L > 7000 ? 7000 / s.L : 1;
    tccNear('allowed l/d = min(40K, basic F1 F2 F3)', Math.min(40 * EC2.KSYS[sag.sys], Math.min(100, bv(42)) * F1 * F2 * Math.min(1.5, 310 / bv(39))), g(`I${b0 + 13}`), 1e-9);
    tccNear('actual l/d', s.L / d, g(`F${b0 + 13}`), 1e-9);
  }
});
for (const [k, v] of Object.entries(counts)) truth(`TCC41 ${k}: ${v} comparisons`, v >= 9);

// ---------- 3 behaviour ----------
const base = (o = {}) => ({ spans: [{ L: 6000, h: 450, bw: 300, hf: 125, shape: 'T', beff: null, bay: 5000 }, { L: 7500, h: 450, bw: 300, hf: 125, shape: 'T', beff: null, bay: 5000 }],
  supports: [{ kind: 'column', width: 300, delta: 1, above: { L: 3500, b: 300, h: 300, far: 'F' }, below: { L: 3500, b: 300, h: 300, far: 'F' } }, { kind: 'column', width: 350, delta: 0.85, above: { L: 3500, b: 350, h: 350, far: 'F' }, below: { L: 3500, b: 350, h: 350, far: 'F' } }, { kind: 'knife', width: 250, delta: 1 }],
  loads: [{ span: 0, case: 'G', type: 'udl', w: 30 }, { span: 0, case: 'Q', type: 'udl', w: 15 }, { span: 1, case: 'G', type: 'udl', w: 30 }, { span: 1, case: 'Q', type: 'udl', w: 15 }],
  rule: '6.10', psi0: 0.7, psi2: 0.3, redist: 'limited', selfWeight: 'downstand', gc: 25, fck: 30, fyk: 500, dg: 20, cover: { top: 30, btm: 30 }, phiLink: 10, legs: 2, wk: { top: 0.3, btm: 0.3 }, brittle: true, ...o });
{ // single span: simply supported closed forms, b_eff by 5.3.2.1, self-weight
  const m = base({ spans: [{ L: 6000, h: 500, bw: 300, hf: 150, shape: 'T', beff: null, bay: 3000 }], supports: [{ kind: 'knife', width: 0 }, { kind: 'knife', width: 0 }], loads: [{ span: 0, case: 'G', type: 'udl', w: 20 }, { span: 0, case: 'Q', type: 'udl', w: 10 }] });
  const P = RCBeam.prepare(m); near('single span: b_eff = b_w + 2 min(0.2 b₁ + 0.1 l₀, 0.2 l₀), l₀ = L', P.spans[0].beff, 300 + 2 * Math.min(0.2 * 1350 + 0.1 * 6000, 0.2 * 6000), 1e-12);
  const D = RCBeamDesign.design(m), w = 1.35 * (20 + 25 * 0.3 * 0.35) + 1.5 * 10;
  near('self-weight of the downstand 25 b_w (h − h_f)', D.sw[0], 25 * 0.3 * 0.35, 1e-12);
  near('simply supported: M = wL²/8', D.A.spanM[0].elastic, w * 6000 ** 2 / 8, 1e-9); near('reactions wL/2', D.A.Rmax[0], w * 3000, 1e-9);
  truth('no hogging and the span is "ss" for deflection', D.A.supM[0].elastic === 0 && D.spanZ[0].sag.sys === 'ss');
}
{ // two equal spans on knife edges: 3-moment equation M = wL²/8 for all spans loaded; propped cantilever on an encastré end
  const m = base({ spans: [{ L: 6000, h: 450, bw: 300, shape: 'R' }, { L: 6000, h: 450, bw: 300, shape: 'R' }], supports: [{ kind: 'knife', width: 0 }, { kind: 'knife', width: 0, delta: 1 }, { kind: 'knife', width: 0 }], loads: [{ span: 0, case: 'G', type: 'udl', w: 10 }, { span: 1, case: 'G', type: 'udl', w: 10 }], selfWeight: 'none' });
  const A = RCBeam.analyse(m); near('two equal spans: support moment wL²/8', A.cases[0].hog[0][1], 1.35 * 10 * 6000 ** 2 / 8, 1e-12);
  const m2 = base({ spans: [{ L: 5000, h: 450, bw: 300, shape: 'R' }], supports: [{ kind: 'fixed', width: 0 }, { kind: 'knife', width: 0 }], loads: [{ span: 0, case: 'G', type: 'point', P: 100, a: 2 }], selfWeight: 'none' });
  const A2 = RCBeam.analyse(m2), a = 2000, b = 3000, L = 5000; near('propped cantilever, point load: M_fixed = P a b (L + b)/(2 L²)', A2.cases[0].hog[0][0], 1.35 * 100e3 * a * b * (L + b) / (2 * L * L), 1e-12);
  // column stiffness: one span between rigid-jointed columns (fixed far ends): end moment = FEM k_c/(k_c + k_b) style closed form
  const kb = 4 * (300 * 450 ** 3 / 12) / 6000, kc = 2 * 4 * (300 * 300 ** 3 / 12) / 3000, m3 = base({ spans: [{ L: 6000, h: 450, bw: 300, shape: 'R' }], supports: [0, 1].map(() => ({ kind: 'column', width: 0, above: { L: 3000, b: 300, h: 300, far: 'F' }, below: { L: 3000, b: 300, h: 300, far: 'F' } })), loads: [{ span: 0, case: 'G', type: 'udl', w: 10 }], selfWeight: 'none' });
  const A3 = RCBeam.analyse(m3), FEM = 1.35 * 10 * 6000 ** 2 / 12; near('symmetric span between columns: end moment = FEM k_c/(k_c + k_b/2)', A3.cases[0].hog[0][0], FEM * kc / (kc + kb / 2), 1e-12);
  const colM = A3.cases[0].colM[0]; near('column moments above + below = beam end moment', colM.above + colM.below, A3.cases[0].hog[0][0], 1e-12); near('pinned far end: 3EI/L', RCBeam.prepare({ ...m3, supports: m3.supports.map(s => ({ ...s, above: { ...s.above, far: 'P' } })) }).supports[0].kA, 3 * (300 * 300 ** 3 / 12) / 3000, 1e-12);
}
{ // cantilevers: determinate root moment, elastic both sides, design at the root, deflection with K = 0.4
  const m = base({ spans: [{ L: 2000, h: 450, bw: 300, shape: 'R' }, { L: 6000, h: 450, bw: 300, shape: 'R' }], supports: [{ kind: 'free' }, { kind: 'column', width: 300, delta: 0.8, above: { L: 3000, b: 300, h: 300, far: 'F' }, below: { L: 3000, b: 300, h: 300, far: 'F' } }, { kind: 'knife', width: 200 }],
    loads: [{ span: 0, case: 'G', type: 'udl', w: 20 }, { span: 0, case: 'Q', type: 'point', P: 30, a: 0 }, { span: 1, case: 'G', type: 'udl', w: 25 }], selfWeight: 'none' });
  const D = RCBeamDesign.design(m), A = D.A, c0 = A.cases[0];
  near('cantilever root moment = Σ load × lever arm', c0.hog[0][1], 1.35 * 20 * 2000 ** 2 / 2 + 1.5 * 30e3 * 2000, 1e-12);
  truth('cantilever root support keeps its moments (no redistribution at a determinate support)', A.cases.every(c => c.hogR[0][1] === c.hog[0][1] && c.hogR[1][0] === c.hog[1][0]) && A.P.supports[1].delta === 1);
  const sd = D.supZ[1].sides.find(x => x.side === 'L'); truth('cantilever side designed at the face, K = 0.4 for deflection', /cantilever root/.test(sd.rule) && sd.R.defl && sd.R.defl.K === 0.4);
  truth('no shear check at the free end, and the free end has no support design', !D.spanZ[0].sh.L && D.supZ[0] === null);
  throws('single cantilever on a knife edge rejected', () => RCBeam.prepare(base({ spans: [{ L: 2000, h: 400, bw: 300, shape: 'R' }], supports: [{ kind: 'free' }, { kind: 'knife' }] })), /fixed/);
  throws('both ends free rejected', () => RCBeam.prepare(base({ supports: [{ kind: 'free' }, { kind: 'knife' }, { kind: 'free' }] })), /mechanism/);
  throws('a cantilever on a knife-edge root with nothing else rotating is a mechanism', () => RCBeam.analyse({ ...base({ spans: [{ L: 2000, h: 400, bw: 300, shape: 'R' }, { L: 4000, h: 400, bw: 300, shape: 'R' }], supports: [{ kind: 'free' }, { kind: 'knife' }, { kind: 'free' }] }) }), /mechanism|free/);
}
{ // support moment rules and the redistribution rules
  const D = RCBeamDesign.design(base()), A = D.A;
  const s1 = D.supZ[0].sides[0]; truth(`monolithic end support: ≥ β₁ = 0.25 × span moment (${s1.rule})`, s1.Mdes >= 0.25 * A.spanM[0].redist * (1 - 1e-12));
  const s2 = D.supZ[1].sides.find(x => x.side === 'L'); truth('interior column: the face moment, not less than 0.65 × centreline', s2.Mdes >= 0.65 * s2.Mcl - 1e-6 && s2.Mdes >= s2.Mface - 1e-6 && s2.Mface < s2.Mcl);
  const s3 = D.supZ[2].sides[0]; truth('knife-edge end support: no β₁, centreline less F t/8 (zero here)', s3.Mdes === 0 && /F t\/8/.test(s3.rule));
  near('support 2: redistributed peak = δ × elastic peak', A.supM[1].redist, 0.85 * A.supM[1].elastic, 1e-12);
  truth('every pattern within ±(1 − δ) of its elastic moment at support 2', A.cases.filter(c => c.uls).every(c => c.hogR[0][1] >= 0.85 * c.hog[0][1] - 1e-6 && c.hogR[0][1] <= 1.15 * c.hog[0][1] + 1e-6));
  truth('1.0 G_k case: never raised', A.cases.filter(c => !c.uls).every(c => c.hogR[0][1] <= c.hog[0][1] + 1e-9));
  truth('design span moments ≥ δ_f × elastic, δ_f = 0.85', A.spanM.every(s => s.redist >= 0.85 * s.elastic - 1e-6));
  const An = RCBeam.analyse({ ...base(), redist: 'none', loads: base().loads });
  truth('reductions only: no pattern raised', An.cases.every(c => c.hogR.every((h, i) => h[0] <= c.hog[i][0] + 1e-9 && h[1] <= c.hog[i][1] + 1e-9)));
  throws('δ below 0.7 rejected', () => RCBeam.prepare(base({ supports: base().supports.map((s, j) => j === 1 ? { ...s, delta: 0.6 } : s) })), /δ must be between/);
  const A2 = RCBeam.analyse({ ...base(), rule: '6.10ab' }); truth('6.10a/b: two sets of patterns + 1.0 G_k', A2.cases.length === 2 * 3 + 1);
  const A3 = RCBeam.analyse({ ...base({ spans: [0, 1, 2, 3].map(() => ({ L: 6000, h: 450, bw: 300, shape: 'R' })), supports: [0, 1, 2, 3, 4].map(() => ({ kind: 'knife', width: 0 })) }), adjacent: true });
  truth('adjacent-span patterns: all, odd, even + 3 pairs + 1.0 G_k', A3.cases.length === 3 + 3 + 1);
}
{ // suggestions and curtailment
  const m = base(), B = RCBeamDesign.suggest(m), D = RCBeamDesign.design({ ...m, bars: B });
  truth(`suggested bars and links pass every check (max ${D.utilMax.toFixed(3)})`, D.utilMax <= 1 + 1e-9);
  truth('suggested top bars at the redistributed support ≥ the bending steel required', D.supZ[1].sides.every(sd => sd.R.arr.As >= sd.R.bd.As));
  const cs = D.curt.sup[1].find(x => x.side === 'L'); truth(`top bars over support 2 extend past the hogging zone + a_l + l_bd (${Math.round(cs.all)} mm), 50% sooner (${Math.round(cs.half)} mm)`, cs.all > cs.x0 && cs.all >= cs.half && cs.x0 < m.spans[0].L);
  const sp = D.curt.span[0], sq = D.curt.span[1]; truth('half the span-1 bottom bars may stop before both supports', sp.stopL > 0 && sp.stopR > 0 && sp.stopL < m.spans[0].L / 2);
  truth('span 2 next to its simply supported end: all bottom bars run to that support', sq.stopR === 0 && sq.stopL > 0);
  const D2 = RCBeamDesign.design({ ...m, bars: { ...B, spans: B.spans.map(s => ({ ...s, links: { sL: 400, sM: 400, sR: 400 } })) } });
  truth('links at 400 mm fail the spacing rule', D2.checks.some(k => k.id === 'linksp' && k.util > 1));
  const D3 = RCBeamDesign.design({ ...m, bars: { ...B, supports: B.supports.map(s => ({ top: { n: 2, phi: 12, layers: 1 } })) } });
  truth('2H12 over the interior support fails bending', D3.checks.some(k => k.zone === 'sup' && k.id === 'bend' && k.util > 1));
}
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
/* Documented differences from TCC41 (v4.6):
   - TCC41 solves by moment distribution stopped after a fixed number of cycles: its moments differ from the exact solution by
     up to ~0.1%; the tool solves the same sub-frame exactly (stiffness method), checked against an independent frame model.
   - Span 6 of a six-span beam: TCC41's second moment of area refers to span 5's centroid (Uls!N26 uses J25), so six-span
     beams are not compared.
   - A sagging moment at a support (uplift patterns) is multiplied by beta+ in TCC; the tool leaves it elastic. TCC's "full"
     redistribution (beta+ = 5) is not offered: support moments are reduced to delta times the peak and the other patterns
     moved by up to 1 - delta, as TCC's default.
   - Face moments: TCC floors the redistributed envelope at 0.7 x elastic; the tool at delta_f x elastic (delta_f the smaller
     delta of the span's supports, >= 0.7), so its moments are equal or larger. TCC also applies 0.25 x span moment at
     interior supports; the tool applies beta1 = 0.25 at end supports only (9.2.1.2(1)).
   - TCC's "Gk,inf" envelope rows are written by its macro (not run); the tool uses 1.0 G_k on every span for minimum moments.
   - Shear at the face: TCC takes |V_cl| - w a with the span's UDL; the tool evaluates the envelope at the face (point loads,
     partial UDLs and reversing shear included).
   - Span design in TCC uses its flanged web formula whenever 0.8x > h_f (rectangular spans included) and lets x/d exceed 0.6
     when delta > 1; the tool integrates the block on the actual section and keeps x/d <= 0.6.
   - SLS: TCC treats the cracked section as a rectangle of width b_eff and samples 20 points per span; its SLS fixed-end
     moments for PL 1 in spans 2+ take span 1's PL 1 load (Sls!E9). The tool solves the T-section and the exact maxima. */
