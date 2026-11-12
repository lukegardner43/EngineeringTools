// Historic British sections and steels in the steel member engine, from the BCSA Historical Structural Steelwork Handbook
// (W. Bates, 1984; outputs only):
//  - the 534 sections of its Tables 3.3, 3.7 to 3.15 and 3.21 to 3.25 converted to metric: counts per table, rows read off the
//    scans, every row's mass against its area (3.4 lb/ft per in², 0.785 kg/m per cm²) and its area against its plates;
//  - the handbook's misprints corrected (each confirmed by the row's own Z and r and the other edition's table);
//  - the derived properties: W_el from I, W_pl by the plates' shape factor, I_t and I_w of the plates; the 1972 sections
//    against today's datasheet for the same sizes; the channel's plastic modulus by direct integration;
//  - the yield strengths of BS 15:1948, BS 548:1934 and BS 968 (1943 and 1962) by thickness, and a given f_y;
//  - a member check on a historic section with a given f_y.
//   node tests/steel-member/test_historic.js
const { EC3, Design, HIST_SERIES, SECTION_DATA } = require('./load.js');
let pass = 0, fail = 0; const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const rel = (a, b, r) => Math.abs(a - b) <= r * Math.abs(b);
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const IN = 25.4, IN2 = 6.4516, IN4 = 41.62314, LB = 1.488164;
const S = k => HIST_SERIES.find(x => x.key === k), row = (k, nm) => S(k).rows.find(r => r[0] === nm), sec = (k, nm) => EC3.fromHist(row(k, nm), S(k).kind, S(k));

