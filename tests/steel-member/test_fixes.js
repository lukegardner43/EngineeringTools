// Regression tests for the fixes from the independent engine review (load height at a free tip, Class 4 web in bending,
// axial buckling of cantilevers). Reference values: reference/ref_fixes.py -> ref_fixes.json (numpy/scipy, independent).
const { EC3, Design, SECTION_DATA } = require('./load.js');
const REF = require('./ref_fixes.json');
let fails = 0, n = 0;
function near(name, got, exp, tol) {
  n++;
  const ok = Math.abs(got - exp) <= tol * Math.abs(exp);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${got.toPrecision(6)} expected ${exp.toPrecision(6)} (${((got / exp - 1) * 100).toFixed(3)}%)`);
  if (!ok) fails++;
}
function truthy(name, v) { n++; console.log(`${v ? 'ok  ' : 'FAIL'} ${name}`); if (!v) fails++; }
const { E, G } = EC3;
const sec = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('457×191×67')));
const i02 = (sec.Iy + sec.Iz) / sec.A;

// ---- critical axial force by FE against closed forms and the exact overhang equation
{ const L = 5000, EI = E * sec.Iz, pin = [{ x: 0, type: 'pin' }, { x: L, type: 'pin' }];
  near('Ncr pinned-pinned', EC3.ncrFE({ L, EI, restraints: pin }), Math.PI ** 2 * EI / L ** 2, 1e-5);
  near('Ncr fixed-free', EC3.ncrFE({ L, EI, restraints: [{ x: 0, type: 'fixed' }] }), Math.PI ** 2 * EI / (2 * L) ** 2, 1e-5);
  near('Ncr fixed-pinned (20.19 EI/L²)', EC3.ncrFE({ L, EI, restraints: [{ x: 0, type: 'fixed' }, { x: L, type: 'pin' }] }), 20.1907 * EI / L ** 2, 1e-4);
  near('NcrT forks (6.3.1.4)', EC3.ncrFE({ L, EI: E * sec.Iw, GJ: G * sec.It, i02, restraints: pin }), (G * sec.It + Math.PI ** 2 * E * sec.Iw / L ** 2) / i02, 1e-5);
  near('NcrT built-in cantilever', EC3.ncrFE({ L: 3000, EI: E * sec.Iw, GJ: G * sec.It, i02, restraints: [{ x: 0, type: 'fixed' }] }), REF.cant_fixed_NcrT_3000, 1e-5);
  const ov = [{ x: 0, type: 'pin' }, { x: 4000, type: 'pin' }];
  near('Ncr,z pinned span 4 m + 3 m overhang (exact equation)', EC3.ncrFE({ L: 7000, EI, restraints: ov }), REF.overhang_Ncrz_4000_3000, 1e-5);
  near('Ncr,T same arrangement (exact equation)', EC3.ncrFE({ L: 7000, EI: E * sec.Iw, GJ: G * sec.It, i02, restraints: ov }), REF.overhang_NcrT_4000_3000, 1e-5);
}

// ---- load height: point load at a free cantilever tip (previously dropped from the load-height term)
{ const mk = destab => Design.designBeam({ sec, grade: 'S355', spans: [], cantR: 3000, endLeft: 'fixed',
    loads: [{ case: 'G', member: 0, type: 'point', P: 20e3, a: 3000 }], selfWeight: false, rule: '6.10', psi0: 0.7,
    restraint: [{ mode: 'ends' }], tipRestrained: { R: false }, destab });
  const top = mk(true).gov.ltb, sc = mk(false).gov.ltb;
  near('built-in cantilever, tip load at shear centre: Mcr vs Ritz', sc.Mcr, REF.cant_sc_Mcr, 2e-3);
  near('built-in cantilever, tip load on top flange (destabilising): Mcr vs Ritz', top.Mcr, REF.cant_top_Mcr, 2e-3);
}

// ---- cantilever with a backspan under axial compression: buckling lengths, Cm factors
{ const r = Design.designBeam({ sec, grade: 'S355', spans: [4000], cantR: 3000, endLeft: 'pinned',
    loads: [{ case: 'G', member: 0, type: 'udl', w: 2 }, { case: 'G', member: 1, type: 'udl', w: 2 }], selfWeight: false, rule: '6.10', psi0: 0.7, N: 150e3,
    restraint: [{ mode: 'ends' }, { mode: 'ends' }], tipRestrained: { R: false }, destab: false });
  const f = r.gov.flexural;
  truthy('flexural buckling governed by the free cantilever segment', f.free === true);
  near('cantilever Ncr,z from backspan + overhang model', f.ab.Ncrz, REF.overhang_Ncrz_4000_3000, 1e-4);
  near('cantilever Ncr,T from backspan + overhang model', f.ab.NcrT, REF.overhang_NcrT_4000_3000, 1e-4);
  near('cantilever Ncr,y from the whole beam on its supports', f.ab.Ncry, REF.overhang_Ncry_4000_3000, 1e-4);
  const g = r.gov.interaction;
  truthy(`interaction on the free segment uses Cmy = 0.9 (sway) and CmLT = 1.0 (got ${g.ir.Cmy}, ${g.ir.CmLT})`, g.freeLT && g.ir.Cmy === 0.9 && g.ir.CmLT === 1.0);
}

// ---- Class 4 web in bending: Weff (EN 1993-1-5 4.4) instead of Wel
{ const pg = EC3.customI({ name: 'PG 1200x300x8x20', h: 1200, b: 300, tw: 8, tf: 20 });
  const fy = EC3.yieldStrength('S355', 20);
  const w = EC3.weffBending(pg, fy);
  near('plate girder Wel (sanity)', pg.Wely, REF.pg.Wel, 1e-9);
  near('plate girder rho (Table 4.1, psi = -1)', w.rho, REF.pg.rho, 1e-9);
  near('plate girder Weff,y', w.Weff, REF.pg.Weff, 1e-9);
  const sc = EC3.sectionCheck(pg, fy, 0, 1000e6, 0);
  truthy(`section check uses Weff for a Class 4 web (method ${sc.method})`, sc.method === 'effective' && Math.abs(sc.Wy - REF.pg.Weff) < 1);
  near('Mc,Rd = Weff fy', 1000e6 / sc.uM, REF.pg.Weff * fy, 1e-9);
  const r = Design.designBeam({ sec: pg, grade: 'S355', spans: [12000], loads: [{ case: 'G', member: 0, type: 'udl', w: 30 }], selfWeight: false,
    rule: '6.10', psi0: 0.7, restraint: [{ mode: 'points', pts: [3000, 6000, 9000] }], destab: false });
  near('LTB uses Weff for the Class 4 section', r.gov.ltb.Wy, REF.pg.Weff, 1e-9);
  // rolled section with a Class 3/1 web: Weff = Wel (no change)
  near('rolled UKB: Weff = Wel', EC3.weffBending(sec, 355).Weff, sec.Wely, 1e-12);
}
// ---- sway buckling mode: Cm = 0.9 (Table B.3 note) when the buckling length exceeds the member length
{ const uc = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('254×254×73')));
  const r = Design.designMember({ sec: uc, grade: 'S355', L: 4000, N: 600e3, MyT: 60e6, MyB: 0, MzT: 0, MzB: 0, ky: 2, kz: 1, nLT: 1 });
  const ir = r.gov.interaction.ir;
  truthy(`member mode, ky = 2: Cmy = 0.9 (got ${ir.Cmy})`, ir.Cmy === 0.9);
  // hand values (review): kyy = 0.9 x min(1 + (lamY - 0.2) nY, 1 + 0.8 nY); (6.61) = 0.463
  near('member mode, ky = 2: kyy', ir.kyy, 0.9 * Math.min(1 + (r.ab.lamY - 0.2) * ir.nY, 1 + 0.8 * ir.nY), 1e-12);
  near('member mode, ky = 2: (6.61)', ir.u61, 0.463, 2e-3);
  const r1 = Design.designMember({ sec: uc, grade: 'S355', L: 4000, N: 600e3, MyT: 60e6, MyB: 0, MzT: 0, MzB: 0, ky: 1, kz: 1, nLT: 1 });
  near('member mode, ky = 1: Cmy from Table B.3 (psi = 0)', r1.gov.interaction.ir.Cmy, 0.6, 1e-12);
}

// ---- Table B.3, last row, concentrated load: larger of the two readings (0.90 -/+ 0.10 ah (1 + 2 psi))
{ const c = EC3.cmFactor([0, 0.5, 1], [-90, 100, 9], false, true);
  near('Table B.3 ah = -0.9, psi = -0.1, point load: Cm', c.Cm, 0.90 + 0.10 * 0.9 * 0.8, 1e-12);
  const u = EC3.cmFactor([0, 0.5, 1], [-90, 100, 9], true, false);
  near('Table B.3 ah = -0.9, psi = -0.1, uniform load: Cm', u.Cm, 0.95 + 0.05 * -0.9 * 0.8, 1e-12);
}

// ---- web susceptible to shear buckling: bending + shear by EN 1993-1-5 7.1 (not 6.2.8)
{ const s = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('914×305×201')));
  const fy = EC3.yieldStrength('S460', Math.max(s.tf, s.tw)), sh = EC3.shear(s, fy);
  truthy('914×305×201 UKB in S460 needs a shear buckling check', sh.slender);
  const V = 0.9 * sh.VRd, sc = EC3.sectionCheck(s, fy, 0, 1000e6, V);
  const eta3 = V / sh.Vb, Mpl = s.Wply * fy, Mf = s.b * s.tf * (s.h - s.tf) * fy;
  const Mv = Mpl - (Mpl - Mf) * (2 * eta3 - 1) ** 2;
  near('7.1: M resistance with shear', sc.en71.Mv, Mv, 1e-12);
  near('7.1: governs the bending utilisation', sc.uM, 1000e6 / Mv, 1e-12);
  const low = EC3.sectionCheck(s, fy, 0, 1000e6, 0.45 * sh.Vb);
  truthy('7.1: no interaction for eta3 <= 0.5', !low.en71 && Math.abs(low.uM - 1000e6 / (s.Wply * fy)) < 1e-12);
}
console.log(`${n - fails}/${n} review-fix tests passed`);
process.exit(fails ? 1 : 0);
