// Timber Beam: the EN 338:2016 and EN 14080 values, k_mod, k_def, k_h, k_crit and k_c,90; the ULS combinations with their
// k_mod (P&K example 4.8.1: wind uplift on an office beam); P&K 4.8.2 (a notched 63 × 225 C24 joist), 4.8.3 (a Kerto-S
// beam under a point load, lateral buckling) and 4.8.4 (floor vibration, UK NA); Luke's spreadsheet (a D40 100 × 250 joist,
// stresses and deflections); deflection, self-weight, plies, restraint and bearing against hand calculation; input errors.
// The book (2007) used the 2003 EN 338 (f_v,k 2.5 for C24) and no k_cr; the tool follows EN 338:2016 and A1, so where
// those differ the test checks the tool's own arithmetic and says so.
const { EC5, TimberBeam: TB } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol = 1e-9) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };
const KAPPA = 5 / 6, BOOK = 0.005;   // book values to their printed rounding (about 0.5 %)
const udlDefl = (w, L, EI, GA) => 5 * w * L ** 4 / (384 * EI) + w * L * L / (8 * KAPPA * GA);

// ---------- materials ----------
{ const M = EC5.material({ family: 'solid', cls: 'C24' });
  [['f_m,k', M.fmk, 24], ['f_v,k', M.fvk, 4.0], ['f_c,90,k', M.fc90k, 2.5], ['E_0,mean', M.E0mean, 11000], ['E_0,05', M.E005, 7400], ['G_mean', M.Gmean, 690], ['ρ_k', M.rhok, 350], ['ρ_mean', M.rhomean, 420], ['γ_M', M.gM, 1.3], ['k_cr', M.kcr, 0.67]].forEach(([k, g, e]) => near(`C24 ${k}`, g, e)); }
{ const M = EC5.material({ family: 'solid', cls: 'C16' }); near('C16 f_m,k', M.fmk, 16); near('C16 E_0,mean', M.E0mean, 8000); near('C16 f_v,k', M.fvk, 3.2); }
{ const M = EC5.material({ family: 'hard', cls: 'D40' }); near('D40 f_m,k', M.fmk, 40); near('D40 E_0,mean', M.E0mean, 13000); truth('hardwood: not softwood', !M.softwood); }
{ const M = EC5.material({ family: 'glulam', cls: 'GL24h' }); near('GL24h f_m,k', M.fmk, 24); near('GL24h E_0,mean', M.E0mean, 11500); near('GL24h E_0,05', M.E005, 9600); near('GL24h f_v,k', M.fvk, 3.5); near('GL24h γ_M', M.gM, 1.25); }
truth('the class lists', EC5.CLASSES.solid.includes('C24') && EC5.CLASSES.hard.includes('D30') && EC5.CLASSES.glulam.includes('GL28c') && !EC5.CLASSES.glulam.includes('GL26h'));
throws('a product needs its values', () => EC5.material({ family: 'other', props: { name: 'x' } }), /f_m,k/);
// ---------- factors ----------
near('k_mod SC1 medium', EC5.kmod(1, 'medium'), 0.8); near('k_mod SC1 instantaneous', EC5.kmod(1, 'instantaneous'), 1.1); near('k_mod SC3 short', EC5.kmod(3, 'short'), 0.7); near('k_mod SC2 permanent', EC5.kmod(2, 'permanent'), 0.6);
near('k_def SC1', EC5.kdef(1), 0.6); near('k_def SC2', EC5.kdef(2), 0.8); near('k_def SC3', EC5.kdef(3), 2.0);
{ const C = EC5.material({ family: 'solid', cls: 'C24' }), G = EC5.material({ family: 'glulam', cls: 'GL24h' }), L = EC5.material({ family: 'other', props: { name: 'LVL', fmk: 44, fvk: 4.1, fc90k: 6, E0mean: 13800, E005: 11600, Gmean: 600, G005: 400, rhomean: 510, gM: 1.2, s: 0.12 } });
  near('k_h solid 100 mm', EC5.kh(C, 100), 1.5 ** 0.2); near('k_h solid 30 mm: capped 1.3', EC5.kh(C, 30), 1.3); near('k_h solid 150 mm', EC5.kh(C, 150), 1);
  near('k_h glulam 300 mm', EC5.kh(G, 300), 2 ** 0.1); near('k_h glulam 100 mm: capped 1.1', EC5.kh(G, 100), 1.1); near('k_h LVL 200 mm', EC5.kh(L, 200), 1.5 ** 0.12);
  // k_crit (6.3.3, equations 6.32 to 6.34) from σ_m,crit = 0.78 b² E_0,05/(h l_ef)
  const kc = (b, h, lef) => EC5.kcrit(C, b, h, lef);
  { const r = kc(47, 200, 3000), s = 0.78 * 47 * 47 * 7400 / (200 * 3000), lam = Math.sqrt(24 / s); near('σ_m,crit', r.scrit, s); near('λ_rel,m', r.lam, lam); near('k_crit 0.75 < λ ≤ 1.4', r.k, 1.56 - 0.75 * lam); }
  { const r = kc(38, 225, 6000); near('k_crit λ > 1.4: 1/λ²', r.k, 1 / r.lam ** 2); truth('… with λ > 1.4', r.lam > 1.4); }
  near('k_crit λ ≤ 0.75: 1', kc(100, 150, 1000).k, 1);
  // k_c,90 (6.1.5, A1)
  { const B = EC5.bearing(C, 100, 200, 3800, 0); near('bearing: solid softwood, l₁ ≥ 2h: k_c,90', B.k, 1.5); near('… l_ef = l + 30 inward only', B.lef, 130); }
  { const B = EC5.bearing(C, 100, 200, 3800, 20); near('… with 20 mm beyond the bearing', B.lef, 150); }
  { const B = EC5.bearing(C, 100, 200, 300, 0); near('l₁ < 2h: k_c,90 = 1', B.k, 1); }
  { const B = EC5.bearing(G, 150, 400, 5000, 0); near('glulam, l ≤ 400: k_c,90', B.k, 1.75); }
  { const B = EC5.bearing(EC5.material({ family: 'hard', cls: 'D40' }), 100, 200, 3800, 0); near('hardwood: k_c,90', B.k, 1); }
}
// ---------- combinations ----------
{ const C = EC5.combinations([{ key: 'Q', cat: 'A' }, { key: 'S', cat: 'S' }], { sc: 1 }), by = nm => C.find(c => c.name === nm);
  truth('6.10: named by their factors', ['1.35G', '1.35G + 1.5Q', '1.35G + 1.5S', '1.35G + 1.5Q + 0.75S', '1.35G + 1.5S + 1.05Q'].every(by));
  near('1.35G: k_mod permanent', by('1.35G').kmod, 0.6); near('1.35G + 1.5Q: k_mod medium', by('1.35G + 1.5Q').kmod, 0.8); near('with snow: k_mod short', by('1.35G + 1.5Q + 0.75S').kmod, 0.9);
  near('ψ₀ for snow 0.5', by('1.35G + 1.5Q + 0.75S').gQ.S, 0.75); near('ψ₀ for domestic 0.7', by('1.35G + 1.5S + 1.05Q').gQ.Q, 1.05); }
{ const C = EC5.combinations([{ key: 'Q', cat: 'A' }, { key: 'S', cat: 'S' }], { sc: 1, combo: '6.10ab' }), nm = C.map(c => c.name);
  truth('6.10a/b', nm.includes('1.35G + 1.05Q + 0.75S (6.10a)') && nm.includes('1.25G + 1.5Q + 0.75S (6.10b)') && nm.includes('1.25G + 1.5S + 1.05Q (6.10b)'));
  near('6.10b: ξ γ_G', C.find(c => c.name === '1.25G + 1.5Q (6.10b)').gG, 0.925 * 1.35); }
{ const C = EC5.combinations([{ key: 'Q', cat: 'E' }], { sc: 2 }); near('storage: long term', C.find(c => c.name === '1.35G + 1.5Q').kmod, 0.7); }
{ const C = EC5.combinations([{ key: 'Q', cat: 'H' }], { sc: 3 }); near('roof imposed, SC3: short term', C.find(c => c.name === '1.35G + 1.5Q').kmod, 0.7); }

