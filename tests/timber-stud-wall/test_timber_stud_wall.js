// Timber Stud Wall: Porteous & Kermani examples 5.7.6 (C16 studs sheathed both faces, long-term load), 5.7.7 (C18 studs with
// noggings under vertical load and wind: buckling both ways and lateral buckling) and 5.7.8 (the lateral deflection under
// wind, eq. 5.46), to the book's rounding; the sole plate bearing by A1 (the book used the 2004 rule, N/(b h) with k_c,90 = 1);
// per-metre loads, eccentricity, restraint options, the deflection by hand, sizing, warnings, errors.
const { TimberStudWall: SW } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol = 1e-9) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };
const BOOK = 0.006, ck = (D, id) => D.checks.find(c => c.id === id);

// ---------- 5.7.6: C16 44 × 100 at 600, H 3.75 m, sheathed both faces, G 0.6 + Q 2.4 kN per stud (long term), k_sys ----------
{ const D = SW.design({ mat: { family: 'solid', cls: 'C16' }, sc: 2, b: 44, h: 100, s: 600, H: 3750, restraint: 'sheathed', per: 'stud', ksys: true, loads: [{ case: 'G', V: 0.6 }, { case: 'Q', V: 2.4 }], cat: 'E', tp: 50 });
  const w = D.combos.find(r => r.c.name === '1.35G + 1.5Q');
  near('5.7.6: N_d = 4.41 kN', w.N / 1e3, 4.41, 1e-9); truth('5.7.6: long term, k_mod 0.7', w.c.kmod === 0.7); near('5.7.6: σ_c,0,d = 1.0', w.sc0, 1.0, 0.003);
  near('5.7.6: f_c,0,d = 10.07 (k_sys 1.1)', w.fc, 10.07, BOOK); near('5.7.6: λ_y = 129.9', D.BY.lam, 129.9, BOOK); near('5.7.6: λ_rel,y = 2.32', D.BY.lr, 2.32, BOOK);
  near('5.7.6: k_y = 3.39', D.BY.k, 3.39, BOOK); near('5.7.6: k_c,y = 0.17', D.BY.kc, 0.17, 0.01); near('5.7.6: 0.58', ck(D, 'cy').util, 0.584, BOOK);
  truth('5.7.6: sheathed: no buckling about z–z, no lateral buckling', D.zHeld && !ck(D, 'ltb') && /held about z–z/.test(ck(D, 'cz').name));
  // the book's bearing: N/(b h) = 1.0 against 0.7 × 2.2/1.3 = 1.18 (k_c,90 1); the tool by A1: l_ef = b + 60, k_c,90 1.25
  near('5.7.6: the book\'s f_c,90,d = 1.18 (no k_sys)', 0.7 * 2.2 / 1.3, 1.18, BOOK); near('5.7.6: A1 l_ef = 44 + 2 × 30', D.lefB, 104); near('5.7.6: A1 k_c,90 1.25', D.kc90, 1.25);
  near('5.7.6: sole plate utilisation by A1', ck(D, 'plate').util, 4410 / (100 * 104) / (1.25 * 0.7 * 2.2 / 1.3), 1e-9); }

// ---------- 5.7.7: C18 38 × 125 at 600, H 3.75 m, noggings at mid-height, G 0.5 + Q 2.0 kN per stud, wind 0.75 kN/m² ----------
{ const D = SW.design({ mat: { family: 'solid', cls: 'C18' }, sc: 2, b: 38, h: 125, s: 600, H: 3750, restraint: 'noggings', rows: 1, per: 'stud', ksys: true, loads: [{ case: 'G', V: 0.5 }, { case: 'Q', V: 2.0 }, { case: 'W', p: 0.75 }], cat: 'A', tp: 38 });
  const w = D.combos.find(r => r.c.name === '1.35G + 1.5W + 1.05Q');
  near('5.7.7: l_ef,z = 1.88 m', D.lefZ, 1875); near('5.7.7: λ_y = 103.92', D.BY.lam, 103.92, BOOK); near('5.7.7: λ_z = 170.93', D.BZ.lam, 170.93, BOOK);
  near('5.7.7: N2d = 2.77 kN', w.N / 1e3, 2.775, 1e-9); near('5.7.7: M2y,d = 1.19 kNm', w.My / 1e6, 1.19, BOOK); near('5.7.7: σ_c,0,d = 0.58', w.sc0, 0.58, 0.01);
  near('5.7.7: f_c,0,d (k_mod 1.1) = 16.75', w.fc, 16.75, BOOK); near('5.7.7: f_c,0,d (permanent) = 9.14', D.combos.find(r => r.c.name === '1.35G').fc, 9.14, BOOK);
  near('5.7.7: λ_rel,y = 1.81', D.BY.lr, 1.81, BOOK); near('5.7.7: λ_rel,z = 2.98', D.BZ.lr, 2.98, BOOK); near('5.7.7: k_z = 5.21', D.BZ.k, 5.21, BOOK); near('5.7.7: k_c,z = 0.1', D.BZ.kc, 0.105, BOOK);
  near('5.7.7: k_y = 2.29', D.BY.k, 2.29, BOOK); near('5.7.7: σ_m,y,d = 11.99', w.smy, 11.99, BOOK); near('5.7.7: f_m,y,d = 17.38', w.fmy, 17.38, BOOK);
  near('5.7.7: l_ef for lateral buckling 0.9 × L/2 + 2h = 1.94 m', D.ltb.lef, 1937.5); near('5.7.7: σ_m,crit = 27.9', D.ltb.scrit, 27.9, BOOK); near('5.7.7: λ_rel,m = 0.8', D.ltb.lam, 0.803, BOOK); near('5.7.7: k_crit = 0.96', D.ltb.k, 0.958, BOOK);
  near('5.7.7: (6.23) = 0.82', ck(D, 'cy').util, 0.82, BOOK); near('5.7.7: (6.24) = 0.81', ck(D, 'cz').util, 0.81, 0.01); near('5.7.7: (6.35) = 0.85', ck(D, 'ltb').util, 0.85, BOOK);
  truth('5.7.7: wind leading governs the stud', ck(D, 'ltb').combo === '1.35G + 1.5W + 1.05Q' && ck(D, 'cy').combo === '1.35G + 1.5W + 1.05Q');
  const b3 = D.combos.find(r => r.c.name === '1.35G + 1.5Q'); near('5.7.7: N3d = 3.67 kN', b3.N / 1e3, 3.675, 1e-9); near('5.7.7: the book\'s σ_c,90,d = N/(b h) = 0.77', b3.N / (38 * 125), 0.77, BOOK);
  near('5.7.7: f_c,90,d = 1.35', 0.8 * 2.2 / 1.3, 1.35, BOOK); truth('5.7.7: the plate governed by 1.35G + 1.5Q', ck(D, 'plate').combo === '1.35G + 1.5Q'); }

