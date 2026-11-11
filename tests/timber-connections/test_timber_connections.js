// Timber Connections: Porteous & Kermani examples 10.13.1 (a nailed timber splice, nails from both sides), 10.13.2 (a nailed
// plywood gusset), 10.13.5 (nails in withdrawal, service class 3, near saturation), 10.13.6 (coach screws through a thick
// steel plate: embedment, yield moment, the steel modes and n_ef) and 10.13.7 (the slip modulus), to the book's rounding;
// by hand: bolts in double shear at an angle (Hankinson), steel plates thin, thick and in between, the central plate, n_ef
// for nails and bolts at an angle, splitting (8.4), the spacing tables, screw withdrawal by A1, the bolt washer, the
// combined checks, the EC5 rules that stop a design, the search for the number of fasteners; errors. The book's screw
// withdrawal (EC5:2004) differs from A1, which the tool uses.
const { EC5F: F, TimberConnection: TC } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol = 1e-9) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-30); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = null; try { f(); } catch (e) { m = e.message; } const ok = m !== null && (!re || re.test(m)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${m ? ': ' + m : ''}`); if (!ok) fails++; };
const BOOK = 0.005, ck = (D, id) => D.checks.find(c => c.id === id);

// ---------- 10.13.1: C22 splice, sides 36, middle 50, 3.35 × 65 smooth nails from both sides, medium term, SC2 ----------
const E1 = { type: 'tt2', sc: 2, dur: 'medium', fast: { kind: 'nail', nail: 'smooth', d: 3.35, len: 65, fu: 600, nailing: 'both' }, m1: { cls: 'C22', t: 36 }, m2: { cls: 'C22', t: 50, h: 150 },
  layout: { n: 9, m: 1, a1: 46.9, a3: 51, end: 'loaded', a4: 17, edge: 'unloaded' }, load: { Fv: 8.625 } };
{ const D = TC.design(E1), M = D.L.modes;
  near('10.13.1: f_h,k = 19.4', D.fh2.v, 19.4, BOOK); near('10.13.1: M_y,Rk = 4.17 × 10³', D.My, 4170, BOOK);
  near('10.13.1: F_ax,Rk point = 36.88 N', D.ax.point, 36.88, BOOK); near('10.13.1: F_ax,Rk head = 651.17 N', D.ax.head, 651.17, BOOK);
  [['a', 2340], ['b', 1880], ['c', 892.71], ['d', 945.53], ['e', 812.12], ['f', 856.09]].forEach(([k, v]) => near(`10.13.1: mode (${k}) = ${v} N`, M[k], v, k === 'b' ? 0.006 : BOOK));
  truth('10.13.1: mode (e) governs', D.L.mode === 'e'); near('10.13.1: F_v,Rd = 499.77 N', D.FvRd, 499.77, BOOK);
  near('10.13.1: 9 nails each side, 8.63 kN', ck(D, 'lat').util, 8625 / (2 * 9 * D.FvRd), 1e-12); near('… n_ef = 9 at a₁ = 14d', D.nE, 9, 1e-9);
  near('10.13.1: a₁ min (5 + 5|cos α|)d = 33.5', D.SP.a1, 33.5, BOOK); near('10.13.1: a₃,t min 50.25', D.SP.a3t, 50.25, BOOK); near('10.13.1: a₄,c min 16.75', D.SP.a4c, 16.75, BOOK);
  truth('10.13.1: overlap in the middle member: 50 − 29 = 21 > 4d', !D.warnings.some(x => /overlap/.test(x)) && Math.abs(D.pen - 29) < 1e-9);
  truth('10.13.1: no rule broken', !D.limits.length); }

// ---------- 10.13.2: 12 mm birch plywood (ρ_k 630) on C18, 3.0 × 50 smooth nails, f_u 650, medium, SC2 ----------
{ const D = TC.design({ type: 'pt1', sc: 2, dur: 'medium', fast: { kind: 'nail', nail: 'smooth', d: 3, len: 50, fu: 650 }, m1: { panel: 'ply', t: 12, rhok: 630 }, m2: { cls: 'C18', t: 50 }, layout: { n: 6, m: 1, a1: 42 }, load: { Fv: 2.8 } }), M = D.L.modes;
  near('10.13.2: f_h,k timber = 18.87', D.fh2.v, 18.87, BOOK); near('10.13.2: β = 0.38', D.L.beta, 0.379, BOOK); near('10.13.2: M_y,Rk = 3.39 × 10³', D.My, 3390, BOOK);
  near('10.13.2: F_ax,Rk = 233.47 N', D.ax.F, 233.47, BOOK); near('10.13.2: head 1.27 × 10³', D.ax.head, 1266, BOOK);
  [['a', 1790], ['b', 2150], ['c', 913.27], ['e', 1020], ['f', 916.89]].forEach(([k, v]) => near(`10.13.2: mode (${k}) = ${v} N`, M[k], v, BOOK));
  near('10.13.2: mode (d) = 764 N governs', D.FvRk, 764, BOOK); truth('… mode (d)', D.L.mode === 'd'); near('10.13.2: F_v,Rd = 470.15 N', D.FvRd, 470.15, BOOK);
  near('10.13.2: a₁ min 0.85 × 10d = 25.5', D.SP.a1, 25.5, 1e-9); }

// ---------- 10.13.5: 15 mm plywood (ρ_k 550) on C18, 2.65 × 40 smooth nails, suction 600 N per m, SC3 instantaneous, × 2/3 ----------
{ const D = TC.design({ type: 'pt1', sc: 3, dur: 'instantaneous', fast: { kind: 'nail', nail: 'smooth', d: 2.65, len: 40, fu: 600, wet: true }, m1: { panel: 'ply', t: 15, rhok: 550 }, m2: { cls: 'C18', t: 47 }, layout: { n: 28, m: 1, a1: 35 }, load: { Fax: 0.6 } });
  near('10.13.5: f_ax,k = 0.49 (× 2/3, t_pen 9.43d)', D.ax.faxP * D.ax.kp, 0.49, 0.01); near('10.13.5: f_head,k = 14.12', D.ax.fhead, 14.12, BOOK);
  near('10.13.5: F_ax,Rk = 32.43 N', D.ax.F, 32.43, BOOK); near('10.13.5: k_mod √(0.9 × 0.9)', D.kmod, 0.9, 1e-12); near('10.13.5: F_ax,Rd = 22.45 N per nail', D.kmod * D.ax.F / 1.3, 22.45, BOOK);
  near('10.13.5: 28 nails take 600 N', ck(D, 'ax').util, 600 / (28 * 0.9 * D.ax.F / 1.3), 1e-12); truth('10.13.5: no lateral check without a lateral force', !ck(D, 'lat'));
  near('10.13.5: a₁ min 0.85 × 10d = 22.52', D.SP.a1, 22.52, BOOK); }

// ---------- 10.13.6: 8 mm coach screws through an 8 mm steel plate into C22 ----------
{ const fh = F.fh({ kind: 'timber', rhok: 340 }, { d: 8, dowel: true }, 0); near('10.13.6: f_h,0,k = 0.082(1 − 0.01d)ρ_k = 25.65', fh.v, 25.65, BOOK);
  near('10.13.6: M_y,Rk = 2.67 × 10⁴', F.My(400, 8), 26700, BOOK);
  const S = F.steelSingle({ fh: fh.v, t: 122, d: 8, My: F.My(400, 8), Fax: 34100 / 4, cap: 1, ts: 8, thickOK: true });   // the book's F_ax per screw, /4
  truth('10.13.6: t = d with tight holes: a thick plate', S.plate === 'thick'); near('10.13.6: mode (c) = 1.28 × 10⁴', S.modes.c, 12800, BOOK); near('10.13.6: mode (d) = 7.52 × 10³ governs', S.F, 7520, BOOK);
  near('10.13.6: mode (e) = 2.5 × 10⁴', S.modes.e, 25000, 0.002); near('10.13.6: n_ef for 2 at 80 mm = 1.75', F.nef('bolt', 2, 80, 8).v, 1.75, BOOK);
  // the tool itself, with A1 withdrawal
  const D = TC.design({ type: 'st1', sc: 2, dur: 'short', fast: { kind: 'screw', d: 8, d1: 5.6, shank: true, len: 130, fu: 400, lthread: 86.67 }, m1: { steel: true, t: 8, clear: 0 }, m2: { cls: 'C22', t: 100 }, layout: { n: 2, m: 2, a1: 80, a2: 36 }, load: { Fv: 10.61, Fax: 10.61 } });
  const fax = 0.52 * 8 ** -0.5 * 86.67 ** -0.1 * 340 ** 0.8; near('A1 (8.39) f_ax,k = 0.52 d^-0.5 l_ef^-0.1 ρ_k^0.8', D.ax.S.fax, fax, 1e-12); near('A1 (8.38) per screw, perpendicular to the grain', D.ax.S.F, fax * 8 * 86.67, 1e-12);
  near('A1 (8.41): n_ef = n^0.9 for 4 screws', ck(D, 'ax').util, 10610 / (0.9 * 4 ** 0.9 * fax * 8 * 86.67 / 1.3), 1e-12);
  truth('screws: combined by (8.28), squares', /8\.28/.test(ck(D, 'comb').ref) && Math.abs(ck(D, 'comb').util - (ck(D, 'ax').util ** 2 + ck(D, 'lat').util ** 2)) < 1e-12);
  truth('screws: rope effect up to 100 %', D.cap === 1); }

// ---------- 10.13.7: slip modulus, pre-drilled 3 mm nails, ρ_m √(380 × 460) ----------
near('10.13.7: K_ser = ρ_m^1.5 d/23 = 1.115 × 10³ N/mm', F.Kser('nail', Math.sqrt(380 * 460), 3, true, false), 1115, BOOK);
near('K_ser not pre-drilled = ρ_m^1.5 d^0.8/30', F.Kser('nail', 400, 3, false, false), 400 ** 1.5 * 3 ** 0.8 / 30, 1e-12);
near('K_ser steel to timber × 2', F.Kser('bolt', 420, 12, true, true), 2 * 420 ** 1.5 * 12 / 23, 1e-12);

// ---------- by hand: bolts ----------
{ const D = TC.design({ type: 'tt2', sc: 2, dur: 'medium', fast: { kind: 'bolt', d: 12, fu: 400 }, m1: { cls: 'C24', t: 47, alpha: 0 }, m2: { cls: 'C24', t: 75, alpha: 30, h: 200, he: 140 }, layout: { n: 3, m: 2, a1: 60, a2: 50, a3: 90, end: 'loaded', a4: 50, edge: 'loaded' }, load: { Fv: 20 } });
  const f0 = 0.082 * 0.88 * 350, k90 = 1.35 + 0.18, f30 = f0 / (k90 * 0.25 + 0.75), My = 0.3 * 400 * 12 ** 2.6, b = f30 / f0;
  near('Hankinson: f_h,30,k', D.fh2.v, f30, 1e-12); near('k_90 = 1.35 + 0.015d', D.fh2.k90, k90, 1e-12); near('f_h,0,k side', D.fh1.v, f0, 1e-12);
  const Fax = 3 * 2.5 * Math.PI / 4 * (36 * 36 - 13 * 13); near('bolt washer 3d: 3 f_c,90,k (π/4)(d_w² − (d + 1)²)', D.Fax, Fax, 1e-12);
  const g = f0 * 47 * 12, h = 0.5 * f30 * 75 * 12, Jj = 1.05 * f0 * 47 * 12 / (2 + b) * (Math.sqrt(2 * b * (1 + b) + 4 * b * (2 + b) * My / (f0 * 12 * 47 * 47)) - b), Jk = 1.15 * Math.sqrt(2 * b / (1 + b)) * Math.sqrt(2 * My * f0 * 12);
  const rp = J => J + Math.min(Fax / 4, 0.25 * J);
  near('(8.7) double shear by hand', D.FvRk, Math.min(g, h, rp(Jj), rp(Jk)), 1e-12);
  const nE = Math.min(3, 3 ** 0.9 * (60 / 156) ** 0.25), nA = nE + (3 - nE) * 30 / 90; near('(8.34) n_ef, interpolated at 30°', D.nE, nE, 1e-12);
  near('group: 2 planes × 2 rows × n_ef,α × F_v,Rd', D.FgRd, 2 * 2 * nA * 0.8 * D.FvRk / 1.3, 1e-12);
  near('(8.4) splitting: 14 b √(h_e/(1 − h_e/h))', ck(D, 'split').util, 20000 * 0.5 / (0.8 * 14 * 75 * Math.sqrt(140 / (1 - 0.7)) / 1.3), 1e-12);
  near('Table 8.4: a₁ (4 + |cos α|)d', D.SP.a1, (4 + Math.cos(Math.PI / 6)) * 12, 1e-12); near('… a₃,t max(7d, 80)', D.SP.a3t, 84, 1e-12); near('… a₄,t max((2 + 2 sin α)d, 3d)', D.SP.a4t, 36, 1e-12);
  truth('bolt spacings met', !D.limits.length); }
// steel plates
{ const fh = 20, My = 30000, d = 10, t = 60, J = { a: 0.4 * fh * t * d, b: 1.15 * Math.sqrt(2 * My * fh * d) }, K = { c: fh * t * d * (Math.sqrt(2 + 4 * My / (fh * d * t * t)) - 1), d: 2.3 * Math.sqrt(My * fh * d), e: fh * t * d };
  const thin = Math.min(...Object.values(J)), thick = Math.min(...Object.values(K));
  near('(8.9) thin plate, t ≤ 0.5d', F.steelSingle({ fh, t, d, My, ts: 4, thickOK: true }).F, thin, 1e-12);
  near('(8.10) thick plate, t ≥ d', F.steelSingle({ fh, t, d, My, ts: 10, thickOK: true }).F, thick, 1e-12);
  near('8.2.3: 0.75d interpolated halfway', F.steelSingle({ fh, t, d, My, ts: 7.5, thickOK: true }).F, (thin + thick) / 2, 1e-12);
  near('loose holes: thin', F.steelSingle({ fh, t, d, My, ts: 12, thickOK: false }).F, thin, 1e-12);
  near('(8.11) central plate', F.steelCentral({ fh, t, d, My }).F, Math.min(fh * t * d, fh * t * d * (Math.sqrt(2 + 4 * My / (fh * d * t * t)) - 1), 2.3 * Math.sqrt(My * fh * d)), 1e-12);
  near('(8.12) thin outer plates', F.steelOuter({ fh, t, d, My, ts: 3, thickOK: true }).F, Math.min(0.5 * fh * t * d, 1.15 * Math.sqrt(2 * My * fh * d)), 1e-12);
  near('(8.13) thick outer plates', F.steelOuter({ fh, t, d, My, ts: 12, thickOK: true }).F, Math.min(0.5 * fh * t * d, 2.3 * Math.sqrt(My * fh * d)), 1e-12);
  const D = TC.design({ type: 'st3', sc: 1, dur: 'medium', fast: { kind: 'dowel', d: 12, fu: 360 }, m1: { steel: true, t: 10 }, m2: { cls: 'GL24h', family: 'glulam', t: 70 }, layout: { n: 4, m: 2, a1: 72, a2: 40, a3: 90, end: 'loaded' }, load: { Fv: 60 } });
  truth('slotted plate: dowels, 2 planes, no rope effect', D.nsp === 2 && D.cap === 0 && D.L.mode && /8\.11/.test(D.steps.map(s => s.ref).join(' ')));
  near('dowels n_ef (8.34)', D.nE, Math.min(4, 4 ** 0.9 * (72 / 156) ** 0.25), 1e-12); near('Table 8.5: dowel a₁ (3 + 2|cos α|)d', D.SP.a1, 60, 1e-12); }
// nails at an angle: the components along and across the grain
{ const D = TC.design({ type: 'tt1', sc: 1, dur: 'short', fast: { kind: 'nail', nail: 'smooth', d: 4, len: 90 }, m1: { cls: 'C16', t: 38 }, m2: { cls: 'C16', t: 75, alpha: 60, h: 150, he: 110 }, layout: { n: 5, m: 2, a1: 40, a2: 30 }, load: { Fv: 6 } });
  const nE = 5 ** F.kef(10), R0 = 2 * nE * D.FvRd, R90 = 2 * 5 * D.FvRd; near('k_ef 0.85 at 10d (Table 8.1)', F.kef(10), 0.85, 1e-12); near('k_ef interpolated at 11d', F.kef(11), 0.8875, 1e-12);
  near('nails at 60°: max(F cos α/(m n_ef F_v,Rd), F sin α/(m n F_v,Rd))', ck(D, 'lat').util, Math.max(6000 * 0.5 / R0, 6000 * Math.sin(Math.PI / 3) / R90), 1e-12);
  near('nail embedment does not follow the angle', D.fh2.v, 0.082 * 310 * 4 ** -0.3, 1e-12); }
// spacing tables for nails
{ const s1 = F.spacing('nail', 4, 350, { alpha: 0, predrilled: true }); near('Table 8.2 pre-drilled a₁ (4 + |cos α|)d', s1.a1, 20, 1e-12); near('… a₃,t (7 + 5cos α)d', s1.a3t, 48, 1e-12);
  const s2 = F.spacing('nail', 5, 450, { alpha: 90 }); near('Table 8.2 420 < ρ_k ≤ 500, a₄,t (7 + 5 sin α)d for d ≥ 5', s2.a4t, 60, 1e-12); near('… a₂ 7d', s2.a2, 35, 1e-12);
  const s3 = F.spacing('nail', 3, 350, { alpha: 0, steel: true }); near('steel to timber: a₁ × 0.7', s3.a1, 0.7 * 30, 1e-12);
  const s4 = F.spacing('bolt', 16, 350, { alpha: 90 }); near('Table 8.4 unloaded end at 90°: (1 + 6 sin α)d', s4.a3c, 112, 1e-12); }
// withdrawal and combinations
{ const ax = F.nailAx({ type: 'ring', d: 3, tp: 21, th: 18, rhoP: 350, rhoH: 350, dh: 6.75 }); near('ring-shank 6d–8d: × (t_pen/2d − 3)', ax.kp, 21 / 6 - 3, 1e-12); near('ring-shank head: f_head,k d_h² only (8.23)', ax.head, 70e-6 * 350 * 350 * 6.75 ** 2, 1e-12);
  const base = { type: 'tt1', sc: 2, dur: 'short', fast: { kind: 'nail', nail: 'smooth', d: 3.75, len: 90 }, m1: { cls: 'C24', t: 38 }, m2: { cls: 'C24', t: 75 }, layout: { n: 4, m: 1, a1: 60 }, load: { Fv: 2, Fax: 0.3 } };
  const D = TC.design(base); truth('smooth nails: (8.27), linear', /8\.27/.test(ck(D, 'comb').ref) && Math.abs(ck(D, 'comb').util - ck(D, 'ax').util - ck(D, 'lat').util) < 1e-12);
  const Dr = TC.design({ ...base, fast: { ...base.fast, nail: 'ring' } }); truth('ring-shank nails: (8.28), squares', /8\.28/.test(ck(Dr, 'comb').ref));
  truth('smooth nails in long-term withdrawal: warned', TC.design({ ...base, dur: 'long' }).warnings.some(x => /permanent or long-term/.test(x))); }
// rules that stop a design
{ const b = { type: 'tt1', sc: 1, dur: 'medium', fast: { kind: 'nail', nail: 'smooth', d: 3.1, len: 50 }, m1: { cls: 'C16', t: 38 }, m2: { cls: 'C16', t: 47 }, layout: { n: 1, m: 1 }, load: { Fv: 0.5 } };
  truth('penetration under 8d', TC.design({ ...b, fast: { ...b.fast, len: 65 } }).limits.length === 0 && TC.design({ ...b, fast: { ...b.fast, len: 65 }, m1: { cls: 'C16', t: 42 } }).limits.some(x => /8d/.test(x)));
  truth('hardwood (ρ_k > 500) must be pre-drilled', TC.design({ ...b, m2: { family: 'hard', cls: 'D30', t: 47 } }).limits.some(x => /pre-drilled/.test(x)));
  truth('nails over 6 mm must be pre-drilled', TC.design({ ...b, fast: { ...b.fast, d: 7, len: 150 }, m2: { cls: 'C16', t: 100 } }).limits.some(x => /over 6 mm/.test(x)));
  truth('a₁ below the minimum', TC.design({ ...b, layout: { n: 3, m: 1, a1: 20 } }).limits.some(x => /a₁/.test(x)));
  truth('8.18: thin timber without pre-drilling warned', TC.design({ ...b, fast: { ...b.fast, d: 4, len: 70 }, m1: { cls: 'C16', t: 25 } }).warnings.some(x => /8\.18/.test(x))); }
// the search
{ const S = TC.suggest({ ...E1, layout: { ...E1.layout, n: 1 } }); truth('find the number of nails: 9 a side, as the book', S && S.n === 9 && S.m === 1); }
// errors
throws('a slotted plate with nails', () => TC.design({ ...E1, type: 'st3', m1: { steel: true, t: 8 } }), /bolts or dowels/);
throws('axial on a double-shear joint', () => TC.design({ ...E1, load: { Fv: 1, Fax: 1 } }), /single-shear/);
throws('dowels in withdrawal', () => TC.design({ type: 'tt1', sc: 1, dur: 'medium', fast: { kind: 'dowel', d: 12 }, m1: { cls: 'C24', t: 60 }, m2: { cls: 'C24', t: 60 }, layout: { n: 1, m: 1 }, load: { Fax: 1 } }), /Dowels/);
throws('no force', () => TC.design({ ...E1, load: {} }), /design force/);
throws('a nail shorter than the side member', () => TC.design({ ...E1, fast: { ...E1.fast, len: 30 } }), /shorter/);
console.log(`\n${n - fails}/${n} passed`); if (fails) process.exit(1);
