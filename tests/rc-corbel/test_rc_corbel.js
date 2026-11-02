// RC Corbel & Nib engine checks: two published worked examples (outputs only) and hand checks of the strut-and-tie
// geometry, PD 6687-1 B.4, 6.2.2(6), 6.2.1(9), 10.9.5.2, the anchorage of the tie (8.4.4, (8.1), Table NA.6a) and 8.6.
const { Corbel: K, EC2 } = require('./load');
let n = 0, fails = 0;
const ok = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } };
const near = (name, a, b, tol = 1e-9) => ok(name, Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `got ${a}, want ${b}`);
const throws = (name, f, re) => { let e = null; try { f(); } catch (x) { e = x; } ok(name, !!e && (!re || re.test(e.message)), e ? e.message : 'no error'); };
const chk = (R, key) => R.checks.find(q => q.key === key);
const BASE = { mode: 'corbel', fck: 40, FEd: 625, hRule: '0.2', aH: 0, ac: 200, hc: 505, hf: 300, lc: 400, lp: 150, bp: 400, b: 500, cover: 35, phiLink: 10, phi: 20, n: 4, nLink: 4, phiCl: 10, hcol: 500, coverCol: 35, linkCol: 10, phiCol: 32 };
const D = o => K.design({ ...BASE, ...o });