// ---------- 5.7.8: C18 44 × 100 at 600, H 2.4 m, G 0.4 + Q 1.8 kN per stud, wind 0.85 kN/m²: the lateral deflection ----------
{ const D = SW.design({ mat: { family: 'solid', cls: 'C18' }, sc: 2, b: 44, h: 100, s: 600, H: 2400, restraint: 'noggings', rows: 1, per: 'stud', ksys: true, loads: [{ case: 'G', V: 0.4 }, { case: 'Q', V: 1.8 }, { case: 'W', p: 0.85 }], cat: 'A', tp: 44, defl: { div: 300 } });
  near('5.7.8: δ₀ = L/300 = 8 mm', D.defl.d0, 8); near('5.7.8: P_E = 37.7 kN', D.defl.PE / 1e3, 37.7, BOOK); near('5.7.8: N = G + ψ₀Q = 1.66 kN', D.defl.Nc / 1e3, 1.66, 1e-9);
  near('5.7.8: δ_inst = 6.86 mm', D.defl.dinst, 6.86, BOOK); near('5.7.8: δ = 7.54 mm', D.defl.d, 7.54, BOOK); near('5.7.8: against H/300', ck(D, 'defl').util, D.defl.d / 8, 1e-12);
  const D2 = SW.design({ ...D.inp, mat: { family: 'glulam', cls: 'GL24h' } }); near('glulam: δ₀ = H/500', D2.defl.d0, 4.8); }

// ---------- by hand ----------
{ const base = { mat: { family: 'solid', cls: 'C16' }, sc: 2, b: 38, h: 140, s: 600, H: 2400, restraint: 'sheathed', per: 'm', ksys: true, loads: [{ case: 'G', V: 2.5 }, { case: 'Q', V: 3 }, { case: 'W', p: 0.9 }], cat: 'A', tp: 38, defl: { div: 300 } };
  const D = SW.design(base), w = D.combos.find(r => r.c.name === '1.35G + 1.5Q');
  near('per metre run × spacing', w.N / 1e3, (1.35 * 2.5 + 1.5 * 3) * 0.6, 1e-12); near('wind × spacing: w L²/8', D.combos.find(r => r.c.name === '1.35G + 1.5W').My / 1e6, 1.5 * 0.9 * 0.6 * 2.4 ** 2 / 8, 1e-12);
  const E = SW.design({ ...base, e: 30 }); near('eccentric vertical load: M_y adds N e', E.combos.find(r => r.c.name === '1.35G + 1.5Q').My / 1e6, w.N / 1e3 * 0.03, 1e-12);
  const N0 = SW.design({ ...base, restraint: 'none' }); near('no restraint: l_ef,z = H', N0.lefZ, 2400); near('… lateral buckling over 0.9H + 2h', N0.ltb.lef, 0.9 * 2400 + 280);
  const N2 = SW.design({ ...base, restraint: 'noggings', rows: 2 }); near('two rows: l_ef,z = H/3', N2.lefZ, 800);
  truth('k_sys over 610 mm warned', SW.design({ ...base, s: 800 }).warnings.some(x => /610/.test(x)));
  truth('wind uplift: tension in the stud', SW.design({ ...base, loads: [{ case: 'G', V: 1 }, { case: 'W', V: -4, p: 0.9 }] }).checks.some(c => /Tension/.test(c.name)));
  const Z = SW.suggest({ ...base, H: 3000 }); truth('size the studs: a passing stud', Z && Z.D.utilMax <= 1);
  truth('no deflection check without wind', !ck(SW.design({ ...base, loads: [{ case: 'G', V: 2 }] }), 'defl')); }
// ---------- errors ----------
const b0 = { mat: { family: 'solid', cls: 'C16' }, sc: 2, b: 38, h: 140, s: 600, H: 2400, restraint: 'sheathed', loads: [{ case: 'G', V: 2 }], cat: 'A', tp: 38 };
throws('spacing more than the stud', () => SW.design({ ...b0, s: 30 }), /spacing/);
throws('a height', () => SW.design({ ...b0, H: 0 }), /height/);
throws('numbers', () => SW.design({ ...b0, loads: [{ case: 'G', V: 'x' }] }), /numbers/);
throws('the Euler load', () => SW.design({ ...b0, H: 6000, b: 38, h: 63, loads: [{ case: 'G', V: 40 }, { case: 'W', p: 0.5 }], defl: { div: 300 } }), /Euler|unstable/);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
