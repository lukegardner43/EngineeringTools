// Prestressed Beam engine checks. The worked examples 11.1 to 11.12 of Mosley, Bungey & Hulse, Reinforced Concrete Design
// to Eurocode 2 (7th edn), chapter 11 (their results only, to the book's rounding); EC2 Annex B creep and shrinkage and
// 3.1.2 strength at transfer against The Concrete Centre's TCC42 (outputs only); then the design run against hand
// calculations and closed forms: section properties, elastic shortening at release, friction and draw-in, the curvature
// integration, strain compatibility against the EC2 core, shear against the core, the Magnel diagram against the stress
// checks, symmetry, debonding, transmission lengths, and input errors.
const { PSC, EC2 } = require('./load');
let n = 0, fails = 0;
const ok = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } };
const near = (name, a, b, tol = 1e-9, scale = 1) => ok(name, Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(scale, Math.abs(b)), `got ${a}, want ${b}`);
const book = (name, a, b, tol = 0.006) => near('book ' + name, a, b, tol);   // the book rounds to three figures
const throws = (name, f, re) => { let e = null; try { f(); } catch (x) { e = x; } ok(name, !!e && (!re || re.test(e.message)), e ? e.message : 'no error'); };
const kN = v => v / 1e3, kNm = v => v / 1e6;

