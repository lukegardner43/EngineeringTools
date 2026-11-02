// RC Stair engine checks: The Concrete Centre TCC71 (40 flights with their half landings, outputs only) and hand checks
// of the statics, the imposed-load patterns, 6.10a/b, built-in ends, the 7.3.3(1) exemption and the bar suggestion.
const { Stair: ST, EC2, EC2Section } = require('./load');
const REF = require('./ref_tcc71.json');
let n = 0, fails = 0;
const ok = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } };
const near = (name, a, b, tol = 1e-9) => ok(name, Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `got ${a}, want ${b}`);
const throws = (name, f, re) => { let e = null; try { f(); } catch (x) { e = x; } ok(name, !!e && (!re || re.test(e.message)), e ? e.message : 'no error'); };

// ---------- TCC71 ----------
// TCC71 differences, set aside here: with "Allow 6.10a & b" off it still takes γQ = 1.5ψ0 when 6.10a would exceed 6.10b
// (the factors used are recovered from its own reactions); its landing sheet limits K to 0.775×0.45×0.67/γc and then
// gives no compression steel; for 310/σs it puts its nominal top steel into the cracked section and stops at 1.75 A_s.
REF.cases.forEach((c, i) => {
  const o = c.out, F = k => o['FLIGHT!' + k], Ld = k => o['LANDING!' + k], tag = `TCC71 case ${i + 1}`;
  const gQf = (F('P23') - 1.35 * F('P21')) / F('P22'), gQ = Math.abs(gQf - 1.5) < 1e-6 ? 1.5 : 1.05;
  const R = ST.flight({ fck: c.fck, cover: c.cover, a: c.a, pA: -c.d, c: c.c, pC: -c.e, n: c.n, going: c.g, rise: c.r, t: c.t, hA: c.hA, hC: c.hC, qk: c.q, fF: c.fF, fL: c.fL, comb: 'custom', gG: 1.35, gQ, psi2: 0.3, ae: F('AJ29'),
    bottom: { phi: F('P31'), s: F('P37') } });
  near(`${tag}: span`, R.L * 1000, F('G21'));
  near(`${tag}: g_k flight`, R.gkF, F('O7'));
  if (c.a - c.d > 0) near(`${tag}: g_k landing A`, R.gkA, F('O6'));
  if (c.c - c.e > 0) near(`${tag}: g_k landing C`, R.gkC, F('O8'));
  near(`${tag}: G reaction A`, R.reactions.G1, F('P21')); near(`${tag}: G reaction C`, R.reactions.G2, F('R21'));
  near(`${tag}: Q reaction A`, R.reactions.Q1, F('P22')); near(`${tag}: Q reaction C`, R.reactions.Q2, F('R22'));
  const B = R.Eall.runs[0].B; near(`${tag}: ULS reaction A`, B.R1, F('P23')); near(`${tag}: ULS reaction C`, B.R2, F('R23'));
  const all = R.Eall.sag(0, R.L); near(`${tag}: largest sagging moment`, all.M, F('S28'), 1e-7);
  const reg = R.regions.find(q => all.x >= q.a - 1e-9 && all.x <= q.b + 1e-9); near(`${tag}: depth where it occurs`, reg.h, F('S30'));
  ok(`${tag}: patterned imposed load never below TCC's`, Math.max(...R.regions.map(q => q.M)) >= F('S28') - 1e-6);
  const sec = EC2Section.design({ kind: 'slab', b: 1000, h: F('S30'), fck: c.fck, fyk: 500, cover: c.cover, dg: 20, bar: { phi: F('P31'), s: F('P37') }, MEd: F('S28') * 1e6, Mk: F('AF31') * 1e6, Mqp: F('AF31') * 1e6, gk: 1, qk: 0, psi2: 0.3, ae: F('AJ29'), xdMax: 0.45 });
  near(`${tag}: d`, sec.d, F('P32')); near(`${tag}: K`, sec.bd.K, F('P34'), 1e-9); near(`${tag}: A_s,req`, Math.max(sec.bd.As, sec.AsMin), F('P36'), 1e-9);
  // the deflection steel: same base ratio, F2 and F3 = 310/σs by the cracked section with TCC's top steel and α_e
  const d0 = F('AA32'), As0 = F('AA36'), L = F('G21'), actual = L / d0;
  const base = EC2Section.baseRatio(c.fck, As0 / (1000 * d0), 0, 1), F2 = L > 7000 ? 7000 / L : 1;
  const allowedAt = As => Math.min(40, base * F2 * Math.min(1.5, 310 / EC2.cracked({ sec: { b: 1000 }, As, d: d0, As2: F('P45'), d2: F('P46'), ae: F('AJ29'), M: F('AF31') * 1e6 }).ss));
  let need = As0; if (allowedAt(As0) < actual) { let lo = As0, hi = 1.75 * As0; if (allowedAt(hi) >= actual) { for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (allowedAt(m) >= actual) hi = m; else lo = m; } need = hi; } else need = null; }
  if (need !== null) near(`${tag}: steel for span/depth`, need, F('AJ33'), 2e-3); else ok(`${tag}: span/depth beyond 1.75A_s in both`, F('R37') < F('R36'));
  // the half landing carrying this flight's reactions
  const l = c.land, gQl = (Ld('P14') - 1.35 * (25 * l.h / 1000 + l.f)) / l.q;
  const Lr = ST.landing({ fck: c.fck, cover: c.cover, a: l.a, b: l.b, c: l.c, d: l.d, h: l.h, w: l.w, qk: l.q, fL: l.f, GA: Ld('D26'), QA: Ld('E26'), GB: Ld('D27'), QB: Ld('E27'), comb: 'custom', gG: 1.35, gQ: Math.abs(gQl - 1.5) < 1e-6 ? 1.5 : 1.05, bottom: { phi: Ld('P26'), s: Ld('P32') } });
  near(`${tag}: landing span`, Lr.L * 1000, Ld('F18')); near(`${tag}: landing effective width`, Lr.weff, Ld('O5'));
  near(`${tag}: landing reaction 1`, Lr.E.runs[0].B.R1, Ld('P18')); near(`${tag}: landing reaction 2`, Lr.E.runs[0].B.R2, Ld('R18')); near(`${tag}: landing moment`, Lr.R.M, Ld('S23'), 1e-7);
  near(`${tag}: landing d`, Lr.sec.d, Ld('P27')); near(`${tag}: landing K`, Lr.sec.bd.K, Ld('P29'));
  if (Ld('P29') <= 0.775 * 0.45 * 0.67 / 1.5) near(`${tag}: landing A_s`, Math.max(Lr.sec.bd.As, Lr.sec.AsMin), Ld('P31'), 1e-9);
  else ok(`${tag}: landing beyond TCC's K′: ours more steel`, Math.max(Lr.sec.bd.As, Lr.sec.AsMin) > Ld('P31'));
});

