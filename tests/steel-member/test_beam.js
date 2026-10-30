const { Beam } = require('./load.js');
let fails = 0, n = 0;
function near(name, got, exp, tol = 1e-3) {
  n++;
  const ok = Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp));
  if (!ok) { fails++; console.log('FAIL', name, 'got', got, 'exp', exp); }
}
const EI = 210000 * 1e8; // N mm2
const maxAbs = (a) => a.reduce((m, v) => Math.abs(v) > Math.abs(m) ? v : m, 0);
const at = (res, g, x, side = 'R') => { const k = res.st.findIndex(s => Math.abs(s.x - x) < 1e-6 && s.side === side); return { V: g.V[k], M: g.M[k], W: g.W[k] }; };

// 1 Simply supported UDL
{ const L = 6000, w = 10; // N/mm
  const r = Beam.analyse({ spans: [L], EI, loads: [{ case: 'G', member: 0, type: 'udl', w }] });
  const c = at(r, r.G, L / 2);
  near('SS UDL M', c.M, w * L * L / 8); near('SS UDL w', c.W, 5 * w * L ** 4 / (384 * EI));
  near('SS UDL V0', at(r, r.G, 0).V, w * L / 2); near('SS UDL R', r.G.reac[0].R, w * L / 2); }
// 2 SS point load off-centre
{ const L = 5000, P = 50e3, a = 1500, b = L - a;
  const r = Beam.analyse({ spans: [L], EI, loads: [{ case: 'G', member: 0, type: 'point', P, a }] });
  near('SS P M', at(r, r.G, a).M, P * a * b / L);
  near('SS P VL', at(r, r.G, a, 'L').V, P * b / L); near('SS P VR', at(r, r.G, a, 'R').V, -P * a / L);
  const xm = L / 2; // deflection at midspan for a < L/2:  P b x (L^2 - b^2 - x^2)/(6 L EI) with x measured from far end... use symmetric formula
  const wmid = P * a * (3 * L * L - 4 * a * a) / (48 * EI);
  near('SS P wmid', at(r, r.G, xm).W, wmid); }
// 3 Fixed-fixed UDL
{ const L = 8000, w = 20;
  const r = Beam.analyse({ spans: [L], EI, endLeft: 'fixed', endRight: 'fixed', loads: [{ case: 'G', member: 0, type: 'udl', w }] });
  near('FF M end', at(r, r.G, 0).M, -w * L * L / 12); near('FF M mid', at(r, r.G, L / 2).M, w * L * L / 24);
  near('FF w mid', at(r, r.G, L / 2).W, w * L ** 4 / (384 * EI)); near('FF C left', r.G.reac[0].C, -w * L * L / 12); }
// 4 Propped cantilever (fixed left, pinned right) UDL
{ const L = 7000, w = 15;
  const r = Beam.analyse({ spans: [L], EI, endLeft: 'fixed', loads: [{ case: 'G', member: 0, type: 'udl', w }] });
  near('PC M fixed', at(r, r.G, 0).M, -w * L * L / 8); near('PC R right', r.G.reac[1].R, 3 * w * L / 8);
  near('PC Mmax', Math.max(...r.G.M), 9 * w * L * L / 128); }
// 5 Two equal spans UDL
{ const L = 6000, w = 10;
  const r = Beam.analyse({ spans: [L, L], EI, loads: [0, 1].map(m => ({ case: 'G', member: m, type: 'udl', w })) });
  near('2S M int', at(r, r.G, L).M, -w * L * L / 8); near('2S R mid', r.G.reac[1].R, 1.25 * w * L);
  near('2S R end', r.G.reac[0].R, 0.375 * w * L); near('2S Mspan', Math.max(...r.G.M), 9 * w * L * L / 128); }
// 6 Cantilever (left fixed, free right via cantR on a zero-span? use spans:[] with cantR) -> model as fixed end + cantilever
{ const L = 3000, P = 10e3, w = 5;
  const r = Beam.analyse({ spans: [], cantR: L, endLeft: 'fixed', EI, loads: [{ case: 'G', member: 0, type: 'point', P, a: L }, { case: 'G', member: 0, type: 'udl', w }] });
  near('Cant M root', at(r, r.G, 0).M, -P * L - w * L * L / 2);
  near('Cant w tip', at(r, r.G, L, 'L').W, P * L ** 3 / (3 * EI) + w * L ** 4 / (8 * EI)); }
// 7 Clockwise couple at midspan of SS beam
{ const L = 4000, C = 20e6;
  const r = Beam.analyse({ spans: [L], EI, loads: [{ case: 'G', member: 0, type: 'moment', M: C, a: L / 2 }] });
  near('Cpl M left', at(r, r.G, L / 2, 'L').M, -C / 2); near('Cpl M right', at(r, r.G, L / 2, 'R').M, C / 2);
  near('Cpl RA', r.G.reac[0].R, -C / L); }
// 8 Backspan + right cantilever, UDL on cantilever only
{ const L = 6000, Lc = 2000, w = 10;
  const r = Beam.analyse({ spans: [L], cantR: Lc, EI, loads: [{ case: 'Q', member: 1, type: 'udl', w }] });
  near('BC M support', at(r, r.Q[1], L).M, -w * Lc * Lc / 2);
  near('BC R left (uplift)', r.Q[1].reac[0].R, -w * Lc * Lc / 2 / L); }
// 9 VDL triangular on SS beam: Mmax = w L^2 / (9 sqrt3) at x = L/sqrt3
{ const L = 6000, w = 12;
  const r = Beam.analyse({ spans: [L], EI, loads: [{ case: 'G', member: 0, type: 'vdl', w1: 0, w2: w, a: 0, b: L }] }, 300);
  near('VDL Mmax', Math.max(...r.G.M), w * L * L / (9 * Math.sqrt(3)), 2e-4); near('VDL RA', r.G.reac[0].R, w * L / 6); }
// 10 Three spans pattern: combine
{ const L = 5000, w = 10;
  const r = Beam.analyse({ spans: [L, L, L], EI, loads: [0, 1, 2].map(m => ({ case: 'Q', member: m, type: 'udl', w })) });
  const c = Beam.combine(r, 0, [1, 1, 1]);
  near('3S M int', c.M[r.st.findIndex(s => Math.abs(s.x - L) < 1e-6)], -0.1 * w * L * L);
  near('3S R int', c.reac[1].R, 1.1 * w * L); }
console.log(`${n - fails}/${n} beam tests passed`);
process.exit(fails ? 1 : 0);
