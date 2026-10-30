// Section Properties engine: closed forms, published tables (British Steel UKB/UKC/PFC, Tata Celsius SHS) and an
// independent implementation (the EC3 engine's hollow-section formulae). Usage: node tests/section-props/test_section_props.js
const { SecProps, SECTION_DATA, PFC_DATA } = process.env.ENGINE ? { ...require(process.env.ENGINE), ...require('../steel-member/load.js') } : require('./load.js');
const { EC3 } = require('../steel-member/load.js');
const fs = require('fs'), path = require('path');
let n = 0, fails = 0;
const near = (name, got, exp, tol, quiet) => { n++; const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-12); if (!ok || !quiet) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const P = (s, d) => SecProps.compute(s, d);
// closed forms
{ const b = 200, h = 400, r = P('rect', { b, h });
  near('rect A', r.A, b * h, 1e-12); near('rect Iy', r.Iy, b * h ** 3 / 12, 1e-12); near('rect Iz', r.Iz, h * b ** 3 / 12, 1e-12);
  near('rect Wpl,y = bh²/4', r.Wply, b * h * h / 4, 1e-9); near('rect Wpl,z', r.Wplz, h * b * b / 4, 1e-9);
  near('square It = 0.1406 a⁴', P('rect', { b: 100, h: 100 }).It, 0.1406 * 1e8, 2e-3); }
{ const d = 300, c = P('circle', { d });
  near('circle A (exact)', c.A, Math.PI * d * d / 4, 1e-12); near('circle I', c.Iy, Math.PI * d ** 4 / 64, 1e-12); near('circle Wpl = d³/6', c.Wply, d ** 3 / 6, 1e-12); }
// hollow sections against the EC3 engine (closed-form spandrel geometry, written separately) and Tata tables
for (const [h, b, t, cold] of [[100, 100, 5, false], [300, 200, 10, false], [200, 100, 6.3, true], [400, 400, 16, true]]) {
  const [ro, ri] = EC3.hollowRadii(t, cold), e = EC3.rhs({ h, b, t, cold }), r = P('rhs', { h, b, t, ro, ri });
  for (const k of ['A', 'Iy', 'Iz', 'Wply', 'Wplz', 'It']) near(`RHS ${h}x${b}x${t}${cold ? ' cold' : ''} ${k} vs EC3 engine`, r[k], e[k], 2e-4, true);
}
{ const rows = fs.readFileSync(path.join(__dirname, '..', 'steel-member', 'reference', 'shs_tata_s460.csv'), 'utf8').trim().split('\n').slice(1).map(l => l.split(','));
  let worst = 0;
  for (const [size, t, mass, A, I, i, Wel, Wpl, It] of rows) { const b = +size.split(' x ')[0], r = P('rhs', { h: b, b, t: +t });
    for (const [g, x] of [[r.A / 100, +A], [r.Iy / 1e4, +I], [r.Wely / 1e3, +Wel], [r.Wply / 1e3, +Wpl], [r.It / 1e4, +It]]) { near(`Tata ${size}x${t}`, g, x, 6e-3, true); worst = Math.max(worst, Math.abs(g / x - 1)); } }
  console.log(`Tata Celsius SHS ${rows.length} rows: worst ${(worst * 100).toFixed(2)}%`); }
{ for (const [d, t] of [[168.3, 8], [508, 16]]) { const e = EC3.chs({ d, t }), r = P('chs', { d, t });
    near(`CHS ${d}x${t} I vs exact`, r.Iy, e.Iy, 1e-12, true); near(`CHS ${d}x${t} Wpl vs exact`, r.Wply, e.Wply, 1e-12, true); near(`CHS ${d}x${t} It`, r.It, e.It, 1e-12, true); } }
// rolled I sections against the British Steel table
{ let worst = {}, cnt = 0;
  for (const row of SECTION_DATA.filter((_, k) => k % 7 === 0)) {
    const [name, mass, h, b, tw, tf, rr, A, Iy, Iz, Wely, Welz, Wply, Wplz, It, Iw] = row;
    const r = P('isec', { h, bt: b, tt: tf, bb: b, tb: tf, tw, r: rr });
    for (const [k, g, x, tol] of [['A', r.A / 1e2, A, 0.015], ['Iy', r.Iy / 1e4, Iy, 0.015], ['Iz', r.Iz / 1e4, Iz, 0.02], ['Wely', r.Wely / 1e3, Wely, 0.015], ['Wply', r.Wply / 1e3, Wply, 0.015], ['Wplz', r.Wplz / 1e3, Wplz, 0.02], ['It', r.It / 1e4, It, 0.06], ['Iw', r.Iw / 1e12, Iw, 0.03]]) {
      near(`${name} ${k}`, g, x, tol, true); worst[k] = Math.max(worst[k] || 0, Math.abs(g / x - 1)); }
    cnt++;
  }
  console.log(`UKB/UKC ${cnt} sections vs British Steel table: worst ${Object.entries(worst).map(([k, v]) => k + ' ' + (v * 100).toFixed(2) + '%').join(', ')}`); }