// ---------- statics by hand ----------
{
  const B = ST.beam(4, [{ x0: 0, x1: 4, w: 10 }]); near('simply supported: R = wL/2', B.R1, 20); near('simply supported: M = wL²/8', B.M(2), 20); near('V at mid-span', B.V(2), 0);
  const C = ST.beam(4, [{ x0: -1, x1: 4, w: 10 }]); near('projection: hogging wp²/2 at the support', -C.M(0), 5); near('projection: reaction', C.R1, 50 * 2.5 / 4);
  const base = { fck: 32, cover: 25, n: 10, going: 250, rise: 175, t: 175, a: 600, hA: 200, c: 1200, hC: 200, qk: 4, fF: 1.6, fL: 1.3, psi2: 0.3, bottom: { phi: 16, s: 200 }, top: { phi: 10, s: 250 } };
  const R = ST.flight(base);
  near('flight self weight on plan', R.gkF, 25 * 0.175 / Math.cos(Math.atan(175 / 250)) + 25 * 0.175 / 2 + 1.6);
  near('span = landings + flight', R.L, 0.6 + 2.5 + 1.2); ok('no projection, simple: no top steel', R.sups.every(S => S.M === 0 && !S.sec));
  const P = ST.flight({ ...base, pA: 600, pC: 300 }), Pall = P.Eall.sag(0, P.L).M;
  ok('imposed load off the projections raises the sagging moment', Math.max(...P.regions.map(q => q.M)) > Pall);
  near('hogging at a projection, imposed on it', P.sups[0].M, (1.35 * P.gkA + 1.5 * 4) * 0.6 ** 2 / 2, 1e-9);
  const M = ST.flight({ ...base, supports: 'monolithic' }); near('built-in ends: 25 % of the span moment', M.sups[0].M, 0.25 * M.gov.M); ok('built-in rule named', /9\.3\.1\.2/.test(M.sups[0].rule));
  const ab = ST.flight({ ...base, comb: '6.10ab', psi0: 0.7 }); ok('6.10a and 6.10b both run', ab.cbs.length === 2);
  const g6 = 1.35 * R.gkF, a6 = Math.max(1.35 * R.gkF + 1.05 * 4, 0.925 * 1.35 * R.gkF + 1.5 * 4);
  ok('6.10a/b lighter than 6.10 for this stair', ab.gov.M < R.gov.M && Math.abs(ab.gov.M / R.gov.M - a6 / (g6 + 6)) < 0.02);
  ok('slab 175 mm: no crack-control checks (7.3.3(1))', !R.checks.some(k => k.id === 'crack' || k.id === 'ascrack'));
  const T = ST.flight({ ...base, t: 225, hA: 250, hC: 250 }); ok('slab over 200 mm: crack control checked', T.checks.some(k => k.id === 'crack'));
  ok('deflection on the governing part only', R.checks.filter(k => k.id === 'defl' && !/top/.test(k.where)).length === 1);
  ok('shear checked at both supports', R.checks.filter(k => k.id === 'shear').length === 2);
  const sB = ST.suggest({ ...base, kind: 'flight' }, 'bottom'), F2 = ST.flight({ ...base, bottom: sB });
  ok('suggested bottom bars pass', !!sB && F2.checks.filter(k => !/top/.test(k.where)).every(k => k.util <= 1));
  const sT = ST.suggest({ ...base, kind: 'flight', pA: 600, pC: 300 }, 'top'), F3 = ST.flight({ ...base, pA: 600, pC: 300, top: sT });
  ok('suggested top bars pass', !!sT && F3.checks.filter(k => /top/.test(k.where)).every(k => k.util <= 1));
  const Lg = ST.landing({ fck: 32, cover: 25, a: 1200, b: 1200, c: 250, d: 175, h: 175, w: 2400, qk: 4, fL: 1.5, GA: 20, QA: 10, GB: 18, QB: 9, bottom: { phi: 16, s: 150 } });
  near('landing: effective width capped at 1.8 m', Lg.weff, 1.8); near('landing span', Lg.L, 3.0);
  near('landing reactions add up', Lg.E.R1 + Lg.E.R2, (1.35 * Lg.gk + 1.5 * 4) * 3 + (1.35 * 20 + 1.5 * 10) / 1.8 * 1.2 + (1.35 * 18 + 1.5 * 9) / 1.8 * 1.2, 1e-9);
}
throws('pitch over 45°', () => ST.flight({ fck: 32, cover: 25, n: 10, going: 150, rise: 200, t: 175, a: 0, c: 0, qk: 4 }), /45°/);
throws('landing needs a thickness', () => ST.flight({ fck: 32, cover: 25, n: 10, going: 250, rise: 175, t: 175, a: 600, c: 0, qk: 4 }), /Landing A thickness/);
console.log(`${n - fails}/${n} checks passed`);
if (fails) process.exit(1);
