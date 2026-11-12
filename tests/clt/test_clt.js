// CLT Panels. The section properties against a CLT manufacturer's published stiffness matrix (Stora Enso, "Stiffness
// matrix for CLT", 02/2015: its worked example and its tables of D11 … D88 and κ, E_0,mean 12 500, G 690, G_R 50
// N/mm²); κ against the rectangle's 5/6; the stiffness against the γ-method of EC5 Annex B; the floor and wall checks
// restated by hand from BS EN 1995-1-1 and the UK NA; errors.
const { CLT, EC5 } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol, abs = 0) => { n++; const ok = Math.abs(got - exp) <= Math.max(tol * Math.abs(exp), abs); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(7)} expected ${(+exp).toPrecision(7)}`); if (!ok) fails++; return ok; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = ''; try { f(); } catch (e) { m = e.message; } const ok = re.test(m); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ': ' + (m || 'no error')}`); if (!ok) fails++; };
const alt = CLT.alternate;

// ---------- 1. the published stiffness matrix ----------
const SE = CLT.material({ family: 'other', props: { name: 'C24 laminations, E 12 500', fmk: 24, ft0k: 14.5, fc0k: 21, fvk: 4, fRk: 1.1, fc90k: 2.5, E0mean: 12500, E005: 10417, Gmean: 690, GR: 50, rhok: 350, rhomean: 470, gM: 1.25 } });
{ // the worked example: CLT 100 L5s, five 20 mm layers
  const s = CLT.section(alt([20, 20, 20, 20, 20]), SE);
  near('100 L5s: I_0,net = 6.6 × 10⁷ mm⁴/m', s.main.I, 6.6e7, 1e-12);
  near('100 L5s: I_90,net = 1.733 × 10⁷ mm⁴/m', s.cross.I, 17333333.33, 1e-9);
  near('100 L5s: D11 = 825 kNm²/m', s.D.D11, 825, 1e-12); near('100 L5s: D22 = 216.67', s.D.D22, 216.6667, 1e-5);
  near('100 L5s: D33 = 0.65 G b d³/12 = 37.375', s.D.D33, 37.375, 1e-12);
  near('100 L5s: D44 = 0.184 × (690 × 60 + 50 × 40) = 7 985.6 kN/m (κ to three figures)', s.D.D44, 7985.6, 2e-3);
  near('100 L5s: D55 = 0.145 × (50 × 60 + 690 × 40) = 4 437 kN/m', s.D.D55, 4437, 5e-3);
  near('100 L5s: D66 = 750 000 kN/m', s.D.D66, 750000, 1e-12); near('100 L5s: D77 = 500 000', s.D.D77, 500000, 1e-12); near('100 L5s: D88 = 690 × 100 × 0.7 = 48 300', s.D.D88, 48300, 1e-12); }
// the table (layups identified from D66 and D77); [layers, D11, D22, D33, D44, D55, κ0, κ90]
const TABLE = [['60 L3s', [20, 20, 20], 216.7, 8.3, 8.1, 4462, 11502, 0.156, 0.728], ['80 L3s', [30, 20, 30], 525.0, 8.3, 19.1, 7293, 11508, 0.172, 0.685],
  ['90 L3s', [30, 30, 30], 731.3, 28.1, 27.2, 6692, 17254, 0.156, 0.728], ['120 L3s', [40, 40, 40], 1733.0, 66.7, 64.6, 8923, 23005, 0.156, 0.728],
  ['140 L5s', [40, 20, 20, 20, 40], 2640.9, 216.7, 102.6, 12709, 4434, 0.179, 0.136], ['160 L5s', [40, 20, 40, 20, 40], 3800.0, 466.7, 153.1, 17638, 4704, 0.208, 0.140],
  ['180 L5s', [40, 30, 40, 30, 40], 5100.0, 975.0, 217.9, 16216, 6589, null, 0.139], ['200 L5s', [40, 40, 40, 40, 40], 6600.0, 1733.0, 299.0, 15971, 8874, 0.184, 0.145],
  ['180 L7s', [30, 20, 30, 20, 30, 20, 30], 4800.0, 1275.0, 217.9, 17417, 8295, 0.203, 0.175], ['200 L7s', [20, 40, 20, 40, 20, 40, 20], 4533.0, 3800.0, 299.0, 12974, null, null, null],
  ['240 L7s', [30, 40, 30, 40, 30, 40, 30], 9300.0, 5100.0, 516.7, 17582, null, null, null]];