// ---------- P&K 4.8.1: an office beam, G 0.6, Q 1.2 (medium) down, wind 0.6 up ----------
{ const L0 = 3000, D = TB.design({ mat: { family: 'solid', cls: 'C24' }, sc: 1, b: 63, h: 200, clear: L0 - 100, lb: 100, sw: false, cat: 'B', restraint: { mode: 'top' },
    loads: [{ case: 'G', form: 'line', w: 0.6 }, { case: 'Q', form: 'line', w: 1.2 }, { case: 'W', form: 'line', w: 0.6, up: true }] });
  const nm = D.combos.map(r => r.c.name), w = r => 8 * (r.Msag - r.Mhog) / L0 ** 2;
  truth('4.8.1: an upward action is not combined with a downward one', !nm.some(x => /Q/.test(x) && /W/.test(x)));
  const down = D.combos.reduce((p, r) => (r.Msag / r.c.kmod > p.Msag / p.c.kmod ? r : p)), up = D.combos.reduce((p, r) => (r.Mhog > p.Mhog ? r : p));
  truth('4.8.1 (b)(i): 1.35G + 1.5Q at k_mod,med governs downward', down.c.name === '1.35G + 1.5Q' && down.c.kmod === 0.8);
  near('4.8.1: DL1d = 2.61 kN/m', w(down), 2.61, 1e-6); near('4.8.1: STR1d = DL1d/k_mod = 3.26', w(down) / 0.8, 3.26, BOOK);
  truth('4.8.1 (b)(ii): 1.0G + 1.5W at k_mod,inst under reversal', up.c.name === '1.0G + 1.5W' && up.c.kmod === 1.1);
  near('4.8.1: DL2d = −0.3 kN/m', w(up), -0.3, 1e-6);
  truth('4.8.1: the uplift is reported', D.warnings.some(x => /uplift/.test(x) && /0\.45 kN/.test(x)));
  truth('4.8.1: reversal brings the bottom edge into compression: lateral buckling checked', !!D.ltb.hog && /6\.3\.3/.test(D.checks[0].ref) === (D.govern.B.Mhog > D.govern.B.Msag));
  // (c) the instantaneous deflection from G + Q1 = 1.8 kN/m
  const M = D.M, EI = M.E0mean * D.I, GA = M.Gmean * D.b * D.h;
  near('4.8.1 (c): w_inst from G + Q = 1.8 kN/m', D.D.inst, udlDefl(1.8, L0, EI, GA), 1e-4);
}

