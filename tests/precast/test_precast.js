// Precast Connections: bearings (EN 1992-1-1 10.9.5, Tables 10.2 to 10.5 as printed), half-joints (10.9.4.6, Figure 10.4
// models with the node laid out as CCIP-057 does for corbels) and grouted sleeve splices, against hand calculation.
//   node tests/precast/test_precast.js
const { Precast: P, EC2 } = require('./load.js');
let n = 0, fails = 0;
const truth = (name, c) => { n++; if (!c) { fails++; console.log('FAIL ' + name); } else console.log('ok   ' + name); };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const chk = (R, id) => R.checks.find(c => c.id === id);
const throws = (f, re) => { try { f(); } catch (e) { return re.test(e.message); } return false; };

// ---------- bearings ----------
const BB = { mode: 'bearing', FEd: 300, row: 'beam', support: 'rc30', fckSupported: 40, fckSupporting: 40, conn: 'bedded', fckBed: 30, b1: 300, aProv: 250, span: 8000, ln: 8000, sup2: 'precast', detail: 'straight', cEnd: 25 };
const B = o => P.design({ ...BB, ...o });
truth('Table 10.2 as printed: line 25/30/40, ribbed 55/70/80, beams 90/110/140', JSON.stringify(P.T102) === JSON.stringify({ line: [25, 30, 40], ribbed: [55, 70, 80], beam: [90, 110, 140] }));
truth('Table 10.3 as printed: steel, RC ≥ C30, plain/RC < C30, brickwork (– above 0.4)', JSON.stringify(P.T103) === JSON.stringify({ steel: { line: [0, 0, 10], conc: [5, 10, 15] }, rc30: { line: [5, 10, 15], conc: [10, 15, 25] }, plain: { line: [10, 15, 25], conc: [20, 25, 35] }, brick: { line: [10, 15, null], conc: [20, 25, null] } }));
truth('Table 10.4: continuous 0/0, straight 5 / max(15, end cover), exposed 5/15, vertical loop 15 / cover + radius', P.a3Of('cont', 'conc', 25, 0) === 0 && P.a3Of('straight', 'line', 25, 0) === 5 && P.a3Of('straight', 'conc', 25, 0) === 25 && P.a3Of('straight', 'conc', 10, 0) === 15 && P.a3Of('exposed', 'conc', 40, 0) === 15 && P.a3Of('vloop', 'line', 30, 40) === 15 && P.a3Of('vloop', 'conc', 30, 40) === 70);
truth('Table 10.5: precast 10 ≤ l/1200 ≤ 30, in situ 15 ≤ l/1200 + 5 ≤ 40', P.dA2Of('precast', 6000) === 10 && near(P.dA2Of('precast', 24000), 20) && P.dA2Of('precast', 60000) === 30 && P.dA2Of('insitu', 6000) === 15 && near(P.dA2Of('insitu', 24000), 25) && P.dA2Of('insitu', 60000) === 40);
{ const R = B({}), fcd = 0.85 * 40 / 1.5;
  truth('bearing: f_Rd = f_bed (0.85 × 30/1.5 = 17.0) ≤ 0.85 f_cd', near(R.fRd, 17) && near(R.fcd, fcd));
  // net length available 250 − a2 − 25 − √(10² + 3.2²), σ/f_cd in 0.15–0.4 so a2 = 15 and a1,min = 110
  const tol = Math.hypot(10, 3.2), a1av = 250 - 15 - 25 - tol, sig = 300e3 / (300 * a1av);
  truth('bearing: σ_Ed over the net length, band 0.15–0.4 (a2 15, a1,min 110)', near(R.sigma, sig) && R.k === 1 && R.a2 === 15 && R.a1min === 110 && near(R.tol, tol));
  truth('bearing: a = 110 + 15 + 25 + 10.5 = 160.5 mm; utilisation a/250', near(R.aReq, 110 + 15 + 25 + tol) && near(chk(R, 'nominal').util, (150 + tol) / 250) && near(chk(R, 'stress').util, sig / 17)); }
{ const R = B({ conn: 'dry' }), fcd = 0.85 * 40 / 1.5;
  truth('bearing, dry: f_Rd = 0.4 f_cd and the 0.3 f_cd average stress of 10.9.4.3(3)', near(R.fRd, 0.4 * fcd) && near(chk(R, 'dry').util, R.sigma / (0.3 * fcd))); }
{ const R = B({ conn: 'dry', b1: 900 }); truth('bearing, dry: b1 taken as 600 mm (10.9.5.2(3)) with a note', R.b1 === 600 && R.warnings.some(w => /600 mm/.test(w))); }
{ const R = B({ support: 'steel', row: 'line', FEd: 60, b1: 1000, aProv: 100, detail: 'cont' }); truth('bearing: a floor (60 kN/m) on steel, low stress: a2 = 0, a3 = 0, a1 = 25', R.k === 0 && R.a2 === 0 && R.a3 === 0 && R.a1min === 25 && near(R.aReq, 25 + R.tol)); }
{ const R = B({ isolated: true, movement: 10 }), R0 = B({}); truth('bearing: isolated +20 and movement +10 (10.9.5.3)', near(R.aReq - R0.aReq, 30, 1e-9) || (R.k !== R0.k)); }
{ const R = B({ support: 'brick', FEd: 600, aProv: 200 }); truth('bearing on brickwork above 0.4 f_cd: a concrete padstone is needed (NOT MET)', R.brickPad && chk(R, 'brick') && !chk(R, 'brick').ok && R.util > 1); }
{ const R = B({ conn: 'pad', fbedPad: 10, tPad: 10, lpad: 150, AsPad: 100 }), As = 0.25 * (10 / 150) * 300e3 / (500 / 1.15);
  truth('bearing on a soft pad: f_Rd = f_bed, A_s = 0.25 (t/h) F_Ed / f_yd (10.5)', near(R.fRd, 10) && near(R.pad.As, As) && near(chk(R, 'padsteel').util, As / 100)); }
{ const R = B({ lpad: 90 }); truth('bearing: a pad shorter than a1 fails', chk(R, 'pad').util > 1); }
{ const R = B({ aProv: 120 }); truth('bearing: too short a seating fails', chk(R, 'nominal').util > 1 && R.util > 1); }
{ const R = B({ fckSupporting: 25, support: 'plain' }); truth('bearing: f_cd the lower of the two members (C25 support)', near(R.fcd, 0.85 * 25 / 1.5)); }
truth('bearing: RC ≥ C30 with a C25 support is refused', throws(() => B({ fckSupporting: 25 }), /below 30/));