for (const [nm, ts, d11, d22, d33, d44, d55, k0, k90] of TABLE) {
  const s = CLT.section(alt(ts), SE), three = ts.length === 3;
  near(`${nm}: D11 (published to 0.1)`, s.D.D11, d11, 1e-3, 0.06); near(`${nm}: D22`, s.D.D22, d22, 1e-3, 0.06); near(`${nm}: D33`, s.D.D33, d33, 1e-3, 0.06);
  // three layers: the published κ0 runs about 1–2 % above the energy method's (the κ90 of the same panels agrees to three figures)
  near(`${nm}: D44 = κ0 ΣG t${three ? ' (within 2.5 % for three layers)' : ''}`, s.D.D44, d44, three ? 0.025 : 0.005);
  if (d55) near(`${nm}: D55 = κ90 ΣG t`, s.D.D55, d55, 0.005);
  if (k0) near(`${nm}: κ0 = ${k0}`, s.main.kappa, k0, three ? 0.025 : 0.004);
  if (k90) near(`${nm}: κ90 = ${k90}`, s.cross.kappa, k90, 0.004);
}
// Left out, as they do not follow from the table's own layups: 120 L5s κ90 0.156 (100 L5s 0.145, 140 L5s 0.136), and
// D55 of 200 L7s and 240 L7s (κ90 0.289 and 0.608, for panels whose outer layers run across and carry no shear stress;
// the energy method gives 0.203 and 0.183, in line with the five-layer panels).

// ---------- 2. closed forms ----------
{ const M = CLT.material({ cls: 'C24' });
  const r = CLT.section([{ t: 40, o: 0 }, { t: 40, o: 0 }, { t: 40, o: 0 }], M);
  near('one material all one way: κ = 5/6 (the rectangle)', r.main.kappa, 5 / 6, 1e-12);
  near('... and I = b h³/12', r.main.I, 1000 * 120 ** 3 / 12, 1e-12);
  const u = CLT.section([{ t: 40, o: 0 }, { t: 20, o: 90 }, { t: 20, o: 0 }], M).main;   // unsymmetric
  const zc = (40 * 20 + 20 * 70) / 60, I = 1000 * (40 ** 3 / 12 + 40 * (20 - zc) ** 2 + 20 ** 3 / 12 + 20 * (70 - zc) ** 2);
  near('unsymmetric 40/20×/20: the neutral axis of the net section', u.zc, zc, 1e-12); near('... I_net', u.I, I, 1e-12);
  near('... W_net to the far fibre', u.W, I / Math.max(zc, 80 - zc), 1e-12);
  near('... the rolling shear moment S_R = b × 40 × (z_c − 20)', u.SR, 1000 * 40 * (zc - 20), 1e-12);
  const f = CLT.section(alt([40, 20, 40, 20, 40]), M).main;
  near('40/20×/40/20×/40: S_R = b × 40 × 60', f.SR, 2.4e6, 1e-12); near('... S_max = S_R + b × 20 × 10', f.Smax, 2.6e6, 1e-12); }
// the γ-method of EC5 Annex B for five layers: within 1.5 % of this method's apparent stiffness under a uniform load
{ const M = CLT.material({ cls: 'C24' });
  for (const [ts, L] of [[[40, 20, 40, 20, 40], 4500], [[20, 20, 20, 20, 20], 4000], [[40, 30, 40, 30, 40], 6000]]) {
    const sec = CLT.section(alt(ts), M).main, g = CLT.gammaEI(sec, M, L), app = 1 / (1 / sec.EI + 48 / (5 * L * L * sec.GA));
    // γ by hand for the outer parts
    const A = 1000 * ts[0], gam = 1 / (1 + Math.PI ** 2 * M.E0mean * A * ts[1] / (M.GR * 1000 * L * L));
    near(`${ts.join('-')} over ${L / 1000} m: γ₁ = 1/(1 + π²E A₁ t_cross/(G_R b L²))`, g.gamma[0], gam, 1e-12);
    near(`... EI_ef (γ-method) against the apparent EI here`, app, g.EI, 0.015);
  } }

