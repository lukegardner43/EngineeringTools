// Flitch Beams against hand calculation by the method of TRADA GD9 (2008), which has no worked example: each quantity
// is worked here independently of the engine (load sharing, creep, the bolt by EC5 8.11, the plate bearing, splitting,
// the deflections) and checked against GD9's own figures where it gives them (the hole factors).
const { FlitchBeam: F } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol = 1e-6) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };
const ck = (D, id) => D.checks.find(c => c.id === id), comb = (D, nm) => D.combos.find(x => x.c.name === nm);

// ---------- GD9's hole factors (its own example: an 11 mm hole 55 mm off the centre of 220 mm timber and a 195 mm plate) ----------
near('GD9 (10): one hole raises the plate stress by 10 %', F.holeOne(195, 11, 55), 1.10, 0.005);
near('GD9 (10): … the timber by 7 %', F.holeOne(220, 11, 55), 1.07, 0.005);
near('GD9 (11): two holes, the plate 12 %', F.holeTwo(195, 11, 55), 1.12, 0.005);
near('GD9 (11): … the timber 8 %', F.holeTwo(220, 11, 55), 1.08, 0.005);
near('no hole: factor 1', F.holeOne(200, 0, 0), 1, 1e-12);

// ---------- a beam by hand: 2 × 75 × 225 C24, a 12 × 200 S275 plate, clear span 4.5 m on 100 mm bearings, M12 4.6 ----------
const base = { mat: { family: 'solid', cls: 'C24' }, sc: 1, b: 75, h: 225, tp: 12, hp: 200, grade: 'S275', clear: 4500, lb: 100, sw: false, cat: 'A',
  loads: [{ case: 'G', form: 'line', w: 1.5 }, { case: 'Q', form: 'line', w: 3.6 }], restraint: { mode: 'top' }, bolt: { d: 12, grade: '4.6', s: 450, nEnd: 2 }, defl: { inst: 300, ceiling: true } };
