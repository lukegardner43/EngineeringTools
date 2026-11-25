// Asymmetric Slimflor beams (ASB): the properties the tool works out from the British Steel datasheet's dimensions against
// the datasheet's own (reference/asb_bs2026.json, public), an independent strip integration of the section (area, centroid,
// I_y and the Wagner integral behind z_j), z_j against the approximation of Kitipornchai and Trahair, the classes by hand,
// the shear area, the plastic moment with axial force against a strip integration, M_cr of uniform moment (finite elements
// against the closed form for each sign), torsional-flexural buckling by hand, and the beam tool turning ASBs away.
const L = process.env.ASB_SRC ? (() => {        // development: the scratchpad sources
  const vm = require('vm'), fs = require('fs'), d = process.env.ASB_SRC, sb = { console, Math, Array, Object, Number, Error, JSON, Set, Map, Float64Array, Int32Array, Infinity };
  vm.createContext(sb);
  vm.runInContext(['sections/sections.js', 'engine/beam.js', 'engine/ec3.js', 'engine/design.js'].map(f => fs.readFileSync(d + '/' + f, 'utf8')).join('\n') + ';this.EC3=EC3;this.Design=Design;this.ASB_DATA=ASB_DATA;', sb);
  return sb; })() : require('./load.js');
const { EC3, Design, ASB_DATA } = L;
const R = require('./reference/asb_bs2026.json').rows;
let fails = 0, n = 0;
const bad = [];
function near(name, got, exp, tol) { n++; if (!(Math.abs(got - exp) <= tol * Math.abs(exp))) { fails++; bad.push(`FAIL ${name}: got ${got} expected ${exp}`); } }
function check(name, c) { n++; if (!c) { fails++; bad.push(`FAIL ${name}`); } }
const B = nm => EC3.fromRowASB(ASB_DATA.find(r => r[0] === nm));
check('ASB: the ten British Steel sizes', ASB_DATA.length === 10 && R.length === 10);
// a strip integration of the section, piece by piece through the depth: the flanges and the web in equal strips; the fillet
// zones in equal steps of θ (u = r(1 − cos θ) from the flange, a fillet r(1 − sin θ) wide a side), so no strip straddles a
// change of width
function strips(s, n = 20000) {
  const out = [], { h, tf, tw, r, bt, bb } = s;
  const even = (a, b, w) => { const dz = (b - a) / n; for (let i = 0; i < n; i++) out.push([a + (i + 0.5) * dz, w, dz]); };
  const fillet = (d0, dir) => { const dt = Math.PI / 2 / n; for (let i = 0; i < n; i++) { const th = (i + 0.5) * dt; out.push([d0 + dir * s.r * (1 - Math.cos(th)), tw + 2 * r * (1 - Math.sin(th)), r * Math.sin(th) * dt]); } };
  even(0, tf, bt); fillet(tf, 1); even(tf + r, h - tf - r, tw); fillet(h - tf, -1); even(h - tf, h, bb);
  return out.sort((a, b) => a[0] - b[0]);
}
for (const row of ASB_DATA) {
  const s = EC3.fromRowASB(row), r = R.find(q => q.name === row[0]), nm = row[0];
  check(`${nm}: the datasheet's dimensions`, s.h === r.h && s.bt === r.bt && s.bb === r.bb && s.tw === r.tw && s.tf === r.tf && s.r === r.r && s.h - 2 * s.tf - 2 * s.r === r.d && s.fire === r.fire);
  // the datasheet's values are to three or four figures: 0.35%
  [['A', s.A / 100, r.A], ['y_e', s.c / 10, r.ye], ['I_y', s.Iy / 1e4, r.Iy], ['I_z', s.Iz / 1e4, r.Iz], ['W_el,y top', s.WelyTop / 1e3, r.WelT], ['W_el,y bottom', s.WelyBot / 1e3, r.WelB],
    ['W_el,z', s.Welz / 1e3, r.Welz], ['y_p', s.zp / 10, r.yp], ['W_pl,y', s.Wply / 1e3, r.Wply], ['W_pl,z', s.Wplz / 1e3, r.Wplz], ['I_t', s.It / 1e4, r.It], ['I_w', s.Iw / 1e12, r.Iw],
    ['i_y', Math.sqrt(s.Iy / s.A) / 10, r.iy], ['i_z', Math.sqrt(s.Iz / s.A) / 10, r.iz]].forEach(([k, g, e]) => near(`${nm} ${k}`, g, e, 0.0035));
  // the strip integration
  const st = strips(s); let A = 0, Sd = 0;
  for (const [d, w, dz] of st) { A += w * dz; Sd += w * dz * d; }
  const c = Sd / A; let Iy = 0, Wg = 0, Wp = 0, half = 0, zp = null;
  for (const [d, w, dz] of st) { const z = c - d; Iy += w * dz * z * z; Wg += z * (w ** 3 / 12 + w * z * z) * dz; }
  for (const [d, w, dz] of st) { if (zp === null && half + w * dz >= A / 2) zp = d - dz / 2 + (A / 2 - half) / w; half += w * dz; }
  for (const [d, w, dz] of st) Wp += w * dz * Math.abs(d - zp);
  near(`${nm} A (strips)`, s.A, A, 1e-6); near(`${nm} centroid (strips)`, s.c, c, 1e-6); near(`${nm} I_y (strips)`, s.Iy, Iy, 1e-6);
  near(`${nm} z_pl (strips)`, s.zp, zp, 1e-6); near(`${nm} W_pl,y (strips)`, s.Wply, Wp, 1e-6);
  near(`${nm} Wagner integral (strips)`, EC3.asbWagner(s, s.c), Wg, 1e-6);
  // the shear centre and z_j: thin-walled, the flanges' second moments; z_j against 0.45 h_s (2ρ − 1)(1 − (I_z/I_y)²), ρ = I_zt/I_z
  near(`${nm} shear centre below the top`, s.dS, s.tf / 2 + (s.h - s.tf) * s.bb ** 3 / (s.bt ** 3 + s.bb ** 3), 1e-12);
  const rho = s.Izt / s.Iz, zjKT = 0.45 * s.hs * (2 * rho - 1) * (1 - (s.Iz / s.Iy) ** 2);
  near(`${nm} z_j against Kitipornchai and Trahair's approximation`, s.zj, zjKT, 0.08);
  check(`${nm}: z_j negative (the narrower flange on top)`, s.zj < 0 && s.z0 < 0);
  // the shear area, 6.2.6(3)(a) with each flange its own width
  near(`${nm} A_v`, EC3.shear(s, 355).Av, Math.max(s.A - (s.bt + s.bb) * s.tf + (s.tw + 2 * s.r) * s.tf, (s.h - 2 * s.tf) * s.tw), 1e-12);
  // the plastic moment with axial force against the strips: compression above (sagging) the depth that balances N
  for (const [N, sg] of [[0, 1], [0.3, 1], [0.3, -1], [-0.5, 1], [0.8, -1]]) {
    const fy = 355, F = s.A * fy, Ned = N * F, Ac = (s.A + Ned / fy) / 2;
    let acc = 0, dp = null;
    const order = sg > 0 ? st : st.slice().reverse();
    for (const [d, w, dz] of order) { if (dp === null && acc + w * dz >= Ac) dp = sg > 0 ? d - dz / 2 + (Ac - acc) / w : d + dz / 2 - (Ac - acc) / w; acc += w * dz; }
    let M = 0;
    for (const [d, w, dz] of st) {            // the strip at the neutral axis split in proportion
      const above = Math.max(0, Math.min(1, (dp - (d - dz / 2)) / dz)), f = sg > 0 ? above : 1 - above;
      M += fy * (2 * f - 1) * w * dz * (s.c - d);
    }
    near(`${nm} M_N,y,Rd at n = ${N}, ${sg > 0 ? 'sagging' : 'hogging'} (strips)`, EC3.asbPlasticM(s, fy, Ned, sg).M, Math.abs(M), 1e-6);
  }
  // M_cr under uniform moment: the finite elements (with the Wagner term) against the closed form, both signs
  for (const sg of [1, -1]) for (const Lm of [2000, 6000]) {
    const lam = EC3.mcrFE({ L: Lm, EIz: EC3.E * s.Iz, GIt: EC3.G * s.It, EIw: EC3.E * s.Iw, hs: 2 * s.dS - s.tf, zj: s.zj, M: () => sg * 1e6, restraints: [{ x: 0, type: 'fork' }, { x: Lm, type: 'fork' }], nEl: 24 });
    near(`${nm} M_cr, uniform ${sg > 0 ? 'sagging' : 'hogging'}, ${Lm / 1000} m`, lam * 1e6, EC3.mcrUniform(s, Lm, sg), 2e-3);
  }
  check(`${nm}: M_cr sagging (the narrower flange in compression) the less`, EC3.mcrUniform(s, 4000, 1) < EC3.mcrUniform({ ...s, zj: 0 }, 4000) && EC3.mcrUniform({ ...s, zj: 0 }, 4000) < EC3.mcrUniform(s, 4000, -1));
}
// the classes by hand: 280 ASB 74 (bottom flange c = (285 − 10 − 54)/2 = 110.5 mm, c/t = 7.89; top 3.96; web 190/10 = 19)
{ const s = B('280 ASB 74'), e355 = Math.sqrt(235 / 355), e460 = Math.sqrt(235 / 460);
  check('280 ASB 74 S355 sagging: Class 1', EC3.classify(s, 355, 0, true, false, 1).cls === 1);
  check('280 ASB 74 S355 hogging: the bottom flange Class 2 (9ε < 7.89 ≤ 10ε)', 7.893 > 9 * e355 && 7.893 <= 10 * e355 && EC3.classify(s, 355, 0, true, false, -1).cls === 2 && EC3.classify(s, 355, 0, true, false, -1).flangeB.cls === 2);
  check('280 ASB 74 S355 in compression: Class 2 (both flanges in compression)', EC3.classify(s, 355, 1, false).cls === 2);
  check('280 ASB 74 S460 hogging: Class 3', 7.893 > 10 * e460 && EC3.classify(s, 460, 0, true, false, -1).cls === 3);
  check('280 ASB 74 sagging: the top flange compressed, the bottom not', (c => c.flange.comp && !c.flangeB.comp)(EC3.classify(s, 355, 0, true, false, 1)));
  // the web: sagging, no axial force, α from z_pl: (z_pl − t_f − r)/c
  const c = EC3.classify(s, 355, 0, true, false, 1); near('280 ASB 74 web α, sagging', c.web.alpha, Math.min(1, (s.zp - s.tf - s.r) / (s.h - 2 * s.tf - 2 * s.r)), 1e-9);
  // ψ: the top at f_y, linear about the centroid
  near('280 ASB 74 web ψ, sagging', c.web.psi, (s.c - (s.h - s.tf - s.r)) / (s.c - s.tf - s.r), 1e-12);
  // the cross-section: M_pl = W_pl f_y at no axial force; Class 3 elastic in S460 hogging with W_el to the bottom
  const sc = EC3.sectionCheck(s, 355, 0, 200e6, 50e3); near('280 ASB 74 M_pl,y,Rd = W_pl,y f_y', sc.Mply, s.Wply * 355, 1e-9);
  const s3 = EC3.sectionCheck(s, 460, 0, -100e6, 0); check('280 ASB 74 S460 hogging: elastic', s3.method === 'elastic');
  near('280 ASB 74 S460 hogging: σ at the bottom', s3.sBot, 100e6 / s.WelyBot, 1e-12); near('280 ASB 74 S460 hogging: utilisation', s3.uM, Math.max(100e6 / s.WelyTop, 100e6 / s.WelyBot) / 460, 1e-12); }
