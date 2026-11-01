// RC Column Design: NODE_PATH=<dir with node_modules> node test_rc_column.js
// 1 The Concrete Centre TCC53 (43 rectangular columns, both axes, braced and unbraced; outputs only), run twice:
//   with TCC's conventions (fcd = 0.85 fck / 1.5 and d = h − d2 for the curvature) to match it closely, and as shipped.
// 2 TCC54 (46 circular columns; outputs only).
// 3 Hand checks: §5.8 nominal curvature step by step, and an independent M-N section solution.
// 4 Rules: both directions always checked, biaxial exponent, reinforcement limits, unbraced and pinned columns.
// 5 Fire: Method A results are unchanged from the page before this rework (ref_fire.json, recorded from it).
const { load, run } = require('./load.js');
const T53 = require('./ref_tcc53.json'), T54 = require('./ref_tcc54.json'), FIRE = require('./ref_fire.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, scale = null) => { n++; const e = Math.abs(got - exp) / Math.max(Math.abs(scale ?? exp), 1e-9); const ok = e <= tol; if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(8)} expected ${(+exp).toPrecision(8)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; if (!c || process.env.V) console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const AREA = p => Math.PI * p * p / 4, FYD = 500 / 1.15, ES = 200000;

const w = load();                                   // as shipped
const wT = load();                                  // with TCC's conventions
wT.eval('fcd = function(f){ return 0.85*f/1.5; }; curvDepth = function(depth, items){ return Math.max(...items.map(q => q.d)); };');

// ---------- 1 TCC53 ----------
const in53 = ({ inp: c, tcc: t }) => ({ rb: c.b, rh: c.h, rfck: c.fck, rfyk: 500, rcov: c.cov, rlink: Math.max(c.link, t.bar > 32 ? 10 : 8), rnx: c.nb, rdx: t.bar, rny: c.nh, rdy: t.bar,
  ned: c.N, mtop: c.My[0], mbot: c.My[1], mtopy: c.Mz[0], mboty: c.Mz[1], clen: t.ly, cleny: t.lz, phief: t.phief,
  ktop: t.y.k1, kbot: t.y.k2, ktopy: t.z.k1, kboty: t.z.k2, braced: c.braced === 'Y', mufi: 0.7, eimode: 'ah' });
T53.forEach((C, k) => {
  const s = in53(C), t = C.tcc, tag = `TCC53 ${k} (${C.inp.h}x${C.inp.b}, ${C.inp.braced === 'Y' ? 'braced' : 'unbraced'}, ${t.bars})`;
  const L = run(wT, s), S = run(w, s);
  for (const [ax, r, Mcap, rS, McapS] of [['y', L.rx, L.McapXX, S.rx, S.McapXX], ['z', L.ry, L.McapYY, S.ry, S.McapYY]]) {
    const T = t[ax], a = `${tag} ${ax}-axis`;
    near(`${a}: l0`, r.l0, T.l0, 1e-9); near(`${a}: slenderness`, r.lambda, T.lambda, 1e-9); near(`${a}: n`, r.n, T.n, 1e-9);
    if (T.omega > r.omega * (1 + 1e-6)) near(`${a}: TCC raises ω to 0.05 when the bars give less`, T.omega, 0.05, 1e-12);
    else near(`${a}: ω`, r.omega, T.omega, 1e-9);
    if (T.lambdaLim < 50 - 1e-9) near(`${a}: λlim (TCC caps it at 50)`, r.lambda_lim, T.lambdaLim, 6e-3);
    near(`${a}: Kφ`, r.Kphi, T.Kphi, 1e-9); near(`${a}: 1/r0`, r.inv_r0, T.inv_r0, 1e-9); near(`${a}: M02`, r.M02, Math.abs(T.M02), 1e-9);
    near(`${a}: M2 (TCC reads nbal off its chart)`, r.M2, Math.abs(T.M2), 6e-2, Math.max(Math.abs(T.M2), 0.05 * T.MEd));
    near(`${a}: MEd`, r.MEd, T.MEd, 3e-2); near(`${a}: MRd at NEd`, Mcap, T.MRd, 8e-3);
    // as shipped: fcd = 0.567 fck (0.06 % below 0.85 fck / 1.5) and d = h/2 + is (§5.8.8.3(2)), never above h − d2
    near(`${a} as shipped: MRd at NEd`, McapS, T.MRd, 1e-2);
    truth(`${a} as shipped: 1/r0 not below TCC's (d = h/2 + is ≤ h − d2)`, rS.inv_r0 >= T.inv_r0 * (1 - 1e-9));
    truth(`${a} as shipped: MEd not below 0.99 of TCC's`, rS.MEd >= 0.99 * T.MEd);
  }
  if (L.biaxial) near(`${tag}: biaxial (5.39)`, L.biaxUtil, t.biaxial, 3e-2);
});

// ---------- 2 TCC54 ----------
const in54 = ({ inp: c, tcc: t }) => ({ tab: 'circ', cd: c.D, cfck: c.fck, cfyk: 500, ccov: c.cov, clink: t.bar > 32 ? 10 : 8, cnb: c.nb, cdb: t.bar,
  ned: c.N, mtop: c.M02, mbot: -c.M01, mtopy: 0, mboty: 0, clen: c.L, cleny: c.L, phief: t.phief,   // TCC54: end moments of the same sign = double curvature
  ktop: t.k1, kbot: t.k2, ktopy: t.k1, kboty: t.k2, braced: c.braced === 'Y', mufi: 0.7, eimode: 'ah' });
T54.forEach((C, k) => {
  const c = C.inp, t = C.tcc, L = run(w, in54(C)), r = L.rx, tag = `TCC54 ${k} (Ø${c.D}, ${c.braced === 'Y' ? 'braced' : 'unbraced'}, ${t.bars})`;
  const Rb = c.D / 2 - c.cov - (t.bar > 32 ? 10 : 8) - t.bar / 2;
  near(`${tag}: l0`, r.l0, t.l0, 1e-9); near(`${tag}: slenderness on the gross section, i = D/4`, r.lambda, t.l0 / t.i, 1e-9);
  near(`${tag}: imperfection moment`, r.eiNEd, t.eiN, 1e-9); near(`${tag}: e0 NEd`, Math.max(20, c.D / 30) * c.N / 1000, t.e0N, 1e-9);
  near(`${tag}: nu = 1 + ω`, r.nu, t.nu, 1e-3);
  near(`${tag}: d = D/2 + is, is = R_bar/√2 for a ring of bars`, r.d_curv, c.D / 2 + Rb / Math.SQRT2, 1e-9);
  near(`${tag}: TCC's d takes is = R_bar/2`, t.d, c.D / 2 + Rb / 2, 2e-3);
  near(`${tag}: 1/r0 = εyd / 0.45 d, on TCC's d`, r.inv_r0 * r.d_curv / t.d, t.inv_r0, 1e-9);
  near(`${tag}: MRd at NEd (TCC interpolates its chart)`, L.McapXX, t.MRd, 3e-2);
  if (!t.slender && !r.isSlender) near(`${tag}: stocky MEd = max(M02 + ei NEd, e0 NEd)`, r.MEd, t.MEd, 1e-9);
  if (c.braced !== 'Y') near(`${tag}: λlim (unbraced, C = 0.7)`, r.lambda_lim, t.lambdaLim, 2e-3);
});

// ---------- 3 hand checks ----------
const H = { rb: 300, rh: 400, rfck: 32, rfyk: 500, rcov: 35, rlink: 8, rnx: 3, rdx: 20, rny: 3, rdy: 20, ned: 1500, mtop: 60, mbot: -30, mtopy: 0, mboty: 0,
  clen: 8000, cleny: 8000, phief: 1.5, ktop: 0.5, kbot: 0.6, ktopy: 0.5, kboty: 0.6, mufi: 0.7, eimode: '400' };
{
  const L = run(w, H), r = L.rx, b = 300, h = 400, fc = 0.567 * 32, Ac = b * h, A20 = AREA(20), As = 8 * A20, NEd = 1500e3;
  const d2 = 35 + 8 + 10, is = Math.sqrt(6 * A20 * (h / 2 - d2) ** 2 / As), d = h / 2 + is;
  const l0 = 0.5 * 8000 * Math.sqrt((1 + 0.5 / 0.95) * (1 + 0.6 / 1.05)), lam = l0 / (h / Math.sqrt(12)), ei = l0 / 400;
  const M02 = 60 + ei * NEd / 1e6, M01 = -30 + ei * NEd / 1e6, rm = M01 / M02, om = As * FYD / (Ac * fc), nn = NEd / (Ac * fc);
  const lim = 20 * (1 / (1 + 0.2 * 1.5)) * Math.sqrt(1 + 2 * om) * (1.7 - rm) / Math.sqrt(nn);
  near('hand: l0 (5.15)', r.l0, l0, 1e-12); near('hand: slenderness', r.lambda, lam, 1e-12); near('hand: ei = l0/400', r.ei_mm, ei, 1e-12);
  near('hand: M02 = |M| + ei NEd', r.M02, M02, 1e-12); near('hand: M01 keeps its sign, + ei NEd', r.M01, M01, 1e-12); near('hand: rm', r.rm, rm, 1e-12);
  near('hand: λlim = 20 A B C / √n', r.lambda_lim, lim, 1e-12); truth('hand: slender', r.isSlender && lam > lim);
  near('hand: d = h/2 + is with the side bars (§5.8.8.3(2))', r.d_curv, d, 1e-12);
  truth('hand: nbal = max(peak, 0.4)', r.nbal === Math.max(r.nbalPk, 0.4));
  const Kr = Math.min(1, (1 + om - nn) / (1 + om - r.nbal)), Kphi = Math.max(1, 1 + (0.35 + 32 / 200 - lam / 150) * 1.5);
  const curv = Kr * Kphi * (FYD / ES) / (0.45 * d), M2 = NEd * curv * l0 * l0 / Math.PI ** 2 / 1e6;
  near('hand: Kr', r.Kr, Kr, 1e-12); near('hand: Kφ', r.Kphi, Kphi, 1e-12); near('hand: M2 = NEd (1/r) l0² / π²', r.M2, M2, 1e-12);
  const M0e = Math.max(0.6 * M02 + 0.4 * M01, 0.4 * M02), e0 = Math.max(20, h / 30) * NEd / 1e6;
  near('hand: MEd = max(M02, M0e + M2, |M01| + M2/2, e0 NEd)', r.MEd, Math.max(M02, M0e + M2, 30 + ei * NEd / 1e6 + M2 / 2, e0), 1e-12);
  truth('hand: the peak of the M-N curve is at nbalPk', (() => { const M = nv => w.getMcap(nv * Ac * fc / 1e3, L.sec.pts, L.sec); return M(r.nbalPk) >= M(r.nbalPk + 0.03) && M(r.nbalPk) >= M(Math.max(0, r.nbalPk - 0.03)); })());
  // independent section solution: 0.8x block of fcd (at most h), εcu3 at the top for x ≤ h, pivot εc3 at h/2 beyond;
  // bars elastic-plastic, fcd deducted from bars in compression (as the page does)
  const lay = [[d2, 3 * A20], [h / 2, 2 * A20], [h - d2, 3 * A20]];
  const pt = x => { const sb = Math.min(0.8 * x, h); let N = fc * b * sb, M = fc * b * sb * (h / 2 - sb / 2);
    for (const [y, A] of lay) { const e = x > h ? 0.00175 * (x - y) / (x - h / 2) : 0.0035 * (x - y) / x; const f = Math.max(-FYD, Math.min(FYD, ES * e)) - (e > 0 ? fc : 0); N += f * A; M += f * A * (h / 2 - y); } return { N, M }; };
  for (const Nt of [0, 400e3, 1500e3, 2400e3]) {
    let lo = 1e-6, hi = 20 * h; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (pt(m).N > Nt) hi = m; else lo = m; }
    near(`hand: MRd at N = ${Nt / 1e3} kN, independent section solution`, w.getMcap(Nt / 1e3, L.sec.pts, L.sec), pt((lo + hi) / 2).M / 1e6, 1e-7);
  }
  // θ0 αh l0 / 2 imperfection: αh = 2/√l clamped to 2/3..1, l in m
  const A = run(w, { ...H, eimode: 'ah', clen: 9000, cleny: 9000 }).rx;
  near('hand: θi = θ0 αh with αh = 2/√9', A.thetaI, 0.005 * (2 / 3), 1e-12); near('hand: ei = θi l0 / 2', A.ei_mm, A.thetaI * A.l0 / 2, 1e-12);
  // circular: d = R + R_bar/√2, a = 2 for the biaxial check
  const Cc = run(w, { tab: 'circ', cd: 450, cfck: 32, cfyk: 500, ccov: 35, clink: 8, cnb: 8, cdb: 20, ned: 1500, mtop: 60, mbot: -30, mtopy: 40, mboty: 10, clen: 5000, cleny: 5000, phief: 1.5, ktop: 0.5, kbot: 0.6, ktopy: 0.5, kboty: 0.6, mufi: 0.7, eimode: '400' });
  near('hand: circular d = D/2 + R_bar/√2', Cc.rx.d_curv, 225 + (225 - 35 - 8 - 10) / Math.SQRT2, 1e-12);
  near('hand: circular biaxial exponent a = 2 (§5.8.9(4))', Cc.biaxUtil, (Cc.rx.MEd / Cc.McapXX) ** 2 + (Cc.ry.MEd / Cc.McapYY) ** 2, 1e-12);
  const Rb = run(w, { ...H, mtopy: 40, mboty: 10 }), ratio = 1500e3 / (Ac * fc + As * FYD), aR = ratio <= 0.1 ? 1 : ratio <= 0.7 ? 1 + 0.5 * (ratio - 0.1) / 0.6 : 1.5 + 0.5 * (ratio - 0.7) / 0.3;
  near('hand: rectangular biaxial exponent interpolated on NEd/NRd', Rb.biaxUtil, (Rb.rx.MEd / Rb.McapXX) ** aR + (Rb.ry.MEd / Rb.McapYY) ** aR, 1e-12);
}