// ---------- 3. a floor, restated ----------
{ const L = 4500, inp = { mat: { cls: 'C24' }, sc: 1, layers: alt([40, 20, 40, 20, 40]), L, lb: 100, loads: [{ case: 'G', form: 'area', w: 1.5 }, { case: 'Q', form: 'area', w: 1.5 }], cat: 'A', combo: '6.10', vib: { B: 4, zeta: 0.02 } };
  const D = CLT.floor(inp), M = D.M, sec = D.sec, gk = M.rhomean * 9.81e-6 * 160, g = 1.5 + gk, q = 1.5;
  const wd = 1.35 * g + 1.5 * q, Md = wd * L * L / 8, Vd = wd * L / 2;   // N/mm on the 1 m strip (kN/m² × 1 m)
  const fmd = 0.8 * 24 / 1.25, fvd = 0.8 * 4 / 1.25, fRd = 0.8 * 1.1 / 1.25, fc90d = 0.8 * 2.5 / 1.25;
  const ck = id => D.checks.find(c => c.id === id).util;
  near('floor: bending M/W_net against k_mod f_m,k/γ_M (1.35G + 1.5Q, k_mod 0.8)', ck('m'), Md / (sec.I / 80) / fmd, 1e-6);
  near('floor: shear V S_max/(I b)', ck('v'), Vd * 2.6e6 / (sec.I * 1000) / fvd, 1e-6);
  near('floor: rolling shear V S_R/(I b) against k_mod f_R,k/γ_M', ck('r'), Vd * 2.4e6 / (sec.I * 1000) / fRd, 1e-6);
  near('floor: bearing R/(b (l + 30)) against f_c,90,d', ck('c90'), Vd / (1000 * 130) / fc90d, 1e-6);
  // deflection: 5wL⁴/384EI + wL²/8GA (Timoshenko); w_inst with Q leading, w_net,fin = u_G(1 + 0.8) + u_Q(1 + 0.3 × 0.8)
  const u = w => 5 * w * L ** 4 / (384 * sec.EI) + w * L * L / (8 * sec.GA);
  near('floor: w_inst = u_G + u_Q (bending and shear)', D.inst.val, u(g) + u(q), 2e-4);
  near('floor: w_net,fin = u_G(1 + k_def) + u_Q(1 + ψ₂k_def), k_def 0.8, ψ₂ 0.3', D.fin.val, u(g) * 1.8 + u(q) * (1 + 0.3 * 0.8), 2e-4);
  // vibration, UK NA: m from the permanent load, b_ef = (l/1.1)(EI_B/EI_L)^¼
  const m = g * 1000 / 9.81, EIL = sec.EI / 1e6, EIB = D.S0.cross.EI / 1e6, Lm = 4.5, f1 = Math.PI / (2 * Lm * Lm) * Math.sqrt(EIL / m);
  const bef = Math.min(4, Lm / 1.1 * (EIB / EIL) ** 0.25), a = (1000 * Lm ** 3 / (48 * EIL * bef) + 1000 * Lm / (4 * sec.GA * bef)) * 1000;
  const n40 = (((40 / f1) ** 2 - 1) * (4 / Lm) ** 4 * EIL / EIB) ** 0.25, v = 4 * (0.4 + 0.6 * n40) / (m * 4 * Lm + 200), bb = a <= 1 ? 180 - 60 * a : 160 - 40 * a;
  near('floor: f₁ = π/(2l²) √(EI_L/m)', D.V.f1, f1, 1e-9); near('floor: a under 1 kN on b_ef', D.V.a, a, 1e-9);
  near('floor: a limit 16 500/l^1.1 (l > 4 m)', D.V.alim, 16500 / 4500 ** 1.1, 1e-12);
  near('floor: unit impulse velocity v', D.V.vel, v, 1e-9); near('floor: v limit b^(f₁ζ − 1)', D.V.vlim, bb ** (f1 * 0.02 - 1), 1e-9);
  truth('floor: k_mod 0.8 for Q (category A, medium term) and 0.6 for G alone', D.combos.find(r => r.c.name === '1.35G').c.kmod === 0.6 && D.combos.find(r => r.c.name === '1.35G + 1.5Q').c.kmod === 0.8);
  const D2 = CLT.floor({ ...inp, ksys: true });
  near('floor: k_sys 1.1 raises f_m,d only', D2.checks.find(c => c.id === 'm').util, ck('m') / 1.1, 1e-9);
  const D3 = CLT.floor({ ...inp, sc: 2 });
  near('floor: service class 2, k_def 1.0', D3.fin.val, u(g) * 2 + u(q) * (1 + 0.3), 2e-4);
  // a line load across the span (a partition): a point load on the strip
  const D4 = CLT.floor({ ...inp, loads: [{ case: 'G', form: 'point', w: 2, a: 2.25 }], sw: false, vib: null });
  near('floor: 2 kN/m across at mid-span: M = 1.35 × 2 × L/4', D4.govern.B.Mx, 1.35 * 2000 * L / 4, 1e-6);
  // spanning across the outer layers: the cross layers carry the bending
  const D5 = CLT.floor({ ...inp, dir: 'cross', L: 2000, vib: null });
  near('floor across the outer layers: I_net of the two cross layers', D5.sec.I, D5.S0.cross.I, 1e-12); }