// ---------- P&K 4.8.2: 63 × 225 C24, SC2, L 3185, G 1.0 kN/m + 1.0 kN central, Q 2.5 kN/m, notched 15 × 150 ----------
{ const D = TB.design({ mat: { family: 'solid', cls: 'C24' }, sc: 2, b: 63, h: 225, clear: 3100, lb: 85, cat: 'A', restraint: { mode: 'top' }, notch: { hn: 15, x: 150 }, defl: { inst: 300, ceiling: false },
    loads: [{ case: 'G', form: 'line', w: 1.0 }, { case: 'G', form: 'point', w: 1.0, a: 3.185 / 2 }, { case: 'Q', form: 'line', w: 2.5 }] });
  const B = D.govern.B, S = D.govern.S;
  near('4.8.2: self-weight 0.06 kN/m', 420 * 9.81 * 63 * 225 * 1e-9, 0.058, 0.01);
  near('4.8.2: M_d = 7.64 kNm', B.Msag / 1e6, 7.64, BOOK); near('4.8.2: σ_m,d = 14.38', B.Msag / D.W, 14.38, BOOK); near('4.8.2: f_m,d = 14.77', B.fmd, 14.77, BOOK);
  truth('4.8.2: 1.35G + 1.5Q at k_mod 0.8 governs', B.c.name === '1.35G + 1.5Q' && B.c.kmod === 0.8);
  near('4.8.2: V_d = 8.92 kN', S.Vm / 1e3, 8.92, BOOK); near('4.8.2: k_v = 0.68', D.kv, 0.683, BOOK); near('4.8.2: h_ef = 210', D.hef, 210);
  // the book's shear: τ = 1.5V/(b h_ef) with f_v,k 2.5 (EN 338:2003); the tool: k_cr 0.67 and f_v,k 4.0 (EN 338:2016)
  near('4.8.2: τ_d by the tool (k_cr)', S.tau, 1.5 * S.Vm / (0.67 * 63 * 210), 1e-12); near('4.8.2: f_v,d = 0.8 × 4.0/1.3', S.fvd, 0.8 * 4 / 1.3, 1e-12);
  near('4.8.2: u_inst,G = 3.44 mm', D.D.uG, 3.44, BOOK); near('4.8.2: u_inst,Q = 5.48 mm', D.D.uQ.Q, 5.48, BOOK);
  near('4.8.2: w_inst = 8.92 mm', D.D.inst, 8.92, BOOK); near('4.8.2: w_net,fin = 12.99 mm (k_def 0.8, ψ₂ 0.3)', D.D.fin, 12.99, BOOK);
  near('4.8.2: w_net,fin = u_G(1 + k_def) + u_Q(1 + ψ₂ k_def)', D.D.fin, D.D.uG * 1.8 + D.D.uQ.Q * 1.24, 1e-9);
  near('4.8.2: no ceiling: L/150', D.D.finDiv, 150);
}

