// Beam Analysis engine against closed-form results. Usage: node tests/beam-analysis/test_beam_analysis.js
const { BeamFE } = process.env.ENGINE ? require(process.env.ENGINE) : require('./load.js');
let n = 0, fails = 0;
const near = (name, got, exp, tol = 1e-6) => {
  n++;
  const ok = Math.abs(got - exp) <= tol * Math.max(Math.abs(exp), 1);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(7)} expected ${(+exp).toPrecision(7)}`);
  if (!ok) fails++;
};
const E = 210000, I = 1e8, EI = E * I;
const ext = (r, key) => { const c = BeamFE.combine(r, { [key]: 1 }); return c; };
const at = (r, arr, x, side = 'R') => { const k = r.st.findIndex(s => Math.abs(s.x - x) < 1e-6 && s.side === side); return arr[k >= 0 ? k : r.st.findIndex(s => Math.abs(s.x - x) < 1e-6)]; };
const max = a => Math.max(...a), min = a => Math.min(...a);

// 1 simply supported, udl
{ const L = 6000, w = 10;
  const r = BeamFE.analyse({ members: [{ L, EI }], joints: [{ sup: 'pin' }, { sup: 'pin' }], loads: [{ case: 'G', member: 0, type: 'udl', w }] });
  const c = ext(r, 'G');
  near('SS udl: Mmax = wL^2/8', max(c.M), w * L * L / 8);
  near('SS udl: deflection 5wL^4/384EI', max(c.W), 5 * w * L ** 4 / (384 * EI), 1e-5);
  near('SS udl: reaction wL/2', c.reac[0].R, w * L / 2); }
// 2 cantilever, tip point load
{ const L = 3000, P = 10e3;
  const r = BeamFE.analyse({ members: [{ L, EI }], joints: [{ sup: 'fixed' }, { sup: 'free' }], loads: [{ case: 'G', member: 0, type: 'point', P, a: L }] });
  const c = ext(r, 'G');
  near('cantilever: tip deflection PL^3/3EI', at(r, c.W, L, 'L'), P * L ** 3 / (3 * EI), 1e-6);
  near('cantilever: root moment -PL', min(c.M), -P * L);
  near('cantilever: moment reaction', Math.abs(c.reac[0].C), P * L); }
// 3 propped cantilever, udl
{ const L = 5000, w = 12;
  const r = BeamFE.analyse({ members: [{ L, EI }], joints: [{ sup: 'fixed' }, { sup: 'pin' }], loads: [{ case: 'G', member: 0, type: 'udl', w }] });
  const c = ext(r, 'G');
  near('propped: prop reaction 3wL/8', c.reac[1].R, 3 * w * L / 8);
  near('propped: fixed-end moment -wL^2/8', min(c.M), -w * L * L / 8);
  near('propped: max sagging 9wL^2/128', max(c.M), 9 * w * L * L / 128, 1e-4); }
// 4 fixed-fixed, udl
{ const L = 8000, w = 7;
  const r = BeamFE.analyse({ members: [{ L, EI }], joints: [{ sup: 'fixed' }, { sup: 'fixed' }], loads: [{ case: 'G', member: 0, type: 'udl', w }] });
  const c = ext(r, 'G');
  near('fixed-fixed: end moment -wL^2/12', min(c.M), -w * L * L / 12);
  near('fixed-fixed: midspan wL^2/24', max(c.M), w * L * L / 24, 1e-5);
  near('fixed-fixed: deflection wL^4/384EI', max(c.W), w * L ** 4 / (384 * EI), 1e-5); }
// 5 two equal spans, udl
{ const L = 5000, w = 10;
  const r = BeamFE.analyse({ members: [{ L, EI }, { L, EI }], joints: [{ sup: 'pin' }, { sup: 'pin' }, { sup: 'pin' }], loads: [0, 1].map(m => ({ case: 'G', member: m, type: 'udl', w })) });
  const c = ext(r, 'G');
  near('two spans: support moment -wL^2/8', min(c.M), -w * L * L / 8);
  near('two spans: centre reaction 1.25wL', c.reac[1].R, 1.25 * w * L);
  near('two spans: end reaction 0.375wL', c.reac[0].R, 0.375 * w * L); }
// 6 stepped cantilever (two EIs), tip load
{ const L1 = 2000, L2 = 1500, EI1 = 3 * EI, EI2 = EI, P = 8e3;
  const r = BeamFE.analyse({ members: [{ L: L1, EI: EI1 }, { L: L2, EI: EI2 }], joints: [{ sup: 'fixed' }, { sup: 'free' }, { sup: 'free' }], loads: [{ case: 'G', member: 1, type: 'point', P, a: L2 }] });
  const c = ext(r, 'G');
  const d = P * (L2 ** 3 / (3 * EI2) + (L1 ** 3 / 3 + L1 * L1 * L2 + L1 * L2 * L2) / EI1);
  near('stepped cantilever: tip deflection', at(r, c.W, L1 + L2, 'L'), d, 1e-6); }
// 7 simply supported span with a central spring support and central point load
{ const Ls = 8000, k = 2000, P = 50e3;
  const r = BeamFE.analyse({ members: [{ L: Ls / 2, EI }, { L: Ls / 2, EI }], joints: [{ sup: 'pin' }, { sup: 'spring', kv: k }, { sup: 'pin' }], loads: [{ case: 'G', member: 1, type: 'point', P, a: 0 }] });
  const c = ext(r, 'G');
  const delta = P / (k + 48 * EI / Ls ** 3);
  near('spring: deflection at the spring P/(k + 48EI/L^3)', at(r, c.W, Ls / 2), delta, 1e-6);
  near('spring: spring reaction k delta', c.reac[1].R, k * delta, 1e-6);
  near('spring: end reactions (P - k delta)/2', c.reac[0].R, (P - k * delta) / 2, 1e-6); }
// 8 Gerber beam: A pin, B pin, overhang to hinge C, suspended span CD on pin D
{ const r = BeamFE.analyse({ members: [{ L: 6000, EI }, { L: 2000, EI }, { L: 4000, EI }], joints: [{ sup: 'pin' }, { sup: 'pin' }, { sup: 'free', hinge: true }, { sup: 'pin' }],
    loads: [{ case: 'G', member: 2, type: 'udl', w: 10 }] });
  const c = ext(r, 'G');
  near('Gerber: R_D = wL/2', c.reac[3].R, 20000);
  near('Gerber: R_B = 20000 x 8/6', c.reac[1].R, 20000 * 8 / 6);
  near('Gerber: R_A = -20000 x 2/6', c.reac[0].R, -20000 * 2 / 6);
  near('Gerber: moment at B = -20000 x 2000', at(r, c.M, 6000, 'L'), -4e7);
  near('Gerber: moment at the hinge = 0', at(r, c.M, 8000, 'L'), 0, 1e-9 * 4e7);
  near('Gerber: suspended span midspan wL^2/8', max(c.M), 10 * 4000 ** 2 / 8, 1e-6); }
// 9 rotational spring at the root of a cantilever (translation restrained)
{ const L = 3000, P = 10e3, kr = 5e10;
  const r = BeamFE.analyse({ members: [{ L, EI }], joints: [{ sup: 'spring', kv: Infinity, kr }, { sup: 'free' }], loads: [{ case: 'G', member: 0, type: 'point', P, a: L }] });
  const c = ext(r, 'G');
  near('rotational spring: tip deflection PL^3/3EI + PL^2/kr', at(r, c.W, L, 'L'), P * L ** 3 / (3 * EI) + P * L * L / kr, 1e-6);
  near('rotational spring: moment reaction PL', Math.abs(c.reac[0].C), P * L, 1e-6); }
// 10 trapezoidal and partial loads: SS beam, triangular load 0 -> w over the span: Mmax = wL^2/(9 sqrt 3)
{ const L = 6000, w = 9;
  const r = BeamFE.analyse({ members: [{ L, EI }], joints: [{ sup: 'pin' }, { sup: 'pin' }], loads: [{ case: 'G', member: 0, type: 'vdl', w1: 0, w2: w, a: 0, b: L }] });
  const c = ext(r, 'G');
  near('triangular load: Mmax = wL^2/(9 sqrt 3)', BeamFE.peaks(r, c)[0].max, w * L * L / (9 * Math.sqrt(3)), 2e-5);
  near('triangular load: reactions wL/6, wL/3', c.reac[1].R, w * L / 3); }
// 11 mechanism detection
{ let msg = '';
  try { BeamFE.analyse({ members: [{ L: 4000, EI }, { L: 4000, EI }], joints: [{ sup: 'pin' }, { sup: 'free', hinge: true }, { sup: 'pin' }], loads: [{ case: 'G', member: 0, type: 'udl', w: 1 }] }); } catch (e) { msg = e.message; }
  n++; const ok = /mechanism/.test(msg); console.log(`${ok ? 'ok  ' : 'FAIL'} mechanism detected: ${msg}`); if (!ok) fails++; }
// 12 combinations, simply supported, G = 10 and Q = 5 N/mm
{ const L = 6000;
  const r = BeamFE.analyse({ members: [{ L, EI }], joints: [{ sup: 'pin' }, { sup: 'pin' }], loads: [{ case: 'G', member: 0, type: 'udl', w: 10 }, { case: 'Q', member: 0, type: 'udl', w: 5 }] });
  const cab = BeamFE.en1990(r, { rule: '6.10ab', psi: { Q: [0.7, 0.5, 0.3] } }), c10 = BeamFE.en1990(r, { rule: '6.10' });
  const uls = cs => BeamFE.envelope(r, cs.filter(c => c.ls === 'ULS')), sls = cs => BeamFE.envelope(r, cs.filter(c => c.ls === 'SLS'));
  near('6.10a/b: governing M = max(1.35G + 1.05Q, 1.249G + 1.5Q) L^2/8', max(uls(cab).Mmax), Math.max(1.35 * 10 + 1.5 * 0.7 * 5, 0.925 * 1.35 * 10 + 1.5 * 5) * L * L / 8);
  near('6.10: governing M = (1.35G + 1.5Q) L^2/8', max(uls(c10).Mmax), (1.35 * 10 + 1.5 * 5) * L * L / 8);
  near('SLS characteristic deflection (G + Q)', max(sls(cab).Wmax), 5 * 15 * L ** 4 / (384 * EI), 1e-5); }
// 13 pattern loading: two equal spans, G = 10, Q = 10: max sagging in span 1 with Q on span 1 only
{ const L = 5000, g = 10, q = 10;
  const r = BeamFE.analyse({ members: [{ L, EI }, { L, EI }], joints: [{ sup: 'pin' }, { sup: 'pin' }, { sup: 'pin' }],
    loads: [0, 1].flatMap(m => [{ case: 'G', member: m, type: 'udl', w: g }, { case: 'Q', member: m, type: 'udl', w: q }]) }, { pattern: ['Q'] });
  const cs = BeamFE.en1990(r, { rule: '6.10', pattern: ['Q'] }).filter(c => c.ls === 'ULS');
  const env = BeamFE.envelope(r, cs);
  // span moment with 1.35g on both spans and 1.5q on span 1: R_A = 0.375*1.35g L + 0.4375*1.5q L, Mmax = R_A^2 / (2 w1)
  const w1 = 1.35 * g + 1.5 * q, RA = 0.375 * 1.35 * g * L + (7 / 16) * 1.5 * q * L;
  near('pattern: max span moment with Q on one span (exact peak)', env.memPeaks[0].max, RA * RA / (2 * w1), 1e-9);
  near('pattern: support moment with Q on both spans', -min(env.Mmin), (1.35 * g + 1.5 * q) * L * L / 8, 1e-6); }
console.log(`${n - fails}/${n} beam analysis checks passed`);
process.exit(fails ? 1 : 0);
