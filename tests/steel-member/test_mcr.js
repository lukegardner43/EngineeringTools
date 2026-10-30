const { EC3, SECTION_DATA } = require('./load.js');
let fails = 0, n = 0;
function near(name, got, exp, tol) {
  n++;
  const ok = Math.abs(got - exp) <= tol * Math.abs(exp);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${got.toPrecision(5)} expected ${exp.toPrecision(5)} (${((got / exp - 1) * 100).toFixed(2)}%)`);
  if (!ok) fails++;
}
const { E, G } = EC3;
const sec = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('457×191×67')));
const base = (L, M, extra = {}) => ({ L, EIz: E * sec.Iz, GIt: G * sec.It, EIw: E * sec.Iw, hs: sec.h - sec.tf, M,
  restraints: [{ x: 0, type: 'fork' }, { x: L, type: 'fork' }], ...extra });

// eigen solver sanity: diag + known 2x2
{ const ev = EC3.symEigenvalues([[2, 1], [1, 2]]).sort((a, b) => a - b); near('eig 2x2 low', ev[0], 1, 1e-12); near('eig 2x2 high', ev[1], 3, 1e-12); }

for (const L of [2000, 4000, 8000]) {
  const lam = EC3.mcrFE(base(L, () => 1));
  near(`uniform M, L=${L}`, lam, EC3.mcrUniform(sec, L), 2e-3);
}
// C1 for linear moment diagrams (SCI Blue Book / LTBeam values: psi=0 -> 1.77, psi=-1 -> 2.76, psi=0.5 -> 1.31)
const L = 4000, Mu = EC3.mcrFE(base(L, () => 1));
// Exact values for this section (kappa = 1.71) from the independent Galerkin solution (galerkin.py); published
// kappa-independent approximations (SCI/SN003: 1.31, 1.77, 2.33, 2.76) are within 0.8-12% of these.
for (const [psi, c1, tol] of [[0.5, 1.32066, 1e-4], [0, 1.84998, 1e-4], [-0.5, 2.60048, 1e-4], [-1, 2.73612, 1e-4]]) {
  const lam = EC3.mcrFE(base(L, x => 1 + (psi - 1) * x / L));
  near(`C1 psi=${psi}`, lam / Mu, c1, tol);
}
// UDL and central point load, load at shear centre: C1 = 1.13 and 1.35 (SCI)
{ const lam = EC3.mcrFE(base(L, x => x * (L - x) / 2 / (L * L / 8))); near('C1 UDL', lam / Mu, 1.13168, 1e-4); }
{ const lam = EC3.mcrFE(base(L, x => (x < L / 2 ? x : L - x) / (L / 2))); near('C1 central point', lam / Mu, 1.36345, 1e-4); }
// Load height: SN003 3-factor formula with C1=1.127, C2=0.454 (UDL) and 1.348/0.630 (central point), zg = +h/2
const sn003 = (C1, C2, zg, Lx) => C1 * Math.PI ** 2 * E * sec.Iz / Lx ** 2 * (Math.sqrt(sec.Iw / sec.Iz + Lx ** 2 * G * sec.It / (Math.PI ** 2 * E * sec.Iz) + (C2 * zg) ** 2) - C2 * zg);
for (const Lx of [3000, 6000]) {
  const w = 1, Mmax = w * Lx * Lx / 8;
  const lam = EC3.mcrFE(base(Lx, x => w * x * (Lx - x) / 2, { q: () => w, a: sec.h / 2 }));
  near(`UDL top flange L=${Lx}`, lam * Mmax, sn003(1.127, 0.454, sec.h / 2, Lx), 0.03);
  const lamB = EC3.mcrFE(base(Lx, x => w * x * (Lx - x) / 2, { q: () => w, a: -sec.h / 2 }));
  near(`UDL bottom flange L=${Lx}`, lamB * Mmax, sn003(1.127, 0.454, -sec.h / 2, Lx), 0.03);
  const P = 1, Mp = P * Lx / 4;
  const lamP = EC3.mcrFE(base(Lx, x => P / 2 * (x < Lx / 2 ? x : Lx - x), { P: [{ x: Lx / 2, P }], a: sec.h / 2 }));
  if (Lx === 3000) near('Point top flange L=3000 vs Galerkin', lamP * Mp, 6.61398e8, 1e-4);
  near(`Point top flange L=${Lx} vs SN003 3-factor formula (approximate)`, lamP * Mp, sn003(1.348, 0.630, sec.h / 2, Lx), 0.08);
}
// Continuous tension-flange (top) restraint: sagging cannot buckle; hogging closed form EIz c pi²/L² + GJ/(2c) (Iw = Iz c²)
{ const c = (sec.h - sec.tf) / 2, s2 = { ...sec, Iw: sec.Iz * c * c };
  const o = (M) => ({ L, EIz: E * s2.Iz, GIt: G * s2.It, EIw: E * s2.Iw, hs: 2 * c, M, restraints: [{ x: 0, type: 'fork' }, { x: L, type: 'fork' }], topRestrained: true });
  n++; const sag = EC3.mcrFE(o(() => 1)); console.log(`${sag === Infinity ? 'ok  ' : 'FAIL'} top restrained, sagging -> no buckling (${sag})`); if (sag !== Infinity) fails++;
  near('top restrained, hogging', EC3.mcrFE(o(() => -1)), E * s2.Iz * c * Math.PI ** 2 / L ** 2 + G * s2.It / (2 * c), 2e-3); }
// Cantilever, tip point load at shear centre, negligible warping: P_cr = 4.013 sqrt(EIz GJ)/L^2
{ const Lc = 3000;
  const lam = EC3.mcrFE({ L: Lc, EIz: E * sec.Iz, GIt: G * sec.It, EIw: E * sec.Iw * 1e-9, hs: sec.h - sec.tf,
    M: x => -(Lc - x), restraints: [{ x: 0, type: 'fixed' }], nEl: 64 });
  near('cantilever tip load (Iw~0, converging)', lam, 4.013 * Math.sqrt(E * sec.Iz * G * sec.It) / Lc ** 2, 5e-3); }
console.log(`${n - fails}/${n} Mcr tests passed`);
process.exit(fails ? 1 : 0);