// ---------- Example 11.1: 300 x 150 rectangle, 4 m, live 10 kN/m, straight tendon at e = 65 ----------
{
  const sp = PSC.section({ type: 'rect', b: 150, h: 300 });
  near('11.1 A', sp.A, 45e3); near('11.1 z', sp.zt, 2.25e6); near('11.1 zb', sp.zb, 2.25e6);
  const sw = 0.15 * 0.3 * 25, Mmax = (10 + sw) * 16 / 8 * 1e6, Mmin = sw * 16 / 8 * 1e6;
  book('11.1 Mmax 22.2 kNm', kNm(Mmax), 22.2, 0.01); book('11.1 Mmin 2.2 kNm', kNm(Mmin), 2.2, 0.03);
  const P = 22.2e6 / (sp.zb / sp.A + 65); book('11.1 P = 193 kN', kN(P), 193);
  const f = PSC.fibre(sp, 193e3, 193e3 * 65, 2.2e6), fe = PSC.fibre(sp, 193e3, 193e3 * 65, 0);
  near('11.1 top under Mmin -0.3', f.top, -0.3, 0.02, 1); near('11.1 bottom under Mmin 8.9', f.bot, 8.9, 0.01);
  near('11.1 top at the ends -1.3', fe.top, -1.3, 0.02, 1); near('11.1 bottom at the ends 9.9', fe.bot, 9.9, 0.01);
}
// ---------- Example 11.2: minimum moduli for 3 kN/m over 10 m, C40, K = 0.8 ----------
{
  const m = PSC.minModuli({ Mmax: 37.5e6, Mmin: 0, K: 0.8, fmax: 24, fmin: 0, fmaxT: 16, fminT: -1 });
  book('11.2 Mv 37.5', kNm(m.Mv), 37.5); book('11.2 zt 1.50e6', m.ztMin / 1e6, 1.50, 0.01); book('11.2 zb 2.93e6', m.zbMin / 1e6, 2.93);
  book('11.2 h for b = 200: 297 mm', Math.sqrt(m.zbMin * 6 / 200), 297, 0.003);
  book('11.2 lateral limit 41.5', 50 / (350 / 200) ** (1 / 3), 41.5, 0.003);
}
// the book's 200 x 350 beam with its rounded moduli (zt = zb = 4.08e6, A = 70 000)
const B3 = { A: 70000, h: 350, yb: 175, yt: 175, I: 4.08e6 * 175, zt: 4.08e6, zb: 4.08e6 };
const A3 = { A: 70000, zt: 4.08e6, zb: 4.08e6, K: 0.8, fmax: 24, fmin: 0, fmaxT: 16, fminT: -1, Mmax: 59.4e6, Mmin: 21.9e6 };
// ---------- Example 11.3: limits on P0 at e = 75 mm, and the economic maximum ----------
{
  const L = PSC.p0Limits({ ...A3, e: 75 }), by = q => L.list.find(l => l.eq === q);
  book('11.3 (11.17) 2881 kN with its sense reversed', kN(-by('11.17').value), 2881, 0.003); ok('11.17 is a lower limit when zt/A < e', by('11.17').sense === '>=');
  book('11.3 (11.18) 1555 kN, an upper limit', kN(by('11.18').value), 1555, 0.003); ok('11.18 sense reversed', by('11.18').sense === '<=');
  book('11.3 (11.19) 557 kN', kN(by('11.19').value), 557); ok('11.19 lower', by('11.19').sense === '>=');
  book('11.3 (11.20) 654 kN', kN(by('11.20').value), 654); ok('11.20 upper', by('11.20').sense === '<=');
  book('11.3 range low 557', kN(L.lo), 557); book('11.3 range high 654', kN(L.hi), 654); ok('11.3 feasible', L.ok);
  book('11.3 economic P0 1050 kN (11.23)', kN(PSC.p0Economic(A3)), 1050);
}
// ---------- Example 11.4: top stress under the quasi-permanent load with P0 = 557 kN ----------
{
  const Mqp = 21.9e6 + 25e6 + 0.3 * 12.5e6; book('11.4 Mqp 50.65', kNm(Mqp), 50.65);
  const f = PSC.fibre(B3, 0.8 * 557e3, 0.8 * 557e3 * 75, Mqp); book('11.4 top 10.59', f.top, 10.59, 0.003);
}
// ---------- Example 11.5: Magnel diagram, emax = 125 ----------
{
  const cons = PSC.bookConstraints(B3, A3), line = eq => { const k = cons.find(c => c.eq === eq), h = PSC.halfPlane(B3, k); return { u0: -h.c / h.au * 1e9, s: -h.ae / h.au * 1e9, le: h.au > 0 }; };
  const l1 = line('11.24'), l2 = line('11.25'), l3 = line('11.26'), l4 = line('11.27');
  book('11.5 line 1: 1210', l1.u0, 1210); book('11.5 line 1: slope -20.77', l1.s, -20.77); ok('11.5 line 1 bounds 1/P0 below', !l1.le);
  book('11.5 line 2: -2243 (the sign is lost in print)', l2.u0, -2243); book('11.5 line 2: slope 38.50', l2.s, 38.50); ok('11.5 line 2 bounds below', !l2.le);
  book('11.5 line 3: 785', l3.u0, 785); book('11.5 line 3: slope 13.5', l3.s, 13.5); ok('11.5 line 3 bounds above', l3.le);
  book('11.5 line 4: 669', l4.u0, 669); book('11.5 line 4: slope 11.5', l4.s, 11.5); ok('11.5 line 4 bounds below', !l4.le);
  const M = PSC.magnel(B3, cons, { emin: -150, emax: 125, P0: 700e3 });
  ok('11.5 feasible', M.feasible);
  book('11.5 minimum P0 414 kN', kN(M.minP0.P0), 414); near('11.5 at e = 121', M.minP0.e, 121, 0.01);
  book('11.5 maximum P0 1160 kN', kN(M.maxP0.P0), 1160); near('11.5 at e = 17', M.maxP0.e, 17, 0.03);
  book('11.5 point A: 1050 kN (lines 1 and 3)', 1e6 / ((l1.u0 * l3.s - l3.u0 * l1.s) / (l3.s - l1.s)), 1050);
  near('11.6 via Magnel: P0 = 700 gives e from 48', M.atP.elo, 47.8, 0.005); near('11.6 via Magnel: to 66', M.atP.ehi, 66, 0.01);
  ok('11.5 emax 125 does not restrict (book)', M.poly.every(p => p[0] < 125 - 1e-6));
}
// ---------- Example 11.6: cable zone for P0 = 700 kN ----------
{
  const zm = PSC.cableZone(B3, PSC.bookConstraints(B3, A3), 700e3);
  book('11.6 mid-span lower 47.8 (11.31)', zm.lo, 47.8); book('11.6 mid-span upper 66 (11.29)', zm.hi, 66, 0.01);
  const ze = PSC.cableZone(B3, PSC.bookConstraints(B3, { ...A3, Mmax: 0, Mmin: 0 }), 700e3);
  book('11.6 ends upper 35 (11.29)', ze.hi, 35, 0.003); book('11.6 ends lower -58.29 (11.31)', ze.lo, -58.29, 0.002);
  // with all eight fibre limits the top compression at transfer closes the zone to +/-35 mm, as the book argues by symmetry
  const all = [...PSC.bookConstraints(B3, { ...A3, Mmax: 0, Mmin: 0 }), { y: -175, Ks: 1, M: 0, lim: 16, kind: 'max' }, { y: -175, Ks: 0.8, M: 0, lim: 24, kind: 'max' }];
  const z8 = PSC.cableZone(B3, all, 700e3); book('11.6 ends -35 with the top compression limit', z8.lo, -35, 0.003);
}
// ---------- Example 11.7: losses at mid-span of a 30 m post-tensioned beam ----------
{
  const th = 2 * (640 / 15000 ** 2) * 15000; near('11.7 theta 0.0853', th, 0.0853, 0.001);
  const Pf = PSC.friction({ P: 10500e3, mu: 0.19, theta: th, k: 0.01 / 1000, x: 15000 }); book('11.7 friction 460 kN', kN(10500e3 - Pf), 460, 0.003);
  const Pe = PSC.elasticBook({ P: 10500e3, Ap: 7500, A: 1.05e6, I: 0.36e12, e: 427, ae: 205 / 32, j: 0.5 });
  book('11.7 elastic: 0.966 P0', Pe / 10500e3, 0.966, 0.001); book('11.7 elastic loss 357 kN', kN(10500e3 - Pe), 357, 0.005);
  const P0p = 10500e3 - 817e3, sc = P0p / 1.05e6 * (1 + 427 * 427 * 1.05e6 / 0.36e12);
  const s = PSC.lossSum({ ecs: 330e-6, Ep: 205000, Ecm: 32000, phi: 1.6, dsr: 0, scQP: sc });
  book('11.7 creep 1034 kN', kN(s.parts.creep * 7500), 1034); book('11.7 shrinkage 507 kN', kN(s.parts.shrink * 7500), 507);
  book('11.7 relaxation 605 kN (2.5 x rho1000)', kN(2.5 * 0.025 * P0p), 605); book('11.7 total 2963 kN', 817 + kN(s.parts.creep * 7500 + s.parts.shrink * 7500 + 0.0625 * P0p), 2963, 0.002);
}
// ---------- Example 11.8: deflection of the 200 x 350 beam, P0 = 560 kN, parabolic e 75 mm ----------
const ex118 = (over = {}) => ({ sec: { type: 'rect', b: 200, h: 350 }, L: 10000, lb: 0, loads: { rho: 25, g2: 2, q: 1, psi0: 0.7, psi1: 0.5, psi2: 0.3 },
  conc: { fck: 40, fckT: 40, t0: 28, cement: 'N', creepMode: 'given', phi: 0, ecs: 0, EcT: 35000, Ec: 35000 },
  pre: { kind: 'post', fpk: 1860, Ep: 195000, sigJ: 1400, relMode: 'factor', relFactor: 0, rho1000: 2.5, Ap: 400, nT: 1, esj: 'seq', zEnd: 175, zMid: 100, mu: 0, k: 0, drawIn: 0, ends: 'one' },
  lossMode: 'sum', limits: { tS: { mode: 'value', value: 1 }, tT: { mode: 'value', value: 1 } }, uls: { links: { phi: 8, legs: 2, s: 200 } }, ...over });
{
  const R = PSC.design(ex118()), I = 200 * 350 ** 3 / 12, L = 10000, E = 35000;
  near('11.8 I 715e6', I, 715e6, 0.001); near('P0 = 560 kN with no friction or elastic loss', R.mid.P0, 560e3, 1e-9);
  const ya = 5 * 1.75 * L ** 4 / (384 * E * I) - 5 * 560e3 * 75 * L * L / (48 * E * I);
  book('11.8 transfer -8 mm (9.1 - 17.5)', R.defl.T.mid, -8.4, 0.01); near('transfer deflection by integration = closed form', R.defl.T.mid, ya, 2e-4);
  book('11.8 self-weight part 9.1', 5 * 1.75 * L ** 4 / (384 * E * I), 9.1); book('11.8 prestress part 17.5', 5 * 560e3 * 75 * L * L / (48 * E * I), 17.5, 0.01);
  near('11.8 with the finishes = transfer + 10 mm', R.defl.F.mid, ya + 5 * 2 * L ** 4 / (384 * E * I), 2e-4); book('11.8 with the finishes +2 mm', R.defl.F.mid, 2, 0.02);
  // long term: losses 0.4 per mille shrinkage (uniform), no creep: closed form on Ecm
  const R2 = PSC.design(ex118({ conc: { ...ex118().conc, ecs: 400 } })), Pinf = 560e3 - 400 * 400e-6 * 195000;
  near('uniform shrinkage loss', R2.mid.P, Pinf, 1e-9);
  near('long-term deflection by integration = closed form', R2.defl.Lg.mid, 5 * 4.05 * L ** 4 / (384 * E * I) - 5 * Pinf * 75 * L * L / (48 * E * I), 3e-4);
  // the book's long-term figures: Ec,eff = 35/(1 + 2) = 11.7, P = 448 kN, 63.0 - 41.8 = 21 mm, movement 19 mm
  const Ef = 35000 / 3, yc = 5 * 4.05 * L ** 4 / (384 * Ef * I) - 5 * 448e3 * 75 * L * L / (48 * Ef * I);
  book('11.8 long term 21 mm', yc, 21.2, 0.01); book('11.8 movement 19 mm', yc - 1.97, 19.2, 0.01);
  const R3 = PSC.design(ex118({ conc: { ...ex118().conc, phi: 2 } }));
  near('Ec,eff = Ecm/(1 + phi)', R3.defl.Ecf, 35000 / 3, 1e-12);
}
// ---------- Example 11.9: end block, four 100 mm conical anchors of 250 kN in 200 x 150 zones, C40 ----------
{
  const e = PSC.endBlock({ P: 250e3, shape: 'circle', a0: 100, b1: 200, h1: 150, fck: 40, nA: 4, B: 400, H: 400, phiZone: 10, phiAll: 12 });
  book('11.9 bearing 38.2', e.sb, 38.2, 0.002); book('11.9 fRdu 40.2 (book rounds 1/1.5 to 0.67)', e.fRdu, 40.2, 0.006);
  book('11.9 tie 100 kN', kN(e.T), 100, 0.01); book('11.9 As 330 at 300 N/mm2', e.As, 330, 0.011); ok('11.9 three H10 links', e.nZone === 3);
  book('11.9 strut 7.21', e.sStrut, 7.21, 0.003); book('11.9 strut limit 13.44', e.sRd, 13.44, 0.001);
  book('11.9 combined tie 400 kN', kN(e.Tall), 400, 0.01); book('11.9 combined As 1333', e.AsAll, 1333, 0.001); ok('11.9 six H12 links', e.nAll === 6);
}
// ---------- Example 11.10: ULS of a pretensioned 120 x 300 beam, ten 5 mm wires, C35 ----------
{
  const sp = PSC.section({ type: 'rect', b: 120, h: 300 }), c = EC2.concrete(35), eps0 = 0.9 * 1120 * 0.7 / 205000;
  book('11.10 prestrain 0.0034', eps0, 0.0034, 0.015);
  const u = PSC.ulsBending({ L: sp.L, h: 300, c, tendons: [{ A: 98, d: 175, eps0 }, { A: 98, d: 275, eps0 }], Ep: 205000, fpd: 1600 / 1.15 });
  book('11.10 x = 123', u.x, 123, 0.005); book('11.10 fsa 1000', u.tendons[0].s, 1000, 0.01); book('11.10 fsb 1390', u.tendons[1].s, 1390, 0.002);
  book('11.10 Fs = Fc = 234 kN', kN(u.T), 234, 0.005); near('equilibrium', u.C, u.T, 1e-6); book('11.10 Mu 43.1 kNm', kNm(u.MRd), 43.1, 0.003);
  // Example 11.11: five wires at d = 275, C40. The book takes the yielded wires at 0.9 f_pd (123 kN); with that force:
  const c4 = EC2.concrete(40), fpdB = 0.9 * 1600 / 1.15;
  const u1 = PSC.ulsBending({ L: sp.L, h: 300, c: c4, tendons: [{ A: 98, d: 275, eps0 }], Ep: 205000, fpd: fpdB });
  book('11.11 x = 56', u1.x, 56.4, 0.005); book('11.11 Mu 31.1 kNm without bars', kNm(u1.MRd), 31.0, 0.004);
  const u2 = PSC.ulsBending({ L: sp.L, h: 300, c: c4, tendons: [{ A: 98, d: 275, eps0 }], bars: [{ As: 157, d: 245, fyk: 500 }], Ep: 205000, fpd: fpdB });
  book('11.11 x = 88 with 2H10', u2.x, 88, 0.005); book('11.11 strand strain 0.0108', u2.tendons[0].eps, 0.0108, 0.012); book('11.11 bar strain 0.0062', u2.bars[0].eps, 0.0062, 0.012);
  book('11.11 Mu 43.8 kNm', kNm(u2.MRd), 43.8, 0.002);
  // at the full f_pd the wires give 136 kN: x and Mu by hand
  const u3 = PSC.ulsBending({ L: sp.L, h: 300, c: c4, tendons: [{ A: 98, d: 275, eps0 }], bars: [{ As: 157, d: 245, fyk: 500 }], Ep: 205000, fpd: 1600 / 1.15 });
  const T3 = 98 * 1600 / 1.15 + 157 * 500 / 1.15, x3 = T3 / (c4.fcd * 120 * 0.8);
  near('11.11 at f_pd: x by hand', u3.x, x3, 1e-6); near('11.11 at f_pd: Mu by hand', u3.MRd, 98 * 1600 / 1.15 * (275 - 0.4 * x3) + 157 * 500 / 1.15 * (245 - 0.4 * x3), 1e-6);
}
// ---------- Example 11.12: shear in a 30 m post-tensioned I beam, Table 11.2 ----------
{
  const bS = 150 / (1000 * 200 * 550 + 150 * 450 * 225), T = [   // x from mid-span: d, VRd,c, gamma_P Vt, VEd, VRd,c + gamma_P Vt, VRd,max(22), Asw/s, Ftd
    [0, 1400, 281, 0, 0, 281, 941, null, 0], [3, 1382, 278, 28, 120, 306, 928, null, 115], [6, 1328, 270, 56, 240, 325, 892, null, 230],
    [9, 1238, 255, 84, 360, 339, 832, 0.229, 345], [12, 1112, 234, 112, 480, 346, 747, 0.339, 460], [15, 950, 202, 140, 600, 342, 638, 0.497, 575]];
  for (const [xm, d0, vc, gvt, ved, cap, vmax, asw, ftd] of T) {
    const x = xm * 1000, e = 750 - 2e-6 * x * x, d = 1500 - 850 + e;
    const R = PSC.shearAt({ VEd: 40 * x, P: 2590e3, slope: 4e-6 * x, d, bw: 150, A: 500e3, I: 145106e6, bS, Asl: 3450, fck: 35, fctk: 2.2, rule: 'lower' });
    book(`11.12 x = ${xm} m: d ${d0}`, d, d0, 0.001); book(`11.12 x = ${xm} m: VRd,c ${vc}`, kN(R.VRdc), vc, 0.006);
    near(`11.12 x = ${xm} m: gamma_P Vt ${gvt}`, kN(R.gVt), gvt, 0.01, 1); near(`11.12 x = ${xm} m: VRd,c + gamma_P Vt ${cap}`, kN(R.Vcap), cap, 0.005, 1);
    book(`11.12 x = ${xm} m: VRd,max(22) ${vmax}`, kN(R.Vmax22), vmax, 0.003);
    if (asw === null) ok(`11.12 x = ${xm} m: minimum links only`, !R.need); else { ok(`11.12 x = ${xm} m: links needed`, R.need); book(`11.12 x = ${xm} m: Asw/s ${asw}`, R.AswS, asw, 0.006); }
    near(`11.12 x = ${xm} m: Ftd ${ftd}`, kN(R.dFtd), ftd, 0.005, 1);
    book(`11.12 x = ${xm} m: Asw,min/s 0.14`, R.AswSmin, 0.142, 0.005);
  }
  const R0 = PSC.shearAt({ VEd: 600e3, P: 2590e3, slope: 0.06, d: 950, bw: 150, A: 500e3, I: 145106e6, bS, Asl: 3450, fck: 35, fctk: 2.2, rule: 'lower' });
  book('11.12 k = 1.46', R0.k, 1.46, 0.002); ok('11.12 rho capped at 0.02', R0.rho === 0.02); book('11.12 sigma_cp 4.66 (= 0.133 fck)', R0.scp, 4.66, 0.002);
  book('11.12 (11.42) 522 kN', kN(R0.Vc2), 522, 0.003); book('11.12 alpha_cw 1.200', R0.acw, 1.2, 0.001); near('11.12 Vt = 155 kN', kN(R0.Vt), 155, 0.002);
  book('11.12 H10 at 300: VRd,s 484 kN', 0.523 * 0.78 * 950 * 500 * 2.5 / 1e3, 484, 0.002); book('11.12 Asl 1322 mm2', R0.dFtd / (0.87 * 500), 1322, 0.006);
  // EC2 6.2.2(2): the uncracked rule uses 6.4 where it applies
  const Ru = PSC.shearAt({ VEd: 600e3, P: 2590e3, slope: 0.06, d: 950, bw: 150, A: 500e3, I: 145106e6, bS, Asl: 3450, fck: 35, fctk: 2.2, rule: 'ec2', uncracked: true });
  near('6.4 used where uncracked', Ru.VRdc, R0.Vc2, 1e-12);
}
// ---------- EC2 Annex B and 3.1.2 against TCC42 (C40/50, cement R, RH 55 %, h0 800, 18 degC curing, transfer at 4 days, curing 3 days) ----------
{
  const c = PSC.concrete({ fck: 40, t0: 4, cement: 'R' });
  near('TCC42 fck(4) 26.538', c.T.fck, 26.53767470650118, 1e-9); near('TCC42 Ecm 35.220', c.Ecm, 35220.462288934414, 1e-9); near('TCC42 Ecm(4) 31.909', c.T.Ecm, 31908.810091216196, 1e-9);
  const cr = PSC.creepEC2({ fcm: 48, RH: 55, h0: 800, t0: 4, cement: 'R', T: 18 });
  near('TCC42 temperature-adjusted age 3.635', cr.tT, 3.6349301460781636, 1e-9); near('TCC42 adjusted t0 8.514', cr.t0a, 8.513749930759671, 1e-9);
  near('TCC42 phi_RH 1.3036 (TCC takes 1/3 as 0.3333333)', cr.phiRH, 1.3035877186916678, 1e-6); near('TCC42 beta_H 1280.9', cr.bH, 1280.8688457449498, 1e-9); near('TCC42 phi(inf, 4) 1.9337', cr.phi, 1.9337049890410525, 1e-6);
  near('TCC42 phi(inf, 30) 1.5076', PSC.creepEC2({ fcm: 48, RH: 55, h0: 800, t0: 30, cement: 'R', T: 18 }).phi, 1.5076036371201083, 1e-6);
  const sh = PSC.shrinkEC2({ fck: 40, fcm: 48, RH: 55, h0: 800, cement: 'R', ts: 3, t0: 4 });
  near('TCC42 kh eps_cd,0 399.0e-6', sh.ecdInf * 1e6, 399.0199225862643, 1e-9); near('TCC42 eps_ca 75e-6', sh.ecaInf * 1e6, 75, 1e-12);
  near('TCC42 eps_cd at transfer 0.440e-6', sh.ecdT0 * 1e6, 0.4403723481494612, 1e-9); near('TCC42 eps_ca at transfer 24.73e-6', sh.ecaT0 * 1e6, 24.72599654732705, 1e-9);
  near('TCC42 shrinkage after transfer 448.85e-6', sh.ecs * 1e6, 448.85355369078775, 1e-9);
  // relaxation 3.29 by hand, class 2 at 0.7 fpk, 500 000 h; class 1 and 3 coefficients
  near('relaxation class 2', PSC.relaxation({ cls: 2, rho1000: 2.5, mu: 0.7 }), 0.66 * 2.5 * Math.exp(9.1 * 0.7) * 500 ** (0.75 * 0.3) * 1e-5, 1e-12);
  near('relaxation class 1', PSC.relaxation({ cls: 1, rho1000: 8, mu: 0.7 }), 5.39 * 8 * Math.exp(6.7 * 0.7) * 500 ** (0.75 * 0.3) * 1e-5, 1e-12);
  near('relaxation class 3 at 1000 h', PSC.relaxation({ cls: 3, rho1000: 4, mu: 0.6, t: 1000 }), 1.98 * 4 * Math.exp(8 * 0.6) * 1e-5, 1e-12);
  // 5.46 by hand
  const l = PSC.loss546({ ecs: 300e-6, Ep: 195000, Ecm: 35000, phi: 2, dsr: 50, scQP: 8, Ap: 2000, Ac: 4e5, Ic: 6e10, zcp: 400 });
  near('5.46 by hand', l.ds, (300e-6 * 195000 + 0.8 * 50 + 195 / 35 * 2 * 8) / (1 + 195 / 35 * 2000 / 4e5 * (1 + 4e5 / 6e10 * 160000) * (1 + 1.6)), 1e-12);
  near('5.46 parts add up', l.parts.shrink + l.parts.relax + l.parts.creep, l.ds, 1e-12);
}

