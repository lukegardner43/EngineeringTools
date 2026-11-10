// Retaining Wall engine checks: The Concrete Centre TCC62 (40 cantilever walls, outputs only) and hand checks of the earth
// pressures, the DA1 and EQU combinations, sliding, bearing, the stem (cantilever and propped), the toe and heel, and the
// plain-concrete checks of gravity walls.   node tests/retaining-wall/test_retaining_wall.js
const { RetWall: P } = require('./load.js');
const REF = require('./ref_tcc62.json');
let n = 0, fails = 0;
const ok = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } };
const near = (name, a, b, tol = 1e-9) => ok(name, Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `got ${a}, want ${b}`);
const throws = (name, f, re) => { let e = null; try { f(); } catch (x) { e = x; } ok(name, !!e && (!re || re.test(e.message)), e ? e.message : 'no error'); };
const chk = (R, id) => R.checks.find(c => c.id === id);
const rad = d => d * Math.PI / 180;

// ---------- TCC62 ----------
// TCC62 differences, set aside here:
//  - with a slope it keeps the thrust inclined at β (or an interpolated angle) on a heel too short for the Rankine zone;
//    this tool then drops the vertical part of the thrust. Those quantities are compared only where the heel is long enough.
//  - it designs the stem for the height of the virtual back (the slope's rise over the heel included); this tool takes the
//    stem's own height. Stem actions are compared for level ground.
//  - drained bearing: it takes N_q and N_γ from the retained soil's φ′ (compared where the two soils match), the
//    overburden as γ_k h_g + 25 t_b (this tool: the foundation soil over the base, less Δa) and always a submerged γ.
//  - in combination 1 it factors the weights by 1.35 or 1.0 together with the thrust (the single-source principle); this
//    tool keeps the weights at 1.0 for sliding (the more onerous). Compared here are the parts: thrusts, weights and
//    resistances, and the bearing chain, whose combination 1 (thrust and weights at 1.35) is the same in both.
//  - it takes the surcharge's thrust at h/3 for overturning, and puts no soil over the toe into the weights; no surcharge
//    and no soil over the toe are compared.
REF.cases.forEach((c, i) => {
  const o = c.out, tag = `TCC62 case ${i + 1}`;
  const R = P.design({ type: 'cantilever', H: c.hb, tb: c.tb, B: c.B, bt: c.bt, ts: c.ts, hg: 0, beta: c.beta, g: c.g, phi: c.phi, gf: c.gf, phif: c.phif, gw: 9.814, fWater: true, fck: c.fck,
    phiS: 16, sS: 150, phiT: 12, sT: 200, phiH: 16, sH: 200 });
  near(`${tag}: virtual back height`, R.yV, o.DAT_N21); near(`${tag}: weights`, R.sumW, o.GEO_F13);
  near(`${tag}: drained sliding resistance, DA1-1`, R.geo.s1.Rs, o.GEO_F14); near(`${tag}: …DA1-2`, R.geo.s2.Rs, o.GEO_G14);
  const fits = o.DAT_E53 >= 1 && o.DAT_G53 >= 1;
  if (c.beta === 0 || fits) {
    near(`${tag}: K_a, φ′k`, R.R.SLS.back.K, o.DAT_E55); near(`${tag}: K_a, φ′d`, R.R.C2b.back.K, o.DAT_G55);
    near(`${tag}: thrust, characteristic`, R.R.SLS.Hgross, o.GEO_F10); near(`${tag}: thrust ×1.35`, R.R.C1a.Hgross, o.GEO_E10); near(`${tag}: thrust DA1-2`, R.R.C2b.Hgross, o.GEO_G10);
    near(`${tag}: overturning moment`, R.R.C1a.Mdst, o.GEO_E20); near(`${tag}: restoring moment, ×1.35`, R.R.C1a.Mstb, o.GEO_E25); near(`${tag}: restoring moment, DA1-2`, R.R.C2b.Mstb, o.GEO_G25);
    near(`${tag}: V with the thrust's vertical part`, R.R.C1a.V, o.GEO_E31); near(`${tag}: resultant from the toe`, R.R.C1a.xR * 1000, o.GEO_E32);
    near(`${tag}: B′, DA1-1`, R.geo.C1a.Bp, o.GEO_E34); near(`${tag}: q_Ed, DA1-1`, R.geo.C1a.q, o.GEO_E35); near(`${tag}: B′, DA1-2`, R.geo.C2b.Bp, o.GEO_G34); near(`${tag}: q_Ed, DA1-2`, R.geo.C2b.q, o.GEO_G35);
    near(`${tag}: i_q, DA1-1`, R.geo.C1a.R.iq, o.GEO_E40); near(`${tag}: i_q, DA1-2`, R.geo.C2b.R.iq, o.GEO_G40);
    if (c.phi === c.phif) {
      const b1 = R.geo.C1a.R, b2 = R.geo.C2b.R, q0 = o.DAT_H30;
      near(`${tag}: N_q`, b1.Nq, o.GEO_E39); near(`${tag}: N_γ`, b1.Ng, o.GEO_E38);
      near(`${tag}: q′_Rd, DA1-1 (TCC62's overburden)`, b1.q + (q0 - b1.q0) * b1.Nq * b1.iq, o.GEO_E41); near(`${tag}: q′_Rd, DA1-2`, b2.q + (q0 - b2.q0) * b2.Nq * b2.iq, o.GEO_G41);
    }
  }
  if (c.beta === 0) { near(`${tag}: stem V, DA1-1`, R.stem.C1.Vbase, o.RCd_E11, 1e-6); near(`${tag}: stem M, DA1-1`, R.stem.C1.Mbase, o.RCd_E12, 1e-6);
    near(`${tag}: stem V, DA1-2`, R.stem.C2.Vbase, o.RCd_G11, 1e-6); near(`${tag}: stem M, DA1-2`, R.stem.C2.Mbase, o.RCd_G12, 1e-6); }
});

