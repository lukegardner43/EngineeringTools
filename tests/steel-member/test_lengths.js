// Member page: buckling lengths given in metres (L_cr,y, L_cr,z for axial buckling about y-y and z-z, L_LT for
// lateral-torsional buckling under M_y). Checked against the factor and segment inputs they replace, against the
// closed-form critical loads and moment, and for the conservative search along the member when L_LT < L.
const { EC3, Design, SECTION_DATA } = require('./load.js');
let pass = 0, fail = 0;
const truth = (n, ok, got) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (ok || got === undefined ? '' : `  (got ${JSON.stringify(got)})`)); };
const rel = (a, b, r = 1e-9) => Math.abs(a - b) <= r * Math.max(Math.abs(b), 1e-30);
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const find = n => EC3.fromRow(SECTION_DATA.find(r => r[0] === n));
const uc = find('254×254×73 UKC'), ub = find('457×191×67 UKB'), E = 210000, G = E / 2.6;
const M = (o) => Design.designMember({ grade: 'S355', N: 0, MyT: 0, MyB: 0, MzT: 0, MzB: 0, ky: 1, kz: 1, nLT: 1, ...o });

// ---------- the same member by factors and by lengths ----------
{ const base = { sec: uc, L: 5000, N: 1200e3, MyT: 40e6, MyB: 0 };
  const a = M({ ...base, ky: 0.85, kz: 0.7, nLT: 2 }), b = M({ ...base, Lcr: { y: 4250, z: 3500, LT: 2500 } });
  truth('lengths = factors: χ_y', rel(b.ab.y.chi, a.ab.y.chi)); truth('lengths = factors: χ_z', rel(b.ab.z.chi, a.ab.z.chi));
  truth('lengths = factors: torsional length L_LT = L/2', rel(b.ab.LT, 2500) && rel(b.ab.T.chi, a.ab.T.chi));
  truth('lengths = factors: flexural utilisation', rel(b.gov.flexural.util, a.gov.flexural.util));
  truth('lengths = factors: L_LT = L/2 finds the top segment (moment 20 → 40 kNm)', rel(b.gov.ltb.util, a.gov.ltb.util) && rel(b.gov.ltb.xa, 2500));
  truth('lengths = factors: interaction', rel(b.gov.interaction.util, a.gov.interaction.util));
  truth('lengths recorded', b.Lcr.given && rel(b.Lcr.y, 4250) && rel(b.Lcr.z, 3500) && rel(b.Lcr.LT, 2500) && !a.Lcr.given && rel(a.Lcr.LT, 2500));
  truth('every position checked: L_LT 2.5 m on 5 m', b.windows >= 25 && b.segResults.length === 1);
  const c = M({ ...base, ky: 1, kz: 1, nLT: 3 }), d = M({ ...base, Lcr: { y: 5000, z: 5000, LT: 5000 / 3 } });
  truth('lengths = factors: three segments (the top one at x = 3.33 m)', rel(d.gov.ltb.util, c.gov.ltb.util, 1e-6) && rel(d.gov.interaction.util, c.gov.interaction.util, 1e-6) && rel(d.gov.ltb.xa, 10000 / 3, 1e-6));
}

