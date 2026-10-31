// RC Slab Design: node test_rc_slab.js
// The one-way analysis is the RC beam engine (checked against an independent frame model in tests/rc-beam); here:
// 1 The Concrete Centre TCC31 (45 one-way slabs, outputs only): analysis within TCC's truncated moment distribution, the
//   design quantities computed the same way to 1e-9 (documented differences in the notes).
// 2 TCC94 (two-way, 90 runs): the BS 8110 Table 3.14 / 3.15 coefficients used here against TCC's formula values.
// 3 Closed forms and behaviour.
const { EC2, EC2Section, RCBeam, RCSlabDesign } = require('./load.js');
const T31 = require('./ref_tcc31.json'), T94 = require('./ref_tcc94.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, scale = null) => { n++; const e = Math.abs(got - exp) / Math.max(Math.abs(scale ?? exp), 1e-9); const ok = e <= tol; if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(8)} expected ${(+exp).toPrecision(8)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; if (!c || process.env.V) console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, fn, re) => { let m = ''; try { fn(); } catch (e) { m = e.message; } truth(`${name} (${m || 'no error'})`, re.test(m)); };
const MD = 2e-3;   // TCC31 stops its moment distribution after a fixed number of cycles

// ---------- 1 TCC31 ----------
const PSI2 = { Office: 0.3, Shopping: 0.6, Storage: 0.8, Dwelling: 0.3 }, SB = [8, 29, 56, 77, 104, 125];
T31.cases.forEach((cs, ci) => {
  const ns = cs.n, O = cs.out, tag = `TCC31 ${ci} (${ns} spans)`;
  const inp = { spans: cs.spans.map(s => ({ L: s.L * 1000, h: s.h })), supports: Array.from({ length: ns + 1 }, (_, j) => ({ kind: 'knife', width: 0, delta: 1 - cs.red[j] })),
    loads: cs.loads.flatMap((l, i) => [{ span: i, case: 'G', type: 'udl', w: l.G }, { span: i, case: 'Q', type: 'udl', w: l.Q }, ...l.pl.flatMap(p => [{ span: i, case: 'G', type: 'line', P: p.G, a: p.a }, { span: i, case: 'Q', type: 'line', P: p.Q, a: p.a }])]),
    sets: [{ gG: O['Uls!C8'], gQ: O['Uls!F9'], label: 'TCC' }], patterns: RCBeam.patternList(ns, false), redist: cs.in['ACTIONS!J14'] === 2 ? 'none' : 'limited', psi2: PSI2[cs.usage], selfWeight: false,
    fck: cs.fck, fyk: 500, dg: 20, cover: { top: cs.in['MAIN!J10'], btm: cs.in['MAIN!J11'] }, wk: { top: cs.in['MAIN!J7'], btm: cs.in['MAIN!J8'] }, brittle: true };
  const D = RCSlabDesign.oneWay(inp), A = D.A, Mref = Math.max(...A.supM.map(s => s.elastic), ...A.spanM.map(s => s.elastic)) / 1e6, Rref = Math.max(...A.Rmax) / 1e3, c = EC2.concrete(cs.fck), st = EC2.steel(500);
  for (let j = 0; j <= ns; j++) {
    near(`${tag} support ${j + 1}: elastic moment`, A.supM[j].elastic / 1e6, O[`ACTIONS!${'CDEFGHI'[j]}22`], MD, Mref); near(`${tag} support ${j + 1}: redistributed`, A.supM[j].redist / 1e6, O[`ACTIONS!${'CDEFGHI'[j]}23`], MD, Mref);
    near(`${tag} support ${j + 1}: largest ULS reaction`, A.Rmax[j] / 1e3, O[`MAIN!${'DEFGHIJ'[j]}51`], MD, Rref); near(`${tag} support ${j + 1}: reaction under G_k`, A.cases[A.cases.length - 1].R[j] / 1e3, O[`MAIN!${'DEFGHIJ'[j]}48`], MD, Rref);
  }
  for (let i = 0; i < ns; i++) {
    const b0 = SB[i], bb = 74 * i, g = k => O[`SPANS!${k}`], bv = k => O[`Bar!${k}`], t = `${tag} span ${i + 1}`, sm = A.spanM[i];
    near(`${t}: elastic span moment`, sm.elastic / 1e6, O[`ACTIONS!${'CDEFGH'[i]}28`], MD, Mref);
    // TCC31 floors the redistributed span moment at 0.7 x elastic, the tool at delta_f x elastic (delta_f >= 0.7): equal unless TCC's floor binds
    const dT = O[`ACTIONS!${'CDEFGH'[i]}30`];
    if (dT >= sm.df - 1e-6 || sm.df >= 1) near(`${t}: redistributed span moment`, sm.redist / 1e6, O[`ACTIONS!${'CDEFGH'[i]}29`], MD, Mref);
    else truth(`${t}: span moment ≥ TCC's (floor ${sm.df} vs TCC δ ${dT.toFixed(3)})`, sm.redist / 1e6 >= O[`ACTIONS!${'CDEFGH'[i]}29`] * (1 - MD));
    // support design moment by TCC's rule: max(centreline, 0.15 x span moment)
    near(`${t}: left support design moment (TCC rule)`, Math.max(A.supM[i].redist, 0.15 * sm.redist) / 1e6, g(`F${b0 + 2}`), MD, Mref); near(`${t}: right support design moment (TCC rule)`, Math.max(A.supM[i + 1].redist, 0.15 * sm.redist) / 1e6, g(`L${b0 + 2}`), MD, Mref);
    near(`${t}: d top`, inp.spans[i].h - inp.cover.top - cs.bars[i].tl / 2, g(`F${b0 + 5}`), 1e-9); near(`${t}: d bottom`, inp.spans[i].h - inp.cover.btm - cs.bars[i].bc / 2, g(`I${b0 + 5}`), 1e-9);
    for (const col of ['F', 'I', 'L']) { if (g(`${col}${b0 + 7}`) > 0) continue;
      const r = EC2.bendingDesign({ sec: { b: 1000, h: inp.spans[i].h }, d: g(`${col}${b0 + 5}`), d2: 50, M: g(`${col}${b0 + 2}`) * 1e6, c, s: st, delta: Math.min(1, g(`${col}${b0 + 3}`)), xdMax: null });
      if (!r.doubly) truth(`${t} ${col}: bending steel ${r.As.toFixed(1)} ≤ TCC's A_s ${g(`${col}${b0 + 6}`).toFixed(1)} (TCC adds its minimum and crack minimum)`, r.As <= g(`${col}${b0 + 6}`) * (1 + 1e-9) && (Math.abs(r.As - g(`${col}${b0 + 6}`)) < 1e-6 * r.As || g(`${col}${b0 + 6}`) <= Math.max(r.As, 0.0016 * 1000 * g(`${col}${b0 + 5}`), 0.6 * 1000 * inp.spans[i].h * c.fctm / 500) * (1 + 1e-6)));
    }
    near(`${t}: V at the left support`, D.spanZ[i].sh.L.Vface / 1e3, g(`F${b0 + 4}`), MD, Rref); near(`${t}: V at the right support`, D.spanZ[i].sh.R.Vface / 1e3, g(`L${b0 + 4}`), MD, Rref);
    for (const [col, k] of [['F', 'D'], ['L', 'H']]) { const d = bv(`${k}${15 + bb}`); near(`${t}: v_Rd,c (TCC d, top steel)`, EC2.shearConcrete({ bw: 1000, d, Asl: bv(`${k}${32 + bb}`), c }).VRdc / (1000 * d), g(`${col}${b0 + 13}`), 1e-6); }
    if (bv(`F${58 + bb}`) > 0.01) {
      if (!cs.loads.some(l => l.pl.length)) near(`${t}: SLS characteristic span moment (TCC samples)`, sm.Mk / 1e6, bv(`F${58 + bb}`), 5e-3, Mref);
      const cr = EC2.cracked({ sec: { b: 1000 }, As: bv(`F${56 + bb}`), d: bv(`F${15 + bb}`), As2: bv(`F${40 + bb}`) > 0.01 ? bv(`F${40 + bb}`) : 0, d2: bv(`F${22 + bb}`), ae: O['Bar!M13'], M: bv(`F${58 + bb}`) * 1e6 });
      near(`${t}: σ_s (TCC M, bars, α_e)`, cr.ss, bv(`F${61 + bb}`), 1e-8);
      const K = EC2.KSYS[D.spanZ[i].sag.sys]; near(`${t}: basic l/d with TCC ρ (stored ρ rounded)`, Math.min(100, EC2Section.baseRatio(cs.fck, bv(`F${63 + bb}`) / 100, bv(`F${62 + bb}`) / 100, K)), Math.min(100, bv(`D${64 + bb}`)), 1e-7);
      near(`${t}: allowed l/d`, Math.min(bv(`D${64 + bb}`) * Math.min(1.5, 310 / bv(`F${61 + bb}`)) * Math.min(1, 7000 / inp.spans[i].L), 40 * K), bv(`D${66 + bb}`), 1e-9);
      near(`${t}: actual l/d`, inp.spans[i].L / bv(`F${15 + bb}`), g(`F${b0 + 15}`), 1e-9);
    }
  }
});

// ---------- 2 TCC94 two-way coefficients ----------
let nm = 0;
for (const c of T94.cases) {
  const e = c.edges, edges = { L1: e[0] === 'C', S1: e[1] === 'C', L2: e[2] === 'C', S2: e[3] === 'C' }, K = RCSlabDesign.coefficients(edges, c.r), O = c.out, tab = RCSlabDesign.RATIOS.includes(c.r);
  const t = `case ${c.case} (${e}) l_y/l_x ${c.r}`, tol = tab ? 0.000501 : 0.0015, abs = (nmx, got, exp, tl) => { n++; nm++; const ok = Math.abs(got - exp) <= tl; if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${t}: ${nmx} ${got} vs TCC ${exp}`); if (!ok) fails++; };
  truth(`${t}: BS 8110 case from the edges`, K.case === c.case);
  abs('β_sx (table rounding)', K.bxp, O['MAIN!D23'], tol); abs('β_sy', K.byp, O['MAIN!F23'], 0.000501);
  [['L1', 'H23', 'bxn'], ['S1', 'J23', 'byn'], ['L2', 'L23', 'bxn'], ['S2', 'N23', 'byn']].forEach(([k, cell, key]) => { if (edges[k]) abs(`edge ${k} β`, K[key], O['MAIN!' + cell], tol); else abs(`edge ${k} discontinuous: no moment`, 0, O['MAIN!' + cell], 1e-12); });
  [['L1', 'D54', 'x'], ['S1', 'F54', 'y'], ['L2', 'H54', 'x'], ['S2', 'J54', 'y']].forEach(([k, cell, ax]) => abs(`edge ${k} β_v (Table 3.15 vs TCC's formula)`, K[`v${ax}${edges[k] ? 'c' : 'd'}`], O['MAIN!' + cell], 0.011));
}
truth(`TCC94: ${nm} coefficient comparisons`, nm >= 900);

// ---------- 3 closed forms and behaviour ----------
const one = (o = {}) => ({ spans: [{ L: 5000, h: 200 }, { L: 5000, h: 200 }], supports: [{ kind: 'beam', width: 300 }, { kind: 'beam', width: 300, delta: 1 }, { kind: 'beam', width: 300 }],
  loads: [{ span: 0, case: 'G', type: 'udl', w: 1.5 }, { span: 0, case: 'Q', type: 'udl', w: 2.5 }, { span: 1, case: 'G', type: 'udl', w: 1.5 }, { span: 1, case: 'Q', type: 'udl', w: 2.5 }],
  rule: '6.10', psi0: 0.7, psi2: 0.3, redist: 'limited', selfWeight: true, gc: 25, fck: 30, fyk: 500, dg: 20, cover: { top: 25, btm: 25 }, wk: { top: 0.3, btm: 0.3 }, brittle: true, ...o });
{ const D = RCSlabDesign.oneWay(one({ spans: [{ L: 4000, h: 175 }], supports: [{ kind: 'knife', width: 0 }, { kind: 'knife', width: 0 }], loads: [{ span: 0, case: 'G', type: 'udl', w: 1 }, { span: 0, case: 'Q', type: 'udl', w: 3 }] }));
  const w = 1.35 * (1 + 25 * 0.175) + 1.5 * 3; near('single span: M = wL²/8 per metre with self-weight 25 h', D.A.spanM[0].elastic, w * 4000 ** 2 / 8, 1e-12);
  truth('bearing ends: no top steel requirement, simply supported span/depth (K = 1)', D.supZ[0].sides[0].Mdes === 0 && D.spanZ[0].sag.sys === 'ss' && D.spanZ[0].sag.R.defl.K === 1);
  const D2 = RCSlabDesign.oneWay(one({ selfWeight: false, loads: [{ span: 0, case: 'G', type: 'udl', w: 5 }, { span: 1, case: 'G', type: 'udl', w: 5 }] }));
  near('two equal spans: support moment wL²/8', D2.A.supM[1].elastic, 1.35 * 5 * 5000 ** 2 / 8, 1e-12);
  const s1 = D2.supZ[0].sides[0]; near('end support on a beam: 25% of the span moment (9.3.1.2(2))', s1.Mdes, 0.25 * D2.A.spanM[0].redist, 1e-12);
  const cu = D2.curt.sup[0][0]; truth(`end-support top steel extends at least 0.2 L from the face (${Math.round(cu.all)} mm)`, cu.all >= 0.2 * 5000 + 150 - 1e-9);
  const D3 = RCSlabDesign.oneWay(one({ selfWeight: false, loads: [{ span: 0, case: 'G', type: 'line', P: 10, a: 2 }] }));
  const a = 2000, b = 3000, L = 5000; near('line load on a two-span slab: three-moment support moment', D3.A.cases[0].hog[0][1], 1.35 * 10e3 * a * b * (L + a) / (4 * L * L), 1e-12);
  const D4 = RCSlabDesign.oneWay(one()); truth('distribution steel ≥ 20% of the main steel and ≥ A_s,min', D4.spanZ.every(z => z.dist >= 0.2 * z.sag.R.arr.As - 1e-9 && z.dist >= EC2.asMin({ fctm: D4.c.fctm, fyk: 500, bt: 1000, d: 200 - 25 - z.bot.phi - 5 }) - 1e-9));
  truth('shear without links: V_Rd,c from the top steel at the supports', D4.spanZ[0].sh.R.vc.VRdc > 0 && D4.checks.some(k => k.id === 'vrdc'));
  const B = RCSlabDesign.suggestOneWay(one()), D5 = RCSlabDesign.oneWay(one({ bars: B })); truth(`suggested bars pass (max ${D5.utilMax.toFixed(3)})`, D5.utilMax <= 1 + 1e-9);
  truth('suggested spacings within 3h and 400 mm', [...B.spans.map(x => x.bottom), ...B.supports.map(x => x.top)].every(b => b.s <= Math.min(3 * 200, 400)));
  const D6 = RCSlabDesign.oneWay(one({ spans: [{ L: 1500, h: 200 }, { L: 5000, h: 200 }], supports: [{ kind: 'free' }, { kind: 'beam', width: 300 }, { kind: 'beam', width: 300 }] }));
  const cz = D6.supZ[1].sides.find(x => x.side === 'L'); truth('cantilever slab: designed at the root face with K = 0.4', /cantilever root/.test(cz.rule) && cz.R.defl.K === 0.4);
  const thin = RCSlabDesign.oneWay(one({ spans: [{ L: 5000, h: 120 }, { L: 5000, h: 120 }], loads: [{ span: 0, case: 'Q', type: 'udl', w: 25 }, { span: 1, case: 'Q', type: 'udl', w: 25 }] }));
  truth('heavily loaded thin slab fails shear without links', thin.checks.some(k => k.id === 'vrdc' && k.util > 1));
  throws('cover required', () => RCSlabDesign.oneWay(one({ cover: { top: 0, btm: 25 } })), /cover/);
}
{ const tw = (o = {}) => ({ lx: 6000, ly: 7500, h: 225, fck: 30, fyk: 500, cover: { top: 25, btm: 25 }, edges: { L1: true, L2: false, S1: true, S2: false }, gk: 1.5, qk: 3.5, rule: '6.10', psi2: 0.3, wk: { top: 0.3, btm: 0.3 },
    bars: { x: { phi: 10, s: 150 }, y: { phi: 10, s: 200 }, L1: { phi: 12, s: 150 }, S1: { phi: 10, s: 200 } }, ...o });
  const T = RCSlabDesign.twoWay(tw()), n0 = 1.35 * (1.5 + 25 * 0.225) + 1.5 * 3.5;
  near('two-way: n = 1.35 (g_k + 25 h) + 1.5 q_k', T.nU, n0, 1e-12); truth('adjacent edges discontinuous → case 4', T.K.case === 4);
  near('short span coefficient interpolated at l_y/l_x 1.25 between 0.047 and 0.051', T.K.bxp, 0.049, 1e-12); near('M_sx = β_sx n l_x²', T.zones[0].M, 0.049 * n0 * 6000 ** 2, 1e-12);
  near('long-span bars inside the short-span bars: d_y = d_x − (φ_x + φ_y)/2', T.zones[1].R.d, T.zones[0].R.d - 10, 1e-12);
  near('shear on the continuous long edge β_vx n l_x', T.shear[0].V, (0.47 + 0.5 * (0.50 - 0.47)) * n0 * 6000, 1e-12);
  const cr = T.corners.find(c => c.nd === 2); near('corner with both edges discontinuous: 3/4 of the short-span steel', cr.As, 0.75 * T.zones[0].R.bd.As, 1e-12);
  truth('deflection on the short span with K = 1.3 (one long edge continuous)', T.zones[0].R.defl.K === 1.3);
  const all = RCSlabDesign.twoWay(tw({ edges: { L1: true, L2: true, S1: true, S2: true }, ly: 6000, bars: { x: { phi: 10, s: 150 }, y: { phi: 10, s: 200 }, L1: { phi: 12, s: 150 }, L2: { phi: 12, s: 150 }, S1: { phi: 12, s: 150 }, S2: { phi: 12, s: 150 } } }));
  truth('interior square panel: case 1 with β_sx 0.024, β_sy 0.024, edges 0.031 / 0.032', all.K.case === 1 && all.K.bxp === 0.024 && all.K.byp === 0.024 && all.K.bxn === 0.031 && all.K.byn === 0.032);
  const sg = RCSlabDesign.suggestTwoWay(tw()), T2 = RCSlabDesign.twoWay(tw({ bars: sg })); truth(`two-way suggestion passes (max ${T2.utilMax.toFixed(3)})`, T2.utilMax <= 1 + 1e-9);
  const long = RCSlabDesign.twoWay(tw({ ly: 13000 })); truth('l_y/l_x > 2 flagged (spans one way)', long.checks.some(k => k.id === 'ratio' && k.util > 1));
  throws('l_x must be the shorter span', () => RCSlabDesign.twoWay(tw({ lx: 8000, ly: 6000 })), /shorter/);
}
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
/* Documented differences from TCC31 (v4.4): moment distribution stopped after fixed cycles (~0.1%); support design moments at the
   centreline with at least 0.15 x the span moment at every support (the tool: the face for slabs cast with beams or walls,
   F t/8 for bearings, 25 % of the span moment at monolithic end supports per 9.3.1.2(2)); TCC's minimum crack steel uses
   k = 1 and an alpha_e = 15 uncracked section, the tool k(h) and E_s/E_cm; the span floor after redistribution is 0.7 x
   elastic in TCC31, delta_f x elastic in the tool; v_Ed uses V at 100 mm (or the first line load) from the centreline in
   TCC31, V at d from the face in the tool. TCC94 computes the two-way coefficients by formula; the tool uses the BS 8110
   Tables 3.14 and 3.15 with linear interpolation (within the tables' rounding of 0.0005 for moments, 0.011 for shear). */