// ---------- P&K 4.8.3: Kerto-S 75 × 300, L 5100, point G 5.25 + Q 7.35 kN at midspan, l_ef = 0.8L + 2h (book: 0.28L … as given) ----------
{ const D = TB.design({ mat: { family: 'other', props: { name: 'Kerto-S', fmk: 44, fvk: 4.1, fc90k: 6.0, E0mean: 13800, E005: 11600, Gmean: 600, G005: 400, rhomean: 510, gM: 1.2, kcr: 1, s: 0.12 } }, sc: 1, b: 75, h: 300, clear: 5000, lb: 100,
    loads: [{ case: 'G', form: 'point', w: 5.25, a: 2.55 }, { case: 'Q', form: 'point', w: 7.35, a: 2.55 }], cat: 'B', restraint: { mode: 'lef', lef: 0.28 * 5100 + 600 } });
  near('4.8.3: M_d = 23.59 kNm', D.govern.B.Msag / 1e6, 23.59, BOOK); near('4.8.3: σ_m,crit = 57.43', D.ltb.sag.scrit, 57.43, BOOK);
  near('4.8.3: λ_rel,m = 0.875', D.ltb.sag.lam, 0.875, BOOK); near('4.8.3: k_crit = 0.904', D.ltb.sag.k, 0.904, BOOK);
  near('4.8.3: τ_d = 0.63', D.govern.S.tau, 0.63, BOOK); near('4.8.3: f_v,d = 2.73', D.govern.S.fvd, 2.73, BOOK); near('4.8.3: k_h = (300/300)^0.12 = 1', D.kh, 1);
  truth('4.8.3: product bearing k_c,90 = 1', D.BRG.k === 1);
}
// with one central point load held at the supports only, l_ef = 0.8L + 2h for a load on the top edge
{ const D = TB.design({ mat: { family: 'solid', cls: 'C24' }, sc: 1, b: 75, h: 300, clear: 5000, lb: 100, sw: false, cat: 'B', restraint: { mode: 'ends', level: 'top' },
    loads: [{ case: 'G', form: 'point', w: 5, a: 2.55 }] });
  near('central point, top edge: l_ef = 0.8L + 2h', D.ltb.sag.scrit, 0.78 * 75 * 75 * 7400 / (300 * (0.8 * 5100 + 600)), 1e-12); }
{ const D = TB.design({ mat: { family: 'solid', cls: 'C24' }, sc: 1, b: 47, h: 225, clear: 4000, lb: 100, cat: 'A', restraint: { mode: 'ends', level: 'bottom' }, loads: [{ case: 'G', form: 'line', w: 1 }] });
  near('UDL, bottom edge: l_ef = 0.9L − 0.5h', D.ltb.sag.scrit, 0.78 * 47 * 47 * 7400 / (225 * (0.9 * 4100 - 112.5)), 1e-12); truth('… and bending takes k_crit', /k_crit f_m,d/.test(D.checks[0].note)); }
{ const D = TB.design({ mat: { family: 'solid', cls: 'C24' }, sc: 1, b: 47, h: 225, clear: 4000, lb: 100, cat: 'A', restraint: { mode: 'both' }, loads: [{ case: 'G', form: 'line', w: 1 }] });
  truth('both edges held: no lateral buckling', !D.ltb.sag && !D.ltb.hog && !/k_crit/.test(D.checks[0].note)); }