// ---------- hand checks ----------
const D = { type: 'cantilever', H: 3000, tb: 300, B: 2500, bt: 600, ts: 300, hg: 0, g: 18, gsat: 20, phi: 30, gf: 19, phif: 32, fck: 32, phiS: 16, sS: 150, phiSF: 12, sSF: 200, phiT: 12, sT: 200, phiH: 16, sH: 200, dA: 0 };
const run = o => P.design({ ...D, ...o });
{ // coefficients
  near('Rankine K_a, level: (1 − sinφ)/(1 + sinφ)', P.Ka(rad(30), 0), 1 / 3, 1e-12);
  const b = rad(20), f = rad(30), cb = Math.cos(b), r = Math.sqrt(cb * cb - Math.cos(f) ** 2);
  near('Rankine K_a, slope β', P.Ka(f, b), cb * (cb - r) / (cb + r), 1e-12);
  near('K_0 = (1 − sinφ)(1 + sinβ)', P.K0(f, b), (1 - 0.5) * (1 + Math.sin(b)), 1e-12); near('K_p = (1 + sinφ)/(1 − sinφ)', P.Kp(f), 3, 1e-12);
}
{ // thrust, weights, sliding, EQU, bearing on a level, dry, surcharged wall
  const R = run({ qQ: 10, qG: 5 });
  const h = 3.0, Ka = 1 / 3, s = R.R.SLS.back;
  near('soil thrust K γ h²/2', s.soil.F, Ka * 18 * h * h / 2); near('…at h/3', s.soil.M, Ka * 18 * h * h / 2 * h / 3);
  near('surcharge thrust K q h', s.qQ.F, Ka * 10 * h); near('…at h/2', s.qQ.M, Ka * 10 * h * h / 2);
  near('weights: stem + base + heel soil', R.sumW, 25 * 0.3 * 2.7 + 25 * 2.5 * 0.3 + 18 * 1.6 * 2.7);
  near('DA1-1 sliding: H = 1.35(soil + q_G) + 1.5q_Q', R.R.C1s.H, 1.35 * (Ka * 18 * 4.5 + Ka * 5 * 3) + 1.5 * Ka * 10 * 3, 1e-12);
  near('DA1-1 sliding: R = (weights + q_G on the heel, both at 1.0) tan φ′_f', R.geo.s1.Rs, (R.sumW + 5 * 1.6) * Math.tan(rad(32)), 1e-12);
  const phid = Math.atan(Math.tan(rad(30)) / 1.25), Kd = P.Ka(phid, 0);
  near('DA1-2: K at tan φ′/1.25', R.R.C2s.back.K, Kd, 1e-12);
  near('DA1-2 sliding: tan δ_d = tan φ′_f/1.25', R.geo.s2.Rs, (R.sumW + 5 * 1.6) * Math.tan(rad(32)) / 1.25, 1e-12);
  const E = R.R.EQU; near('EQU: 1.1 × thrust moment (φ/1.25) + 1.5 q_Q', E.Mdst, 1.1 * (Kd * 18 * 27 / 6 + Kd * 5 * 4.5) + 1.5 * Kd * 10 * 4.5, 1e-12);
  near('EQU: 0.9 × the weights (q_G on the heel too) about the toe', E.Mstb, 0.9 * R.momW + 0.9 * 5 * 1.6 * (0.9 + 0.8), 1e-12);
  // bearing, DA1-2, drained, Annex D strip with inclination
  const c = R.R.C2b, g = R.geo.C2b, e = 1.25 - c.xR, Bp = 2.5 - 2 * Math.abs(e);
  near('B′ = B − 2e', g.Bp, Bp, 1e-12); near('q_Ed = V/B′', g.q, c.V / Bp, 1e-12);
  const pf = Math.atan(Math.tan(rad(32)) / 1.25), t = Math.tan(pf), Nq = Math.exp(Math.PI * t) * Math.tan(Math.PI / 4 + pf / 2) ** 2, Ng = 2 * (Nq - 1) * t, rr = 1 - c.H / c.V;
  near('q_Rd = q′N_q i_q + ½γB′N_γ i_γ, m = 2', g.R.q, 19 * 0.3 * Nq * rr ** 2 + 0.5 * 19 * Bp * Ng * rr ** 3, 1e-12);
  const U = run({ bearing: 'undrained', cuf: 50 }), gu = U.geo.C2b, cud = 50 / 1.4;
  near('undrained: (π + 2)c_u,d i_c + q, i_c = ½(1 + √(1 − H/B′c_u,d))', gu.R.q, (Math.PI + 2) * cud * 0.5 * (1 + Math.sqrt(1 - U.R.C2b.H / (gu.Bp * cud))) + 19 * 0.3, 1e-12);
}
{ // water and passive
  const R = run({ hw: 1500, hwf: 500 }), s = R.R.SLS;
  near('water thrust γ_w h_w²/2 behind', s.back.water.F, 9.81 * 1.5 ** 2 / 2, 1e-12);
  near('uplift: trapezoid from h_wf to h_w across the base', R.U.F, 9.81 * (0.5 + 1.5) / 2 * 2.5, 1e-12);
  near('soil below the water: γ_sat − γ_w', s.back.soil.F, (1 / 3) * (18 * 1.5 * 1.5 / 2 + 18 * 1.5 * 1.5 + (20 - 9.81) * 1.5 * 1.5 / 2), 1e-12);
  const Pp = run({ passive: true, hg: 500, dA: 300 });
  near('passive: K_p γ (h_g + t_b − Δa)²/2 in front', Pp.geo.s1.Pp, P.Kp(rad(32)) * 19 * 0.5 ** 2 / 2, 1e-6);
}
{ // stem: cantilever and propped (exact forms)
  const R = run({ qQ: 10 });
  const w = 1.35 * (1 / 3) * 18 * 2.7, q = 1.5 * (1 / 3) * 10;
  near('stem V = w h/2 + q h', R.stem.C1.Vbase, w * 2.7 / 2 + q * 2.7, 1e-9); near('stem M = w h²/6 + q h²/2', R.stem.C1.Mbase, w * 2.7 ** 2 / 6 + q * 2.7 ** 2 / 2, 1e-9);
  const Pr = run({ type: 'propped', K: 'rest', qQ: 10 }), K0 = 0.5, wt = 1.35 * K0 * 18 * 2.7, qu = 1.5 * K0 * 10, L = 2.7;
  near('propped at the top: R = wL/10 + 3qL/8', Pr.stem.C1.Rp, wt * L / 10 + 3 * qu * L / 8, 1e-6);
  near('…base M = wL²/15 + qL²/8', Pr.stem.C1.Mbase, wt * L * L / 15 + qu * L * L / 8, 1e-6);
  ok('propped: no EQU; the prop reported', !chk(Pr, 'equ') && chk(Pr, 'prop').req);
  const Ph = run({ type: 'propped', K: 'rest', baseHeld: true }); ok('a base held by a slab: no sliding check', !chk(Ph, 'slide1') && !chk(Ph, 'slide2'));
  const m = R.members.stem; near('stem d = t − c − φ/2', m.d, 300 - 40 - 8); near('stem bending utilisation A_s,req/A_s,prov', chk(R, 'stemM').util, m.Bd.As / (Math.PI * 64 * 1000 / 150), 1e-12);
}
{ // toe and heel from the uniform pressure on B′
  const R = run({}), a = R.members.acts.find(x => x.k === 'C2b'), c = R.R.C2b, g = R.geo.C2b;
  near('toe M = q b_t²/2 − toe weight', a.Mtoe, g.q * 0.6 * 0.6 / 2 - 25 * 0.3 * 0.6 * 0.3, 1e-9);
  const up = g.Bp > 0.9 ? g.q * (g.Bp - 0.9) : 0, upM = up * (g.Bp - 0.9) / 2;
  near('heel M = soil and base on the heel − upward pressure within B′', a.Mheel, 18 * 2.7 * 1.6 * 0.8 + 25 * 0.3 * 1.6 * 0.8 - upM, 1e-9);
}
{ // gravity wall: 12.6.1 and 12.6.3 at the foot
  const R = run({ type: 'gravity', ts: 1600, tTop: 500, B: 2200, bt: 300, fck: 20, gc: 24 });
  const s = R.gravity.secs.find(x => x.k === 'C1b' && Math.abs(x.y - 0.3) < 1e-9);
  near('N = the wall above (trapezoid)', s.N, 24 * (1.6 + 0.5) / 2 * 2.7, 1e-9);
  near('N_Rd = 0.6f_ck/1.5 b h_w (1 − 2e/h_w)', s.NRd, 0.6 * 20 / 1.5 * 1000 * 1600 * (1 - 2 * s.e / 1.6) / 1000, 1e-9);
  ok('gravity: the plain-concrete checks appear, no reinforcement', chk(R, 'plainN') && chk(R, 'plainV') && !chk(R, 'stemM'));
  throws('a gravity wall cannot be wider at the top', () => run({ type: 'gravity', ts: 400, tTop: 600 }), /cannot be wider/);
}
{ // refusals and notes
  throws('the base must reach the back of the stem', () => run({ B: 800 }), /reach the back of the stem/);
  throws('slope steeper than φ′', () => run({ beta: 35 }), /flatter than/);
  throws('undrained needs c_u', () => run({ bearing: 'undrained', cuf: 0 }), /c_u,k/);
  ok('a short heel on a slope: the note', run({ beta: 20, B: 1300 }).warnings.some(w => /too short for the Rankine zone/.test(w)));
  ok('propped with active pressure: the note', run({ type: 'propped' }).warnings.some(w => /at-rest/.test(w)));
  const L = run({ lineQ: 20, lineX: 3000 }), L2 = run({ lineQ: 20, lineX: 600 });
  ok('a line load beyond the heel pushes on the virtual back; on the heel it also bears down', L.R.SLS.el.lineQ.F > 0 && L2.R.C1a.V > run({}).R.C1a.V);
  const S = run({ stripQ: 20, stripB: 1000, stripA: 2000 }); ok('a strip load adds thrust', S.R.SLS.H > run({}).R.SLS.H);
}
console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