// torsional-flexural buckling by hand (EN 1993-1-3 6.2.3(7)): N_cr,TF from N_cr,z, N_cr,T and z_0
{ const s = B('300 ASB 153'), Lm = 4000, E = EC3.E, G = EC3.G, ab = Design.axialBuckling(s, 355, 'S355', 1, Lm, Lm, Lm);
  const i02 = (s.Iy + s.Iz) / s.A + s.z0 ** 2, NT = (G * s.It + Math.PI ** 2 * E * s.Iw / Lm ** 2) / i02, Nz = Math.PI ** 2 * E * s.Iz / Lm ** 2, b = 1 - s.z0 ** 2 / i02;
  const NTF = Nz / (2 * b) * (1 + NT / Nz - Math.sqrt((1 - NT / Nz) ** 2 + 4 * s.z0 ** 2 / i02 * NT / Nz));
  check('300 ASB 153: torsional-flexural', ab.torsionalMode === 'torsional-flexural' && ab.tfAxis === 'z');
  near('300 ASB 153 N_cr,TF at 4 m', ab.NcrTF, NTF, 1e-12);
  check('300 ASB 153: curves b and c', ab.curves.y === 'b' && ab.curves.z === 'c');
  const p = EC3.ltbParams(s); check('ASB LTB: 6.3.2.3, curve d', p.method === '6.3.2.3' && p.curve === 'd' && p.lam0 === 0.4 && p.beta === 0.75); }
// a member: sagging along its length, the narrower flange in compression governs; Annex A with compression
{ const s = B('280 ASB 105'), m = Design.designMember({ sec: s, grade: 'S355', L: 5000, N: 300e3, MyB: 80e6, MyT: 80e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
  check('280 ASB 105 member: sagging LTB', m.gov.ltb.sgn === 1);
  near('280 ASB 105 member: M_cr uniform sagging', m.gov.ltb.Mcr, 80e6 / 80e6 * EC3.mcrUniform(s, 5000, 1), 2e-3);
  check('280 ASB 105 member: Annex A', m.gov.interaction.ir.method === 'A' && m.annexA); }
{ let msg = ''; try { Design.designBeam({ sec: B('280 ASB 74'), grade: 'S355', spans: [6000], loads: [] }); } catch (e) { msg = e.message; }
  check('the beam tool turns an ASB away (designed as a member)', /ASB/.test(msg)); }
bad.slice(0, 30).forEach(l => console.log(l));
console.log(`${n - fails}/${n} ASB checks passed (British Steel ASB datasheet, July 2026)`);
process.exit(fails ? 1 : 0);