// ---------- 4. a wall, restated ----------
{ const H = 2700, e = 15, inp = { mat: { cls: 'C24' }, sc: 1, layers: alt([30, 40, 30]), H, kef: 1, top: [{ case: 'G', w: 15 }, { case: 'Q', w: 6 }], e, wind: 0.8, cat: 'A', combo: '6.10', bearing: { on: true } };
  const D = CLT.wall(inp), M = D.M, sec = D.sec, E05 = 5 / 6 * 11000, G05 = 690 * E05 / 11000;
  const Ne = Math.PI ** 2 * E05 * sec.I / H ** 2, Ncr = Ne / (1 + Ne / (sec.kappa * (690 * 60 + 50 * 40) * 1000 * E05 / 11000));
  near('wall: N_cr = π²E_0,05 I/l² reduced for shear', D.Ncr, Ncr, 1e-12);
  const lr = Math.sqrt(21 * sec.A / Ncr), k = 0.5 * (1 + 0.1 * (lr - 0.3) + lr * lr), kc = 1 / (k + Math.sqrt(k * k - lr * lr));
  near('wall: λ_rel = √(f_c,0,k A/N_cr)', D.lrel, lr, 1e-12); near('wall: k_c with β_c 0.1', D.kc, kc, 1e-12);
  // 6.23 at the station the engine reports, then over a fine grid (the 25 stations find the worst within 0.5 %)
  const g = D.govern.B, c = g.c, f = kk => (kk === 'G' ? c.gG : c.gQ[kk] || 0), Nt = f('G') * 15000 + f('Q') * 6000, w = f('W') * 0.8, sw = c.gG * D.S0.gk;
  const fcd = c.kmod * 21 / 1.25, fmd = c.kmod * 24 / 1.25, U = x => (Nt + sw * x) / sec.A / (kc * fcd) + (Nt * e * (1 - x / H) + w * x * (H - x) / 2) / sec.W / fmd;
  near(`wall: 6.23 at ${(g.best.x / 1000).toFixed(2)} m, ${c.name}`, g.uB, U(g.best.x), 1e-9);
  let um = 0; for (let i = 0; i <= 2000; i++) um = Math.max(um, U(H * i / 2000));
  near('wall: ... the worst along the height', g.uB, um, 5e-3);
  near('wall: the top, 6.19: (σ_c/f_c,0,d)² + σ_m/f_m,d', D.govern.T.uT, Math.max(...D.combos.map(r => { const ff = kk => (kk === 'G' ? r.c.gG : r.c.gQ[kk] || 0), N = ff('G') * 15000 + ff('Q') * 6000; return (N / sec.A / (r.c.kmod * 21 / 1.25)) ** 2 + N * e / sec.W / (r.c.kmod * 24 / 1.25); })), 1e-9);
  near('wall: rolling shear at the ends, V = N e/H + w H/2', D.govern.R.tR, Math.max(...D.combos.map(r => { const ff = kk => (kk === 'G' ? r.c.gG : r.c.gQ[kk] || 0); return ((ff('G') * 15000 + ff('Q') * 6000) * e / H + ff('W') * 0.8 * H / 2) * sec.SR / (sec.I * 1000); })), 1e-9);
  near('wall: bearing on the floor below over the full thickness', D.govern.C.s90, Math.max(...D.combos.map(r => { const ff = kk => (kk === 'G' ? r.c.gG : r.c.gQ[kk] || 0); return (ff('G') * 15000 + ff('Q') * 6000 + r.c.gG * D.S0.gk * H) / (100 * 1000); })), 1e-9);
  truth('wall: wind enters with k_mod 1.1 (instantaneous)', D.combos.some(r => r.c.gQ.W && r.c.kmod === 1.1)); }

// ---------- 5. errors ----------
throws('no layers', () => CLT.section([], CLT.material({})), /layers/);
throws('a layer without a thickness', () => CLT.section([{ t: 0, o: 0 }], CLT.material({})), /Layer 1/);
throws('service class 3 is refused (BS EN 16351)', () => CLT.floor({ mat: {}, sc: 3, layers: alt([30, 40, 30]), L: 4000, lb: 100, loads: [] }), /service classes 1 and 2/);
throws('spanning across a panel with no cross layers', () => CLT.floor({ mat: {}, sc: 1, layers: [{ t: 100, o: 0 }], dir: 'cross', L: 4000, lb: 100, loads: [] }), /across/);
throws('a wall without loads', () => CLT.wall({ mat: {}, sc: 1, layers: alt([30, 40, 30]), H: 2700, top: [], wind: 0, sw: false }), /load/);
console.log(`\n${n - fails}/${n} CLT checks passed`);
process.exit(fails ? 1 : 0);
