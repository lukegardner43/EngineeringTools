// RC Wall Crack Control (RC Crack Width.html) against CIRIA C766 (2018), Control of cracking caused by restrained
// deformation in concrete — its published worked examples, outputs only:
//   Example 1, a retaining wall on a stiff base (edge restraint): C30/37, 500 mm, flint, T1 26.4, R 0.47 / 0.40, εcd 82,
//     T16 at 200, cmin 40 — εctu, εr, εcr, Sr,max, crack widths and As,min at early age and long term;
//   Example 2, a suspended slab between walls (end restraint): C32/40, 200 mm, granite, T1 17.6, T12 at 250, cmin 30 —
//     Eq 3.12 crack-inducing strains, Sr,max, crack widths and As,min (kRedge = 1);
//   Example 4's section (C40/50, 350 mm, T16 at 150, c 50) under end restraint — εcr and wk;
//   the 350 mm ground slab's drying shrinkage (C40/50, RH 65%, one face, 50 years: 238 µε) and Example 2's (RH 80%: 222 µε);
//   Example 1's restraint from its base (A5.1, A5.2: 0.47 early, 0.40 long term, to 0.01);
//   Table 4.13 (f_ctm(3), f_ctm(28)), Table 4.6 (α_c) and Table 3.3 (T1, C30/37).
//   NODE_PATH=<jsdom>/node_modules node tests/rc-crack-width/test_crack_width.js
const fs = require('fs'), path = require('path'), { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Crack Width.html'), 'utf8');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${got})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol, rel = (a, b, r) => Math.abs(a - b) <= r * Math.abs(b);
const vc = new VirtualConsole(), errs = []; vc.on('jsdomError', e => errs.push(e.message));
const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', virtualConsole: vc }).window, d = w.document;
const set = (o) => { for (const [k, v] of Object.entries(o)) { const el = d.getElementById(k); if (!el) throw new Error('no input ' + k); el.value = String(v); el.dispatchEvent(new w.Event('change', { bubbles: true })); } };
const calc = o => { set(o); return w.crackCalc(); };
truth('page loads without script errors', errs.length === 0, errs.join('; '));

// ---- Example 1: wall on a stiff base, edge restraint only ----
const E1 = { h: 500, H: 4, L: 12, phi: 16, spacing: 200, cover: 40, fck_class: 30, cement_class: 'N', agg: 'flint', formwork: 'plywood', season: 'summer',
  T1_mode: 'given', T1_given: 26.4, ecd_mode: 'given', ecd_given: 82, restraint_config: 'base_only', R1_mode: 'manual', R1_manual: 0.47, R1_lt_manual: 0.40, bond_mode: 'auto', fyk: 500, wmax: 0.2 };
{
  const g = calc(E1);
  truth('Ex 1: εca(3) 15, εca(28) 33 µε', near(g.eca_3, 15, 0.5) && near(g.eca_28, 33, 0.5));
  truth('Ex 1: f_ctm(3) 1.73, f_ct,r(3) 1.21, f_ct,r(28) 2.03 MPa', near(g.fctm3, 1.73, 0.005) && near(g.fctr3, 1.21, 0.005) && near(g.fctr28, 2.03, 0.005), [g.fctm3, g.fctr3, g.fctr28]);
  truth('Ex 1: E_cm(3) 31.0, E_cm(28) 36.1 GPa (flint, × 1.1)', near(g.Ecm3, 31.0, 0.05) && near(g.Ecm28_val, 36.1, 0.05), [g.Ecm3, g.Ecm28_val]);
  truth('Ex 1: εctu(3) 60, εctu(28) 112 µε', near(g.ectu_ea, 60, 0.5) && near(g.ectu_lt, 112, 0.6), [g.ectu_ea, g.ectu_lt]);
  truth('Ex 1: εr 101 µε early age', near(g.er_ea, 101, 0.5), g.er_ea);
  truth('Ex 1: εr 185 µε long term', near(g.er_lt, 185, 0.6), g.er_lt);
  truth('Ex 1: εcr 71 µε early age, 129 µε long term', near(g.ecr_ea, 71, 0.6) && near(g.ecr_lt, 129, 0.6), [g.ecr_ea, g.ecr_lt]);
  truth('Ex 1: poor bond k1 1.14 (h > 300, c ≤ 50); hc,ef 120 mm; ρp,eff 0.838%', g.k1_ea === 1.14 && near(g.hcef, 120, 1e-9) && near(g.rho_pef * 100, 0.838, 0.0005), [g.k1_ea, g.hcef, g.rho_pef]);
  truth('Ex 1: Sr,max 1061 mm (early age and long term)', near(g.Srmax_ea, 1061, 0.5) && near(g.Srmax_lt, 1061, 0.5), [g.Srmax_ea, g.Srmax_lt]);
  truth('Ex 1: wk 0.08 mm early age, 0.14 mm long term', near(g.wk_ea, 0.08, 0.005) && near(g.wk_lt, 0.14, 0.005), [g.wk_ea, g.wk_lt]);
  truth('Ex 1: k 0.86; As,min 399 mm² (kRedge 0.77) and 698 mm² (kRedge 0.80)', near(g.k_h, 0.86, 1e-9) && near(g.kRedge_ea, 0.765, 1e-9) && near(g.Asmin_ea, 399, 1) && near(g.Asmin_lt, 698, 1), [g.Asmin_ea, g.Asmin_lt]);
  truth('Ex 1: passes 0.18 mm, steel above As,min', g.wk_gov <= 0.18 && g.steel_ok);
  // the alternative: T12 at 200 fails As,min (Sr,max 1318 mm, wk 0.09 / 0.15 mm)
  const a = calc({ ...E1, phi: 12 });
  // (the book's long-term 0.15 mm for this alternative is not 1318 × 129 µε = 0.17 mm, so only the early-age figures are checked)
  truth('Ex 1 alternative T12 at 200: Sr,max 1318 mm, wk 0.09 mm early age, fails As,min', near(a.Srmax_ea, 1318, 1) && near(a.wk_ea, 0.09, 0.005) && !a.steel_ok, [a.Srmax_ea, a.wk_ea]);
  // the restraint from the base (C766 A5): 0.47 early, 0.40 long term
  const r = calc({ ...E1, phi: 16, R1_mode: 'auto', base_b: 2.85, base_d: 0.8 });
  truth('Ex 1: restraint from the base 0.8 m × 2.85 m by Eq A5.1, A5.2: 0.47 early, 0.40 long term (to 0.01)', near(r.R1, 0.47, 0.01) && near(r.R1_lt, 0.40, 0.01), [r.R1, r.R1_lt]);
}

// ---- Example 2: suspended slab, end restraint ----
const E2 = { h: 200, H: 3, L: 15, phi: 12, spacing: 250, cover: 30, fck_class: 32, cement_class: 'N', agg: 'granite', formwork: 'plywood', season: 'summer',
  T1_mode: 'given', T1_given: 17.6, ecd_mode: 'given', ecd_given: 222, restraint_config: 'ends_only', Rend_mode: 'manual', Rend_manual: 0.17, Rend2_mode: 'same', bond_mode: 'auto', fyk: 500, wmax: 0.3 };
{
  const g = calc(E2);
  truth('Ex 2: εca(3) 16, εca(28) 36 µε', near(g.eca_3, 16, 0.5) && near(g.eca_28, 36, 0.5));
  truth('Ex 2: f_ctm(3) 1.81, f_ct,r(3) 1.27, f_ct,r(28) 2.11 MPa', near(g.fctm3, 1.81, 0.005) && near(g.fctr3, 1.27, 0.005) && near(g.fctr28, 2.11, 0.01), [g.fctm3, g.fctr3, g.fctr28]);   // the book rounds 0.7 × 3.024 = 2.117 to 2.11
  truth('Ex 2: E_cm(3) 28.6, E_cm(28) 33.3 GPa', near(g.Ecm3, 28.6, 0.05) && near(g.Ecm28_val, 33.3, 0.05), [g.Ecm3, g.Ecm28_val]);
  truth('Ex 2: εctu(3) 68, εctu(28) 127 µε', near(g.ectu_ea, 68, 0.6) && near(g.ectu_lt, 127, 0.6), [g.ectu_ea, g.ectu_lt]);
  truth('Ex 2: εr 22 µε early age (no early-age crack)', near(g.er_ea, 22, 0.5) && !g.cracks_ea, g.er_ea);
  truth('Ex 2: εcr 722 µε early age, 1201 µε long term (Eq 3.12, to 0.6%)', rel(g.ecr_ea, 722, 0.006) && rel(g.ecr_lt, 1201, 0.006), [g.ecr_ea, g.ecr_lt]);
  truth('Ex 2: k1 0.8; hc,ef 90 mm; ρp,eff 0.503%; Sr,max 914 mm', g.k1_ea === 0.8 && near(g.hcef, 90, 1e-9) && near(g.rho_pef * 100, 0.503, 0.0005) && near(g.Srmax_ea, 914, 1) && near(g.Srmax_lt, 914, 1), [g.Srmax_ea, g.Srmax_lt]);
  truth('Ex 2: wk 0.66 mm early age, 1.1 mm long term; fails 0.3 mm', near(g.wk_ea, 0.66, 0.006) && near(g.wk_lt, 1.1, 0.01) && !g.wk_ok, [g.wk_ea, g.wk_lt]);
  truth('Ex 2: k 1.0, kRedge 1; As,min 253 and 423 mm²', g.k_h === 1 && g.kRedge_ea === 1 && near(g.Asmin_ea, 253, 1) && near(g.Asmin_lt, 423, 1), [g.Asmin_ea, g.Asmin_lt]);
  const b = calc({ ...E2, phi: 16, spacing: 150 });
  truth('Ex 2 alternative T16 at 150: εcr 427 µε long term (Eq 3.12 at 28 days, to 1%)', rel(b.ecr_lt, 427, 0.01), b.ecr_lt);
  const c = calc({ ...E2, ecd_mode: 'calc', RH: 80, dry_faces: 2, life: 50 });
  truth('Ex 2: εcd 222 µε from RH 80% (EC2 B.2, kh 0.85, 50 years)', near(c.ecd, 222, 1.5), c.ecd);
}
// ---- Example 4's section under end restraint ----
{
  const g = calc({ ...E2, h: 350, phi: 16, spacing: 150, cover: 50, fck_class: 40, agg: 'granite' });
  truth('Ex 4 section: εcr 487 µε by Eq 3.12 (to 0.6%), k 0.965', rel(g.ecr_ea, 487, 0.006) && near(g.k_h, 0.965, 1e-9), g.ecr_ea);
  truth('Ex 4 section: poor bond, wk 0.49 mm', g.k1_ea === 1.14 && near(g.wk_ea, 0.49, 0.005), g.wk_ea);
  truth('C40/50: f_ctm(3) 2.10 MPa, E_cm(3) 30.2 GPa (Table 4.13 and the examples)', near(g.fctm3, 2.10, 0.005) && near(g.Ecm3, 30.2, 0.05), [g.fctm3, g.Ecm3]);
}
// ---- drying shrinkage: the 350 mm ground slab, C40/50, RH 65%, drying from one face, 50 years ----
{
  const g = calc({ ...E2, h: 350, fck_class: 40, ecd_mode: 'calc', RH: 65, dry_faces: 1, life: 50 });
  truth('εcd 238 µε at 50 years (h0 700, kh 0.70)', near(g.ecd, 238, 1) && near(g.ecdC.kh, 0.70, 1e-9) && g.ecdC.h0 === 700, g.ecd);
}
// ---- tables ----
{
  const t13 = { 25: [1.53, 2.56], 30: [1.73, 2.90], 32: [1.81, 3.02], 35: [1.92, 3.21], 40: [2.10, 3.51] };
  const ok = Object.entries(t13).every(([f, [a, b]]) => { const g = calc({ ...E2, fck_class: f }); return near(g.fctm3, a, 0.006) && near(g.fctm28, b, 0.006); });
  truth('C766 Table 4.13: f_ctm(3) and f_ctm(28) for C25/30 to C40/50', ok);
  const t46 = { flint: 12, quartzite: 14, glacial: 13, sandstone: 12.5, granite: 10.5, basalt: 10.5, limestone: 9.5, marble: 8 };
  truth('C766 Table 4.6: α_c (upper end of each range)', Object.entries(t46).every(([a, v]) => calc({ ...E1, agg: a }).ac === v));
  const t33 = { steel: { 500: 28, 700: 35, 1000: 43, 2000: 54 }, plywood: { 300: 28, 500: 36, 700: 42, 1000: 47, 2000: 55 } };
  truth('C766 Table 3.3: T1 for C30/37, CEM I, summer', Object.entries(t33).every(([fw, m]) => Object.entries(m).every(([h, v]) => calc({ ...E1, T1_mode: 'table', fck_class: 30, cement: 'CEMI', season: 'summer', formwork: fw, h }).T1 === v)));
}
// ---- the page itself: run, results, report pane ----
{
  set({ ...E1, R1_mode: 'auto', base_b: 2.85, base_d: 0.8, T1_mode: 'table', ecd_mode: 'calc' }); w.runCalc();
  const t = d.getElementById('results').textContent;
  truth('run: results show Eq A5.1, A5.2 and Eq 4.4 workings', /Eq A5\.1/.test(t) && /Eq A5\.2/.test(t) && /Eq 4\.4/.test(t) && /PASS|FAIL/.test(d.getElementById('statusbar').textContent));
  truth('restraint inputs follow the choice', d.getElementById('Rbase_w').style.display !== 'none' && d.getElementById('R1_mw').style.display === 'none');
  set({ R1_mode: 'manual' }); truth('… manual shows early and long-term R', d.getElementById('R1_mw').style.display !== 'none' && d.getElementById('Rbase_w').style.display === 'none');
  truth('no script errors', errs.length === 0, errs.join('; '));
}
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
