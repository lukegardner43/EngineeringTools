// Timber Racking Wall: PD 6693-1:2025 clause 20 by hand, each equation worked independently of the engine — f_p,d (20),
// f_p,d,t and K_comb (17, 18, Table 7), μ (23), K_i,w (21) with its clamps, M_d,stb and M_d,dst,top (25, 26), K_opening
// (30, 31) with the shallow-opening rule, F_i,v,Rd (16), the deflection limit (19), sliding (20.4.2), the leeward compression
// (33) and Note 2, the uplift of Figure 3, plasterboard Table 8 — and the sheathing nail by BS EN 1995-1-1 8.2.2 against
// Luke's racking spreadsheet (3.75 × 75 smooth nail, 11 mm OSB, C24, service class 2: F_f,Rd 0.701 kN); the limits of
// 20.1 and 20.2; errors. (PD 6693-1 has no worked example of clause 20.)
const { TimberRacking: TR } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol = 1e-9) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };
const ck = (D, id) => D.checks.find(c => c.id === id);

// ---------- the sheathing nail, EC5 8.2.2, against the spreadsheet ----------
{ const N = TR.nail({ type: 'smooth', d: 3.75, len: 75 }, { kind: 'OSB/3', t: 11 }, { rhok: 350 }, Math.sqrt(1.1 * 0.9));
  near('spreadsheet: F_f,Rd = 0.701 kN (3.75 × 75 smooth nail, 11 mm OSB/3, C24, SC2)', N.Fd / 1e3, 0.701, 0.001);
  near('f_h,1,k OSB (8.22) = 65 d^-0.7 t^0.1', N.fh1, 65 * 3.75 ** -0.7 * 11 ** 0.1, 1e-12); near('f_h,2,k timber (8.15) = 0.082 ρ_k d^-0.3', N.fh2, 0.082 * 350 * 3.75 ** -0.3, 1e-12);
  near('M_y,Rk (8.14) = 0.3 f_u d^2.6', N.My, 0.3 * 600 * 3.75 ** 2.6, 1e-12); near('F_ax,Rk = f_ax,k d t_pen (20 × 10⁻⁶ ρ_k²)', N.Fax, 20e-6 * 350 * 350 * 3.75 * 64, 1e-12);
  truth('mode (d) governs, with the 15 % rope cap', N.mode === 'd' && Math.abs(N.Fk - N.modes[3]) < 1e-9);
  const J = 1.05 * N.fh1 * 11 * 3.75 / (2 + N.beta) * (Math.sqrt(2 * N.beta * (1 + N.beta) + 4 * N.beta * (2 + N.beta) * N.My / (N.fh1 * 3.75 * 121)) - N.beta);
  near('mode (d) by hand, 1.15 × the Johansen part', N.Fk, 1.15 * J, 1e-9);
  const P = TR.nail({ type: 'smooth', d: 3.1, len: 50 }, { kind: 'ply', t: 12, rhok: 410 }, { rhok: 310 }, 1.1); near('plywood f_h,1,k (8.20) = 0.11 ρ_k d^-0.3', P.fh1, 0.11 * 410 * 3.1 ** -0.3, 1e-12);
  const S = TR.nail({ type: 'smooth', d: 3.1, len: 38 }, { kind: 'OSB/3', t: 15 }, { rhok: 310 }, 1.1); truth('t_pen 23 < 8d: no withdrawal', S.Fax === 0 && S.t2 === 23);
  const T = TR.nail({ type: 'smooth', d: 3, len: 45 }, { kind: 'OSB/3', t: 15 }, { rhok: 310 }, 1.1); near('8d ≤ t_pen < 12d: × (t_pen/4d − 2)', T.Fax, 20e-6 * 310 * 310 * 3 * 30 * (30 / 12 - 2), 1e-12);
  const Rg = TR.nail({ type: 'ring', d: 3.75, len: 75 }, { kind: 'OSB/3', t: 11 }, { rhok: 350 }, 1); truth('ring-shank: rope effect up to 50 %', Rg.cap === 0.5 && Rg.Fk >= N.Fk); }