const D = F.design(base), C = comb(D, '1.35G + 1.5Q');
const L = 4600, It = 2 * 75 * 225 ** 3 / 12, Is = 12 * 200 ** 3 / 12, EIt = 11000 * It, EIs = 210000 * Is;
near('I_t of two stringers', D.It, It); near('I_s of the plate', D.Is, Is);
const kt = EIt / (EIt + EIs);
near('k_t = E_0,mean I_t/(E_0,mean I_t + E_s I_s) (GD9 5)', D.kt, kt); near('… 0.4825', kt, 0.48249, 1e-4);
truth('the steel 52 % of the stiffness: timber strengths × 1.04', D.enh === 1.04 && Math.abs(D.share - 0.5175) < 1e-3);
const w = 1.35 * 1.5 + 1.5 * 3.6, M = w * L * L / 8, V = w * L / 2;
near('M_d = 7.425 kN/m × 4.6²/8', C.Mm, M); near('V_d', C.Vm, V); near('R_d', C.Rm, V);
// creep: E_0,fin by GD9 (4), Q leading (ψ₂ 0.3, k_def 0.6); full-length loads so u_Q/u_G = 3.6/1.5
const E0fin = 7400 * 5.1 / (5.1 + 0.6 * (1.5 + 0.3 * 3.6));
near('E_0,fin = E_0,05 (u_G + u_Q)/(u_G + u_Q + k_def(u_G + ψ₂u_Q)) (GD9 4)', C.ef.E, E0fin, 1e-9); near('… 5677 N/mm²', E0fin, 5676.89, 1e-5);
const ks = 1.1 * EIs / (E0fin * It + EIs);
near('k_s = 1.1 E_s I_s/(E_0,fin I_t + E_s I_s) (GD9 6)', C.ks, ks, 1e-9); near('… 0.7427', ks, 0.742678, 1e-5);
const C0 = comb(D, '1.35G');
near('1.35G alone: E_0,fin = E_0,05/(1 + k_def)', C0.ef.E, 7400 / 1.6, 1e-9); truth('… a larger steel share', C0.ks > C.ks);
// timber bending with the hole factor
const fT = F.holeOne(225, 13, 56.25), fmd = 1.04 * 0.8 * 24 / 1.3;
near('timber σ_m,d = k_t M/W_t × the hole factor', C.sigT, kt * M / (2 * 75 * 225 * 225 / 6) * fT, 1e-9);
near('timber f_m,d = 1.04 k_mod f_m,k/γ_M = 15.36', C.fmd, fmd, 1e-9); near('timber bending utilisation', ck(D, 'tbend').util, C.sigT / fmd, 1e-9);
// timber shear on the depth less two holes
near('timber τ = 1.5 k_t V/(k_cr 2b (h − 2d₀))', C.tau, 1.5 * kt * V / (0.67 * 150 * (225 - 26)), 1e-9);
near('timber f_v,d = 1.04 × 0.8 × 4.0/1.3', C.fvd, 1.04 * 0.8 * 4 / 1.3, 1e-9);
// bearing on the stringers (A1: l_ef 100 + 30, k_c,90 1.5)
near('bearing σ = R/(2b l_ef) against 1.5 f_c,90,d', ck(D, 'bearing').util, V / (150 * 130) / (1.5 * 0.8 * 2.5 / 1.3), 1e-9);
// the plate
const fS = F.holeOne(200, 13, 56.25);
near('plate σ = k_s M/W_el × the hole factor', C.sigS, ks * M / (12 * 200 * 200 / 6) * fS, 1e-9);
near('plate f_y 275 (t ≤ 16 mm)', D.fy, 275); near('plate bending utilisation', ck(D, 'sbend').util, C.sigS / 275, 1e-9);
near('plate shear on h_p − 2d₀', C.VRd, 12 * (200 - 26) * 275 / Math.sqrt(3), 1e-9);
// the bolt: EC5 8.11 with the load perpendicular to the grain, the rope effect from 3d washers
const fh0 = 0.082 * (1 - 0.01 * 12) * 350, k90 = 1.35 + 0.015 * 12, fh = fh0 / k90, My = 0.3 * 400 * 12 ** 2.6, Fax = 3 * 2.5 * Math.PI / 4 * (36 * 36 - 13 * 13);
const J = fh * 75 * 12, g = J * (Math.sqrt(2 + 4 * My / (fh * 12 * 75 * 75)) - 1), hh = 2.3 * Math.sqrt(My * fh * 12), rope = j => j + Math.min(Fax / 4, 0.25 * j);
const Fv = Math.min(J, rope(g), rope(hh));
near('f_h,90,k = f_h,0,k/k_90 (8.31, 8.32)', D.fh.v, fh, 1e-9); near('M_y,Rk = 0.3 f_u d^2.6 (8.30)', D.My, My, 1e-9); near('F_ax,Rk of a 3d washer at 3 f_c,90,k', D.Fax, Fax, 1e-9);
near('F_v,Rk per shear plane (8.11, mode g)', D.J.F, Fv, 1e-9); truth('… mode g governs', D.J.mode === 'g');
near('R_k = 2 F_v,Rk = 18.43 kN per bolt', D.Rk, 2 * Fv, 1e-9); near('… by hand', 2 * Fv / 1000, 18.43, 1e-3);
const Rd = 0.8 * 2 * Fv / 1.3;
near('bolts along: F = k_s w_d s (GD9 8)', C.Fb, ks * w * 450, 1e-9); near('… against k_mod R_k/γ_M', ck(D, 'boltU').util, ks * w * 450 / Rd, 1e-9);
near('bolts at the supports: k_s R over 2 bolts', ck(D, 'boltE').util, ks * V / 2 / Rd, 1e-9);
// plate bearing (EN 1993-1-8 Table 3.4): along the beam e₁ = h_p/2 − h/4, α_b = min(e₁/3d₀, f_ub/f_u, 1)
near('plate bearing at the bolts along the beam', D.FbU, 2.5 * Math.min(43.75 / 39, 400 / 410, 1) * 410 * 12 * 12 / 1.25, 1e-9);
// splitting (8.4) at the upper staggered bolt, h_e = h/4 from the top
near('splitting: F/2 on a stringer against k_mod 14b √(h_e/(1 − h_e/h))/γ_M', ck(D, 'splitU').util, ks * w * 450 / 2 / (0.8 * 14 * 75 * Math.sqrt(56.25 / 0.75) / 1.3), 1e-9);
// the support column: e = max(1.2d₀, 4d − (h − h_p)/2) = 36 mm, pitch 200 − 72 = 128 mm
near('support bolts: the pitch in the column', D.pv, 200 - 2 * Math.max(1.2 * 13, 48 - 12.5), 1e-9);
// deflections (GD9: bending on E I_t + E_s I_s, shear of the timber under its share)
const ws = 5.1, b0 = 5 * ws * L ** 4 / (384 * (EIt + EIs)), s0 = kt * ws * L * L / (8 * 5 / 6 * 690 * 33750);
near('w_inst = 5wL⁴/384(EI_t + EI_s) + k_t wL²/(8κG A_t), G + Q (integrated over 400 steps)', D.D.inst, b0 + s0, 1e-4); near('… 9.49 mm', b0 + s0, 9.4947, 1e-4);
const Ef = 11000 * 5.1 / (5.1 + 0.6 * (1.5 + 0.3 * 3.6)), ktf = Ef * It / (Ef * It + EIs);
const bf = 5 * ws * L ** 4 / (384 * (Ef * It + EIs)), sf = ktf * ws * L * L / (8 * 5 / 6 * 690 * Ef / 11000 * 33750);
near('E_0,mean,fin by GD9 (4)', D.D.Efin, Ef, 1e-9);
near('w_net,fin with E_0,mean,fin (bending and shear)', D.D.fin, bf + sf, 1e-4); near('… 10.70 mm', bf + sf, 10.6964, 1e-4);
near('w_inst limit L/300', ck(D, 'winst').util, (b0 + s0) / (L / 300), 1e-4);
// spacings
near('s ≤ min(2.5h, 600) = 562.5', ck(D, 'sMax').util, 450 / 562.5, 1e-12); near('s ≥ 7d', ck(D, 'sMin').util, 84 / 450, 1e-12);
near('h/4 ≥ 4d', ck(D, 'eT').util, 48 / 56.25, 1e-12); near('h_p/2 − h/4 ≥ 1.2d₀', ck(D, 'eS').util, 15.6 / 43.75, 1e-12);
truth('passes', D.utilMax < 1 && !D.warnings.length);

