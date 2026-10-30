// Cross-check the JS engine against the independent Python reference, plus hand-calculated design cases.
const fs = require('fs'), path = require('path');
const dir = __dirname;
const { EC3, Design, SECTION_DATA } = require('./load.js');
const sb = { EC3, Design };
const find = n => EC3.fromRow(SECTION_DATA.find(r => r[0] === n));
let fails = 0, n = 0;
const rel = (a, b) => (a === b ? 0 : Math.abs(a - b) / Math.max(1e-9, Math.abs(b)));
function check(name, got, exp, tol = 1e-6) { n++; const ok = (got === Infinity && exp === Infinity) || rel(got, exp) <= tol; if (!ok) { fails++; if (fails < 25) console.log('FAIL', name, got, exp); } return ok; }

const cases = JSON.parse(fs.readFileSync(path.join(dir, 'ref_cases.json')));
for (const c of cases) {
  const s = find(c.name);
  const fy = EC3.yieldStrength(c.grade, Math.max(s.tf, s.tw));
  if (c.kind === 'section') {
    const r = EC3.sectionCheck(s, fy, c.N, c.My, c.V, c.Mz);
    check(`${c.name} cls`, r.cls.cls, c.exp.cls, 0);
    check(`${c.name} uV`, r.uV, c.exp.uV); check(`${c.name} uM`, r.uM, c.exp.uM); check(`${c.name} uN`, r.uN, c.exp.uN);
  } else if (c.kind === 'flex') {
    const ab = Design.axialBuckling(s, fy, c.grade, 1, c.Lcr, c.Lcr, 1e9);
    check(`${c.name} chiy`, ab.y.chi, c.exp.chiy); check(`${c.name} chiz`, ab.z.chi, c.exp.chiz); check(`${c.name} A`, ab.A, c.exp.A);
  } else if (c.kind === 'ltb') {
    const M = x => 1 + (c.psi - 1) * x / c.L;
    const lt = Design.ltb(s, fy, 1, { L: c.L, M, Mref: 1, Mmax: 1e15, restraints: [{ x: 0, type: 'fork' }, { x: c.L, type: 'fork' }], forkFork: true }, { destab: false });
    check(`${c.name} C1 psi=${c.psi}`, lt.C1, c.exp.C1, 2e-4);
    check(`${c.name} Mb`, lt.MbRd, c.exp.Mb, 2e-4);
  }
}
console.log(`reference cross-check: ${n - fails}/${n}`);