// ---------- half-joints ----------
const HB = { mode: 'half', VEd: 200, h: 600, hn: 300, b: 300, av: 100, lend: 250, lp: 100, bp: 250, fck: 40, cover: 30, phiL: 10, nTie: 4, phiTie: 16, nibEnd: 'loop', phimTie: 128, lin: 700,
  nHang: 3, legsHang: 2, phiHang: 12, sHang: 50, nBot: 3, phiBot: 25, botEnd: 'bent', alpha: 0 };
const H = o => P.design({ ...HB, ...o });
{ const R = H({}), fcd = 0.85 * 40 / 1.5, nu = 1 - 40 / 250, s2 = 0.85 * nu * fcd, V = 200e3, Hh = 0.2 * V;
  const dn = 300 - 30 - 10 - 8, ax = V / (300 * s2), xh = 30 + 6 + 50, xn = Math.max(ax / 2, xh), a = 100 + xn, z = (dn + Math.sqrt(dn * dn - 2 * ax * a)) / 2;
  truth('half-joint: d_n = 252, the node a_x = V/(b k2ν′f_cd), centred at the hangers (86 mm)', near(R.dn, dn) && near(R.G.ax, ax) && near(R.G.xn, 86) && near(R.s2, s2));
  truth('half-joint: z from z² − d_n z + a_x a/2 = 0', near(R.G.z, z) && near(R.G.a, a));
  truth('half-joint: nib tie V a/z + 0.2V; hangers V; bottom tie V cot45° + H', near(R.Ftie, V * a / z + Hh) && near(R.Fhang, V) && near(R.Fbot, V + Hh));
  truth('half-joint: tie, hanger and bottom tie utilisations F / (A_s f_yd)', near(chk(R, 'tie').util, R.Ftie / (4 * Math.PI * 64 * 500 / 1.15)) && near(chk(R, 'hang').util, V / (6 * Math.PI * 36 * 500 / 1.15)) && near(chk(R, 'bot').util, R.Fbot / (3 * Math.PI * 156.25 * 500 / 1.15)));
  truth('half-joint: bearing node V/(b_p l_p) ≤ k2ν′f_cd; nib shear V ≤ 0.5 b d_n ν f_cd', near(chk(R, 'bear').util, V / (250 * 100) / s2) && near(chk(R, 'shear').util, V / (0.5 * 300 * dn * 0.6 * nu * fcd)));
  const th = Math.atan(z / a), u = 2 * (30 + 10 + 8), w = 100 * Math.sin(th) + u * Math.cos(th);
  truth('half-joint: the strut over l_p sin θ + u cos θ', near(chk(R, 'strut').util, V / Math.sin(th) / (300 * w) / s2));
  truth('half-joint: passes with the defaults', R.util <= 1); }
{ const R = H({}), e = R.endT, Fbar = R.Ftie / (4 * Math.PI * 64) * Math.PI * 64, ab = Math.min(30 + 10 + 8, (300 - 80 - 16) / 3 / 2);
  const Fbt = (R.lbTie - e.lst) / R.lbTie * Fbar, req = Fbt * (1 / ab + 1 / 32) / (0.85 * 40 / 1.5);
  truth('half-joint: the loop: force left at the bend and the mandrel it needs (8.1)', near(e.Fbt, Fbt) && near(e.phimReq, req) && near(chk(R, 'anchEnd').util, req / 128)); }
{ const R = H({ alpha: 1, nInc: 2, phiInc: 20, beta: 45, nNibL: 2, legsNibL: 2, phiNibL: 10 }), V = 200e3;
  truth('half-joint, all on inclined bars: F = V/sin 45°, links 0.25V, no hangers or node', near(R.Finc, V * Math.SQRT2) && !chk(R, 'hang') && !chk(R, 'node') && near(chk(R, 'niblinks').util, 0.25 * V / (2 * 2 * Math.PI * 25 * 500 / 1.15)) && near(R.Ftie, 0.2 * V)); }
{ const R = H({ alpha: 0.5, nInc: 2, phiInc: 16 }), V = 200e3;
  truth('half-joint, half and half: hangers V/2, inclined V/2 / sin 45°, bottom tie V/2 + V/2 + H', near(R.Fhang, V / 2) && near(R.Finc, V / 2 * Math.SQRT2) && near(R.Fbot, V / 2 + V / 2 + 0.2 * V)); }
{ const R = H({ hRule: 'value', HEd: 0 }); truth('half-joint: H as given (0)', R.H === 0 && near(R.Ftie, R.Fhang * R.G.a / R.G.z)); }
{ const R = H({ av: 180, lend: 260 }); truth('half-joint: a bearing far from the face gives a strut flatter than 45° (warning)', R.G.theta < 45 && R.warnings.some(w => /45°/.test(w))); }
{ const R = H({ nibEnd: 'plate' }); truth('half-joint: a welded end plate is left to the designer (warning, no anchorage check)', !chk(R, 'anchEnd') && R.warnings.some(w => /weld/.test(w))); }
truth('half-joint: a nib as deep as the beam is refused', throws(() => H({ hn: 600 }), /shallower/));
truth('half-joint: a bearing past the end of the nib is refused', throws(() => H({ av: 220 }), /past the end/));