// ---------- point loads: the bolts under each, each action with its own k_mod (GD9) ----------
{ const P = F.design({ ...base, loads: [...base.loads, { case: 'G', form: 'point', w: 6, a: 1.2 }, { case: 'Q', form: 'point', w: 10, a: 1.2 }, { case: 'Q', form: 'point', w: 10, a: 0.1 }] });
  const p = P.ptBolts.find(q => Math.abs(q.x - 1200) < 1), cP = comb(P, '1.35G + 1.5Q');
  const nG = cP.ks * 1.35 * 6000 / (0.6 * P.Rk / 1.3), nQ = cP.ks * 1.5 * 10000 / (0.8 * P.Rk / 1.3);
  near('point loads at 1.2 m: k_s γP/R_d, G at k_mod 0.6 plus Q at 0.8', p.nExact, nG + nQ, 1e-9); truth('… rounded up', p.n === Math.ceil(nG + nQ));
  truth('within h/2 of a support: no bolts', P.ptBolts.find(q => Math.abs(q.x - 100) < 1).n === 0); }

// ---------- a shallower plate warning; LTB held at the supports; uplift; area loads; self-weight ----------
{ const W = F.design({ ...base, hp: 220 }); truth('a plate within 10 mm of the timber depth: warned (GD9 25 mm)', W.warnings.some(x => /25 mm/.test(x))); }
{ const E = F.design({ ...base, restraint: { mode: 'ends' } }), lef = 0.9 * 4600 + 2 * 225, scr = 0.78 * 75 * 75 * 7400 / (225 * lef);
  near('each stringer held at the supports: σ_m,crit = 0.78 b² E_0,05/(h l_ef), l_ef = 0.9L + 2h', E.ltb.sag.scrit, scr, 1e-9);
  near('… k_crit on the timber bending', ck(E, 'tbend').util, comb(E, '1.35G + 1.5Q').sigT / (E.ltb.sag.k * fmd), 1e-9); }
{ const A = F.design({ ...base, spacing: 2400, loads: [{ case: 'G', form: 'area', w: 0.625 }, { case: 'Q', form: 'area', w: 1.5 }] });
  near('area loads × the loaded width 2.4 m: as the line loads', comb(A, '1.35G + 1.5Q').Mm, M, 1e-9); }
{ const S = F.design({ ...base, sw: true }), sw = (420 * 2 * 75 * 225 + 7850 * 12 * 200) * 9.81e-9;
  near('self-weight of the stringers and plate', comb(S, '1.35G').Rm, 1.35 * (1.5 + sw) * 2300, 1e-9); }
{ const U = F.design({ ...base, loads: [{ case: 'G', form: 'line', w: 1.5 }, { case: 'W', form: 'line', w: 3, up: true }] });
  truth('wind uplift: reaction warned, the uplift combination checked', U.warnings.some(x => /uplift/i.test(x)) && U.combos.some(x => x.Mhog > 0)); }
{ const B = F.design({ ...base, bolt: { d: 16, grade: '4.6', s: 450, nEnd: 2 } }); truth('M16 in 225 mm timber: h/4 under 4d, fails the edge rule', ck(B, 'eT').util > 1); }
{ const B = F.design({ ...base, bolt: { d: 12, grade: '4.6', s: 450, nEnd: 6 } }); truth('six support bolts: two columns', B.cols === 2 && B.nPer === 3); }
// errors
throws('a plate deeper than the timber', () => F.design({ ...base, hp: 240 }), /deeper/);
throws('no bolts at the supports', () => F.design({ ...base, bolt: { d: 12, grade: '4.6', s: 450, nEnd: 0 } }), /bolts at each support/);
throws('area loads without the width', () => F.design({ ...base, loads: [{ case: 'G', form: 'area', w: 1 }] }), /loaded width/);
throws('an LVL product without ρ_k', () => F.design({ ...base, mat: { family: 'other', props: { name: 'LVL', fmk: 44, fvk: 4.1, fc90k: 6, E0mean: 13800, E005: 11600, Gmean: 600, G005: 400, rhomean: 510 } } }), /ρ_k/);
console.log(`\n${n - fails}/${n} flitch beam checks passed`);
process.exit(fails ? 1 : 0);