// ---- Hand-calculated design case D1: 457x191x67 UKB S355, 6 m simply supported, Gk 10 kN/m + self weight, Qk 15 kN/m,
//      top flange continuously restrained. Hand calc (see report): w(6.10b) = 0.925*1.35*(10+0.6580) + 1.5*15 = 35.809 kN/m
{ const sec = find('457×191×67 UKB');
  const r = Design.designBeam({ sec, grade: 'S355', spans: [6000], loads: [{ case: 'G', member: 0, type: 'udl', w: 10 }, { case: 'Q', member: 0, type: 'udl', w: 15 }],
    selfWeight: true, rule: '6.10ab', psi0: 0.7, restraint: [{ mode: 'top' }], destab: false, defl: { brittle: true } });
  const sw = 67.1 * 9.80665e-3, w = 0.925 * 1.35 * (10 + sw) + 1.5 * 15;
  const MEd = w * 6000 ** 2 / 8, VEd = w * 3000;
  const Mc = 1481e3 * 355, Av = 8600 - 2 * 189.9 * 12.7 + (8.5 + 2 * 12.7) * 12.7, Vpl = Av * 355 / Math.sqrt(3);
  check('D1 bending util', r.gov.bending.util, MEd / Mc, 1e-4);
  check('D1 shear util', r.gov.shear.util, VEd / Vpl, 2e-3);
  check('D1 LTB util (no LTB: sagging with top restraint)', r.gov.ltb.util, MEd / Mc, 1e-4);
  const wq = 5 * 15 * 6000 ** 4 / (384 * 210000 * 29597e4);
  check('D1 imposed deflection', Math.abs(r.memDefl[0].wQ), wq, 1e-3);
  check('D1 reaction Gk', r.reactions[0].Gk, (10 + sw) * 3000, 1e-6);
  console.log(`D1: MEd ${(MEd / 1e6).toFixed(1)} kNm, util bending ${r.gov.bending.util.toFixed(3)}, shear ${r.gov.shear.util.toFixed(3)}, defl ${wq.toFixed(2)} mm`);
}
// ---- D2: same beam, restrained at supports only (forks), loads at shear centre. Hand: C1 from UDL shape, kc = 1/sqrt(C1).
{ const sec = find('457×191×67 UKB');
  const r = Design.designBeam({ sec, grade: 'S355', spans: [6000], loads: [{ case: 'G', member: 0, type: 'udl', w: 10 }, { case: 'Q', member: 0, type: 'udl', w: 15 }],
    selfWeight: true, rule: '6.10ab', psi0: 0.7, restraint: [{ mode: 'ends' }], destab: false });
  const lt = r.gov.ltb;
  const L = 6000, Mcr0 = EC3.mcrUniform(sec, L);
  const C1 = lt.C1, Mcr = C1 * Mcr0;
  const lam = Math.sqrt(1481e3 * 355 / Mcr);
  const phi = 0.5 * (1 + 0.49 * (lam - 0.4) + 0.75 * lam * lam);            // h/b = 2.39 -> curve c
  const chi = 1 / (phi + Math.sqrt(phi * phi - 0.75 * lam * lam));
  const kc = 1 / Math.sqrt(C1), f = 1 - 0.5 * (1 - kc) * (1 - 2 * (lam - 0.8) ** 2);
  const Mb = Math.min(1, chi / f) * 1481e3 * 355;
  check('D2 C1 ~ 1.13 (UDL)', C1, 1.13, 0.01);
  check('D2 Mcr', lt.Mcr, Mcr, 1e-3);
  check('D2 Mb,Rd', lt.MbRd, Mb, 1e-3);
  console.log(`D2: Mcr0 ${(Mcr0 / 1e6).toFixed(1)} kNm, C1 ${C1.toFixed(3)}, Mcr ${(Mcr / 1e6).toFixed(1)}, lamLT ${lam.toFixed(3)}, chi ${chi.toFixed(3)}, f ${f.toFixed(3)}, Mb,Rd ${(Mb / 1e6).toFixed(1)} kNm, util ${lt.util.toFixed(3)}`);
}
// ---- D3: two-span continuous with pattern loading: internal support hogging must come from both spans loaded,
//      max span sagging from one span loaded (6.10b factors)
{ const sec = find('406×178×60 UKB'), Lsp = 7000;
  const r = Design.designBeam({ sec, grade: 'S355', spans: [Lsp, Lsp], loads: [0, 1].flatMap(m => [{ case: 'G', member: m, type: 'udl', w: 8 }, { case: 'Q', member: m, type: 'udl', w: 12 }]),
    selfWeight: false, rule: '6.10ab', psi0: 0.7, restraint: [{ mode: 'top' }, { mode: 'top' }] });
  const g = 0.925 * 1.35 * 8, q = 1.5 * 12;
  const Mhog = (g + q) * Lsp ** 2 / 8;
  // span moment with Q on span 1 only: reactions by superposition: R_A = 0.375 g L + (7/16) q L ; Mmax = R_A^2/(2(g+q))
  const RA = 0.375 * g * Lsp + 7 / 16 * q * Lsp, Msag = RA * RA / (2 * (g + q));
  check('D3 hogging envelope', -Math.min(...r.envelope.Mmin), Mhog, 1e-4);
  check('D3 sagging envelope (pattern)', Math.max(...r.envelope.Mmax), Msag, 2e-4);
  console.log(`D3: Mhog ${(Mhog / 1e6).toFixed(1)} kNm, Msag(pattern) ${(Msag / 1e6).toFixed(1)} kNm, LTB in hogging with top restraint util ${r.gov.ltb.util.toFixed(3)}`);
}
// ---- D4: Mode B column: 254x254x73 UKC S355, L = 5 m, NEd 1200 kN, My top 40 kNm, bottom 0. Hand calc of 6.3.1 and Annex B.
{ const sec = find('254×254×73 UKC');
  const r = Design.designMember({ sec, grade: 'S355', L: 5000, N: 1200e3, MyB: 0, MyT: 40e6, MzB: 0, MzT: 0, ky: 1, kz: 1, nLT: 1 });
  const fy = 355, A = 9520, NRk = A * fy;
  const lz = Math.sqrt(NRk / (Math.PI ** 2 * 210000 * 3910e4 / 5000 ** 2));
  const phz = 0.5 * (1 + 0.49 * (lz - 0.2) + lz * lz), chiz = 1 / (phz + Math.sqrt(phz * phz - lz * lz));   // h/b <= 1.2 -> z curve c
  const ly = Math.sqrt(NRk / (Math.PI ** 2 * 210000 * 11643e4 / 5000 ** 2));
  const phy = 0.5 * (1 + 0.34 * (ly - 0.2) + ly * ly), chiy = 1 / (phy + Math.sqrt(phy * phy - ly * ly));   // y curve b
  check('D4 chi_z', r.ab.z.chi, chiz, 1e-9); check('D4 chi_y', r.ab.y.chi, chiy, 1e-9);
  const NbRd = Math.min(chiz, r.ab.T.chi) * NRk;
  check('D4 flexural util', r.gov.flexural.util, 1200e3 / NbRd, 1e-9);
  // Annex B, class from combined N + M (computed by engine), Cm = 0.6 (psi = 0)
  const ir = r.gov.interaction.ir;
  check('D4 Cmy (psi = 0)', ir.Cmy, 0.6, 1e-12); check('D4 CmLT (psi = 0)', ir.CmLT, 0.6, 1e-12);
  const nY = 1200e3 / (chiy * NRk), nZ = 1200e3 / (Math.min(chiz, r.ab.T.chi) * NRk);
  const kyy = 0.6 * Math.min(1 + (ly - 0.2) * nY, 1 + 0.8 * nY);
  const kzy = lz < 0.4 ? Math.min(0.6 + lz, 1 - 0.1 * lz * nZ / 0.35) : Math.max(1 - 0.1 * lz * nZ / (0.6 - 0.25), 1 - 0.1 * nZ / (0.6 - 0.25));
  const MRk = (r.cls <= 2 ? 1014e3 : 916e3) * fy;
  const chiLT = r.gov.ltb.chiMod;
  check('D4 eq 6.61', ir.u61, nY + kyy * 40e6 / (chiLT * MRk), 1e-9);
  check('D4 eq 6.62', ir.u62, nZ + kzy * 40e6 / (chiLT * MRk), 1e-9);
  console.log(`D4: class ${r.cls}, chi_y ${chiy.toFixed(3)}, chi_z ${chiz.toFixed(3)}, N/Nb ${(1200e3 / NbRd).toFixed(3)}, 6.61 ${ir.u61.toFixed(3)}, 6.62 ${ir.u62.toFixed(3)}`);
}
console.log(`${n - fails}/${n} total EC3 checks passed`);
process.exit(fails ? 1 : 0);