// ---------- P&K 4.8.4: floor vibration, 47 × 200 C18 at 400, L 3750, m 35 kg/m², B 4 m, 18 mm OSB/3 E 4930 ----------
{ const D = TB.design({ mat: { family: 'solid', cls: 'C18' }, sc: 1, b: 47, h: 200, clear: 3700, lb: 50, spacing: 400, cat: 'A', loads: [{ case: 'G', form: 'area', w: 0.35 }, { case: 'Q', form: 'area', w: 1.5 }],
    vib: { m: 35, B: 4, tdeck: 18, Edeck: 4930, kamp: 1.05 } }), V = D.V;
  near('4.8.4: f₁ = 15.85 Hz', V.f1, 15.85, BOOK); near('4.8.4: k_dist = 0.358', V.kdist, 0.358, BOOK); near('4.8.4: a = 1.466 mm/kN', V.a, 1.466, BOOK);
  near('4.8.4: b = 101.36', V.bb, 101.36, BOOK); near('4.8.4: v limit = 0.0427', V.vlim, 0.0427, BOOK); near('4.8.4: n₄₀ = 6.72', V.n40, 6.72, BOOK); near('4.8.4: v = 0.0245', V.vel, 0.0245, BOOK);
  near('4.8.4: a limit 1.8 mm (L ≤ 4 m)', V.alim, 1.8);
  truth('4.8.4: three vibration checks', ['f1', 'a', 'v'].every(id => D.checks.some(c => c.id === id)));
  const Ds = TB.design({ ...D.inp, vib: { ...D.inp.vib, strut: true } }); near('strutting: k_dist × 0.97 (above 0.30)', Ds.V.kdist, Math.max(0.97 * V.kdist, 0.3), 1e-12);
  const Dl = TB.design({ ...D.inp, clear: 4500 }); near('L > 4 m: a limit 16 500/L^1.1', Dl.V.alim, 16500 / 4550 ** 1.1, 1e-12);
}

// ---------- Luke's spreadsheet: D40 100 × 250 at 610, L 6150, G 0.62 kN/m² + 0.225 kN/m, Q 3.0 kN/m² (ψ₂ 0.6), k_sys ----------
{ const D = TB.design({ mat: { family: 'hard', cls: 'D40' }, sc: 1, b: 100, h: 250, clear: 6050, lb: 100, spacing: 610, ksys: true, sw: false, cat: 'C', defl: { inst: 300, ceiling: true },
    loads: [{ case: 'G', form: 'area', w: 0.62 }, { case: 'G', form: 'line', w: 0.225 }, { case: 'Q', form: 'area', w: 3.0 }] });
  near('sheet: σ_m,d = 16.15', D.govern.B.Msag / D.W, 16.15, BOOK); near('sheet: τ_d = 0.98', D.govern.S.tau, 0.98, BOOK);
  near('sheet: u_G = 6.81 mm', D.D.uG, 6.81, BOOK); near('sheet: u_Q = 20.65 mm', D.D.uQ.Q, 20.65, BOOK);
  near('sheet: w_inst = 27.46 mm', D.D.inst, 27.46, BOOK); near('sheet: w_net,fin = 38.98 mm', D.D.fin, 38.98, BOOK);
  truth('sheet: fails net final deflection against L/250', D.checks.find(c => c.id === 'wfin').util > 1 && D.D.finDiv === 250);
  near('k_sys 1.1 on f_m,d (k_mod 0.8)', D.govern.B.fmd, 0.8 * 1.1 * 40 / 1.3, 1e-12);
}

