// The Blue Book series added to Steel Member Design: universal bearing piles (UKBP, British Steel UBP datasheet) and the
// four parallel flange channels British Steel no longer lists (Corus 2005 tables). Each row's tabulated properties are
// checked against the properties recomputed from its dimensions (rectangles and root fillets), and each is designed.
const { EC3, Design, PFC_DATA, UKBP_DATA } = require('./load.js');
let fails = 0, n = 0;
const bad = [];
function near(name, got, exp, tol) {
  n++;
  const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-12);
  if (!ok) { fails++; bad.push(`FAIL ${name}: got ${got} expected ${exp}`); }
}
function check(name, cond) { n++; if (!cond) { fails++; bad.push(`FAIL ${name}`); } }

// UKBP: 17 sizes; tabulated A, I, W against the rolled I section from h, b, t_w, t_f, r
check('UKBP: 17 sizes', UKBP_DATA.length === 17);
for (const r of UKBP_DATA) {
  const s = EC3.fromRow(r), c = EC3.customI({ h: s.h, b: s.b, tw: s.tw, tf: s.tf, r: s.r, rolled: true });
  check(`${s.name}: named UKBP`, /^\d+×\d+×\d+ UKBP$/.test(s.name));
  for (const k of ['A', 'Iy', 'Iz', 'Wely', 'Welz', 'Wply', 'Wplz']) near(`${s.name} ${k}`, c[k], s[k], 0.012);
  near(`${s.name} I_t`, c.It, s.It, 0.03);
  near(`${s.name} I_w`, c.Iw, s.Iw, 0.03);
  const cur = EC3.fbCurves(s, 'S355');
  check(`${s.name}: rolled H, curves b and c`, cur.y === 'b' && cur.z === 'c');
  const m = Design.designMember({ sec: s, grade: 'S355', L: 4000, N: 1e6, MyB: 50e6, MyT: -20e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
  check(`${s.name}: designed`, Number.isFinite(m.utilMax) && m.utilMax > 0);
}
// a pile in pure compression: N_b,Rd by hand, 305×305×110 UKBP, S355 (t_f 15.4 ≤ 16: f_y 355), L 6 m, curve c about z-z
{ const s = EC3.fromRow(UKBP_DATA.find(r => r[0] === '305×305×110 UKBP')), fy = 355, L = 6000;
  const lam = Math.sqrt(s.A * fy / (Math.PI ** 2 * EC3.E * s.Iz / L / L)), phi = 0.5 * (1 + 0.49 * (lam - 0.2) + lam * lam), chi = 1 / (phi + Math.sqrt(phi * phi - lam * lam));
  const ab = Design.axialBuckling(s, fy, 'S355', 1, L, L, L);
  near('305×305×110 UKBP N_b,z,Rd by hand', ab.z.chi * ab.NRk, chi * s.A * fy, 1e-12);
  // flange c/t_f = (310.7 − 15.3 − 2×20)/2/15.4 = 8.29: over 10ε = 8.14, within 14ε = 11.39
  check('305×305×110 UKBP: Class 3 in compression (the flange)', EC3.classify(s, fy, 1, false).cls === 3 && EC3.classify(s, fy, 1, false).flange.cls === 3); }
// a Class 4 flange, 356×368×109 UKBP in S355: c/t_f = (371 − 12.8 − 40)/2/12.9 = 12.33 > 14ε. EN 1993-1-5 Table 4.2, k_σ = 0.43:
// λ_p = (c/t)/(28.4ε√k_σ), ρ = (λ_p − 0.188)/λ_p²; uniform compression A_eff = A − 4(1 − ρ)c t_f; bending: the compression
// flange's tips lost, I_eff about the shifted centroid, W_eff to the farther (tension) fibre
{ const s = EC3.fromRow(UKBP_DATA.find(r => r[0] === '356×368×109 UKBP')), fy = 355, eps = Math.sqrt(235 / fy);
  const c = (s.b - s.tw - 2 * s.r) / 2, lp = c / s.tf / (28.4 * eps * Math.sqrt(0.43)), rho = (lp - 0.188) / lp ** 2;
  check('356×368×109 UKBP: Class 4 flange in compression', EC3.classify(s, fy, 1, false).flange.cls === 4);
  near('356×368×109 UKBP A_eff', EC3.aeffCompression(s, fy).Aeff, s.A - 4 * (1 - rho) * c * s.tf, 1e-12);
  const Ah = 2 * (1 - rho) * c * s.tf, zh = s.h / 2 - s.tf / 2, Ae = s.A - Ah, sh = -Ah * zh / Ae;
  const Ie = s.Iy - (2 * (1 - rho) * c * s.tf ** 3 / 12 + Ah * zh * zh) - Ae * sh * sh;
  const wb = EC3.weffBending(s, fy);
  near('356×368×109 UKBP W_eff,y (the compression flange reduced)', wb.Weff, Ie / (s.h / 2 - sh), 1e-9);
  check('356×368×109 UKBP: the web keeps its full width', wb.hole === 0);
  const sc = EC3.sectionCheck(s, fy, 2e6, 300e6, 50e3);
  near('356×368×109 UKBP: N + M_y on A_eff and W_eff (6.2.9.3)', sc.uNM, (2e6 / (s.A - 4 * (1 - rho) * c * s.tf) + 300e6 / (Ie / (s.h / 2 - sh))) / fy, 1e-9);
  let threw = false; try { EC3.sectionCheck(s, fy, 2e6, 0, 0, 20e6, 0); } catch (e) { threw = /minor-axis/.test(e.message); }
  check('356×368×109 UKBP: a Class 4 flange with minor-axis bending is refused', threw); }

// PFC: the four Corus 2005 sizes, in depth order with the British Steel range
const corus = PFC_DATA.filter(r => r[17] === 'Corus 2005').map(r => r[0]);
check('PFC: the four Corus 2005 sizes', corus.join() === '100×50×10 PFC,125×65×15 PFC,380×100×54 PFC,430×100×64 PFC');
check('PFC: in depth order', PFC_DATA.every((r, i) => !i || r[2] >= PFC_DATA[i - 1][2]));
for (const nm of corus) {
  const s = EC3.fromRowPFC(PFC_DATA.find(r => r[0] === nm));
  check(`${nm}: source tagged`, s.src === 'Corus 2005');
  // A and I_y of the plates and the two root fillets
  const { As, e, Ic } = { As: (1 - Math.PI / 4) * s.r ** 2, e: s.r * (10 - 3 * Math.PI) / (12 - 3 * Math.PI), Ic: 0 };
  const A = 2 * s.b * s.tf + (s.h - 2 * s.tf) * s.tw + 2 * As;
  near(`${nm} A from the dimensions`, A, s.A, 0.006);
  const Iy = (s.b * s.h ** 3 - (s.b - s.tw) * (s.h - 2 * s.tf) ** 3) / 12 + 2 * As * (s.h / 2 - s.tf - e) ** 2;
  near(`${nm} I_y from the dimensions`, Iy, s.Iy, 0.006);
  const m = Design.designMember({ sec: s, grade: 'S275', L: 3000, N: 50e3, MyB: 5e6, MyT: 5e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
  check(`${nm}: designed`, Number.isFinite(m.utilMax) && m.utilMax > 0);
}
bad.slice(0, 30).forEach(l => console.log(l));
console.log(`${n - fails}/${n} series checks passed`);
process.exit(fails ? 1 : 0);