// ---------- a ground-floor wall by hand ----------
const base = { L: 3.6, H: 2.4, sc: 2, stud: { cls: 'C16', b: 38, h: 140, s: 600, rail: 38 }, sheath: { kind: 'OSB/3', t: 9, fastener: { mode: 'given', Ffd: 0.5 }, s: 150 }, second: { mode: 'none' },
  openings: [], wind: { R: 2.0, above: [{ R: 2.5, H: 2.4 }], Hf: 0.3 }, vert: { g: 3.0, V: 2.0, up: 0, q: 1.5, cat: 'A' }, base: { fwd: 2.5, fix: 2.0 }, lee: { n: 2, small: false } };
{ const D = TR.design(base), L = 3.6, H = 2.4;
  const fpd = 1.2 * 0.5 * (1 + 2.5 * 0.15) / 0.15; near('(20) f_p,d = 1.2 F_f,Rd (1 + 2.5s)/s = 5.50 kN/m', D.fpdt, fpd, 1e-12); near('… = 5.5', fpd, 5.5, 1e-12);
  near('F_v,Ed = 1.5 (2.0 + 2.5)', D.FvEd, 6.75, 1e-12);
  const Mtop = 1.5 * 2.5 * (2.4 + 0.3), Mstb = 0.5 * 3.0 * L * L + 2.0 * L, Mn = Mstb - Mtop; near('(26) M_d,dst,top = R_d (H + H_f)', D.Mtop, Mtop, 1e-12); near('(25) M_d,stb = 0.5 w L² + V L', D.Mstb, Mstb, 1e-12);
  const mu = Math.min(1, 1.1 * 2.5 / fpd); near('(23) μ = min(1, 1.1 f_w,d/f_p,d,t) = 0.5', D.mu, mu, 1e-12); near('… 0.5', mu, 0.5, 1e-12);
  const a = H / (mu * L), K = Math.sqrt(1 + a * a + 2 * Mn / (mu * fpd * L * L)) - a; near('(21) K_i,w', D.Kiw, Math.min(1, K), 1e-12);
  near('(16) F_i,v,Rd = K_i,w f_p,d,t L', D.FvRd, Math.min(1, K) * fpd * L, 1e-12); near('racking utilisation', ck(D, 'rack').util, 6.75 / (Math.min(1, K) * fpd * L), 1e-12);
  near('(19) K_i,w f_p,d,t ≤ 8(L/H)', ck(D, 'defl').util, Math.min(1, K) * fpd / (8 * L / H), 1e-12);
  near('20.4.2 sliding: 0.4 (G L + V) + fixings L', ck(D, 'slide').util, 6.75 / (0.4 * (3 * L + 2) + 2 * L), 1e-12);
  near('Figure 3: uplift (1 − K_i,w) f_w,d L', D.uplift, (1 - Math.min(1, K)) * 2.5 * L, 1e-12);
  // leeward compression (33): wind leading 1.35G + 1.5W + 1.05Q, or imposed leading with 0.75W
  const Mb = Mtop + 6.75 * H, c = (w, gw) => { const W = w * L + 1.35 * 2, Ms = 0.5 * w * L * L + 1.35 * 2 * L; return 0.8 * W * (Mb * gw / 1.5 / Ms + 0.6 / L); };
  const Fc = Math.max(c(1.35 * 3 + 1.05 * 1.5, 1.5), c(1.35 * 3 + 1.5 * 1.5, 0.75)); near('(33) F_c,d,leewd, worse of the two', D.lee.lw.Fc, Fc, 1e-12);
  const fc = 1.1 * 17 / 1.3, lr = 2400 / (140 / Math.sqrt(12)) / Math.PI * Math.sqrt(17 / 5400), k = 0.5 * (1 + 0.2 * (lr - 0.3) + lr * lr), kc = 1 / (k + Math.sqrt(k * k - lr * lr));
  near('stud buckling k_c,y f_c,0,d A', D.lee.Nb, kc * fc * 38 * 140 / 1e3, 1e-12); near('stud bearing 1.25 f_c,90,d h (b + 30)', D.lee.Nbr, 1.25 * 1.1 * 2.2 / 1.3 * 140 * 68 / 1e3, 1e-12);
  near('(32) against 2 studs', ck(D, 'lee').util, Fc / (2 * Math.min(D.lee.Nb, D.lee.Nbr)), 1e-12);
  truth('no limits broken', !D.limits.length);
  const N2 = TR.design({ ...base, lee: { n: 2, small: true } }); truth('Note 2: two storeys or fewer, two studs: the leeward check left out', !ck(N2, 'lee') && /may be disregarded/.test(N2.steps.map(s => s.text).join(' ')));
  const N3 = TR.design({ ...base, lee: { n: 0, small: false } }); near('studs within 0.1L from the spacing', N3.lee.n, 1); }
// K_i,w clamps and μ
{ const big = TR.design({ ...base, vert: { ...base.vert, g: 30 }, base: { fwd: 10, fix: 0 } }); near('K_i,w capped at 1.0', big.Kiw, 1); truth('… and the raw value above 1', big.Kraw > 1);
  const neg = TR.design({ ...base, vert: { g: 0, V: 0, up: 0, q: 0 }, wind: { R: 2, above: [{ R: 6, H: 2.4 }], Hf: 0.3 }, base: { fwd: 0.5, fix: 5 } }); near('K_i,w clamped at 0 when M_d,stb,n is strongly negative', neg.Kiw, 0); truth('… warned', neg.warnings.some(x => /overturns/.test(x)));
  const nof = TR.design({ ...base, base: { fwd: 0, fix: 2 } }); near('μ = 0 (no withdrawal): K_i,w → M_d,stb,n/(f_p,d,t L H)', nof.Kiw, Math.min(1, nof.Mn / (nof.fpdt * 3.6 * 2.4)), 1e-12);
  const one = TR.design({ ...base, base: { fwd: 20, fix: 2 } }); near('μ capped at 1', one.mu, 1); }