// ---------- hand calculations ----------
{ // a UDL and self-weight, deflection with bending and shear, bearing
  const inp = { mat: { family: 'solid', cls: 'C24' }, sc: 1, b: 47, h: 200, clear: 3700, lb: 100, spacing: 400, ksys: true, cat: 'A', loads: [{ case: 'G', form: 'area', w: 0.35 }, { case: 'Q', form: 'area', w: 1.5 }] };
  const D = TB.design(inp), L = 3800, sw = 420 * 9.81 * 47 * 200 * 1e-9, g = 0.35 * 0.4 + sw, q = 1.5 * 0.4, wd = 1.35 * g + 1.5 * q;
  near('L = clear + bearing', D.L, L); near('M = w L²/8', D.govern.B.Msag, wd * L * L / 8, 1e-5); near('V = w L/2', D.govern.S.Vm, wd * L / 2, 1e-9);
  near('bearing σ = R/(b l_ef)', D.govern.Br.sc90, wd * L / 2 / (47 * 130), 1e-9);
  const EI = 11000 * 47 * 200 ** 3 / 12, GA = 690 * 47 * 200;
  near('u_G (bending + shear)', D.D.uG, udlDefl(g, L, EI, GA), 1e-4); near('w_net,fin = u_G 1.6 + u_Q (1 + 0.3 × 0.6)', D.D.fin, udlDefl(g, L, EI, GA) * 1.6 + udlDefl(q, L, EI, GA) * 1.18, 1e-4);
  const D2 = TB.design({ ...inp, n: 2 }); near('two plies: twice the breadth', D2.b, 94); near('… half the bending stress', D2.govern.B.Msag / D2.W, (wd + 1.35 * sw) * L * L / 8 / (94 * 200 * 200 / 6), 1e-5);
  const D3 = TB.design({ ...inp, sw: false }); near('without self-weight', D3.govern.B.Msag, (1.35 * 0.14 + 1.5 * q) * L * L / 8, 1e-5);
  // snow and imposed together: each leading, k_mod short for the pair
  const D4 = TB.design({ ...inp, loads: [...inp.loads, { case: 'S', form: 'line', w: 0.5 }] });
  truth('Q and S: four variable combinations with k_mod', ['1.35G + 1.5Q', '1.35G + 1.5S', '1.35G + 1.5Q + 0.75S', '1.35G + 1.5S + 1.05Q'].every(x => D4.combos.some(r => r.c.name === x && r.c.kmod === (x === '1.35G + 1.5Q' ? 0.8 : 0.9))));
  const ug = udlDefl(g, L, EI, GA), uq = udlDefl(q, L, EI, GA), us = udlDefl(0.5, L, EI, GA);
  near('w_net,fin with two variable actions: worst leading', D4.D.fin, Math.max(ug * 1.6 + uq * 1.18 + us * 0.5, ug * 1.6 + us * 1 + uq * (0.7 + 0.18)), 1e-4);
  near('w_inst: worst leading', D4.D.inst, Math.max(ug + uq + 0.5 * us, ug + us + 0.7 * uq), 1e-4);
  // a partial load and a point load: reactions by statics
  const D5 = TB.design({ ...inp, sw: false, loads: [{ case: 'G', form: 'partial', w: 2, a: 1, b: 2 }, { case: 'G', form: 'point', w: 3, a: 3 }] }), E = D5.defs.G.E;
  near('partial + point: R_B by moments', E.RB, (2 * 1000 * 1500 + 3000 * 3000) / L, 1e-12); near('… R_A', E.RA, 2000 + 3000 - (2 * 1000 * 1500 + 3000 * 3000) / L, 1e-12);
  // the notch factor (6.5.2, equation 6.62)
  const D6 = TB.design({ ...inp, notch: { hn: 50, x: 100 } }), a = 150 / 200;
  near('notch k_v', D6.kv, Math.min(1, 5 / (Math.sqrt(200) * (Math.sqrt(a * (1 - a)) + 0.8 * 100 / 200 * Math.sqrt(1 / a - a * a)))), 1e-12);
  truth('notch: the shear check named', D6.checks.some(c => c.name === 'Shear at the notched end'));
  // suggest: the smallest depth that passes
  const S = TB.suggest({ ...inp, clear: 4500 }); truth('suggest: a passing size', S && S.D.utilMax <= 1 && S.b === 47);
  truth('… the next depth down fails', TB.design({ ...inp, clear: 4500, h: S.h - 25 }).utilMax > 1);
  // a glulam beam: k_h, γ_M and k_sys
  const Dg = TB.design({ ...inp, mat: { family: 'glulam', cls: 'GL28h' }, b: 90, h: 315, ksys: false });
  near('glulam: f_m,d = k_mod k_h f_m,k/γ_M', Dg.govern.B.fmd, Dg.govern.B.c.kmod * (600 / 315) ** 0.1 * 28 / 1.25, 1e-9);
  // service class 3
  const D7 = TB.design({ ...inp, sc: 3 }); near('SC3: k_def 2.0', D7.kdef, 2); truth('SC3: k_mod 0.65 for medium term', D7.combos.some(r => r.c.name === '1.35G + 1.5Q' && r.c.kmod === 0.65));
}
// ---------- input errors ----------
const base = { mat: { family: 'solid', cls: 'C24' }, sc: 1, b: 47, h: 200, clear: 3700, lb: 100, spacing: 400, cat: 'A', loads: [{ case: 'G', form: 'area', w: 0.35 }] };
throws('area loads need the spacing', () => TB.design({ ...base, spacing: 0 }), /spacing/);
throws('a notch must leave more than half the depth', () => TB.design({ ...base, notch: { hn: 110, x: 100 } }), /half the depth/);
throws('a point load within the span', () => TB.design({ ...base, loads: [{ case: 'G', form: 'point', w: 1, a: 9 }] }), /within the span/);
throws('a partial load must end after it starts', () => TB.design({ ...base, loads: [{ case: 'G', form: 'partial', w: 1, a: 2, b: 1 }] }), /end after it starts/);
throws('a depth is needed', () => TB.design({ ...base, h: 0 }), /depth h/);
throws('the service class', () => TB.design({ ...base, sc: 4 }), /service class/);
throws('l_ef given must be positive', () => TB.design({ ...base, restraint: { mode: 'lef', lef: 0 } }), /l_ef/);

console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