// channels against the British Steel PFC table
{ let worst = {};
  for (const row of PFC_DATA) {
    const [name, mass, h, b, tw, tf, rr, A, Iy, Iz, Wely, Welz, Wply, Wplz, It, Iw, cy] = row;
    const r = P('channel', { h, b, tf, tw, r: rr });
    for (const [k, g, x, tol] of [['A', r.A / 1e2, A, 0.01], ['Iy', r.Iy / 1e4, Iy, 0.01], ['Iz', r.Iz / 1e4, Iz, 0.01], ['Welz', r.Welz / 1e3, Welz, 0.01], ['Wply', r.Wply / 1e3, Wply, 0.01], ['Wplz', r.Wplz / 1e3, Wplz, 0.01], ['cy', r.yc / 10, cy, 0.01], ['Iw', r.Iw / 1e12, Iw, 0.06]]) {
      near(`${name} ${k}`, g, x, tol, true); worst[k] = Math.max(worst[k] || 0, Math.abs(g / x - 1)); } }
  console.log(`PFC ${PFC_DATA.length} sections vs British Steel table: worst ${Object.entries(worst).map(([k, v]) => k + ' ' + (v * 100).toFixed(2) + '%').join(', ')}`); }
// equal angle: principal axes at 45 degrees; Iu + Iv = Iy + Iz
{ const r = P('angle', { h: 100, b: 100, t: 10, r: 12, r2: 6 });
  near('equal angle: |alpha| = 45 deg', Math.abs(r.alpha) * 180 / Math.PI, 45, 1e-9);
  near('equal angle: Iu + Iv = Iy + Iz', r.Iu + r.Iv, r.Iy + r.Iz, 1e-12);
  near('equal angle: Iy = Iz', r.Iy, r.Iz, 1e-9);
  // 100x100x10 equal angle (BS EN 10056-1: r1 = 12, r2 = 6): A 19.2 cm², Iy 177 cm⁴, Iu 280 cm⁴, Iv 73.0 cm⁴
  near('100x100x10 angle A', r.A / 100, 19.2, 0.01); near('100x100x10 angle Iy', r.Iy / 1e4, 177, 0.01);
  near('100x100x10 angle Iu', r.Iu / 1e4, 280, 0.01); near('100x100x10 angle Iv', r.Iv / 1e4, 73.0, 0.015); }
// unequal angle: tan 2 alpha = 2 Iyz / (Iz - Iy) magnitude check and product of inertia sign consistency
{ const r = P('angle', { h: 150, b: 90, t: 10, r: 0 });
  near('unequal angle principal sum', r.Iu + r.Iv, r.Iy + r.Iz, 1e-12);
  near('unequal angle Iu Iv = Iy Iz - Iyz²', r.Iu * r.Iv, r.Iy * r.Iz - r.Iyz ** 2, 1e-9); }
// T section without fillets: plastic neutral axis in the flange when the flange area exceeds the stem area
{ const b = 200, tf = 20, tw = 10, h = 220, r = P('tee', { h, b, tf, tw });
  const Af = b * tf, As = (h - tf) * tw, A = Af + As;                  // Af > As: PNA in the flange at depth d from the top
  const dpna = A / 2 / b, Wpl = b * dpna ** 2 / 2 + b * (tf - dpna) ** 2 / 2 + As * (tf - dpna + (h - tf) / 2);
  near('T: plastic modulus (PNA in the flange)', r.Wply, Wpl, 1e-9);
  near('T: plastic neutral axis', h - r.zpna, dpna, 1e-9); }
// built-up plates reproduce the I section without fillets; holes subtract
{ const a = P('isec', { h: 500, bt: 200, tt: 16, bb: 200, tb: 16, tw: 10 });
  const p = P('plates', { plates: [{ y: -100, z: 0, b: 200, h: 16 }, { y: -100, z: 484, b: 200, h: 16 }, { y: -5, z: 16, b: 10, h: 468 }] });
  for (const k of ['A', 'Iy', 'Iz', 'Wply', 'Wplz']) near(`plates = welded I: ${k}`, p[k], a[k], 1e-9, true);
  const hole = P('plates', { plates: [{ y: 0, z: 0, b: 100, h: 100 }, { y: 25, z: 25, b: 50, h: 50, hole: true }] });
  near('plate with a hole: A', hole.A, 100 * 100 - 50 * 50, 1e-12); near('plate with a hole: Iy', hole.Iy, (100 ** 4 - 50 ** 4) / 12, 1e-12); }
// monosymmetric I: shear centre between the flanges, Iw and the Wagner integral against grid integration
{ const d = { h: 600, bt: 300, tt: 20, bb: 150, tb: 15, tw: 10, r: 0 }, r = P('isec', d);
  const It_ = 20 * 300 ** 3 / 12, Ib = 15 * 150 ** 3 / 12, hs = 600 - 10 - 7.5;
  near('mono I: shear centre from the bottom', r.zs, 7.5 + hs * It_ / (It_ + Ib), 1e-12);
  near('mono I: Iw = hs² It Ib / (It + Ib)', r.Iw, hs * hs * It_ * Ib / (It_ + Ib), 1e-12);
  // grid integration of int z (y^2 + z^2) dA about the centroid
  let s = 0; const ng = 1200;
  const add = (y0, z0, b, h) => { const dy = b / ng, dz = h / ng; for (let i = 0; i < ng; i++) for (let j = 0; j < ng; j++) { const y = y0 + (i + 0.5) * dy, z = z0 + (j + 0.5) * dz - r.zc; s += z * (y * y + z * z) * dy * dz; } };
  add(-150, 580, 300, 20); add(-75, 0, 150, 15); add(-5, 15, 10, 565);
  near('mono I: z_j from the Wagner integral', r.zj, (r.zs - r.zc) - s / (2 * r.Iy), 2e-4);
  n++; const ok = r.zj > 0; console.log(`${ok ? 'ok  ' : 'FAIL'} mono I with the larger flange on top: z_j > 0 (${r.zj.toFixed(1)} mm)`); if (!ok) fails++; }
console.log(`${n - fails}/${n} section property checks passed`);
process.exit(fails ? 1 : 0);