// ---------- 4 rules ----------
{
  const U = run(w, H);
  truth('Y-Y is designed with no Y-Y moments (imperfection, M2 and e0)', U.ry.MEd >= Math.max(20, 300 / 30) * 1.5 - 1e-9 && /Moment capacity \(y-y\)/.test(w.document.getElementById('sumBody').textContent) && w.document.getElementById('slenSectionYY').style.display !== 'none');
  truth('no biaxial check without Y-Y moments', !U.biaxial && !/Biaxial/.test(w.document.getElementById('sumBody').textContent));
  const steel = Object.fromEntries(U.steel.map(c => [c.name.replace(/ \(.*/, ''), c]));
  near('As,min = max(0.10 NEd / fyd, 0.002 Ac)', steel['Minimum steel'].AsMin, Math.max(0.1 * 1500e3 / FYD, 0.002 * 120000), 1e-12);
  near('As,max = 0.04 Ac', steel['Maximum steel, outside laps'].AsMax, 0.04 * 120000, 1e-12);
  const low = run(w, { ...H, rnx: 2, rny: 2, rdx: 12, rdy: 12, ned: 3000 });
  truth('too little steel fails, and the summary says so', !low.passSteel && !low.steel[0].ok && /Minimum steel/.test(w.document.getElementById('sumBody').textContent));
  truth('too much steel fails', !run(w, { ...H, rnx: 4, rdx: 32, rny: 4, rdy: 32 }).steel[1].ok);
  truth('links under φ/4 fail', !run(w, { ...H, rdx: 40, rdy: 40, rlink: 8 }).steel[3].ok && run(w, { ...H, rdx: 40, rdy: 40, rlink: 10 }).steel[3].ok);
  const circ3 = run(w, { tab: 'circ', cd: 400, cfck: 32, cfyk: 500, ccov: 35, clink: 8, cnb: 3, cdb: 20, ned: 800, mtop: 20, mbot: -10, mtopy: 0, mboty: 0, clen: 3500, cleny: 3500, phief: 1.5, ktop: 0.5, kbot: 0.5, ktopy: 0.5, kboty: 0.5, mufi: 0.7 });
  truth('a circular column needs at least 4 bars (§9.5.2(4))', circ3.steel.some(c => /circular/.test(c.name) && !c.ok));
  const ub = run(w, { ...H, braced: false }), r = ub.rx;
  near('unbraced: rm = 1', r.rm, 1, 1e-12);
  near('unbraced: l0 (5.16)', r.l0, 8000 * Math.max(Math.sqrt(1 + 10 * 0.3 / 1.1), (1 + 0.5 / 1.5) * (1 + 0.6 / 1.6)), 1e-12);
  near('unbraced: MEd = max(M02 + M2, e0 NEd)', r.MEd, Math.max(r.M02 + r.M2, Math.max(20, 400 / 30) * 1.5), 1e-12);
  near('pinned both ends: l0 = l', run(w, { ...H, pinned: true }).rx.l0, 8000, 1e-12);
  const cm = run(w, { ...H, mbot: 60 }).rx;
  truth('constant first-order moment: c = 8 (§5.8.8.2(4))', cm.constM && cm.c === 8 && cm.M2 > run(w, { ...H, mbot: 59 }).rx.M2);
  const bi = run(w, { ...H, clen: 3500, cleny: 3500, ned: 1000, mtop: 100, mbot: 100, mtopy: 50, mboty: 50 });
  truth('a failing biaxial check fails the column even when each direction passes', bi.passXX && bi.passYY && !bi.passBiax);
  const st = run(w, { ...H, clen: 2500, cleny: 2500, ned: 500 }).rx;
  truth('stocky: no second-order moment', !st.isSlender && st.M2 === 0);
  truth('no alerts or script errors', w.alerts.length === 0 && w.errs.length === 0);
}

// ---------- 5 fire unchanged ----------
FIRE.forEach(({ inp, fr }, k) => {
  const L = run(w, inp);
  for (const [key, v] of Object.entries(fr)) typeof v === 'number' ? near(`fire ${k}: ${key} as before`, L.fr[key], v, 1e-12, Math.max(1, Math.abs(v))) : truth(`fire ${k}: ${key} as before`, L.fr[key] === v);
});

console.log(`\n${n - fails}/${n} passed`);
if (fails) process.exit(1);
/* Documented differences from the Concrete Centre's TCC53 (rectangular) and TCC54 (circular):
   fcd = 0.567 fck here (TCC 0.85 fck / 1.5, 0.06 % higher), kept so the fire results do not move;
   d for the nominal curvature is h/2 + is (§5.8.8.3(2)) here; TCC53 uses h − d2 even with side bars (up to 14 % less
   curvature) and TCC54 takes is = R_bar/2 for a ring of bars (the radius of gyration is R_bar/√2);
   nbal is the larger of the n at the peak of the M-N curve and 0.4 here; TCC reads the peak off its chart;
   TCC53 caps λlim at 50 and relaxes Kφ to 1 under §5.8.4(4); neither is done here;
   TCC54's λ and Kφ use a transformed section (§5.8.3.2(1) says the uncracked concrete section), its rm leaves the
   imperfection out and takes the opposite sign to its M0e, and its MRd is interpolated from its chart;
   both TCC sheets take the imperfection in both directions for the biaxial check, as here (conservative, §5.8.9(2)). */
