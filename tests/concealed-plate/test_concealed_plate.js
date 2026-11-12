// Concealed Plate Glulam Connections. Porteous & Kermani, Structural Timber Design to Eurocode 5 (1st ed.), Example 12.8.1
// (a bolted moment connection, 12 mm steel plates on the faces of 72 × 294 C24, M12 bolts: the group forces, the angle,
// f_h,α,k, M_y,Rk, F_ax,Rk, F_v,Rk and F_v,Rd per plane, n_ef and the row's capacity); the slotted-in arrangements restated
// by hand from BS EN 1995-1-1 Section 8 and Annex A and BS EN 1993-1-8; the group's statics; errors.
const { GlulamPlate: GP } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol, abs = 0) => { n++; const ok = Math.abs(got - exp) <= Math.max(tol * Math.abs(exp), abs); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; return ok; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, f, re) => { n++; let m = ''; try { f(); } catch (e) { m = e.message; } const ok = re.test(m); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ': ' + (m || 'no error')}`); if (!ok) fails++; };
const ck = (D, id) => (D.checks.find(c => c.id === id) || {}).util;

// ---------- 1. P&K Example 12.8.1 ----------
{ const D = GP.design({ mat: { family: 'solid', cls: 'C24' }, sc: 2, b: 72, h: 294, dur: 'short', plates: { arr: 'outside', ts: 12, grade: 'S275', holeOK: true, hp: 294, e1p: 40, e2p: 40 },
    fast: { kind: 'bolt', d: 12, fu: 400, dw: 48 }, layout: { m: 3, n: 3, a1: 90, a2: 85, a3: 87, a4: 62, omit: [[1, 1]] }, act: { V: 10.05, N: 1.0, e: 0, M: 3.25 } });
  const W = D.W, nsp = 2;
  near('P&K 12.8.1: Σr² = 9.2 × 10⁴ mm²', D.Ip, 9.2e4, 0.005);
  near('P&K 12.8.1: F_m,d,max = M r_max/(n_sp Σr²) = 2.19 kN per plane', Math.abs(D.Mz) * Math.hypot(90, 85) / (nsp * D.Ip), 2190, 0.005);
  near('P&K 12.8.1: F_d on the worst bolt per shear plane = 2.71 kN', W.F / nsp, 2710, 0.005);
  near('P&K 12.8.1: its angle to the grain 54.81°', W.alpha, 54.81, 1e-4);
  near('P&K 12.8.1: f_h,0,k = 25.26 N/mm²', D.R0.fh.v, 25.26, 5e-4); near('P&K 12.8.1: k_90 = 1.53', D.R0.fh.k90, 1.53, 1e-9);
  near('P&K 12.8.1: f_h,α,k = 18.65 N/mm²', W.R.fh.v, 18.65, 5e-4);
  near('P&K 12.8.1: M_y,Rk = 7.67 × 10⁴ N mm', D.My, 7.67e4, 1e-3);
  near('P&K 12.8.1: F_ax,Rk = 1.26 × 10⁴ N (the washer under a plate, d_w = min(12t, 4d) = 48)', D.Fax.F, 1.26e4, 5e-3);
  near('P&K 12.8.1: F_v,Rk per plane = 8.06 kN, mode (l)', W.R.planes[0].F, 8060, 1e-3); truth('P&K 12.8.1: ... mode l', W.R.planes[0].mode === 'l');
  near('P&K 12.8.1: F_v,Rd per plane = 5.58 kN', W.R.Rd / nsp, 5580, 1e-3);
  near('P&K 12.8.1: n_ef = 2.34 for three bolts at 90 mm', D.rowW.nef, 2.34, 2e-3);
  near('P&K 12.8.1: F_1h = n_ef/n F_v,0,Rd = 5.9 kN per bolt per plane', D.rowW.cap0 / nsp, 5900, 2e-3);
  // P&K puts the whole horizontal force on the row of three (H/(n_b n_sp)) where its step 5 shares it over all eight
  near('row component along the grain: M y/(n_sp Σr²) + H/(n n_sp) (P&K 1.67 kN with H on one row of three)', D.rowW.Fx / nsp, 3.25e6 * 85 / (nsp * D.Ip) + 1000 / (8 * nsp), 1e-9);
  truth('P&K 12.8.1: the loaded end a₃,t = max(7d, 80) = 84 ≤ 87 mm, the loaded edge 4d = 48 ≤ 62 mm', /a₃ to the end 87 ≥ 84/.test(D.checks.find(c => c.id === 'sp').note) && /a₄,t to the loaded edge 62 ≥ 48/.test(D.checks.find(c => c.id === 'sp').note));
  truth('P&K 12.8.1: adequate (the bolt at 0.49, the row at 0.27)', ck(D, 'f') < 0.5 && ck(D, 'row') < 0.3); }

// ---------- 2. one slotted-in plate, restated ----------
const BASE = { mat: { family: 'glulam', cls: 'GL24h' }, sc: 1, b: 140, h: 450, dur: 'medium', plates: { arr: 'inside', n: 1, ts: 10, slot: 12, grade: 'S275', holeOK: true, e1p: 30, e2p: 30 },
  fast: { kind: 'dowel', d: 12, fu: 410 }, layout: { m: 3, n: 4, a1: 84, a2: 60, a3: 100, a4: 60 }, act: { V: 30, N: 0, g: 20 } };
{ const D = GP.design(BASE), d = 12, rk = 385, t1 = 64, kmod = 0.8;
  const fh0 = 0.082 * (1 - 0.01 * d) * rk, k90 = 1.35 + 0.015 * d, My = 0.3 * 410 * d ** 2.6;
  near('f_h,0,k = 0.082 (1 − 0.01d) ρ_k (8.32)', D.R0.fh.v, fh0, 1e-12); near('M_y,Rk = 0.3 f_u d^2.6 (8.30)', D.My, My, 1e-12);
  const plane = fh => Math.min(fh * t1 * d, fh * t1 * d * (Math.sqrt(2 + 4 * My / (fh * d * t1 * t1)) - 1), 2.3 * Math.sqrt(My * fh * d));
  near('one plate: F_v,0,Rk = 2 × min(8.11 f, g, h), t₁ = (140 − 12)/2', D.R0.Rk, 2 * plane(fh0), 1e-12);
  const W = D.W, fa = fh0 / (k90 * Math.sin(W.alpha * Math.PI / 180) ** 2 + Math.cos(W.alpha * Math.PI / 180) ** 2);
  near('the worst fastener: F_v,α,Rd with f_h,α,k by 8.31', W.R.Rd, kmod * 2 * plane(fa) / 1.3, 1e-12);
  // statics: ΣF_y = V, ΣF_x = 0, and the resultant on the line of zero moment (g = 20 mm before the timber end)
  near('ΣF_y = V', D.pts.reduce((s, p) => s + p.Fy, 0), 30000, 1e-12);
  near('ΣF_x = 0', D.pts.reduce((s, p) => s + p.Fx, 0), 0, 0, 1e-6);
  near('the moment of the fastener forces about the line of zero moment is nil', D.pts.reduce((s, p) => s + (p.x + 20) * p.Fy - (p.y - D.yc) * p.Fx, 0), 0, 0, 1e-3);
  near('the worst fastener = √((V/n + |M| Δx/Σr²)² + (|M| Δy/Σr²)²) at a corner', W.F, Math.hypot(30000 / 12 + 30000 * (20 + D.xc) * 84 / D.Ip, 30000 * (20 + D.xc) * 90 / D.Ip), 1e-12);
  // splitting, shear
  const he = 450 - 60, F90 = 14 * 128 * Math.sqrt(he / (1 - he / 450));
  near('splitting: F_90,Rk = 14 b √(h_e/(1 − h_e/h)), h_e from the top to the lowest row', ck(D, 'split'), 30000 / (kmod * F90 / 1.25), 1e-12);
  near('shear: 1.5V/(k_cr b h) against f_v,d', ck(D, 'shear'), 1.5 * 30000 / (0.67 * 128 * 450) / (kmod * 3.5 / 1.25), 1e-12);
  // rows: n_ef for 3 at 7d
  const nef = Math.min(3, 3 ** 0.9 * (84 / (13 * d)) ** 0.25);
  near('each row: n_ef = min(n, n^0.9 (a₁/13d)^¼)', D.rowW.nef, nef, 1e-12);
  near('... against n_ef/n F_v,0,Rd', D.rowW.cap0, nef / 3 * D.R0.Rd, 1e-12);
  // Table 8.5 for dowels at the angles that occur; the loaded edge is the top for V > 0
  const minA = Math.min(...D.pts.map(p => p.alpha)), maxA = Math.max(...D.pts.map(p => p.alpha)), rad = a => a * Math.PI / 180;
  const req = Math.max((3 + 2 * Math.cos(rad(minA))) * d / 84, 3 * d / 60, Math.max(7 * d, 80) / 100, Math.max((2 + 2 * Math.sin(rad(maxA))) * d, 3 * d) / 210, 3 * d / 60);
  near('spacings: Table 8.5 at the angles of the forces', ck(D, 'sp'), req, 1e-12);
  // the plate: Table 3.4 with d₀ = 13
  const d0 = 13, ab = Math.min(30 / (3 * d0), 84 / (3 * d0) - 0.25, 410 / 410, 1), k1 = Math.min(2.8 * 30 / d0 - 1.7, 1.4 * 60 / d0 - 1.7, 2.5);
  near('plate bearing: k₁ α_b f_u d t/γ_M2 (EN 1993-1-8 Table 3.4)', ck(D, 'pb'), W.F / (k1 * ab * 410 * d * 10 / 1.25), 1e-12);
  near('the plate at the timber face: V/V_pl,Rd', ck(D, 'pf'), Math.max(30000 / (10 * D.hp * 275 / Math.sqrt(3)), 30000 * 20 / (275 * 10 * D.hp ** 2 / 6)), 1e-12); }

// ---------- 3. two plates; tension; block shear ----------
{ const inp = { ...BASE, b: 200, plates: { ...BASE.plates, n: 2 }, act: { V: 20, N: 60, g: 20 } }, D = GP.design(inp), d = 12;
  const t1 = (200 - 24) / 4, t2 = 2 * t1, fh0 = D.R0.fh.v, My = D.My, ts = 10;
  near('two plates: outer pieces t₁ = (b − 2 slots)/4, inner t₂ = 2t₁', D.t1, t1, 1e-12);
  const out = Math.min(fh0 * t1 * d, fh0 * t1 * d * (Math.sqrt(2 + 4 * My / (fh0 * d * t1 * t1)) - 1), 2.3 * Math.sqrt(My * fh0 * d));
  // the inner piece between two plates, t = 10 mm < d: interpolated between thin (8.12) and thick (8.13) by (t − 0.5d)/0.5d
  const thin = Math.min(0.5 * fh0 * t2 * d, 1.15 * Math.sqrt(2 * My * fh0 * d)), thick = Math.min(0.5 * fh0 * t2 * d, 2.3 * Math.sqrt(My * fh0 * d)), w = (ts - 0.5 * d) / (0.5 * d);
  near('two plates: F_v,0,Rk = 2 F(8.11) + 2 F(8.12/8.13 interpolated)', D.R0.Rk, 2 * out + 2 * (thin + w * (thick - thin)), 1e-12);
  // block shear, Annex A, each piece by its mode
  const Lt = 3 * (60 - d), Lv = 2 * (100 + 2 * 84 - 2.5 * d), mo = D.R0.planes[0].mode, tef = mo === 'g' ? t1 * (Math.sqrt(2 + My / (fh0 * d * t1 * t1)) - 1) : mo === 'h' ? 2 * Math.sqrt(My / (fh0 * d)) : t1;
  const piece = (t, full, te) => Math.max(1.5 * Lt * t * 19.2, 0.7 * (full ? Lv * t : Lv / 2 * (Lt + 2 * te)) * 3.5);
  const Fbs = 2 * piece(t1, mo === 'f', tef) + piece(t2, true, t2);
  near(`block shear: Σ max(1.5 A_net,t f_t,0,k, 0.7 A_net,v f_v,k), outer pieces in mode ${mo}`, ck(D, 'bs'), 60000 / (0.8 * Fbs / 1.25), 1e-12);
  near('the timber net section in tension: b_net (h − n d)', ck(D, 'tn'), 60000 / (176 * (450 - 4 * d)) / (Math.min((600 / 450) ** 0.1, 1.1) * 0.8 * 19.2 / 1.25), 1e-12);
  near('the plates net section: 0.9 A_net f_u/γ_M2', ck(D, 'pn'), 60000 / (0.9 * 2 * 10 * (D.hp - 4 * 13) * 410 / 1.25), 1e-12);
  truth('tension: the loaded end needs a₃,t = max(7d, 80)', /a₃ to the end 100 ≥ 84/.test(D.checks.find(c => c.id === 'sp').note)); }

// ---------- 4. bolts, outside plates, durations ----------
{ const D = GP.design({ ...BASE, fast: { kind: 'bolt', d: 12, fu: 400, dw: 36 } });
  truth('bolts in a slotted plate: the rope effect from washers on the timber faces', D.Fax.F > 0 && D.Fax.dw === 36);
  const D2 = GP.design({ ...BASE, dur: 'permanent' });
  near('k_mod 0.6 for permanent load: the fastener utilisation × 0.8/0.6', ck(D2, 'f'), ck(GP.design(BASE), 'f') * 0.8 / 0.6, 1e-12);
  const D3 = GP.design({ ...BASE, act: { V: -30, N: 0, g: 20 } });
  truth('V downward on the timber: the loaded edge is the bottom', /from the bottom \(loaded\) edge/.test(D3.checks.find(c => c.id === 'split').note));
  const D4 = GP.design({ ...BASE, layout: { ...BASE.layout, m: 3, n: 3, a4: 120 }, act: { V: 0, N: 0, e: 0, M: 2 } }), c = D4.pts.find(p => p.i === 0 && p.j === 0);
  near('a pure moment on a 3 × 3 group: the corner takes M r/Σr²', c.F, 2e6 * Math.hypot(84, 60) / D4.Ip, 1e-12); }

// ---------- 5. errors ----------
throws('slots that leave no timber', () => GP.design({ ...BASE, b: 30, plates: { ...BASE.plates, n: 3, slot: 12 } }), /no timber/);
throws('rows that do not fit in the depth', () => GP.design({ ...BASE, layout: { ...BASE.layout, n: 8 } }), /do not fit/);
throws('no force', () => GP.design({ ...BASE, act: { V: 0, N: 0, g: 20 } }), /force/);
throws('one fastener with a moment', () => GP.design({ ...BASE, layout: { ...BASE.layout, m: 1, n: 1 }, act: { V: 5, g: 50 } }), /cannot carry a moment/);
console.log(`\n${n - fails}/${n} concealed plate checks passed`);
process.exit(fails ? 1 : 0);
