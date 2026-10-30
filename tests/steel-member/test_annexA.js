// Annex A (Method 1) interaction factors against the published intermediate values of ECCS Technical Publication No. 119,
// Worked Example 5 (as reproduced in the SCIA Engineer EN 1993 benchmark 21): IPE 500, S235, L = 3.75 m, NEd = 500 kN,
// My,Ed = 200 kNm, Mz,Ed = 25 kNm (linear, psi = 0). The member is identified from the published resistances
// (Nc,Rd 2715 kN, Mc,y,Rd 516 kNm, Mc,z,Rd 78.9 kNm, c/t ratios) and Ncr,y / Ncr,z (L = 3.75 m); the actions are
// recovered from the published Method 2 factors and results. Published values are given to 3 significant figures.
const { EC3, Design } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol) => {
  n++;
  const ok = Math.abs(got - exp) <= tol;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toFixed(4)} published ${exp}`);
  if (!ok) fails++;
};
const ipe = EC3.customI({ name: 'IPE 500', h: 500, b: 200, tw: 10.2, tf: 16, r: 21, rolled: true });
const fy = 235, L = 3750, N = 500e3, My = 200e6, Mz = 25e6;
near('A (cm2)', ipe.A / 100, 115.5, 0.3);
near('Nc,Rd (kN)', ipe.A * fy / 1e3, 2715, 5);
near('Mc,y,Rd (kNm)', ipe.Wply * fy / 1e6, 516, 1.5);
near('Mc,z,Rd (kNm)', ipe.Wplz * fy / 1e6, 78.9, 0.6);
const Ncry = Math.PI ** 2 * EC3.E * ipe.Iy / L ** 2, Ncrz = Math.PI ** 2 * EC3.E * ipe.Iz / L ** 2;
near('Ncr,y (kN)', Ncry / 1e3, 71038, 300);
near('Ncr,z (kN)', Ncrz / 1e3, 3157, 15);
near('Mcr,0 uniform moment (kNm)', EC3.mcrUniform(ipe, L) / 1e6, 899, 8);
// Annex A with the published inputs (chi_LT = 0.826: general case with f, as used by the reference)
const i02 = (ipe.Iy + ipe.Iz) / ipe.A, NcrT = (EC3.G * ipe.It + Math.PI ** 2 * EC3.E * ipe.Iw / L ** 2) / i02;
const k = EC3.annexA({ cls: 1, N, My, Mz, NRk: 2715e3, chiY: 1.0, chiZ: 0.644, lamY: 0.195, lamZ: 0.927, Ncry: 71038e3, Ncrz: 3157e3, NcrT, NcrTF: NcrT,
  Cmy0: 0.999, Cmz0: EC3.cm0Linear(0, N, 3157e3), lam0: 0.757, C1: 1.2, chiLT: 0.826, aLT: 1 - ipe.It / ipe.Iy,
  Wply: 2194e3, Wely: 1928e3, Wplz: 335.9e3, Welz: 214.2e3, fy, epsY: My / N * 11550 / 1928e3, torsional: true });
near('Cmz,0 (end moments, psi = 0)', k.Cmz, 0.771, 0.0006);
near('mu_y', k.muY, 1.00, 0.005);
near('mu_z', k.muZ, 0.937, 0.0006);
near('wy', k.C.wy, 1.138, 0.0006);
near('wz', k.C.wz, 1.5, 1e-9);
near('aLT', k.aLT, 0.998, 0.0006);
near('Cmy', k.Cmy, 1.00, 0.005);
near('bLT', k.C.bLT, 0.043, 0.0006);
near('cLT', k.C.cLT, 0.468, 0.0006);
near('dLT', k.C.dLT, 0.347, 0.0012);
near('eLT', k.C.eLT, 0.719, 0.0012);
near('Cyy', k.C.Cyy, 0.981, 0.0006);
near('Cyz', k.C.Cyz, 0.863, 0.0006);
near('Czy', k.C.Czy, 0.843, 0.0006);
near('Czz (AC:2009 form)', k.C.Czz, 1.014, 0.0006);
const nY = N / (1.0 * 2715e3), nZ = N / (0.644 * 2715e3), a = My / (0.826 * 515.6e6), b = Mz / 78.9e6;
near('(6.61)', nY + k.kyy * a + k.kyz * b, 0.964, 0.003);
near('(6.62)', nZ + k.kzy * a + k.kzz * b, 0.870, 0.006);
// Method 2 values of the same benchmark through annexB (kyy 0.924, kyz 0.489, kzy 0.961, kzz 0.815)
const kb = EC3.annexB({ cls: 1, lamY: 0.195, lamZ: 0.927, nY, nZ, Cmy: 0.925, Cmz: 0.6, CmLT: 0.925, torsional: true });
near('Annex B kyy', kb.kyy, 0.924, 0.0006);
near('Annex B kyz', kb.kyz, 0.489, 0.0006);
near('Annex B kzy', kb.kzy, 0.961, 0.0006);
near('Annex B kzz', kb.kzz, 0.815, 0.0006);
// member mode end to end with Annex A selected: runs and reports Method A factors
{ const r = Design.designMember({ sec: ipe, grade: 'S275', L, N, MyT: My, MyB: 0, MzT: Mz, MzB: 0, ky: 1, kz: 1, nLT: 1, annex: 'A' });
  n++; const ok = r.gov.interaction && r.gov.interaction.ir.method === 'A' && Number.isFinite(r.gov.interaction.util);
  console.log(`${ok ? 'ok  ' : 'FAIL'} member mode with Annex A: method ${r.gov.interaction?.ir.method}, utilisation ${r.gov.interaction?.util.toFixed(3)}`); if (!ok) fails++; }
// beam mode with Annex A: simply supported udl with axial load; Cmy,0 by the general expression of Table A.2
{ const { SECTION_DATA } = require('./load.js');
  const sec = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('254×254×73'))), Lb = 5000, w = 20, Nb = 400e3;
  const r = Design.designBeam({ sec, grade: 'S355', spans: [Lb], loads: [{ case: 'G', member: 0, type: 'udl', w }], selfWeight: false, rule: '6.10', psi0: 0.7,
    restraint: [{ mode: 'ends' }], N: Nb, annex: 'A' });
  const ir = r.gov.interaction.ir, NcrY = Math.PI ** 2 * EC3.E * sec.Iy / Lb ** 2;
  n++; const ok = ir.method === 'A'; console.log(`${ok ? 'ok  ' : 'FAIL'} beam mode uses Annex A when selected`); if (!ok) fails++;
  // pi^2 EI delta / (L^2 M) = pi^2 x 5/48 for a uniformly loaded simply supported member
  near('beam mode Cmy,0 = 1 + (pi^2 x 5/48 - 1) N/Ncr,y', ir.Cmy0, 1 + (Math.PI ** 2 * 5 / 48 - 1) * Nb / NcrY, 2e-4);
  const rb = Design.designBeam({ sec, grade: 'S355', spans: [Lb], loads: [{ case: 'G', member: 0, type: 'udl', w }], selfWeight: false, rule: '6.10', psi0: 0.7, restraint: [{ mode: 'ends' }], N: Nb });
  n++; const ok2 = rb.gov.interaction.ir.method === 'B'; console.log(`${ok2 ? 'ok  ' : 'FAIL'} Annex B remains the default`); if (!ok2) fails++; }
console.log(`${n - fails}/${n} Annex A checks passed`);
process.exit(fails ? 1 : 0);
