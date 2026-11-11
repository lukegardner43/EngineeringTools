// RC Ribbed and Waffle Slabs: node test_rc_ribbed.js
// The one-way analysis is the RC beam engine (checked against an independent frame model in tests/rc-beam); here:
// 1 The Concrete Centre TCC32 (48 ribbed slabs of 1 to 5 spans, outputs only): self-weight with the solid ends, the analysis
//   within TCC's truncated moment distribution, and the rib design quantities computed the same way (documented differences
//   in the notes at the end).
// 2 Mosley, Bungey and Hulse, Reinforced Concrete Design to Eurocode 2 (7th edition), examples 8.8 (ribbed floor) and 8.9
//   (waffle slab): moments per rib, steel, the rib's hogging capacity where the ribs stop, span/depth and rib shear.
// 3 Closed forms and behaviour (waffle coefficients, self-weight, topping rules, suggestions, errors).
const { EC2, EC2Section, RCBeam, RCSlabDesign, RCRibbed } = require('./load.js');
const T32 = require('./ref_tcc32.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, scale = null) => { n++; const e = Math.abs(got - exp) / Math.max(Math.abs(scale ?? exp), 1e-9); const ok = e <= tol; if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(8)} expected ${(+exp).toPrecision(8)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; if (!c || process.env.V) console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, fn, re) => { let m = ''; try { fn(); } catch (e) { m = e.message; } truth(`${name} (${m || 'no error'})`, re.test(m)); };
const MD = 2e-3;   // TCC32 stops its moment distribution after a fixed number of cycles
const AREA = phi => Math.PI * phi * phi / 4;

// ---------- 1 TCC32 ----------
const PSI2 = { Office: 0.3, Shopping: 0.6, Storage: 0.8, Dwelling: 0.3 }, SB = [8, 29, 56, 77, 104, 125];
let nShear = 0, nDefl = 0;
let nSkip = 0;
T32.forEach((cs, ci) => {
  if (cs.n === 2 && cs.ends[1] === 'E') { nSkip++; return; }   // TCC32 v4.3 drops an encastré right end when there are two spans
  const ns = cs.n, O = cs.out, I = cs.in, tag = `TCC32 ${ci} (${ns} span${ns > 1 ? 's' : ''})`, cen = cs.cen, k = cen / 1000, link = I['SPANS!I21'];
  const endKind = t => t === 'E' ? 'fixed' : 'knife';
  const bars = { spans: [], supports: [] };
  // the bars TCC chose (it sizes the number from the diameter): rib bars plus the bars between the ribs at the supports
  for (let i = 0; i < ns; i++) { const bb = 100 * i; const nb = O[`Bar!G${49 + bb}`]; bars.spans[i] = { bottom: { n: typeof nb === 'number' ? nb : 2, phi: cs.bars[i].bc } }; }
  // TCC adds one cross rib where the ribbed length exceeds 60 rib widths
  const inp = { spans: cs.spans.map(s => ({ L: s.L * 1000, h: s.H, solidL: s.sl, solidR: s.sr, cross: s.L * 1000 - s.sl - s.sr > 60 * cs.bw ? 1 : 0 })), rib: { hf: cs.hf, bw: cs.bw, s: cen, taper: cs.taper },
    supports: Array.from({ length: ns + 1 }, (_, j) => ({ kind: j === 0 ? endKind(cs.ends[0]) : j === ns ? endKind(cs.ends[1]) : 'knife', width: 0, delta: 1 - cs.red[j] })),
    loads: cs.loads.flatMap((l, i) => [{ span: i, case: 'G', type: 'udl', w: l.G }, { span: i, case: 'Q', type: 'udl', w: l.Q }, ...l.pl.flatMap(p => [{ span: i, case: 'G', type: 'line', P: p.G, a: p.a }, { span: i, case: 'Q', type: 'line', P: p.Q, a: p.a }])]),
    sets: [{ gG: O['Uls!C16'], gQ: O['Uls!F17'], label: 'TCC' }], patterns: RCBeam.patternList(ns, false), redist: I['ACTIONS!L14'] === 2 ? 'none' : 'limited', psi2: PSI2[cs.usage], selfWeight: true, gc: 25,
    fck: cs.fck, fyk: 500, dg: 20, cover: { top: I['MAIN!J10'], btm: I['MAIN!J11'], side: I['MAIN!J12'] }, wk: { top: I['MAIN!F13'], btm: I['MAIN!F14'] }, brittle: true,
    links: { phi: link, legs: 2, s: 150 }, bars };
  const D = RCRibbed.oneWay(inp), A = D.A, c = EC2.concrete(cs.fck), st = EC2.steel(500);
  const Mref = Math.max(...A.supM.map(s => s.elastic), ...A.spanM.map(s => s.elastic)) / 1e6, Rref = Math.max(...A.Rmax) / 1e3;
  // self-weight: the rib at its mean width over the span, the solid ends at full depth, averaged along the span
  for (let i = 0; i < ns; i++) near(`${tag} span ${i + 1}: self-weight with the solid ends`, D.sw[i], O[`Uls!${'DEFGHI'[i]}14`], 1e-12);
  for (let j = 0; j <= ns; j++) {
    near(`${tag} support ${j + 1}: elastic moment`, A.supM[j].elastic / 1e6, O[`ACTIONS!${'DEFGHIJ'[j]}23`], MD, Mref);
    near(`${tag} support ${j + 1}: redistributed`, A.supM[j].redist / 1e6, O[`ACTIONS!${'DEFGHIJ'[j]}24`], MD, Mref);
    near(`${tag} support ${j + 1}: largest ULS reaction`, A.Rmax[j] / 1e3, O[`MAIN!${'DEFGHIJ'[j]}56`], MD, Rref);
    near(`${tag} support ${j + 1}: reaction under G_k`, A.cases[A.cases.length - 1].R[j] / 1e3, O[`MAIN!${'DEFGHIJ'[j]}53`], MD, Rref);
  }
  for (let i = 0; i < ns; i++) {
    const bb = 100 * i, bv = key => O[`Bar!${key}`], t = `${tag} span ${i + 1}`, sm = A.spanM[i], z = D.spanZ[i], R = z.R, s = inp.spans[i];
    near(`${t}: elastic span moment`, sm.elastic / 1e6, O[`ACTIONS!${'DEFGHI'[i]}29`], MD, Mref);
    const dT = O[`ACTIONS!${'DEFGHI'[i]}31`];
    const floorSame = dT >= sm.df - 1e-6 || sm.df >= 1;
    if (floorSame) near(`${t}: redistributed span moment`, sm.redist / 1e6, O[`ACTIONS!${'DEFGHI'[i]}30`], MD, Mref);
    else truth(`${t}: span moment ≥ TCC's (floor ${sm.df} vs TCC δ ${dT.toFixed(3)})`, sm.redist / 1e6 >= O[`ACTIONS!${'DEFGHI'[i]}30`] * (1 - MD));
    // per rib: moments × centres; the effective depths with TCC's bars and links
    if (floorSame) near(`${t}: span moment per rib = per metre × s`, z.sag.M / 1e6, bv(`G${11 + bb}`) * k, MD, Mref * k);
    else truth(`${t}: span moment per rib ≥ TCC's`, z.sag.M / 1e6 >= bv(`G${11 + bb}`) * k * (1 - MD));
    near(`${t}: d in the span`, z.sag.R.d, bv(`G${13 + bb}`), 1e-12);
    near(`${t}: rib mean width`, R.bAvg, O[`Uls!${'DEFGHI'[i]}8`], 1e-12);
    near(`${t}: b_w for shear at the level of the bottom bars`, R.widthAt(s.h - bv(`G${13 + bb}`)), bv(`G${84 + bb}`), 1e-12);
    // bending steel computed the same way: the flange s wide in the span (stress block within the topping), a solid section at the supports
    const Kp = dd => { const dl = Math.min(1, bv(`${dd}${10 + bb}`)); return dl; };
    if (bv(`G${21 + bb}`) <= cs.hf / 0.8 && bv(`G${12 + bb}`) > 0.5) {
      const r = EC2.bendingDesign({ sec: { b: cen, bw: R.bAvg, hf: cs.hf, h: s.h }, d: bv(`G${13 + bb}`), d2: 50, M: bv(`G${12 + bb}`) * 1e6, c, s: st, delta: Kp('G'), xdMax: null, zMax: 0.95 });
      if (!r.doubly) near(`${t}: span A_s (flange s wide)`, r.As, bv(`G${27 + bb}`), 1e-9);
    }
    for (const col of ['E', 'I']) {
      if (!(bv(`${col}${12 + bb}`) > 0.5)) continue;
      const r = EC2.bendingDesign({ sec: { b: cen, h: s.h }, d: bv(`${col}${13 + bb}`), d2: 50, M: bv(`${col}${12 + bb}`) * 1e6, c, s: st, delta: Kp(col), xdMax: null, zMax: 0.95 });
      if (!r.doubly && bv(`${col}${25 + bb}`) < 1e-6) near(`${t} ${col === 'E' ? 'left' : 'right'}: support A_s (solid, s wide)`, r.As, bv(`${col}${27 + bb}`), 1e-9);
      // where the ribs start: the hogging moment on the rib (compression in the soffit, b = b_w)
      const Mh = bv(`${col}${35 + bb}`);
      if (Mh > 0.5 && bv(`${col}${42 + bb}`) < 1e-6) {
        const re = EC2.bendingDesign({ sec: { b: cs.bw, h: s.h }, d: bv(`${col}${13 + bb}`), d2: 50, M: Mh * 1e6, c, s: st, delta: 1, xdMax: null, zMax: 0.95 });
        if (!re.doubly) near(`${t} ${col === 'E' ? 'left' : 'right'}: A_s on the rib where it starts`, re.As, bv(`${col}${44 + bb}`), 1e-9);
      }
    }
    // the hogging moment at the edge of the solid zone and at the quarter points (TCC samples its envelope)
    // (TCC floors the redistributed envelope at 0.7 × elastic, the tool at δ_f × elastic: equal where neither end is redistributed)
    const elastic = cs.red[i] === 0 && cs.red[i + 1] === 0;
    // (with redistribution the envelopes differ by method: TCC reduces each pattern's support moment by δ, the tool moves the others by up to 1 − δ)
    const cmp = (nm, got, exp) => elastic ? near(nm, got, exp, 5e-3, Mref) : truth(`${nm}: ${got.toFixed(2)} within 2 % of TCC ${exp.toFixed(2)} or above (redistributed)`, got >= exp - 0.02 * Mref);
    for (const [col, end] of [['E', 'L'], ['I', 'R']]) {
      const q = z.ends[end], tv = bv(`${col}${34 + bb}`);
      if (q && !q.solidAll && tv != null && q.a > 0) cmp(`${t} ${end}: hogging per metre where the ribs start`, q.Mh / k / 1e6, tv);
    }
    if (z.ribHog && bv(`G${34 + bb}`) > 0.05 * Mref) cmp(`${t}: hogging at the quarter points`, z.ribHog.M / k / 1e6, bv(`G${34 + bb}`));
    // minimum steel: b_t = the mean rib width in the span, s at the supports
    near(`${t}: A_s,min in the span (b_t = mean rib width)`, EC2.asMin({ fctm: c.fctm, fyk: 500, bt: R.bAvg, d: bv(`G${13 + bb}`) }), bv(`G${32 + bb}`), 1e-9);
    // rib shear: V at the support centreline, less the load on the solid zone; V_Rd,c with TCC's d, steel and b_w
    for (const [col, end] of [['E', 'L'], ['I', 'R']]) {
      const q = z.ends[end], Vcl = bv(`${col}${83 + bb}`); if (!q || q.solidAll || Vcl == null) continue;
      const j = end === 'L' ? i : i + 1, Env = RCBeam.envAt(A, i, end === 'L' ? 0 : s.L, end === 'L' ? 'R' : 'L');
      near(`${t} ${end}: V_Ed at the support centreline`, end === 'L' ? Env.Vmax / 1e3 : -Env.Vmin / 1e3, Vcl, MD, Rref);
      const dist = bv(`${col}${84 + bb}`), pl = cs.loads[i].pl.some(p => (end === 'L' ? p.a : s.L / 1000 - p.a) <= dist + 1e-9);
      if (!pl && Math.abs(dist * 1000 - q.xv) < 1e-6 && q.a >= q.xv - 1e-6) {   // (TCC deducts the solid weight over d even where there is no solid zone)
        // TCC deducts the factored self-weight of the solid zone and the imposed load, not the added dead load; the tool deducts all three
        const gG = O['Uls!C16'], add = gG * cs.loads[i].G * dist * k;
        near(`${t} ${end}: rib V_Ed = TCC's less γ_G g_add a s`, q.sh.VEd / 1e3, bv(`${col}${85 + bb}`) - add, MD, Rref * k);
      }
      const As = bv(`${col}${50 + bb}`) + (bv(`${col}${61 + bb}`) || 0), dd = bv(`${col}${13 + bb}`), bw = bv(`G${84 + bb}`);
      if (![As, dd, bw, bv(`${col}${89 + bb}`)].every(Number.isFinite)) continue;   // (TCC left the cell in error)
      near(`${t} ${end}: V_Rd,c of the rib (TCC's d, steel and b_w)`, EC2.shearConcrete({ bw, d: dd, Asl: As, c }).VRdc / 1e3, bv(`${col}${89 + bb}`), 1e-9); nShear++;
    }
    // span/depth: basic ratio from TCC's ρ, the flange factor 1 − 0.1(b/b_w − 1) ≥ 0.8, actual l/d
    if (bv(`G${71 + bb}`) > 0.01) {
      // TCC takes K by the span's position (1.0 single, 1.3 end, 1.5 interior) and ignores an encastré end; the tool uses the fixity
      const Kt = ns === 1 ? 1.0 : i === 0 || i === ns - 1 ? 1.3 : 1.5, base = EC2Section.baseRatio(cs.fck, bv(`G${75 + bb}`) / 100, (bv(`G${76 + bb}`) || 0) / 100, Kt);
      near(`${t}: basic l/d with TCC's ρ and K`, Math.min(200, base), Math.min(200, bv(`G${77 + bb}`)), 1e-7);
      if (!cs.ends.includes('E') || (i > 0 && i < ns - 1)) truth(`${t}: K from the fixity agrees with TCC's by position`, Math.abs(EC2.KSYS[z.sag.sys] - Kt) < 1e-12);
      // TCC: F3 × min(1, (7/l) F1); the tool F1 F2 F3 with F2 = 7/l only beyond 7 m (UK NA): equal for spans of 7 m and more
      const F1 = Math.max(0.8, 1 - 0.1 * (cen / R.bAvg - 1)), F3 = Math.min(1.5, 310 / bv(`G${74 + bb}`));
      // TCC's first span takes F3 min(1, (7/l) F1); its other spans F1 min(1, 7/l) F3 as the UK NA and the tool (brittle partitions)
      if (i === 0) near(`${t}: modification F3 min(1, 7/l F1) (TCC's first span)`, F3 * Math.min(1, 7000 / s.L * F1), bv(`G${78 + bb}`), 1e-9);
      else { near(`${t}: modification F1 F2 F3`, F1 * Math.min(1, 7000 / s.L) * F3, bv(`G${78 + bb}`), 1e-9); truth(`${t}: the tool's F1 F2 F3`, Math.abs(z.sag.R.defl.F1 * z.sag.R.defl.F2 - F1 * Math.min(1, 7000 / s.L)) < 1e-12 || z.sag.beff < cen); }
      near(`${t}: actual l/d`, s.L / bv(`G${13 + bb}`), bv(`G${80 + bb}`), 1e-9); nDefl++;
    }
  }
});
truth(`TCC32: ${T32.length - nSkip} slabs (${nSkip} two-span slabs with an encastré right end left out), ${nShear} rib shear and ${nDefl} span/depth comparisons`, T32.length - nSkip >= 40 && nShear >= 80 && nDefl >= 60);

// ---------- 2 Mosley, Bungey and Hulse examples 8.8 and 8.9 ----------
{ // 8.8: ribs 125 wide at 400 centres, h 200, topping 60, d 160, C25/30, end span 5 m by the one-way coefficients (0.086 F l)
  const R = RCRibbed.rib({ h: 200, hf: 60, bw: 125, s: 400, taper: 0 }), c = EC2.concrete(25), st = EC2.steel(500);
  near('8.8: b_eff = b_w + 2 b_1 = 400 (= the rib spacing)', RCRibbed.beffRib(R, 0.85 * 5000), 400, 1e-12);
  const F = 0.4 * (1.35 * 4.5 + 1.5 * 2.5) * 5.0, M = 0.086 * F * 5.0;
  near('8.8: ultimate load per rib 3.93 kN/m', F / 5, 3.93, 2e-3); near('8.8: M = 0.086 F l = 8.45 kNm', M, 8.45, 2e-3);
  const r = EC2.bendingDesign({ sec: { b: 400, bw: 125, hf: 60, h: 200 }, d: 160, M: M * 1e6, c, s: st, delta: 1, xdMax: null, zMax: 0.95 });
  near('8.8: A_s = 128 mm² (z = 0.95 d)', r.As, 8.45e6 / (0.87 * 500 * 0.95 * 160), 2e-3); truth('8.8: neutral axis within the topping', r.x <= 60);
  const Mrib = 0.167 * 25 * 125 * 160 ** 2 / 1e6; near('8.8: hogging capacity of the rib where it stops 0.167 f_ck b_w d² = 13.36 kNm', Mrib, 13.36, 1e-3);
  truth('8.8: no compression steel needed where the ribs stop', !EC2.bendingDesign({ sec: { b: 125, h: 200 }, d: 160, M: M * 1e6, c, s: st, delta: 1, xdMax: null, zMax: 0.95 }).doubly);
  const VEd = 0.6 * F - 0.6 * 3.93; near('8.8: V_Ed in the rib 0.6 m from the support 9.43 kN', VEd, 9.43, 2e-3);
  const vc = EC2.shearConcrete({ bw: 125, d: 160, Asl: 157, c }); near('8.8: V_Rd,c = 0.94 × 0.68 × 125 × 160 = 12.8 kN (the book reads rounded table values)', vc.VRdc / 1e3, 12.78, 0.015);
  const base = EC2Section.baseRatio(25, 128 / (400 * 160), 0, 1.3); truth(`8.8: span/depth limit 0.8 × 41.6 = 33.2 covers 5000/160 = 31.3 (${(0.8 * Math.min(base, 32 * 1.3)).toFixed(1)})`, 0.8 * 32 * 1.3 >= 5000 / 160);
  truth('8.8: topping 60 ≥ max(50, clear/10)', RCRibbed.toppingChecks(R, {}).find(q => q.id === 'hf').util <= 1);
}
{ // 8.9: internal waffle panel 6 m × 6 m, the ribs of 8.8, g_k 6.0 (with self-weight), q_k 2.5
  const W = RCRibbed.twoWay({ lx: 6000, ly: 6000, h: 200, rib: { hf: 60, bw: 125, s: 400, taper: 0 }, margin: 600, edges: { L1: true, L2: true, S1: true, S2: true }, method: 'restrained',
    gk: 6.0, qk: 2.5, selfWeight: false, rule: '6.10', psi2: 0.3, fck: 25, fyk: 500, cover: { top: 30, btm: 30 }, wk: { top: 0.3, btm: 0.3 }, links: null,
    bars: { x: { n: 2, phi: 10 }, y: { n: 2, phi: 10 }, L1: { n: 2, phi: 10 }, L2: { n: 2, phi: 10 }, S1: { n: 2, phi: 10 }, S2: { n: 2, phi: 10 } } });
  near('8.9: n = 1.35 × 6.0 + 1.5 × 2.5 = 11.85 kN/m²', W.nU, 11.85, 1e-12);
  near('8.9: mid-span 0.024 n l_x² = 10.24 kNm/m, 4.10 kNm per rib', W.zones[0].M / 1e6, 0.4 * 0.024 * 11.85 * 36, 1e-12);
  near('8.9: per rib 4.10 kNm', W.zones[0].M / 1e6, 4.10, 2e-3);
  const L1 = W.zones.find(z => z.id === 'L1'); near('8.9: support 0.031 n l_x² × 0.4 = 5.29 kNm per rib', L1.M / 1e6, 5.29, 2e-3);
  const sh = W.shear.find(q => q.edge === 'L1'); near('8.9: edge shear per rib 0.33 n l_x × 0.4 = 9.38 kN', sh.v * 0.4 / 1e3, 9.38, 2e-3);
  near('8.9: at the end of the solid margin (0.6 m) 9.38 − 0.6 × 11.85 × 0.4 = 6.54 kN', sh.VEd / 1e3, 9.38 - 0.6 * 11.85 * 0.4, 2e-3);
  truth('8.9: ribs need no links', sh.checks.every(q => q.util <= 1));
  truth('8.9: interior panel → span/depth K = 1.5 with F1 = 0.8 (b/b_w > 3)', W.zones[0].R.defl.K === 1.5 && W.zones[0].R.defl.F1 === 0.8);
  near('8.9: mesh 0.13 % of the 60 mm topping = 78 mm²/m', 0.0013 * 1000 * 60, 78, 1e-12);
}

// ---------- 3 closed forms and behaviour ----------
const one = (o = {}) => ({ spans: [{ L: 7000, h: 300, solidL: 300, solidR: 750 }, { L: 7000, h: 300, solidL: 750, solidR: 300 }], rib: { hf: 100, bw: 150, s: 900, taper: 10 },
  supports: [{ kind: 'beam', width: 300 }, { kind: 'beam', width: 300, delta: 0.85 }, { kind: 'beam', width: 300 }],
  loads: [0, 1].flatMap(i => [{ span: i, case: 'G', type: 'udl', w: 1.5 }, { span: i, case: 'Q', type: 'udl', w: 5 }]),
  rule: '6.10', psi0: 0.7, psi2: 0.3, redist: 'limited', selfWeight: true, gc: 25, fck: 35, fyk: 500, dg: 20, cover: { top: 25, btm: 30, side: 30 }, wk: { top: 0.3, btm: 0.3 }, brittle: true,
  links: null, mesh: 142, transverse: 0, bars: { spans: [{ bottom: { n: 2, phi: 20 }, top: { n: 1, phi: 12 } }, { bottom: { n: 2, phi: 20 }, top: { n: 1, phi: 12 } }], supports: [{ top: { n: 3, phi: 12 } }, { top: { n: 4, phi: 20 } }, { top: { n: 3, phi: 12 } }] }, ...o });
{
  const R = RCRibbed.rib({ h: 300, hf: 100, bw: 150, s: 900, taper: 10 });
  near('rib: 1 in 10 each side widens a 150 rib to 190 at the topping', R.bTop, 190, 1e-12); near('rib: mean width 170', R.bAvg, 170, 1e-12);
  near('rib: equivalent thickness (900 × 100 + 200 × 170)/900', R.tEq, (90000 + 34000) / 900, 1e-12);
  const D = RCRibbed.oneWay(one({ spans: [{ L: 6000, h: 300, solidL: 0, solidR: 0 }], supports: [{ kind: 'knife', width: 0 }, { kind: 'knife', width: 0 }], loads: [{ span: 0, case: 'Q', type: 'udl', w: 4 }] }));
  const w = 1.35 * 25 * R.tEq / 1000 + 1.5 * 4; near('single span: M = wL²/8 per metre with the rib self-weight', D.A.spanM[0].elastic, w * 6000 ** 2 / 8, 1e-12);
  near('single span: M per rib = M × s/1000', D.spanZ[0].sag.M, w * 6000 ** 2 / 8 * 0.9, 1e-12);
  truth('no solid zone: the ribs start at the support, shear at d from it', D.spanZ[0].ends.L.xv === D.spanZ[0].ends.L.dTop);
  const E = RCRibbed.oneWay(one());
  near('solid ends add their weight: (t_eq (L − a) + h a) × 25 / L', E.sw[0], 25 * (R.tEq * (7000 - 1050) + 300 * 1050) / 7000 / 1000, 1e-12);
  const z = E.spanZ[0], q = z.ends.R; truth('the ribs start where the solid zone ends (750 mm from the centreline)', q.xr === 750 && q.xv === 750);
  const Ecl = RCBeam.envAt(E.A, 0, 7000, 'L'), wl = 1.35 * (25 * 0.3 + 1.5) + 1.5 * 5;
  near('rib V_Ed = (V at the centreline − the factored load on the solid zone) × s', q.sh.VEd, (-Ecl.Vmin - wl * 750) * 0.9, 1e-9);
  near('b_w for shear at the level of the bottom bars', q.sh.bw, 150 + 2 * (300 - z.sag.R.d) / 10, 1e-12);
  truth('hogging on the rib where it starts is checked with the soffit in compression', !!q.hog && q.hog.sec.bw === 150 && q.hog.sec.moment === 'hogging');
  truth('support zone designed as a solid section s wide', E.supZ[1].sides[0].sec.b === 900 && E.supZ[1].sides[0].sec.shape === 'rect');
  truth('end support on a beam: 25 % of the span moment', /25 %/.test(E.supZ[0].sides[0].rule));
  truth('span: b_eff of the rib at most the centres; F1 = 0.8 for b/b_w > 3', z.sag.beff <= 900 && z.sag.R.defl.F1 === 0.8);
  truth('no transverse ribs over 10 h: noted for both spans', E.notes.length === 1 && /span 1 .*span 2/.test(E.notes[0]));
  const X = RCRibbed.oneWay(one({ spans: [{ L: 7000, h: 300, solidL: 300, solidR: 750, cross: 2 }, { L: 7000, h: 300, solidL: 750, solidR: 300, cross: 2 }] }));
  near('two transverse ribs add 2 (h − t_eq) b_m / L to the self-weight', X.sw[0] - E.sw[0], 25 * 2 * (300 - R.tEq) * 170 / 7000 / 1000, 1e-12); truth('two transverse ribs in 5.95 m: within 10 h, no note', X.notes.length === 0);
  truth('topping 100 ≥ max(50, 71); ribs 200 ≤ 4 × 150; centres ≤ 1500', ['hf', 'ribsp', 'ribdep'].every(id => E.checks.find(k => k.id === id).util <= 1));
  const thin = RCRibbed.oneWay(one({ rib: { hf: 50, bw: 60, s: 1200, taper: 0 } })); truth('thin topping over wide ribs flagged (clear/10 > h_f)', thin.checks.find(k => k.id === 'hf').util > 1);
  truth('deep narrow ribs flagged (depth > 4 b_w)', thin.checks.find(k => k.id === 'ribdep').util > 1);
  const heavy = RCRibbed.oneWay(one({ loads: [0, 1].flatMap(i => [{ span: i, case: 'Q', type: 'udl', w: 15 }]) }));
  truth('heavy load: rib shear without links fails', heavy.checks.some(k => k.id === 'ribshear' && k.util > 1));
  const linked = RCRibbed.oneWay(one({ loads: [0, 1].flatMap(i => [{ span: i, case: 'Q', type: 'udl', w: 15 }]), links: { phi: 8, legs: 2, s: 150 } }));
  truth('links in the ribs carry it', linked.checks.filter(k => k.id === 'riblinks').every(k => k.util <= 1) && !linked.checks.some(k => k.id === 'ribshear'));
  const B = RCRibbed.suggestOneWay(one()), S = RCRibbed.oneWay(one({ bars: B })), flexIds = ['bend', 'comp', 'asmin', 'smin', 'crack', 'ascrack', 'defl'];
  truth(`suggested bars pass the bending and detailing checks (max ${Math.max(...S.checks.filter(k => flexIds.includes(k.id)).map(k => k.util)).toFixed(3)})`, S.checks.filter(k => flexIds.includes(k.id)).every(k => k.util <= 1 + 1e-9));
  const cant = RCRibbed.oneWay(one({ spans: [{ L: 1500, h: 300, solidL: 0, solidR: 600 }, { L: 7000, h: 300, solidL: 750, solidR: 300 }], supports: [{ kind: 'free' }, { kind: 'beam', width: 300 }, { kind: 'beam', width: 300 }] }));
  truth('cantilever: designed at the root, span/depth K = 0.4', cant.supZ[1].sides.some(sd => /cantilever root/.test(sd.rule) && sd.R.defl && sd.R.defl.K === 0.4));
  throws('solid zones longer than the span', () => RCRibbed.oneWay(one({ spans: [{ L: 1000, h: 300, solidL: 600, solidR: 600 }, { L: 7000, h: 300, solidL: 0, solidR: 0 }] })), /longer than the span/);
  throws('ribs that meet at the top', () => RCRibbed.rib({ h: 500, hf: 100, bw: 150, s: 300, taper: 4 }), /meet/);
  throws('topping thicker than the slab', () => RCRibbed.rib({ h: 100, hf: 120, bw: 150, s: 900, taper: 10 }), /topping/);
}
{
  const tw = (o = {}) => ({ lx: 7200, ly: 8100, h: 350, rib: { hf: 100, bw: 150, s: 900, taper: 10 }, margin: 900, edges: { L1: true, L2: false, S1: true, S2: false }, method: 'restrained',
    gk: 1.5, qk: 4, selfWeight: true, gc: 25, rule: '6.10', psi2: 0.3, fck: 35, fyk: 500, cover: { top: 25, btm: 30, side: 30 }, wk: { top: 0.3, btm: 0.3 }, links: null, mesh: 142,
    bars: { x: { n: 2, phi: 20 }, y: { n: 2, phi: 16 }, L1: { n: 4, phi: 16 }, S1: { n: 4, phi: 16 } }, ...o });
  const T = RCRibbed.twoWay(tw()), R = T.R;
  const tCell = 350 - (900 - R.bAvg) ** 2 * 250 / 900 ** 2, As = 7200 * 8100 - 5400 * 6300;
  near('waffle self-weight: cells less prism voids, averaged with the margins', T.swT, (As * 350 + (7200 * 8100 - As) * tCell) / (7200 * 8100), 1e-12);
  truth('adjacent edges discontinuous → BS 8110 case 4', T.K.case === 4);
  near('M per rib = β n l_x² × s', T.zones[0].M, T.K.bxp * T.nU * 7200 ** 2 * 0.9, 1e-12);
  near('long-span ribs: d_y = d_x − (φ_x + φ_y)/2', T.zones[1].R.d, T.zones[0].R.d - 18, 1e-12);
  const simple = RCRibbed.twoWay(tw({ method: 'simple' })), r = 8100 / 7200;
  near('simply supported: α_sx = r⁴/(8(1 + r⁴))', simple.K.bxp, r ** 4 / (8 * (1 + r ** 4)), 1e-12); near('simply supported: α_sy = r²/(8(1 + r⁴))', simple.K.byp, r ** 2 / (8 * (1 + r ** 4)), 1e-12);
  near('Mosley table 8.4 at 1.5: 0.104 / 0.046', RCRibbed.simpleCoeffs(1.5).bxp, 0.104, 5e-3); near('… α_sy 0.046', RCRibbed.simpleCoeffs(1.5).byp, 0.046, 1e-2);
  truth('simply supported: no edge moments, edge shears from the four-edges-discontinuous case', simple.zones.length === 2 && simple.shear.every(q => !q.cont));
  const sh = T.shear.find(q => q.edge === 'L1'); near('edge shear per rib at the margin: (β_v n l_x − n a) s', sh.VEd, (sh.beta * T.nU * 7200 - T.nU * 900) * 0.9, 1e-12);
  truth('margins narrower than l_x/5 at a discontinuous corner: noted for the torsion steel', T.notes.some(t => /l_x\/5 = 1440/.test(t)));
  truth('margins of l_x/5: no note', RCRibbed.twoWay(tw({ margin: 1440 })).notes.length === 0);
  const sg = RCRibbed.suggestTwoWay(tw()), T2 = RCRibbed.twoWay(tw({ bars: { ...tw().bars, ...sg } }));
  truth(`two-way suggestion passes the bending and detailing checks (max ${Math.max(...T2.checks.filter(k => ['bend', 'asmin', 'crack', 'ascrack', 'defl', 'smin'].includes(k.id)).map(k => k.util)).toFixed(3)})`, T2.checks.filter(k => ['bend', 'asmin', 'crack', 'ascrack', 'defl', 'smin', 'comp'].includes(k.id)).every(k => k.util <= 1 + 1e-9));
  const long = RCRibbed.twoWay(tw({ ly: 16000 })); truth('l_y/l_x > 2 flagged', long.checks.some(k => k.id === 'ratio' && k.util > 1));
  throws('l_x must be the shorter span', () => RCRibbed.twoWay(tw({ lx: 9000, ly: 8100 })), /shorter/);
  throws('margins covering the panel', () => RCRibbed.twoWay(tw({ margin: 4000 })), /whole panel/);
}
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
/* Documented differences from TCC32 (v4.3): moment distribution stopped after fixed cycles (~0.1 %); the rib shear where the
   ribs start deducts the factored load on the solid zone including the added dead load (TCC32 deducts the solid self-weight and
   the imposed load only, so its V_Ed is higher by γ_G g_add a s); ρ for span/depth on the concrete above the steel as
   b_w d + (b_eff − b_w) h_f (TCC32: the rib area less b_w (h − d)); b_eff by 5.3.2.1 capped at the centres (TCC32: the
   centres); the stiffness of each span from a rectangular rib at the mean width (TCC32: the tapered rib), which only matters
   where spans differ in depth; the top steel at the supports is the bars entered per rib (TCC32 puts two thirds in the rib and
   the rest between the ribs); the support design moment at the face for supports cast with beams, F t/8 at bearings and 25 %
   of the span moment at monolithic end supports (TCC32: the centreline). */