// two layers and Table 7
{ const same = TR.design({ ...base, second: { mode: 'oppSame' } }); near('other face, the same: K_comb 0.75', same.fpdt, 5.5 * 1.75, 1e-12); near('(19) with (1 + K_comb)', ck(same, 'defl').util, same.Kiw * same.fpdt / (8 * 1.75 * 3.6 / 2.4), 1e-12);
  const diff = TR.design({ ...base, second: { mode: 'oppDiff', Ffd: 0.3, s: 100 } }); near('other face, different: K_comb 0.5', diff.fpdt, 5.5 + 0.5 * 1.2 * 0.3 * 1.25 / 0.1, 1e-12);
  const swap = TR.design({ ...base, second: { mode: 'sameSide', Ffd: 0.9, s: 150 } }); near('(18) the stronger layer taken first', swap.fpdt, 1.2 * 0.9 * 1.375 / 0.15 + 0.5 * 5.5, 1e-12); }
// openings
{ const o1 = TR.design({ ...base, openings: [{ w: 1.2, h: 1.05, sill: 0.9 }] }); near('(30) K_opening = 1 − 1.9 A/(HL)', o1.Kop, 1 - 1.9 * 1.26 / (2.4 * 3.6), 1e-12);
  const o2 = TR.design({ ...base, openings: [{ w: 1.5, h: 0.6, sill: 1.2 }] }); near('a shallow opening counts as 0.5 L_open²', o2.A, 0.5 * 1.5 * 1.5, 1e-12);
  const o3 = TR.design({ ...base, openings: [{ w: 0.9, h: 2.1, sill: 0 }] }); truth('a door is a racking discontinuity (20.2.2)', o3.limits.some(x => /discontinuity/.test(x)));
  const o4 = TR.design({ ...base, openings: [{ w: 0.9, h: 1.2, sill: 0.5 }] }); truth('a sill below 0.25H is a discontinuity', o4.limits.some(x => /discontinuity/.test(x))); }
// plasterboard Table 8
{ const pb = TR.design({ ...base, sheath: { kind: 'pb', pb: 'pb125x2' } }); near('Table 8: 12.5 mm both sides 2.19 kN/m', pb.fpdt, 2.19); truth('no deflection limit for plasterboard (Clause 22)', !ck(pb, 'defl'));
  truth('plasterboard: the one-third note', pb.warnings.some(x => /one-third/.test(x)));
  [['pb125', 1.27], ['pb15', 1.42], ['pb15x2', 2.49], ['sep30', 2.19]].forEach(([k, f]) => near(`Table 8: ${k}`, TR.PLASTERBOARD[k].f, f)); }
// limits of 20.1
{ const L1 = TR.design({ ...base, stud: { ...base.stud, s: 625 } }); truth('studs over 610 mm', L1.limits.some(x => /610/.test(x)));
  const L2 = TR.design({ ...base, sheath: { ...base.sheath, s: 200 } }); truth('perimeter spacing over 150 mm', L2.limits.some(x => /150 mm/.test(x)));
  const L3 = TR.design({ ...base, sheath: { kind: 'OSB/3', t: 9, fastener: { mode: 'calc', type: 'smooth', d: 3.75, len: 50 }, s: 150 } }); truth('d > 0.09 × 38 mm', L3.limits.some(x => /0\.09/.test(x)));
  const L4 = TR.design({ ...base, sheath: { ...base.sheath, t: 5 } }); truth('b_net/t > 100', L4.limits.some(x => /b_net\/t/.test(x)));
  throws('OSB/3 in service class 3', () => TR.design({ ...base, sc: 3 }), /service class 3/); near('plywood in service class 3: k_mod √(0.9 × 0.9)', TR.design({ ...base, sc: 3, sheath: { ...base.sheath, kind: 'ply' } }).fpdt, 5.5, 1e-12); }
// the suggestion
{ const B = { ...base, wind: { R: 5, above: [{ R: 4, H: 2.4 }], Hf: 0.3 }, base: { fwd: 8, fix: 4 }, lee: { n: 2, small: true } }, S = TR.suggest(B);
  truth('find the nail spacing: 125 mm passes where 150 fails', S && S.s === 125 && S.D.utilMax <= 1 && TR.design(B).utilMax > 1); }
// errors
throws('no wind', () => TR.design({ ...base, wind: { R: 0, above: [], Hf: 0 } }), /wind/);
throws('an opening above the sheathing', () => TR.design({ ...base, openings: [{ w: 1, h: 1.6, sill: 1 }] }), /above the sheathed height/);
throws('openings too large', () => TR.design({ ...base, openings: [{ w: 3.6, h: 1.4, sill: 0.7 }] }), /K_opening/);
throws('a nail shorter than the sheathing', () => TR.nail({ type: 'smooth', d: 3, len: 8 }, { kind: 'OSB/3', t: 9 }, { rhok: 310 }, 1), /longer/);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
