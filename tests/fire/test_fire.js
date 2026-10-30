// Steel member fire design: heating against scipy integration (reference/ref_fire.py), critical temperature against
// BS EN 1993-1-2 Table 4.1, reduction factors and resistances by hand, failure time and protection sizing behaviour.
const { EC3, Fire: F, SECTION_DATA } = require('./load.js');
const REF = require('./ref_fire.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, scale) => { n++; const ok = Math.abs(got - exp) <= tol * (scale ?? Math.max(Math.abs(exp), 1e-30)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(6)} expected ${(+exp).toPrecision(6)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const sec = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('457×191×67')));
const sf = F.sectionFactors(sec, 3);
near('section factor, profile, 3 sides', sf.profile, REF.prof3, 1e-9); near('section factor, box, 3 sides', sf.box, REF.box3, 1e-9);
const H = F.heat({ s: sec, sides: 3, prot: null, tEnd: 3600, dt: 2 });
near('k_sh = 0.9 (A_m/V)_b/(A_m/V)', H.ksh, REF.ksh, 1e-9);
REF.times.forEach((t, i) => near(`unprotected steel at ${t / 60} min vs RK45`, H.a[Math.round(t / 2)], REF.unprot[i], 3e-3));
const P = F.heat({ s: sec, sides: 3, prot: { type: 'board', dp: 20, lp: 0.15, cp: 1200, rhop: 800 }, tEnd: 5400, dt: 2 });
[...REF.times, 5400].forEach((t, i) => near(`protected (board 20 mm) at ${t / 60} min vs fine-step loop`, P.a[Math.round(t / 2)], REF.prot[i], 1e-2));
near('ISO 834 at 60 min = 945 °C', F.iso(3600), 20 + 345 * Math.log10(481), 1e-12);
REF.table41.forEach(([mu, th]) => near(`critical temperature mu0 = ${mu} (Table 4.1: ${th} °C)`, F.thetaCr(mu), th, 1, 0.6));
const kk = F.k(550); near('k_y at 550 °C = 0.625', kk.ky, 0.625, 1e-12); near('k_E at 550 °C = 0.455', kk.kE, 0.455, 1e-12);
near('c_a at 735 °C (peak branch)', F.ca(734.9), 666 + 13002 / (738 - 734.9), 1e-12);
// restrained beam: M_fi,Rd = k_y W_pl fy / (kappa1 kappa2)
{ const o = { s: sec, grade: 'S355', type: 'beamR', kappa: 0.7, Ed: { M: 200e6 } };
  const r = F.resistance(o, 600); near('restrained beam at 600 °C: k_y W_pl f_y / 0.7', r.R, 0.47 * sec.Wply * 355 / 0.7, 1e-9);
  const tl = F.limitingTemp(o), at = F.resistance(o, tl); near('limiting temperature gives utilisation 1', at.util, 1, 1e-6);
  const D = F.design({ ...o, sides: 3, prot: null, period: 60 });
  truth('unprotected 457 UKB fails R60 at this load (time to failure < 60 min)', D.tf.t < 3600 && !D.ok);
  const Dp = F.design({ ...o, sides: 3, prot: { type: 'board', dp: 15, lp: 0.15, cp: 1200, rhop: 800 }, period: 60 });
  const Hreq = F.heat({ s: sec, sides: 3, prot: { type: 'board', dp: Dp.dpReq, lp: 0.15, cp: 1200, rhop: 800 }, tEnd: 3600 });
  near('required protection thickness brings the 60 min temperature to the limiting temperature', Hreq.a[Hreq.a.length - 1], Dp.thLim, 2e-3); }
// column in fire: chi_fi with alpha = 0.65 sqrt(235/fy), lambda_theta = lambda sqrt(ky/kE)
{ const c = EC3.fromRow(SECTION_DATA.find(r => r[0].startsWith('254×254×73'))), L = 0.7 * 4000, th = 500, fy = 355;
  const r = F.resistance({ s: c, grade: 'S355', type: 'column', Lcr: { y: L, z: L }, Ed: { N: 800e3, M: 0 } }, th);
  const k5 = F.k(th), lz = Math.sqrt(c.A * fy / (Math.PI ** 2 * EC3.E * c.Iz / L ** 2)) * Math.sqrt(k5.ky / k5.kE), a = 0.65 * Math.sqrt(235 / fy);
  const ph = 0.5 * (1 + a * lz + lz * lz), chi = 1 / (ph + Math.sqrt(ph * ph - lz * lz));
  near('column at 500 °C: N_b,fi,Rd = chi_fi A k_y fy', r.R, chi * c.A * k5.ky * fy, 1e-9); }
console.log(`\n${n - fails}/${n} fire checks passed`);
if (fails) process.exit(1);