// ---------- grouted sleeve splices ----------
const SB = { mode: 'splice', b: 400, h: 400, nb: 3, nh: 3, phi: 25, Ds: 45, cover: 35, phiL: 10, fckCol: 40, fckLow: 35, fckGrout: 60, NEd: 1500, Mh: 150, Mb: 0, VEd: 60, capMode: 'full', leMin: 200, leProv: 220, fgMin: 50, cReq: 40, surface: 'smooth', dg: 20 };
const S = o => P.design({ ...SB, ...o });
{ const R = S({}), fcd = 0.85 * 35 / 1.5, As = 8 * Math.PI * 625 / 4;
  truth('splice: 8 bars round the perimeter, the joint at the weakest f_ck (35)', R.bars.length === 8 && R.fj === 35);
  truth('splice: N_Rd = η f_cd b h + A_s min(f_yd, E_s ε_c2)', near(R.NRd, fcd * 160000 + As * 400) && near(chk(R, 'ncomp').util, 1500e3 / R.NRd));
  // M_Rd by an independent strain-compatibility bisection: three layers at 67.5, 200, 332.5 mm
  const off = 35 + 10 + 22.5, L = [[off, 3], [200, 2], [400 - off, 3]].map(([y, k]) => ({ y, As: k * Math.PI * 625 / 4 })), N = 1500e3;
  const F = x => { let f = 0.8 * x * 400 * fcd; L.forEach(l => { let s = 200000 * 0.0035 * (x - l.y) / x; s = Math.max(-500 / 1.15, Math.min(500 / 1.15, s)); if (l.y < 0.8 * x && s > 0) s -= fcd; f += s * l.As; }); return f; };
  let lo = 1, hi = 4000; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (F(m) > N) hi = m; else lo = m; }
  const x = (lo + hi) / 2; let M = 0.8 * x * 400 * fcd * (200 - 0.4 * x); L.forEach(l => { let s = 200000 * 0.0035 * (x - l.y) / x; s = Math.max(-500 / 1.15, Math.min(500 / 1.15, s)); if (l.y < 0.8 * x && s > 0) s -= fcd; M += s * l.As * (200 - l.y); });
  truth('splice: M_Rd across h by strain compatibility (independent bisection)', near(R.Rh.MRd, M, 1e-6) && near(R.Rh.x, x, 1e-6) && near(chk(R, 'mh').util, 150e6 / M)); }
{ const R = S({ capMode: 'value', Fk: 150, NEd: -400, Mh: 0 }), Ab = Math.PI * 625 / 4;
  truth('splice rated below the bar: tension limited to F_k/(γ_s A_s); pure tension on 8 splices', near(R.fsMax, 150e3 / 1.15 / Ab) && near(chk(R, 'nten').util, 400e3 / (8 * 150e3 / 1.15)) && R.warnings.some(w => /below the bar/.test(w))); }
{ const R = S({ VEd: 300 }), c = EC2.concrete(35), Ai = 160000, sn = Math.min(1500e3 / Ai, 0.6 * c.fcd), rho = 8 * Math.PI * 625 / 4 / Ai;
  const v = Math.min(0.2 * c.fctd + 0.6 * sn + rho * 500 / 1.15 * 0.6, 0.5 * c.nu * c.fcd);
  truth('splice: shear across the bed, 6.2.5: c f_ctd + μ σ_n + ρ f_yd μ ≤ 0.5 ν f_cd (smooth)', near(R.vRdi, v) && near(chk(R, 'shear').util, 300e3 / Ai / v)); }
{ const R = S({ Mb: 100 }), r = 1500e3 / R.NRd, a = r <= 0.1 ? 1 : 1 + (r - 0.1) / 0.6 * 0.5;
  truth('splice: biaxial (5.39) with a interpolated from N/N_Rd', near(R.biax.a, a) && near(R.biax.u, (150e6 / R.Rh.MRd) ** a + (100e6 / R.Rb.MRd) ** a)); }
{ const R = S({ leProv: 180, fckGrout: 40, cReq: 60 });
  truth("splice: the maker's embedment and grout, and the cover, NOT MET", !chk(R, 'embed').ok && !chk(R, 'grout').ok && !chk(R, 'cover').ok && R.util > 1 && R.fj === 35); }
{ const R = S({ nb: 5, Ds: 60 }); truth('splice: sleeves too close (8.2) NOT MET', !chk(R, 'spacing').ok); }
{ const R = S({ NEd: 20000 }); truth('splice: N_Ed beyond the section reported, not crashed', chk(R, 'mh').util === Infinity && chk(R, 'ncomp').util > 1); }
truth('splice: a sleeve narrower than its bar is refused', throws(() => S({ Ds: 20 }), /wider than the bar/));
console.log(`\n${n - fails}/${n} precast checks passed`); process.exit(fails ? 1 : 0);