// ---------- sections ----------
{
  const I = PSC.section({ type: 'I', h: 1200, bt: 600, ht: 150, hth: 75, bw: 200, bb: 450, hb: 200, hbh: 100 });
  const C = PSC.section({ type: 'custom', layers: [{ h: 200, b0: 450, b1: 450 }, { h: 100, b0: 450, b1: 200 }, { h: 675, b0: 200, b1: 200 }, { h: 75, b0: 200, b1: 600 }, { h: 150, b0: 600, b1: 600 }] });
  near('I = the same stack of layers: A', C.A, I.A); near('I = layers: I', C.I, I.I); near('I = layers: yb', C.yb, I.yb);
  // by hand: rectangles and trapezoids (area, centroid from the soffit)
  const parts = [[450 * 200, 100], [(450 + 200) / 2 * 100, 200 + 100 * (450 + 2 * 200) / (3 * 650)], [200 * 675, 300 + 337.5], [(200 + 600) / 2 * 75, 975 + 75 * (200 + 1200) / (3 * 800)], [600 * 150, 1125]];
  const A = parts.reduce((t, p) => t + p[0], 0), yb = parts.reduce((t, p) => t + p[0] * p[1], 0) / A;
  near('I section A by hand', I.A, A); near('I section yb by hand', I.yb, yb);
  near('rectangle I', PSC.section({ type: 'rect', b: 300, h: 600 }).I, 300 * 600 ** 3 / 12);
  near('width in the web', PSC.width(I.L, 600), 200); near('width in a haunch', PSC.width(I.L, 250), 325); ok('b/S smallest at the centroid for a uniform web', Math.abs(I.zbS - I.yb) < 60);
  near('first moment above the centroid = below', PSC.S(I.L, I.yb, I.yb), -(PSC.slice(I.L, 0, I.yb).A * (PSC.slice(I.L, 0, I.yb).y - I.yb)), 1e-9);
  const D = PSC.section({ type: 'dt', B: 2400, hf: 75, h: 600, n: 2, bwt: 180, bwb: 120, sp: 1200 });
  near('double-tee area', D.A, 2400 * 75 + (240 + 360) / 2 * 525); near('double-tee bw = two webs at the bottom', D.bw, 240);
  near('double-tee perimeter', D.u, 2400 + 150 + (2400 - 360) + 2 * (120 + 2 * Math.hypot(525, 30)), 1e-12); near('notional size 2A/u', D.h0, 2 * D.A / D.u);
  near('rectangle perimeter', PSC.section({ type: 'rect', b: 300, h: 600 }).u, 1800);
  throws('web outside the flange', () => PSC.section({ type: 'dt', B: 1200, hf: 75, h: 600, n: 2, bwt: 180, bwb: 120, sp: 1200 }), /outside the flange/);
  throws('flanges leave no web', () => PSC.section({ type: 'I', h: 300, bt: 600, ht: 150, bw: 200, bb: 450, hb: 200 }), /no web/);
}

