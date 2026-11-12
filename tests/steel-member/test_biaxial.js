// Minor-axis (horizontal) loading in beam mode and biaxial interaction (6.3.3 with N = 0), checked against hand values.
const { EC3, Design, SECTION_DATA } = require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol) => {
  n++;
  const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1e-12);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`);
  if (!ok) fails++;
};
const truthy = (name, v) => { n++; console.log(`${v ? 'ok  ' : 'FAIL'} ${name}`); if (!v) fails++; };
const sec = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('457×191×67')));
const E = EC3.E, fy = 355, L = 6000;

// simply supported, vertical udl 10 kN/m and horizontal udl 2 kN/m, both permanent; 6.10 -> 1.35 G
const base = { sec, grade: 'S355', spans: [L], selfWeight: false, rule: '6.10', psi0: 0.7, restraint: [{ mode: 'ends' }] };
const r = Design.designBeam({ ...base, loads: [{ case: 'G', member: 0, type: 'udl', w: 10 }, { case: 'G', member: 0, type: 'udl', w: 2, dir: 'h' }] });
const My = 1.35 * 10 * L * L / 8, Mz = 1.35 * 2 * L * L / 8;
near('Mz,Ed envelope at midspan', Math.max(...r.envelopeH.Mmax), Mz, 1e-6);
near('My,Ed unaffected by the horizontal load', Math.max(...r.envelope.Mmax), My, 1e-6);
near('horizontal reaction', Math.abs(r.reactions[0].Hmax), 1.35 * 2 * L / 2, 1e-9);
near('horizontal deflection (characteristic) 5wL^4/384EIz', Math.abs(r.memDefl[0].wH), 5 * 2 * L ** 4 / (384 * E * sec.Iz), 1e-4);
// cross-section, 6.2.9.1(6) with n = 0: (My/Mpl,y)^2 + (Mz/Mpl,z)^1
{ const g = r.gov.bending;
  near('biaxial cross-section check at midspan (6.41)', g.util, (My / (sec.Wply * fy)) ** 2 + Mz / (sec.Wplz * fy), 1e-6); }
// member: 6.61 / 6.62 with N = 0: kyy = Cmy, kzz = Cmz, kyz = 0.6 kzz, kzy = 1 (lambda_z >= 0.4) for class 1-2 I-sections
{ const g = r.gov.interaction, ir = g.ir;
  truthy('interaction is checked with N = 0 when minor-axis bending is present', !!g);
  near('Cmy (udl, simply supported, Table B.3)', ir.Cmy, 0.95, 1e-9);
  near('Cmz (udl, simply supported, Table B.3)', ir.Cmz, 0.95, 1e-9);
  near('kyz = 0.6 kzz', ir.kyz, 0.6 * ir.kzz, 1e-12);
  const chi = g.chiLT, u61 = 0.95 * My / (chi * sec.Wply * fy) + 0.6 * 0.95 * Mz / (sec.Wplz * fy);
  const kzy = g.ab.lamZ < 0.4 ? Math.min(0.6 + g.ab.lamZ, 1) : 1, u62 = kzy * My / (chi * sec.Wply * fy) + 0.95 * Mz / (sec.Wplz * fy);
  near('(6.61) hand', ir.u61, u61, 1e-9);
  near('(6.62) hand', ir.u62, u62, 1e-9);
}
// horizontal load only: no LTB from minor-axis bending, interaction still checked
{ const rh = Design.designBeam({ ...base, loads: [{ case: 'Q', member: 0, type: 'point', P: 20e3, a: 3000, dir: 'h' }] });
  near('horizontal point load only: Mz', Math.max(...rh.envelopeH.Mmax.map(Math.abs)), 1.5 * 20e3 * L / 4, 1e-6);
  truthy('horizontal point load only: no LTB result', !rh.gov.ltb);
  near('horizontal point load only: (6.62) = Cmz Mz/Mpl,z', rh.gov.interaction.ir.u62, rh.gov.interaction.ir.Cmz * (1.5 * 20e3 * L / 4) / (sec.Wplz * fy), 1e-9);
  near('Cmz, central point load (Table B.3)', rh.gov.interaction.ir.Cmz, 0.9, 1e-9);
  truthy('no web bearing check from a horizontal point load', !rh.bearing.some(b => b.where === 'point load'));
}
// cantilever with a horizontal tip load: sway mode, Cmz = 0.9
{ const rc = Design.designBeam({ ...base, spans: [], cantR: 2000, endLeft: 'fixed', restraint: [{ mode: 'ends' }], tipRestrained: { R: false },
    loads: [{ case: 'G', member: 0, type: 'point', P: 5e3, a: 2000, dir: 'h' }, { case: 'G', member: 0, type: 'udl', w: 5 }] });
  near('cantilever: Cmz = 0.9 (sway)', rc.gov.interaction.ir.Cmz, 0.9, 1e-12); }
// member mode: Mz with N = 0 now gets the 6.3.3 interaction
{ const rm = Design.designMember({ sec, grade: 'S355', L: 4000, N: 0, MyT: 100e6, MyB: 0, MzT: 20e6, MzB: 0, ky: 1, kz: 1, nLT: 1 });
  truthy('member mode: biaxial bending with N = 0 is checked by 6.61/6.62', !!rm.gov.interaction);
  near('member mode: (6.62) Mz term with kzz = Cmz = 0.6', rm.gov.interaction.ir.kzz, 0.6, 1e-12); }
// hollow sections, Table B.1 (not susceptible to torsional deformation): k_zz by the RHS row, k_zy = 0.6 k_yy
{ const s = EC3.rhs({ h: 200, b: 100, t: 6.3 }), r = Design.designMember({ sec: s, grade: 'S355', L: 5000, N: 300e3, MyT: 30e6, MyB: 30e6, MzT: 15e6, MzB: 15e6, Lcr: { y: 5000, z: 5000, LT: 5000 } });
  const ir = r.gov.interaction.ir, ab = r.ab, nz = 300e3 / (ab.z.chi * ab.NRk);
  near('RHS: k_zz = Cmz(1 + (lambda_z - 0.2) n_z), capped at Cmz(1 + 0.8 n_z)', ir.kzz, ir.Cmz * Math.min(1 + (ab.lamZ - 0.2) * nz, 1 + 0.8 * nz), 1e-12);
  near('RHS: k_zy = 0.6 k_yy', ir.kzy, 0.6 * ir.kyy, 1e-12);
  truthy('RHS: reported against Table B.1', ir.table === 'B.1');
  const c = EC3.chs({ d: 168.3, t: 6.3 }), rc = Design.designMember({ sec: c, grade: 'S355', L: 4000, N: 200e3, MyT: 10e6, MyB: 10e6, MzT: 10e6, MzB: 10e6, Lcr: { y: 4000, z: 4000, LT: 4000 } });
  near('CHS: same about both axes, k_zz = k_yy', rc.gov.interaction.ir.kzz, rc.gov.interaction.ir.kyy, 1e-12); }
console.log(`${n - fails}/${n} biaxial checks passed`);
process.exit(fails ? 1 : 0);
