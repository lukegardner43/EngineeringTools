// Basement Wall checks (the engine is the Retaining Wall's, propped at the ground floor): The Concrete Centre TCC61 (24 walls,
// outputs only) and hand checks of the propped and pinned wall, the slab reaction, wall loads, the wall above the ground and
// early-age restraint steel.   node tests/basement-wall/test_basement_wall.js
const { RetWall: P } = require('./load.js');
const REF = require('./ref_tcc61.json');
let n = 0, fails = 0;
const ok = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } };
const near = (name, a, b, tol = 1e-9) => ok(name, Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `got ${a}, want ${b}`);
const chk = (R, id) => R.checks.find(c => c.id === id);
const AREA = p => Math.PI * p * p / 4;
const bars = { fck: 30, phiS: 16, sS: 150, phiSF: 12, sSF: 200, phiT: 12, sT: 200, phiH: 12, sH: 200 };

// ---------- TCC61 ----------
// TCC61 (a beta release) differences, set aside here:
//  - its fixed-end moment for a surcharge over the lower part a·L of the span, P L(1.5a³ − 6a² + 6)/12, is right only at
//    a = 1; this tool integrates the load (P L(a/2 − a²/2 + a³/8) for a uniform load, checked below by hand).
//  - it adds water as 1.2 × (γ_w − K_a γ_k) h_w²/2 on top of the full-weight earth pressure; this tool takes submerged soil
//    plus γ_w h. No water is compared.
//  - its prop reaction mixes force and moment terms; the prop force is checked here by hand instead.
REF.cases.forEach((c, i) => {
  const o = c.out, tag = `TCC61 case ${i + 1}`, L = c.Hc + c.tb, a = c.hb / L;
  const base = { type: 'propped', K: 'active', H: c.tb + c.hb, hUp: L - c.hb, hProp: L, tb: c.tb, ts: c.ts, B: c.B, bt: c.B - c.bh - c.ts, g: c.g, gsat: c.g, phi: c.phi, gf: 20, phif: 35, baseHeld: true, ...bars };
  const E = P.design(base);
  near(`${tag}: K_a at φ′k`, E.R.SLS.back.K, o.E52); near(`${tag}: K_a at φ′d`, E.R.C2b.back.K, o.G52);
  near(`${tag}: span to the prop`, (E.yProp - E.tb) * 1000, o.O50);
  near(`${tag}: fixed-end moment, earth, DA1-1`, E.stem.C1.Mbase, o.E58, 1e-7); near(`${tag}: …characteristic`, E.stem.SLS.Mbase, o.F58, 1e-7); near(`${tag}: …DA1-2`, E.stem.C2.Mbase, o.G58, 1e-7);
  if (c.qk > 0) {
    const Q = P.design({ ...base, qQ: c.qk }), MS = Q.stem.C1.Mbase - E.stem.C1.Mbase, PadS = 1.5 * E.R.SLS.back.K * c.qk * c.hb / 1000;
    near(`${tag}: surcharge fixed-end moment = P L(a/2 − a²/2 + a³/8)`, MS, PadS * L / 1000 * (a / 2 - a * a / 2 + a ** 3 / 8), 1e-7);
    if (Math.abs(a - 1) < 1e-9) near(`${tag}: …equals TCC61's at a = 1`, MS, o.E59, 1e-7);
  }
});

// ---------- hand checks ----------
const D = { type: 'propped', K: 'rest', fixBase: true, H: 3300, hUp: 0, hProp: 3000, tb: 300, B: 1400, bt: 600, ts: 300, hg: 0, g: 18, gsat: 20, phi: 30, gf: 19, phif: 32, baseHeld: true, dA: 0, ...bars };
const run = o => P.design({ ...D, ...o });
{ // full-height triangular earth load, K0: fixed and pinned
  const K0 = 0.5, L = 3.0, w = 1.35 * K0 * 18 * L;
  const F = run({}); near('fixed base: R = wL/10', F.stem.C1.Rp, w * L / 10, 1e-6); near('…M_base = wL²/15', F.stem.C1.Mbase, w * L * L / 15, 1e-6);
  const Pn = run({ fixBase: false }); near('pinned base: R = wL/6', Pn.stem.C1.Rp, w * L / 6, 1e-6); near('…no moment at the base', Pn.stem.C1.Mbase, 0, 1e-6);
  near('…span moment wL²/(9√3)', -Pn.stem.C1.Mmin, w * L * L / (9 * Math.sqrt(3)), 2e-3);
  // the slab takes the rest: H_slab = total − prop
  near('slab reaction = thrust − prop', F.R.C1a.Hslab, F.R.C1a.Hgross - F.R.C1a.Rp, 1e-9);
  ok('the slab and prop are reported, sliding is not checked', chk(F, 'slab').req && chk(F, 'prop').req && !chk(F, 'slide1'));
  near('the footing sees no horizontal load', F.R.C1a.H, 0);
}
{ // wall above the ground and wall loads
  const U = run({ hUp: 500, hProp: 3500 }), A = run({});
  near('the wall above the ground adds its weight', U.sumW - A.sumW, 25 * 0.3 * 0.5, 1e-9);
  near('…but no load: the earth moment needs the longer span', U.stem.SLS.diag[U.stem.SLS.diag.length - 1].p, 0);
  const W = run({ wallG: 40, wallQ: 20 });
  near('wall loads: G in the weights at the wall centre', W.sumW - A.sumW, 40, 1e-9);
  near('…Q only where unfavourable (bearing, DA1-1 weights 1.35)', W.R.C1a.V - A.R.C1a.V, 1.35 * 40 + 1.5 * 20, 1e-9);
  near('…not for sliding', W.R.C1s.V - A.R.C1s.V, 40, 1e-9);
}
{ // early-age restraint: surface zones, f_ct,eff(t)
  const R = run({ phiHz: 12, sHz: 150, tCrack: 3, cement: 'N' }), r = R.restraint;
  const fct = Math.exp(0.25 * (1 - Math.sqrt(28 / 3))) * 0.3 * 30 ** (2 / 3), d = 300 - 40 - 6;
  near('f_ct,eff at 3 days (3.1): β_cc f_ctm', r.fct, fct, 1e-12);
  near('A_c,eff per face = min(2.5(h − d), h/2)', r.hef, Math.min(2.5 * (300 - d), 150));
  near('A_s,min = k_c k f_ct,eff A_c,eff/f_yk', r.AsMin, fct * r.hef * 1000 / 500, 1e-12);
  near('utilisation against one face', chk(R, 'restraint').util, r.AsMin / (AREA(12) * 1000 / 150), 1e-12);
  const S = run({ phiHz: 12, sHz: 150, tCrack: 3, cement: 'S' }); ok('slow cement: lower f_ct,eff', S.restraint.fct < r.fct);
}
console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