// ---------- the design run: pretensioned double-tee ----------
const DT = (over = {}) => ({ sec: { type: 'dt', B: 2400, hf: 75, h: 600, n: 2, bwt: 180, bwb: 120, sp: 1200 }, L: 12000, lb: 150,
  loads: { rho: 25, g2: 3.6, q: 6.0, psi0: 0.7, psi1: 0.5, psi2: 0.3 }, conc: { fck: 50, fckT: 32, t0: 1, cement: 'R', RH: 50, temp: 20 },
  pre: { kind: 'pre', fpk: 1860, Ep: 195000, sigJ: 0.72 * 1860, relClass: 2, rho1000: 2.5, wire: 'strand', release: 'gradual',
    strands: [{ n: 4, Ap: 100, phi: 12.9, z: 60 }, { n: 2, Ap: 100, phi: 12.9, z: 110 }, { n: 2, Ap: 100, phi: 12.9, z: 110, debond: 1500 }] },
  limits: { tT: { mode: 'fctm' }, tS: { mode: 'fctm' }, tComb: 'freq', exposure: 'XC1' }, uls: { rule: '6.10', links: { phi: 8, legs: 2, s: 200 } }, ...over });
{
  const R = PSC.design(DT());
  ok('double-tee passes', R.util <= 1, R.util); ok('no notes of failure', R.checks.every(k => k.util <= 1));
  // symmetry
  const at = x => R.st.reduce((b, s) => Math.abs(s.x - x) < Math.abs(b.x - x) ? s : b);
  [1000, 2500, 4000].forEach(x => { near(`symmetric P0 at ${x}`, at(x).P0, at(R.L - x).P0, 1e-9); near(`symmetric P at ${x}`, at(x).P, at(R.L - x).P, 1e-9); });
  // release by hand at mid-span: alpha_e transformed section, self-weight moment included
  const sp = R.sp, ae = 195000 / R.EcmT, L = [[400, 60], [200, 110], [200, 110]].map(([A, z]) => ({ A, e: sp.yb - z })), MT = R.gT * 12000 ** 2 / 8, sJ = 0.72 * 1860;
  let W0 = 0, W1 = 0, W2 = 0; L.forEach(l => { W0 += l.A; W1 += l.A * l.e; W2 += l.A * l.e * l.e; });
  const a11 = sp.A + ae * W0, a12 = ae * W1, a22 = sp.I + ae * W2, b1 = sJ * W0, b2 = sJ * W1 - MT, det = a11 * a22 - a12 * a12, ca = (b1 * a22 - a12 * b2) / det, cb = (a11 * b2 - a12 * b1) / det;
  const P0h = L.reduce((t, l) => t + l.A * (sJ - ae * (ca + cb * l.e)), 0);
  near('P0 at mid-span: transformed section by hand', R.mid.P0, P0h, 1e-9);
  // with no self-weight and one layer the release equals the book's formula (j = 1)
  const R1 = PSC.design(DT({ loads: { rho: 0, g2: 0, q: 0 }, pre: { ...DT().pre, strands: [{ n: 8, Ap: 100, phi: 12.9, z: 80 }] } }));
  near('release = Mosley P0/(1 + ae Ap/A (1 + e2 A / I))', R1.mid.P0, PSC.elasticBook({ P: 800 * sJ, Ap: 800, A: sp.A, I: sp.I, e: sp.yb - 80, ae, j: 1 }), 1e-9);
  // transmission length 8.10.2.2 by hand for the full-bond stress
  const l0 = R.layers[0], fbpt = 3.2 * 1 * 0.7 * R.c.T.fctm / 1.5; near('fbpt', l0.fbpt, fbpt, 1e-12); near('lpt = a1 a2 phi sigma_pm0 / fbpt', l0.lpt, 1 * 0.19 * 12.9 * l0.s0Full / fbpt, 1e-12);
  near('lpt1 = 0.8 lpt, lpt2 = 1.2 lpt', l0.lpt1 + l0.lpt2, 2 * l0.lpt, 1e-12);
  // within the debonded length the debonded layer carries nothing
  const xd = 1000 - 75, sd = at(xd); ok('debonded strands carry nothing at 1.0 m from the end', sd.ly[2].beta1 === 0 && sd.ly[1].beta1 === 1);
  // the force builds linearly over lpt1 from the end of the beam
  const xr = -75 + 0.5 * l0.lpt1, sr = at(xr); near('half way along lpt1 half the bond', sr.ly[0].beta1, 0.5, 0.02);
  // the stress checks match the fibre stresses at their station
  const rT = R.rows.find(r => r.x === R.checks.find(k => k.id === 'tc').x); near('transfer compression = fibre stress', R.checks.find(k => k.id === 'tc').util * R.fcT, Math.max(rT.T.top, rT.T.bot), 1e-12);
  // Magnel: this passing design lies in the feasible zone at mid-span
  ok('design point inside the Magnel region', R.magnel.atP && R.magnel.atP.elo <= R.cmid.e0 + 1e-6 && R.cmid.e0 <= R.magnel.atP.ehi + 1e-6);
  ok('cable zone holds the tendon along the span', R.zone.every(z => z.e >= z.lo - 1e-6 && z.e <= z.hi + 1e-6));
  // a heavier imposed load fails in service, and the Magnel diagram agrees
  const Rf = PSC.design(DT({ loads: { ...DT().loads, q: 30 } })), st = Rf.checks.find(k => k.id === 'st');
  ok('heavy load: service tension fails', st.util > 1, st.util); ok('and the design point leaves the Magnel region', !Rf.magnel.atP || Rf.magnel.atP.none || Rf.cmid.e0 < Rf.magnel.atP.elo - 1e-6 || Rf.cmid.e0 > Rf.magnel.atP.ehi + 1e-6);
  // ULS at mid-span equals the strain compatibility on the same tendons
  const m = R.cmid, tdn = m.ly.map((l, k) => ({ A: R.layers[k].A, d: 600 - R.layers[k].z, eps0: 0.9 * l.sInf / 195000 }));
  near('MRd at mid-span = ulsBending', R.ulsMid.MRd, PSC.ulsBending({ L: R.sp.L, h: 600, c: R.c, tendons: tdn, Ep: 195000, fpd: R.fpd }).MRd, 1e-9);
  // lateral stability by hand
  near('lateral stability', R.checks.find(k => k.id === 'lt').util, Math.max((12000 / 2400) / (50 / (600 / 2400) ** (1 / 3)), (600 / 2400) / 2.5), 1e-12);
  // the 0.7 fck(t) option raises the transfer limit
  const R7 = PSC.design(DT({ limits: { ...DT().limits, k6: 0.7 } })); near('k6 = 0.7', R7.fcT, 0.7 * 32, 1e-12);
  // given creep and shrinkage, separate sums: mid-span loss by hand for the bottom layer
  const Rg = PSC.design(DT({ conc: { ...DT().conc, creepMode: 'given', phi: 2, ecs: 300 }, lossMode: 'sum', pre: { ...DT().pre, relMode: 'factor', relFactor: 2 } }));
  const L0 = Rg.mid.ly[0];
  near('separate sums by hand', L0.tl.ds, 300e-6 * 195000 + 195000 * 2 * L0.scQP / (1.05 * Rg.Ecm) + 2 * 0.025 * L0.s0, 1e-12);
}
// ---------- the design run: post-tensioned I beam ----------
const PT = (over = {}) => ({ sec: { type: 'I', h: 1200, bt: 600, ht: 150, hth: 75, bw: 200, bb: 450, hb: 200, hbh: 100 }, L: 20000, lb: 300,
  loads: { rho: 25, g2: 10, q: 15, psi0: 0.7, psi1: 0.5, psi2: 0.3 }, conc: { fck: 40, t0: 7, cement: 'N', RH: 70, temp: 20 },
  pre: { kind: 'post', fpk: 1860, Ep: 195000, sigJ: 0.75 * 1860, relClass: 2, rho1000: 2.5, Ap: 2100, nT: 2, zEnd: 600, zMid: 130, mu: 0.19, k: 0.005, drawIn: 6, ends: 'both', esj: 'half', duct: { phi: 80, kind: 'steel', across: 1 } },
  limits: { tT: { mode: 'fctm' }, tS: { mode: 'fctm' }, tComb: 'freq', exposure: 'XC1' }, uls: { links: { phi: 10, legs: 2, s: 250 } },
  end: { on: true, na: 2, shape: 'square', a0: 250, b1: 450, h1: 450, B: 600, H: 1200, sigS: 300, phiZone: 12, phiAll: 16 }, ...over });
{
  const R = PSC.design(PT());
  ok('post-tensioned beam passes', R.util <= 1, R.util);
  // friction from one end, no draw-in: P at mid-span by hand
  const R1 = PSC.design(PT({ pre: { ...PT().pre, ends: 'one', drawIn: 0 } })), p = R1.post, s0 = 4 * (130 - 600) * (20000 + 300) / 20000 ** 2, sm = 0;
  const th = Math.abs(Math.atan(s0) - Math.atan(sm)), Pm = p.Pj * Math.exp(-0.19 * (th + 0.005e-3 * 10150));
  near('friction at mid-span by hand', R1.mid.Pf, Pm, 1e-9); near('no draw-in: lock-off = friction', R1.mid.Pl, Pm, 1e-12);
  // straight tendon with wobble only: draw-in length from the area condition solved independently
  const Rs = PSC.design(PT({ pre: { ...PT().pre, zEnd: 300, zMid: 300, ends: 'one', mu: 0.2, k: 0.03, drawIn: 6 } })), ps = Rs.post, a = 0.2 * 0.03e-3, W = 6 * 195000 * 2100;
  const area = l => 2 * ps.Pj * ((1 - Math.exp(-a * l)) / a - l * Math.exp(-a * l));
  let lo = 0, hi = 20300; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (area(m) < W) lo = m; else hi = m; }
  ok('draw-in stops short of the far end', ps.delta === 0 && ps.lset < 20300);
  near('draw-in length (exponential friction)', ps.lset, (lo + hi) / 2, 2e-4); near('force at the anchor after lock-off', ps.Panchor, 2 * ps.Pj * Math.exp(-a * ps.lset) - ps.Pj, 2e-4);
  // elastic shortening averaged along the tendon: the closed form for a straight tendon with no friction
  const Re = PSC.design(PT({ pre: { ...PT().pre, zEnd: 300, zMid: 300, mu: 0, k: 0, drawIn: 0 } })), sp = Re.sp, ae = 195000 / Re.EcmT, e = sp.yb - 300, Pj = 0.75 * 1860 * 2100;
  near('post-tensioned elastic shortening = Mosley with j = 0.5', Re.mid.P0, PSC.elasticBook({ P: Pj, Ap: 2100, A: sp.A, I: sp.I, e, ae, j: 0.5 }), 1e-9);
  const Rn = PSC.design(PT({ pre: { ...PT().pre, zEnd: 300, zMid: 300, mu: 0, k: 0, drawIn: 0, esj: 'seq', nT: 4 } }));
  near('j = (n - 1)/2n', Rn.mid.P0, PSC.elasticBook({ P: Pj, Ap: 2100, A: sp.A, I: sp.I, e, ae, j: 3 / 8 }), 1e-9);
  // inclined tendon: Vt at the support = P sin(slope)
  const q0 = R.shearSt[0]; near('Vt from the tendon slope', q0.R.Vt, R.st.find(s => s.x === q0.x).P * Math.sin(Math.atan(Math.abs(R.post.slope(q0.x)))), 1e-9);
  // web net of ducts for V_Rd,max (80 > 200/8): bw - 0.5 phi
  near('web net of a grouted duct', R.ductRed, 40, 1e-12);
  const Rp = PSC.design(PT({ pre: { ...PT().pre, duct: { phi: 80, kind: 'plastic', across: 1 } } })); near('plastic duct: 1.2 phi', Rp.ductRed, 96, 1e-12);
  // the end block uses f_ck(t) and the jacking force per tendon
  near('end block force per anchor', R.eb.P, R.post.Pj / 2, 1e-12); near('end block fRdu on fck(t)', R.eb.fRdu, Math.min(R.c.T.fck / 1.5 * Math.sqrt(450 * 450 / (250 * 250)), 3 * R.c.T.fck / 1.5), 1e-12);
  // decompression check appears for XC2-XC4 and XD/XS
  ok('XC1: no decompression check', !R.checks.some(k => k.id === 'dec'));
  const Rx = PSC.design(PT({ limits: { ...PT().limits, exposure: 'XC2' } })); ok('XC2: decompression under the quasi-permanent combination', /quasi-permanent/.test(Rx.checks.find(k => k.id === 'dec').name));
  const Rd = PSC.design(PT({ limits: { ...PT().limits, exposure: 'XD' } })); ok('XD: decompression under the frequent combination', /frequent/.test(Rd.checks.find(k => k.id === 'dec').name));
  // shear: with no prestress the 6.2a resistance equals the EC2 core
  const c = EC2.concrete(40), sa = PSC.shearAt({ VEd: 100e3, P: 0, d: 900, bw: 200, A: 3e5, I: 5e10, bS: 1e-6, Asl: 1500, fck: 40 }), sc = EC2.shearConcrete({ bw: 200, d: 900, Asl: 1500, c });
  near('6.2a = EC2 core without prestress', sa.Vc1, sc.VRdc, 1e-12); near('VRd,max(45) = EC2 core', sa.Vmax45, EC2.vrdMax(200, 810, c, 1, 0), 1e-12);
  // ULS with bars only = the EC2 core's strain compatibility
  const sp2 = PSC.section({ type: 'rect', b: 300, h: 600 }), ub = PSC.ulsBending({ L: sp2.L, h: 600, c, tendons: [], bars: [{ As: 1473, d: 540, fyk: 500 }, { As: 402, d: 50, fyk: 500 }], Ep: 195000, fpd: 1400 });
  const cb = EC2.bendingResistance({ sec: { b: 300, h: 600 }, layers: [{ As: 1473, d: 540 }, { As: 402, d: 50 }], c, s: EC2.steel(500) });
  near('ULS bars only = EC2 core x', ub.x, cb.x, 1e-6); near('ULS bars only = EC2 core MRd', ub.MRd, cb.MRd, 1e-6);
  // 6.10a/b envelope
  const Rab = PSC.design(PT({ uls: { ...PT().uls, rule: '6.10ab' } })), g = Rab.gG, q = Rab.q;
  near('6.10a/b MEd at mid-span', Rab.MEd(10000), Math.max(1.35 * g + 1.5 * 0.7 * q, 0.925 * 1.35 * g + 1.5 * q) * 20000 ** 2 / 8, 1e-12);
}
// ---------- input errors ----------
throws('no span', () => PSC.design(DT({ L: 0 })), /span/);
throws('bearing longer than the span', () => PSC.design(DT({ L: 100, lb: 200 })), /bearing/);
throws('strand layer outside', () => PSC.design(DT({ pre: { ...DT().pre, strands: [{ n: 2, Ap: 100, z: 700 }] } })), /outside/);
throws('debonded over the whole length', () => PSC.design(DT({ pre: { ...DT().pre, strands: [{ n: 2, Ap: 100, z: 60, debond: 7000 }] } })), /whole length/);
throws('tendon rising at mid-span', () => PSC.design(PT({ pre: { ...PT().pre, zMid: 700 } })), /sag/);
throws('tendon outside the section', () => PSC.design(PT({ pre: { ...PT().pre, zEnd: 1300 } })), /outside/);
throws('transfer strength above fck', () => PSC.design(DT({ conc: { ...DT().conc, fckT: 60 } })), /exceeds/);
throws('no initial stress', () => PSC.design(DT({ pre: { ...DT().pre, sigJ: 0 } })), /initial/);
throws('point load outside the span', () => PSC.design(DT({ loads: { ...DT().loads, points: [{ a: 13000, G: 10, Q: 0 }] } })), /outside the span/);
throws('given creep missing', () => PSC.design(DT({ conc: { ...DT().conc, creepMode: 'given', phi: null } })), /creep/);

console.log(`${n - fails} / ${n} checks passed`);
if (fails) process.exit(1);