// ---- the tables ----
const COUNT = { 'H-DL1887': 98, 'H-BSB1903': 30, 'H-NBSB1921': 29, 'H-BSB1932': 40, 'H-BFB1959': 20, 'H-UB1962': 80, 'H-UC1962': 32, 'H-UB1972': 80, 'H-UC1972': 32, 'H-BSC1904': 17, 'H-NBSC1921': 18, 'H-BSC1932': 41, 'H-BSC1962': 17 };
truth('13 series, 534 sections: Tables 3.3, 3.7 to 3.15 and 3.21 to 3.25 (the 1962 UBs with the 1963 addendum and Table 3.13)', HIST_SERIES.length === 13 && Object.entries(COUNT).every(([k, n]) => S(k) && S(k).rows.length === n), HIST_SERIES.map(x => [x.key, x.rows.length]));
truth('names are unique within each series', HIST_SERIES.every(x => new Set(x.rows.map(r => r[0])).size === x.rows.length));
const imp = (r, D, B, w, t, T, A, Ix, Iy) => near(r[1], w * LB, 0.01) && near(r[2], D * IN, 0.01) && near(r[3], B * IN, 0.01) && near(r[4], t * IN, 0.01) && near(r[5], T * IN, 0.01) && rel(r[6], A * IN2, 6e-4) && rel(r[7], Ix * IN4, 6e-4) && rel(r[8], Iy * IN4, 6e-4);
// rows as printed (scans of Tables 3.3, 3.7, 3.8, 3.10, 3.11, 3.12, 3.25)
truth('Table 3.3: Dorman Long 20 × 8.26 in × 100 lb: t 0.76, T 0.97, A 29.67 in², I 1825.10 / 80.43 in⁴', imp(row('H-DL1887', 'DL 20×8.26 in × 100 lb (1887)'), 20, 8.26, 100, 0.76, 0.97, 29.67, 1825.10, 80.43));
truth('Table 3.3: Dorman Long 3 × 1.40 in × 5 lb (the last of the 98)', imp(row('H-DL1887', 'DL 3×1.4 in × 5 lb (1887)'), 3, 1.40, 5, 0.31, 0.25, 1.50, 1.74, 0.12));
truth('Table 3.7: BSB 30, 24 × 7½ in × 100 lb: t 0.60, T 1.07, A 29.39 in², I 2655.0 / 66.9 in⁴', imp(row('H-BSB1903', 'BSB 30 24×7.5 in × 100 lb (BS 4:1903)'), 24, 7.5, 100, 0.60, 1.07, 29.39, 2655.0, 66.9));
truth('Table 3.8: NBSHB 5, 9 × 7 in × 50 lb: A 14.71 in², I 208.1 / 40.17 in⁴', imp(row('H-NBSB1921', 'NBSHB 5 9×7 in × 50 lb (BS 4:1921)'), 9, 7, 50, 0.40, 0.83, 14.71, 208.1, 40.17));
truth('Table 3.8: NBSB 5 (OCR-garbled metric size): 6 × 3 in × 12 lb, A 3.53 in², I 21.0 / 1.46 in⁴', imp(row('H-NBSB1921', 'NBSB 5 6×3 in × 12 lb (BS 4:1921)'), 6, 3, 12, 0.23, 0.38, 3.53, 21.0, 1.46));
truth('Table 3.10: BSB 140, 24 × 7½ in × 95 lb: A 27.94 in², I 2533.0 / 62.5 in⁴', imp(row('H-BSB1932', 'BSB 140 24×7.5 in × 95 lb (BS 4:1932)'), 24, 7.5, 95, 0.57, 1.01, 27.94, 2533.0, 62.5));
truth('Table 3.9: BS 4:1932 lists its sizes from 1903 and 1921: BSB 102 as BSB 2 of 1903', imp(row('H-BSB1932', 'BSB 102 3×3 in × 8.5 lb (BS 4:1932)'), 3, 3, 8.5, 0.20, 0.33, 2.50, 3.79, 1.26) && /BSB 2 of BS 4:1903/.test(row('H-BSB1932', 'BSB 102 3×3 in × 8.5 lb (BS 4:1932)')[9]));
truth('Table 3.11: UB 36 × 16½ × 260 lb: D 36.24, B 16.56 in, A 76.8 in², I 17230 / 1021 in⁴', imp(row('H-UB1962', '36×16.50×260 lb UB (1962)'), 36.24, 16.56, 260, 0.85, 1.44, 76.8, 17230, 1021));
truth('Table 3.11: UB 21 × 13 × 142 lb (its metric size garbled in the OCR)', imp(row('H-UB1962', '21×13×142 lb UB (1962)'), 21.46, 13.13, 142, 0.66, 1.10, 41.8, 3404, 386.0));
truth('Table 3.13: UB 24 × 7 × 61 lb (added 1962/72)', imp(row('H-UB1962', '24×7×61 lb UB (1962)'), 23.72, 7.02, 61, 0.42, 0.59, 18.0, 1537, 34.3));
truth('Table 3.12: UC 14 × 16 × 426 lb: A 125.3 in², I 6610 / 2360 in⁴', imp(row('H-UC1962', '14×16×426 lb UC (1962)'), 18.69, 16.70, 426, 1.88, 3.03, 125.3, 6610, 2360));
truth('Table 3.25: BFB 24 × 12 × 165 lb: A 48.53 in², I 4857 / 393.2 in⁴', imp(row('H-BFB1959', '24×12×165 lb BFB (1959)'), 24.0, 12.0, 165, 0.70, 1.36, 48.53, 4857, 393.2));
const met = (r, w, D, B, t, T, A, Ix, Iy) => [w, D, B, t, T, A, Ix, Iy].every((v, i) => near(r[i + 1], v, 1e-9));
truth('Table 3.14: UB 914 × 419 × 388 (1972): 920.5 × 420.5, 21.5 / 36.6 mm, 494 cm², 717300 / 42480 cm⁴', met(row('H-UB1972', '914×419×388 UB (1972)'), 388, 920.5, 420.5, 21.5, 36.6, 494, 717300, 42480));
truth('Table 3.15: UC 356 × 406 × 634 (1972): 474.7 × 424.1, 47.6 / 77.0 mm, 808.1 cm², 275100 / 98210 cm⁴', met(row('H-UC1972', '356×406×634 UC (1972)'), 634, 474.7, 424.1, 47.6, 77.0, 808.1, 275100, 98210));
const ch = (r, D, B, w, t, T, A, cy, Ix, Iy) => imp(r, D, B, w, t, T, A, Ix, Iy) && near(r[9], cy * IN, 0.01);
truth('Table 3.21: BSC 1, 6 × 3 in × 14.49 lb: A 4.26 in², c.g. 0.94 in from the back, I 24.0 / 3.50 in⁴', ch(row('H-BSC1904', 'BSC 1 6×3 in × 14.49 lb (BS 6:1904)'), 6, 3, 14.49, 0.31, 0.44, 4.26, 0.94, 24.0, 3.50));
truth('Table 3.23: BSC 120A, 17 × 4.12 in × 51.28 lb', ch(row('H-BSC1932', 'BSC 120A 17×4.12 in × 51.28 lb (BS 4:1932)'), 17, 4.12, 51.28, 0.60, 0.68, 15.08, 0.91, 569.3, 17.0));
truth('Table 3.24: channel 17 × 4 × 44 lb (1962): A 12.94 in², c.g. 0.91 in, I 514.1 / 15.10 in⁴', ch(row('H-BSC1962', '17×4×44 lb channel (1962)'), 17, 4, 44, 0.48, 0.66, 12.94, 0.91, 514.1, 15.10));
// every row: mass against area, area against its plates
{
  const bad = [];
  HIST_SERIES.forEach(x => x.rows.forEach(r => {
    const [nm, mass, h, b, tw, tf, A] = r, plates = 2 * b * tf + (h - 2 * tf) * tw;
    if (!rel(mass, A * 0.785, x.key.endsWith('1972') ? 0.03 : 0.035)) bad.push([nm, 'mass', mass, +(A * 0.785).toFixed(2)]);
    const [lo, hi] = x.year >= 1959 ? [0.99, 1.04] : [0.90, 1.08];   // parallel flanges with fillets; the older tapered flanges at their tabulated thickness
    if (!(A * 100 >= lo * plates && A * 100 <= hi * plates)) bad.push([nm, 'plates', A, +(plates / 100).toFixed(2)]);
  }));
  truth('all 534 rows: mass within 3.5% of 0.785 kg/m per cm²; area −1 / +4% of the plates from 1959 (fillets), −10 / +8% before (tapered flanges)', bad.length === 0, bad.slice(0, 5));
}
// ---- the handbook's misprints, corrected ----
truth('UB 33 × 11½ × 118 (1962): I_yy 170.8 in⁴, not the printed 178.8 (its Z 29.8, r 2.2; 1972: 7111 cm⁴)', rel(row('H-UB1962', '33×11.50×118 lb UB (1962)')[8], 170.8 * IN4, 6e-4) && /178\.8/.test(row('H-UB1962', '33×11.50×118 lb UB (1962)')[9]));
truth('UB 12 × 6½ × 27 (1962): I_yy 16.6, not 18.6; UB 10 × 5¾ × 29: I_xx 157.3, not 138.1', rel(row('H-UB1962', '12×6.50×27 lb UB (1962)')[8], 16.6 * IN4, 6e-4) && rel(row('H-UB1962', '10×5.75×29 lb UB (1962)')[7], 157.3 * IN4, 6e-4));
truth('Column core 320 lb (1962): I_xx 4142 in⁴, not 3714 (its Z 493; 1972: 172400 cm⁴)', rel(row('H-UC1962', 'Column core 320 lb UC (1962)')[7], 4142 * IN4, 6e-4));
truth('1972: 457 × 152 × 52 B 152.4 (not 162.4); 406 × 178 × 67 I_yy 1269 (not 1869); 356 × 406 × 235 I_yy 31000 (not 38000)', row('H-UB1972', '457×152×52 UB (1972)')[3] === 152.4 && row('H-UB1972', '406×178×67 UB (1972)')[8] === 1269 && row('H-UC1972', '356×406×235 UC (1972)')[8] === 31000);
truth('Channel 15 × 4 × 37 (1962): I_xx 357.2 in⁴, not 537.2 (its Z 47.7, r 5.7)', rel(row('H-BSC1962', '15×4×37 lb channel (1962)')[7], 357.2 * IN4, 6e-4));
truth('Dorman Long 3½ × 3 group: flanges 0.40 in, not the printed 0.30 (its areas, masses and I_yy); BSC 120A web 0.60 in, not 0.50', ['DL 3.5×3.14 in × 12.5 lb (1887)', 'DL 3.5×2.99 in × 10.75 lb (1887)', 'DL 3.5×2.84 in × 9 lb (1887)'].every(n => near(row('H-DL1887', n)[5], 0.40 * IN, 0.01)) && near(row('H-DL1887', 'DL 3.5×1.68 in × 7 lb (1887)')[5], 0.30 * IN, 0.01) && near(row('H-BSC1932', 'BSC 120A 17×4.12 in × 51.28 lb (BS 4:1932)')[4], 0.60 * IN, 0.01));
// ---- derived properties ----
{
  const s = sec('H-BSB1903', 'BSB 30 24×7.5 in × 100 lb (BS 4:1903)'), p = EC3.customI({ h: s.h, b: s.b, tw: s.tw, tf: s.tf, r: 0 });
  truth('I sections: W_el,y = I_y/(h/2), W_el,z = I_z/(b/2) from the tabulated I (BSB 30: 221.2 in³ printed)', near(s.Wely, s.Iy / (s.h / 2), 1e-6) && near(s.Welz, s.Iz / (s.b / 2), 1e-6) && rel(s.Wely, 221.2 * 16.387064 * 1e3, 0.002));
  truth('W_pl = W_el × the shape factor of the plates; I_t = Σ bt³/3; I_w = I_z (h − t_f)²/4; r = 0', near(s.Wply / s.Wely, p.Wply / p.Wely, 1e-12) && near(s.Wplz / s.Welz, p.Wplz / p.Welz, 1e-12) && near(s.It, (2 * s.b * s.tf ** 3 + (s.h - s.tf) * s.tw ** 3) / 3, 1e-6) && near(s.Iw, s.Iz * (s.h - s.tf) ** 2 / 4, 1) && s.r === 0 && s.rolled && s.hist.year === 1903);
  const pairs = [['H-UB1972', '457×191×67 UB (1972)', '457×191×67 UKB'], ['H-UB1972', '610×229×125 UB (1972)', '610×229×125 UKB'], ['H-UC1972', '254×254×73 UC (1972)', '254×254×73 UKC'], ['H-UC1972', '203×203×46 UC (1972)', '203×203×46 UKC']];
  const ok = pairs.every(([k, nm, m]) => { const h = sec(k, nm), d = EC3.fromRow(SECTION_DATA.find(r => r[0] === m)); return rel(h.Wply, d.Wply, 0.03) && h.It <= d.It && h.It >= 0.75 * d.It && rel(h.Iw, d.Iw, 0.1); });
  truth('1972 UBs and UCs against today’s datasheet for the same sizes: W_pl,y within 3%, I_t lower (no fillets) by under 25%, I_w within 10%', ok);
  const c = sec('H-BSC1962', '9×3×17.5 lb channel (1962)');
  // the channel's plates by direct integration: equal areas either side of the plastic axis about z
  const { h, b, tw, tf } = c, strips = []; const n = 4000;
  for (let i = 0; i < n; i++) { const y = (i + 0.5) * b / n, wdt = y < tw ? h : 2 * tf; strips.push([y, wdt * b / n]); }
  const Ap = strips.reduce((s, q) => s + q[1], 0); let acc = 0, yp = 0; for (const [y, a] of strips) { acc += a; if (acc >= Ap / 2) { yp = y; break; } }
  const Wnum = strips.reduce((s, [y, a]) => s + a * Math.abs(y - yp), 0), yc = strips.reduce((s, [y, a]) => s + a * y, 0) / Ap, Inum = strips.reduce((s, [y, a]) => s + a * (y - yc) ** 2, 0);
  truth('channels: W_el,z = I_z/(b − c_y); W_pl,z by the plates’ shape factor (checked by integration)', near(c.Welz, c.Iz / (c.b - c.cy), 1e-6) && rel(c.Wplz / c.Welz, Wnum / (Inum / (b - yc)), 0.01) && c.shape === 'PFC');
  const bp = b - tw / 2, hp = h - tf;
  truth('channels: shear centre e = 3b′²t_f/(6b′t_f + h′t_w) behind the web; I_w thin-walled', near(c.eSC, 3 * bp * bp * tf / (6 * bp * tf + hp * tw), 1e-9) && near(c.y0, c.cy - tw / 2 + c.eSC, 1e-9) && near(c.Iw, tf * bp ** 3 * hp * hp / 12 * (3 * bp * tf + 2 * hp * tw) / (6 * bp * tf + hp * tw), 1e-3));
}
// ---- historic steels ----
{
  const Y = (g, t, f) => EC3.yieldStrength(g, t, f);
  truth('BS 15:1948: 16 tons/in² to ¾" (247), 15 to 1½" (231), 14.75 beyond (227) N/mm²', Y('BS15', 10) === 247 && Y('BS15', 19.05) === 247 && Y('BS15', 19.1) === 231 && Y('BS15', 38.1) === 231 && Y('BS15', 40) === 227 && Y('BS15', 100) === 227);
  truth('the conversion: 1 ton/in² = 15.444 N/mm², rounded down', Math.floor(16 * 15.4443) === 247 && Math.floor(15 * 15.4443) === 231 && Math.floor(14.75 * 15.4443) === 227);
  truth('BS 548:1934: 23, 22, 21, 20, 19 tons/in² to 1¼", 1¾", 2¼", 2¾" and beyond', [[30, 355], [40, 339], [50, 324], [60, 308], [80, 293]].every(([t, f]) => Y('BS548', t) === f));
  truth('BS 968, 1943 amendment: 21 tons/in² to ¾" (324), 19 over (293)', Y('BS968A', 15) === 324 && Y('BS968A', 25) === 293);
  truth('BS 968:1962: 23, 22.5, 22 tons/in² to ⅝", 1¼", 2"; over 2" to be agreed (refused)', Y('BS968', 15) === 355 && Y('BS968', 25) === 347 && Y('BS968', 45) === 339 && throws(() => Y('BS968', 60), /outside the specification/));
  truth('a given f_y: used as given; missing or outside 150 to 700 N/mm² refused', Y('GIVEN', 30, '230') === 230 && Y('GIVEN', 30, 215) === 215 && throws(() => Y('GIVEN', 30, ''), /Give the steel/) && throws(() => Y('GIVEN', 30, 100), /150 to 700/));
  truth('the modern grades unchanged: S275 265 at 20 mm, S355 355 at 16 mm', Y('S275', 20) === 265 && Y('S355', 16) === 355 && Y('S235', 10) === 235);
}
// ---- a member check on a historic section ----
{
  const s = sec('H-BSB1903', 'BSB 26 15×6 in × 59 lb (BS 4:1903)');
  const R = Design.designMember({ sec: s, grade: 'GIVEN', fy: 230, L: 4000, N: 0, MyT: 0, MyB: 100e6, MzT: 0, MzB: 0, ky: 1, kz: 1, nLT: 1 });
  const cls = EC3.classify(s, 230, 0, true);
  const Wy = cls.cls <= 2 ? s.Wply : s.Wely;
  truth('BSB 26 (1903) as a 4 m beam, f_y 230 given: runs, f_y 230, ε = √(235/230)', R.fy === 230 && near(cls.eps, Math.sqrt(235 / 230), 1e-12) && R.utilMax > 0 && Number.isFinite(R.utilMax));
  truth(`… bending at the section: 100 kNm against W × f_y = ${(Wy * 230 / 1e6).toFixed(1)} kNm (Class ${cls.cls})`, near(R.gov.bending.util, 100e6 / (Wy * 230), 1e-6), R.gov.bending.util);
  const R2 = Design.designMember({ sec: s, grade: 'BS15', L: 4000, N: 0, MyT: 0, MyB: 100e6, MzT: 0, MzB: 0, ky: 1, kz: 1, nLT: 1 });
  truth('… with BS 15:1948 steel: its 0.88 in (22.4 mm) flange is over ¾", so 15 tons/in², 231 N/mm²', R2.fy === 231);
  const C = sec('H-BSC1932', 'BSC 112 9×3.5 in × 22.27 lb (BS 4:1932)');
  const R3 = Design.designMember({ sec: C, grade: 'BS15', L: 3000, N: 50e3, MyT: 0, MyB: 20e6, MzT: 0, MzB: 0, ky: 1, kz: 1, nLT: 1 });
  truth('a 1932 channel as a beam-column with BS 15 steel: runs, every check finite', R3.fy === 247 && Object.values(R3.gov).every(g => Number.isFinite(g.util)));
}
console.log(`\n${pass}/${pass + fail} historic section checks passed`); process.exit(fail ? 1 : 0);