// ---------- The Concrete Centre, CCIP-057 Strut-and-tie Models (2014), example 5.4 Corbel (published outputs) ----------
// 625 kN on a 500 × 500 column, C40/50, 150 × 400 bearing at 200 mm, d = 450 mm, 0.2F horizontal, 4H20
{
  const R = D({});
  near('CCIP-057: d', R.d, 450); near('CCIP-057: ν′', R.nuP, 0.84); near('CCIP-057: σRd,max CCC 19.1', R.s1, 19.1, 0.005); near('CCIP-057: σRd,max CCT 16.2', R.s2, 16.2, 0.005);
  near('CCIP-057: node 2 width ax2 65.5 mm', R.ax2, 65.5, 0.005);
  near('CCIP-057: lever arm 430 mm (their 20 mm rounding of ay2/2)', R.z0, 430, 0.01); near('CCIP-057: strut 712 kN', R.F12 - 0, 712, 0.02);
  near('CCIP-057: tie 466 kN (341 + 0.2F)', R.Ftd, 466, 0.015); near('CCIP-057: As,req 1072 mm²', R.AsReq, 1072, 0.015);
  near('CCIP-057: bearing stress 10.4 N/mm²', R.sBear, 10.4, 0.005); near('CCIP-057: z0 at the column face 365 mm', R.z0face, 365, 0.025);
  near('CCIP-057: lbd poor bond 820 mm (tables)', R.lbdPoor, 820, 0.03); near('CCIP-057: lbd good bond 600 mm (tables)', R.lbdGood, 600, 0.02);
  near('CCIP-057: straight in the corbel 140 mm', R.front.lst, 140); near('CCIP-057: straight in the column 288 mm', R.supp.lst, 288);
  near('CCIP-057: Fbt at the corbel bend 96.6 kN', R.front.Fbt, 96.6, 0.02); near('CCIP-057: Fbt at the column bend 60.6 kN', R.supp.Fbt, 60.6, 0.03);
  near('CCIP-057: mandrel needed in the corbel 192 mm (their ab 50, ours 55)', R.front.phimReq, 192, 0.06);
  ok('CCIP-057: a standard bend does not work at the front', chk(R, 'front').util > 1);
  ok('CCIP-057: horizontal links (ac ≤ 0.5hc)', R.linkKind === 'horizontal' && Math.abs(R.linkReq - 0.5 * R.As) < 1e-9);
  ok('CCIP-057: welded H32 cross bar makes the front work', chk(D({ frontAnch: 'welded', phiT: 32 }), 'front').util <= 1);
}
// ---------- The Concrete Centre / BPCF Precast Eurocode 2 worked examples, Example 9 Design of corbels (published outputs) ----------
{
  const R = K.design({ mode: 'corbel', fck: 60, FEd: 900, hRule: 'value', HEd: 0, ac: 160, hc: 730, lc: 400, lp: 200, bp: 300, b: 450, cover: 35, phiLink: 10, phi: 20, n: 4, nLink: 5, phiCl: 10, hcol: 450 });
  near('precast ex 9: ν′ = 0.76', R.nuP, 0.76); near('precast ex 9: CCT limit 22 N/mm²', R.s2, 22, 0.01);
  ok('precast ex 9: strut steeper than 2.5, tie taken at 2.5', R.tan > 2.5 && R.tUse === 2.5);
  near('precast ex 9: tie 360 kN', R.Ftd, 360); near('precast ex 9: As 828 mm²', R.AsReq, 828, 0.001);
  ok('precast ex 9: 5 layers of H10 links (765 mm²) meet 0.5As', Math.abs(R.AsLnk - 785.4) < 1 && chk(R, 'links').util <= 1);
}
// ---------- strut-and-tie geometry by hand ----------
{
  const R = D({ hRule: 'value', HEd: 0 }), d = R.d;
  near('ax2 = FEd/(b k1 ν′ fcd)', R.ax2, 625e3 / (500 * 1.0 * (1 - 40 / 250) * 0.85 * 40 / 1.5));
  near('a = ac + ax2/2', R.a, 200 + R.ax2 / 2); near('hydrostatic node: ay2 = ax2 a / z0', R.ay2, R.ax2 * R.a / R.z0, 1e-12); near('z0 = d − ay2/2', R.z0, d - R.ay2 / 2, 1e-12);
  near('tie = FEd a / z0 with no horizontal force', R.Ftd, 625 * R.a / R.z0, 1e-12); near('strut = √(FEd² + C²)', R.F12, Math.hypot(625, R.Ftd), 1e-12);
  const Hh = D({ hRule: 'value', HEd: 100, aH: 60 }); near('horizontal force at aH above the tie', Hh.Ftd, 625 / Hh.tan + 100 * (1 + 60 / Hh.z0), 1e-12);
  near('aH defaults to the top face', D({ aH: null }).aH, 505 - 450); near('0.2FEd rule', D({}).HEd, 125);
  const far = D({ ac: 420, lc: 600, lp: 150 }); ok('ac beyond z0: strut flatter than 1:1 fails B.4.1', chk(far, 'slope').util > 1 && far.tan < 1);
  const crush = D({ FEd: 6000, n: 6, phi: 32 }); ok('a node that cannot fit in the depth fails', chk(crush, 'node2').util > 1);
  ok('tie force grows with ac', D({ ac: 250 }).Ftd > D({ ac: 150 }).Ftd); ok('tie force falls with depth', D({ hc: 650 }).Ftd < D({ hc: 505 }).Ftd);
  const st = D({ ac: 100, lp: 150 }); ok('steep strut: tie at least 0.4FEd + horizontal', st.tan > 2.5 && Math.abs(st.Ftd - (625 / 2.5 + 125)) < 1e-9);
  near('strut width at node 1 = lp sinθ + 2(hc − d) cosθ', R.w1, 150 * Math.sin(Math.atan(R.tan)) + 2 * 55 * Math.cos(Math.atan(R.tan)), 1e-12);
  near('strut stress at node 1', R.sStrut1, R.F12 * 1000 / (400 * R.w1), 1e-12);
}
// ---------- shear, links, bearings, hangers ----------
{
  const R = D({}), c = EC2.concrete(40);
  near('6.2.2(6): 0.5 b d ν fcd', R.VMax, 0.5 * 500 * 450 * 0.6 * (1 - 40 / 250) * 40 / 1.5 / 1000); near('VRd,c of the root', R.VRdc, EC2.shearConcrete({ bw: 500, d: 450, Asl: R.As, c }).VRdc / 1000, 1e-12);
  const v = D({ ac: 300, lc: 450, hc: 505, FEd: 400 }); ok('ac > 0.5hc, FEd > VRd,c: vertical links 0.5FEd/fyd', v.linkKind === 'vertical' && Math.abs(v.linkReq - 0.5 * 400e3 / (500 / 1.15)) < 1e-9);
  const z = D({ ac: 300, lc: 450, FEd: 100 }); ok('ac > 0.5hc, FEd ≤ VRd,c: no links required', z.linkKind === 'none' && !chk(z, 'links') && z.notes.some(t => /no links/.test(t)));
  ok('no links given where needed fails', chk(D({ nLink: 0 }), 'links').util === Infinity);
  near('dry bearing 0.4fcd', D({ bearing: 'dry' }).fRd, 0.4 * c.fcd); near('bedded bearing capped at 0.85fcd', D({ bearing: 'bedded', fbed: 40 }).fRd, 0.85 * c.fcd); near('bedded bearing fbed', D({ bearing: 'bedded', fbed: 12 }).fRd, 12);
  const N = K.design({ ...BASE, mode: 'nib', FEd: 120, hRule: 'value', HEd: 0, ac: 100, hc: 300, hf: 250, lc: 200, lp: 100, phi: 12, s: 150, sNl: 200, hcol: 300, phiCol: 16, hanging: true, phiH: 10, sH: 150 });
  near('nib: per metre width', N.b, 1000); near('nib: tie per metre', N.As, Math.PI * 36 * 1000 / 150); near('nib: hanger steel FEd/fyd', N.AsHangReq, 120e3 / (500 / 1.15));
  near('nib: hangers provided, two legs', N.AsHang, 2 * Math.PI * 25 * 1000 / 150); ok('nib: hanger check present', !!chk(N, 'hang'));
  ok('nib not hanging: no hanger check', !chk(K.design({ ...BASE, mode: 'nib', FEd: 120, ac: 100, hc: 300, hf: 250, lc: 200, lp: 100, phi: 12, s: 150, sNl: 200, hcol: 300 }), 'hang'));
}
// ---------- anchorage ----------
{
  near('Table NA.6a: 4φ up to 16', K.mandrelStd(16), 64); near('Table NA.6a: 7φ above 16', K.mandrelStd(20), 140);
  const R = D({}), c = EC2.concrete(40);
  near('lbd poor = φ/4 fyd/fbd(η1 0.7)', R.lbdPoor, 20 / 4 * (500 / 1.15) / (2.25 * 0.7 * c.fctd), 1e-12);
  near('ab = min(s/2, c + φ/2)', R.ab, Math.min(((500 - 2 * 45 - 20) / 3) / 2, 45 + 10));
  near('(8.1) mandrel', R.front.phimReq, R.front.Fbt * 1000 * (1 / R.ab + 1 / 40) / c.fcd, 1e-12);
  near('Fbt scales with As,req/As,prov', R.front.Fbt, (R.lbdPoor - 140) / R.lbdPoor * Math.PI * 100 * (500 / 1.15) * (R.AsReq / R.As) / 1000, 1e-12);
  const B = K.bendEnd({ lst: 900, lbd: 800, phi: 20, Abar: 314, fyd: 434.8, ratio: 1, ab: 50, fcd: 22.7, phim: 140 }); ok('straight length enough: no bend force', B.Fbt === 0 && B.ok && B.straight);
  const w = K.weldedBar({ phiT: 32, phi: 20, lt: 105, cover: 35, c, fyd: 500 / 1.15 });
  near('8.6: x = 2c/φt + 1', w.x, 2 * 35 / 32 + 1); near('8.6: y = 0.015 + 0.14e^(−0.18x)', w.y, 0.015 + 0.14 * Math.exp(-0.18 * w.x)); near('8.6: σtd = fctd/y', w.std, c.fctd / w.y);
  near('8.6: ltd limited to lt', w.ltd, 105); near('8.6: Fwd = 0.5 As fyd', w.Fwd, 0.5 * Math.PI * 100 * 500 / 1.15 / 1000); near('8.6: Fbtd', w.Fbtd, Math.min(105 * 32 * w.std / 1000, w.Fwd));
  const W = D({ frontAnch: 'welded', phiT: 32 }); near('welded bar takes part of the bend force', W.front.Fbt, Math.max(0, W.front.Fbt0 - W.welded.Fbtd), 1e-12);
  throws('welded bar outside 14–32 mm', () => D({ frontAnch: 'welded', phiT: 12 }), /14 to 32/);
}
// ---------- inputs ----------
throws('bearing past the front', () => D({ ac: 350 }), /front/); throws('bearing into the face', () => D({ ac: 60 }), /support face/);
throws('bearing wider than the corbel', () => D({ bp: 600 }), /wider/); throws('front deeper than the root', () => D({ hf: 600 }), /front/);
throws('too many bars', () => D({ n: 12, phi: 32 }), /fit/); throws('one bar', () => D({ n: 1 }), /two/);
console.log(`${n - fails}/${n} checks passed`);
if (fails) process.exit(1);