// ---------- flexural buckling with the given lengths, against π²EI/L² ----------
{ const r = M({ sec: uc, L: 6000, N: 1000e3, Lcr: { y: 7200, z: 3100, LT: 6000 } });
  truth('N_cr,y = π²EI_y/L_cr,y² (7.2 m)', rel(r.ab.Ncry, Math.PI ** 2 * E * uc.Iy / 7200 ** 2));
  truth('N_cr,z = π²EI_z/L_cr,z² (3.1 m)', rel(r.ab.Ncrz, Math.PI ** 2 * E * uc.Iz / 3100 ** 2));
  truth('L_cr,y above the member: a sway mode, C_my 0.9', r.swayY && !r.swayZ);
}
// ---------- lateral-torsional buckling ----------
{ // uniform moment, L_LT = L: M_cr by the closed form for a fork-fork length, C1 = 1
  const L = 4000, r = M({ sec: ub, L, MyT: 150e6, MyB: 150e6, Lcr: { y: L, z: L, LT: L } }), lt = r.gov.ltb;
  const mcr = Lt => Math.PI ** 2 * E * ub.Iz / Lt ** 2 * Math.sqrt(ub.Iw / ub.Iz + Lt ** 2 * G * ub.It / (Math.PI ** 2 * E * ub.Iz));
  truth('uniform moment, L_LT = L: M_cr by the closed form (finite elements, 0.1 %)', rel(lt.Mcr, mcr(L), 1e-3), lt.Mcr / mcr(L));
  // L_LT above the member (an end-condition factor 1.2): M_cr = C1 M_cr,0(L_LT), C1 from the member's diagram
  const r2 = M({ sec: ub, L, MyT: 150e6, MyB: 0, Lcr: { y: L, z: L, LT: 1.2 * L } }), r1 = M({ sec: ub, L, MyT: 150e6, MyB: 0 });
  truth('L_LT 1.2L: C1 from the member (ψ = 0, as the factor input)', rel(r2.gov.ltb.C1, r1.gov.ltb.C1));
  truth('L_LT 1.2L: M_cr = C1 × M_cr,0(1.2L)', rel(r2.gov.ltb.Mcr, r1.gov.ltb.C1 * EC3.mcrUniform(ub, 1.2 * L)));
  truth('L_LT 1.2L: lower M_cr than L', r2.gov.ltb.Mcr < r1.gov.ltb.Mcr && r2.gov.ltb.util > r1.gov.ltb.util);
  // L_LT below the member: the worst position along it, never less onerous than equal segments of that length
  for (const [MyB, nm] of [[0, 'ψ = 0'], [-150e6, 'double curvature'], [75e6, 'ψ = 0.5']]) {
    const g = M({ sec: ub, L: 6000, MyT: 150e6, MyB, Lcr: { y: 6000, z: 6000, LT: 2000 } }), s = M({ sec: ub, L: 6000, MyT: 150e6, MyB, nLT: 3 });
    truth(`L_LT 2 m on 6 m (${nm}): at least the three-segment result`, g.gov.ltb.util >= s.gov.ltb.util * (1 - 1e-9), [g.gov.ltb.util, s.gov.ltb.util]);
  }
  { // with the largest moment mid-way along, a stretch centred on it governs, not an end segment
    const L = 12000, Mm = 250e6, r3 = Design.designMember({ sec: ub, grade: 'S355', L, N: 0, MyB: 0, MyT: 0, MzB: 0, MzT: 0, Myf: x => 4 * Mm * x * (L - x) / L ** 2, Vzf: x => 4 * Mm * (L - 2 * x) / L ** 2, hasUdl: true, ky: 1, kz: 1, nLT: 1, Lcr: { y: L, z: L, LT: 4000 } });
    truth('a parabolic moment: the 4 m stretch centred on mid-span governs (χ_LT < 1)', rel(r3.gov.ltb.xa, 4000, 1e-6) && rel(r3.gov.ltb.Mmax, Mm, 1e-6) && r3.gov.ltb.chiMod < 1, [r3.gov.ltb.xa, r3.gov.ltb.chiMod]);
  }
}
// ---------- errors; the factor input unchanged ----------
truth('a zero length refused', throws(() => M({ sec: uc, L: 5000, N: 100e3, Lcr: { y: 5000, z: 0, LT: 5000 } }), /Buckling lengths must be positive/));
{ const r = M({ sec: uc, L: 5000, N: 1200e3, MyT: 40e6 });
  truth('factor input: the lengths it implies', !r.Lcr.given && rel(r.Lcr.y, 5000) && rel(r.Lcr.z, 5000) && rel(r.Lcr.LT, 5000) && r.segResults.length === 1 && r.windows === 0); }
console.log(`\n${pass}/${pass + fail} buckling length checks passed`);
process.exit(fail ? 1 : 0);
