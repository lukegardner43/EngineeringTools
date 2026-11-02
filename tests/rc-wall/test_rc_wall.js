// RC Wall Design: NODE_PATH=<dir with node_modules> node test_rc_wall.js
// 1 The Concrete Centre TCC63 (40 buildings of 2 to 4 cores, outputs only), run with TCC's conventions: core section
//   properties, wind shares by stiffness and torsion, the core moments, the vertical load per combination, the
//   stresses at 8 points and the steel needed.
// 2 The reinforced panel per metre against RC Column Design (checked against TCC53) for the same section run as a
//   1000 mm wide column.
// 3 Hand checks: the section, 5.8, plain walls to 12.6.5, 9.6 detailing.
// 4 The core method as shipped: equilibrium of the shared wind and the torque, unsymmetric bending, peaks at corners,
//   combinations, bar choice, errors.
const { Wall } = require('./load.js');
const T63 = require('./ref_tcc63.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, scale = null) => { n++; const e = Math.abs(got - exp) / Math.max(Math.abs(scale ?? exp), 1e-9); const ok = e <= tol; if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(8)} expected ${(+exp).toPrecision(8)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; if (!c || process.env.V) console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, fn, re) => { let m = ''; try { fn(); } catch (e) { m = e.message; } truth(`${name} (${m || 'no error'})`, re.test(m)); };
const AREA = p => Math.PI * p * p / 4, FYD = 500 / 1.15, ES = 200000;

// ---------- 1 TCC63 ----------
T63.forEach(({ inp: c, tcc: O }, k) => {
  const tag = `TCC63 ${k} (${c.cores.length} cores, designing core ${c.sel + 1})`, psi0 = O['CORE!O11'], psi2 = O['CORE!Q11'];
  const combos = [[0.925 * 1.35, 1.5, 0.5], [0.925 * 1.35, 1.5 * psi0, 1.5], [1, 1.5, 0.5], [1, 1.5 * psi0, 1.5], [1.35, 1.5 * psi0, 0.5], [1, psi2, 1.5]].map(([gG, gQ, gW], j) => ({ name: `TCC ${j + 1}`, gG, gQ, gW }));
  const R = Wall.core({ L: c.L, W: c.W, Mns: c.Mns, Mew: c.Mew, method: 'tcc', together: true, ignoreIxy: true, cores: c.cores, design: c.sel, fck: c.fck, fyk: 500, combos, loads: c.loads, locations: c.locs }), D = R.D;
  D.C.forEach((q, i) => {
    const col = 'DFHJ'[i], sc = 'DEFG'[i], t = `${tag} core ${i + 1} (${c.cores[i].kind})`;
    near(`${t}: area`, q.A, O[`GEOMETRY!${['N28', 'N35', 'N42', 'N49'][i]}`], 1e-12); near(`${t}: centroid x`, q.xc, O[`GEOMETRY!${col}38`], 1e-12); near(`${t}: centroid y`, q.yc, O[`GEOMETRY!${col}39`], 1e-12);
    near(`${t}: Ixx`, q.Ixm, O[`GEOMETRY!${col}40`], 1e-12); near(`${t}: Iyy`, q.Iym, O[`GEOMETRY!${col}41`], 1e-12);
    near(`${t}: NS share by stiffness`, q.stiffNS, O[`GEOMETRY!${sc}49`], 1e-12); near(`${t}: NS share with torsion`, q.ns[0].Mx / c.Mns, O[`GEOMETRY!${sc}51`], 1e-12, 1);
    near(`${t}: EW share by stiffness`, q.stiffEW, O[`GEOMETRY!${sc}52`], 1e-12); near(`${t}: EW share with torsion`, q.ew[0].My / c.Mew, O[`GEOMETRY!${sc}54`], 1e-12, 1);
  });
  near(`${tag}: eccentricity along x`, D.ex0, O['GEOMETRY!E44'], 1e-12, D.L); near(`${tag}: eccentricity along y`, D.ey0, O['GEOMETRY!E45'], 1e-12, D.W);
  near(`${tag}: core Mxx`, R.c.ns[0].Mx, O['CORE!G10'], 1e-12); near(`${tag}: core Myy`, R.c.ew[0].My, O['CORE!G11'], 1e-12); near(`${tag}: fcd`, R.fcd, O['CORE!T3'], 1e-12);
  R.cases.forEach((cs, j) => near(`${tag}: ΣV, combination ${j + 1}`, cs.N, O[`CORE!${'OPQRST'[j]}19`], 1e-12));
  R.locs.forEach((L, j) => {
    const r = 39 + j, sc = Math.max(Math.abs(O[`CORE!F${r}`]), Math.abs(O[`CORE!G${r}`]), 0.1), t = `${tag} location ${j + 1}`;
    near(`${t}: largest compression`, L.sMax, O[`CORE!F${r}`], 1e-8, sc); near(`${t}: largest tension`, L.sT, O[`CORE!G${r}`], 1e-8, sc); near(`${t}: steel needed`, L.need, O[`CORE!H${r}`], 1e-8);
  });
});

// ---------- 2 the panel against RC Column Design ----------
let colPage = null; try { colPage = require('../rc-column/load.js'); } catch (e) { colPage = null; }
if (colPage) {
  const w = colPage.load(); w.eval('fcd = function(f){ return 0.85*f/1.5; }'); ['rdx', 'rdy'].forEach(id => w.document.getElementById(id).insertAdjacentHTML('beforeend', '<option value="10">10</option>'));
  let seed = 3; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
  for (let k = 0; k < 60; k++) {
    const h = pick([150, 175, 200, 250, 300]), s = pick([100, 125, 200, 250]), pv = pick([10, 12, 16, 20]), ph = pick([8, 10, 12]), cov = pick([25, 30, 40]), fck = pick([25, 30, 32, 40]);
    const l = pick([2500, 3000, 3500, 4500, 6000]), braced = k % 4 !== 3, NEd = Math.round(1000 * h * 0.85 * fck / 1.5 * (0.05 + 0.6 * rnd()) / 1000), Mt = Math.round(rnd() * 0.08 * NEd * h / 1000 * 10) / 10, Mb = pick([Mt, -Mt * 0.5, 0, -Mt]);
    const k1 = pick([0.1, 0.5, 1, 2]), k2 = pick([0.1, 0.5, 1, 2]), phief = pick([1, 1.5, 2]), eimode = pick(['400', 'ah']), tag = `panel ${k} (h ${h}, H${pv} @ ${s}, ${braced ? 'braced' : 'unbraced'})`;
    const R = Wall.panel({ h, l, fck, fyk: 500, cover: cov, phiV: pv, sV: s, phiH: ph, sH: 200, NEd, Mtop: Mt, Mbot: Mb, braced, k1, k2, phief, eimode });
    const L = colPage.run(w, { rb: 1000, rh: h, rfck: fck, rfyk: 500, rcov: cov, rlink: ph, rnx: 1000 / s, rdx: pv, rny: 2, rdy: pv, ned: NEd, mtop: Mt, mbot: Mb, mtopy: 0, mboty: 0, clen: l, cleny: l, phief, ktop: k1, kbot: k2, ktopy: k1, kboty: k2, braced, mufi: 0.7, eimode }), r = L.rx;
    near(`${tag}: l0`, R.l0, r.l0, 1e-12); near(`${tag}: λ`, R.lambda, r.lambda, 1e-12); near(`${tag}: λlim`, R.lambdaLim, r.lambda_lim, 1e-12); near(`${tag}: ω`, R.omega, r.omega, 1e-12);
    near(`${tag}: d = h/2 + is`, R.dC, r.d_curv, 1e-12); near(`${tag}: nbal (the curve has jumps where a bar's strain changes sign)`, R.nbal, r.nbal, 3e-2);
    near(`${tag}: M2`, R.M2, r.M2, 1e-6, Math.max(R.M2, 0.05 * R.MEd)); near(`${tag}: MEd`, R.MEd, r.MEd, 1e-6); near(`${tag}: MRd at NEd`, R.MRd, L.McapXX, 1e-9);
  }
} else console.log('(RC Column Design cross-check skipped: jsdom not found)');

// ---------- 3 hand checks ----------
const P0 = { h: 200, l: 3500, fck: 32, fyk: 500, cover: 30, phiV: 12, sV: 200, phiH: 10, sH: 300, NEd: 900, Mtop: 6, Mbot: -3, braced: true, k1: 0.5, k2: 0.5, phief: 2, eimode: '400', lw: 4 };
{
  const R = Wall.panel(P0), fcd = 0.85 * 32 / 1.5, d2 = 30 + 10 + 6, A12 = AREA(12) * 5, Ac = 200000;
  near('d2 = cover + horizontal bar + φv/2', R.d2, d2, 1e-12); near('As per face = 1000/s bars', R.Aface, A12, 1e-12); near('As,h both faces', R.AsH, 2 * AREA(10) * 1000 / 300, 1e-12);
  const l0 = 0.5 * 3500 * (1 + 0.5 / 0.95), lam = l0 * Math.sqrt(12) / 200, ei = l0 / 400, eiN = 900 * ei / 1000;
  near('l0 (5.15)', R.l0, l0, 1e-12); near('λ = l0 √12 / h', R.lambda, lam, 1e-12);
  const M02 = 6 + eiN, M01 = -3 + eiN, om = 2 * A12 * FYD / (Ac * fcd), nn = 900e3 / (Ac * fcd);
  near('M02 = |M| + ei NEd', R.M02, M02, 1e-12); near('M01 keeps its sign', R.M01, M01, 1e-12);
  near('λlim = 20ABC/√n', R.lambdaLim, 20 / (1 + 0.4) * Math.sqrt(1 + 2 * om) * (1.7 - M01 / M02) / Math.sqrt(nn), 1e-12);
  near('e0 = max(h/30, 20 mm)', R.Me0, 900 * 20 / 1000, 1e-12);
  // independent section solution at N = NEd
  const pt = x => { const s = Math.min(0.8 * x, 200); let N = fcd * 1000 * s, M = fcd * 1000 * s * (100 - s / 2); for (const y of [d2, 200 - d2]) { const e = x > 200 ? 0.00175 * (x - y) / (x - 100) : 0.0035 * (x - y) / x; const f = Math.max(-FYD, Math.min(FYD, ES * e)) - (e > 0 ? fcd : 0); N += f * A12; M += f * A12 * (100 - y); } return { N, M }; };
  for (const Nt of [0, 300e3, 900e3, 2000e3]) { let lo = 1e-6, hi = 4000; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (pt(m).N > Nt) hi = m; else lo = m; } near(`MRd at N = ${Nt / 1e3} kN/m, independent`, Wall.mRd(R.S, Nt) / 1e6, pt((lo + hi) / 2).M / 1e6, 1e-9); }
  near('squash load (Ac − As) fcd + As min(εc3 Es, fyd)', R.N0, ((Ac - 2 * A12) * fcd + 2 * A12 * Math.min(350, FYD)) / 1e3, 1e-12);
  // a slender braced wall step by step
  const S = Wall.panel({ ...P0, l: 5200, NEd: 600, Mtop: 8, Mbot: 8 }), Sl0 = 0.5 * 5200 * (1 + 0.5 / 0.95);
  truth('slender case is slender', S.slender);
  const om2 = S.omega, n2 = 600e3 / (Ac * fcd), Kr = Math.min(1, (1 + om2 - n2) / (1 + om2 - S.nbal)), Kphi = Math.max(1, 1 + (0.35 + 32 / 200 - S.lambda / 150) * 2), dC = 200 - d2;
  near('Kr', S.Kr, Kr, 1e-12); near('Kφ', S.Kphi, Kphi, 1e-12); near('d = h − d2 for two faces', S.dC, dC, 1e-12);
  near('constant moment: c = 8, M2 = NEd Kr Kφ εyd/(0.45d) l0²/8', S.M2, 600 * Kr * Kphi * FYD / ES / (0.45 * dC) * Sl0 * Sl0 / 8 / 1000, 1e-12);
  near('MEd = M0e + M2 (single curvature, rm = 1)', S.MEd, Math.max(S.M02, S.M0e + S.M2, S.M01abs + S.M2 / 2, S.Me0), 1e-12);
  truth('nbal = max(the peak, 0.4)', S.nbal === Math.max(S.nbalPk, 0.4));
  const U = Wall.panel({ ...P0, braced: false });
  near('unbraced l0 (5.16)', U.l0, 3500 * Math.max(Math.sqrt(1 + 10 * 0.5 * 0.5 / (0.5 + 0.5)), (1 + 0.5 / 1.5) ** 2), 1e-12);
  near('unbraced MEd = max(M02 + M2, e0 NEd)', U.MEd, Math.max(U.M02 + U.M2, U.Me0), 1e-12); near('unbraced rm = 1', U.rm, 1, 1e-12);
  near('pinned ends: l0 = l', Wall.panel({ ...P0, pinned: true }).l0, 3500, 1e-12);
  const AH = Wall.panel({ ...P0, eimode: 'ah', l: 9000 }); near('θi = θ0 αh, αh = 2/√9', AH.thetaI, 0.005 * 2 / 3, 1e-12); near('ei = θi l0/2', AH.ei, AH.thetaI * AH.l0 / 2, 1e-12);
  // 9.6
  const ck = (R2, re) => R2.checks.find(c => re.test(c.name));
  near('As,v ≥ 0.002 Ac', ck(R, /not less than 0.002/).util, 0.002 * Ac / (2 * A12), 1e-12);
  near('As,v ≤ 0.04 Ac', ck(R, /not more than 0.04/).util, 2 * A12 / (0.04 * Ac), 1e-12);
  near('vertical spacing ≤ min(3h, 400)', ck(R, /Vertical bar spacing/).util, 200 / 400, 1e-12);
  near('horizontal ≥ max(0.25 As,v, 0.001 Ac)', ck(R, /Horizontal steel/).util, Math.max(0.25 * 2 * A12, 200) / R.AsH, 1e-12);
  near('horizontal spacing ≤ 400', ck(R, /Horizontal bar spacing/).util, 300 / 400, 1e-12);
  near('vertical spacing in a thin wall ≤ 3h', ck(Wall.panel({ ...P0, h: 120, cover: 25, sV: 400, phiV: 10, phiH: 8 }), /Vertical bar spacing/).util, 400 / 360, 1e-12);
  truth('heavy steel: links through the wall (9.6.4)', Wall.panel({ ...P0, phiV: 25, sV: 100 }).notes.some(t => /9\.6\.4/.test(t)));
  truth('short wall: design as a column (9.6.1)', Wall.panel({ ...P0, lw: 0.7 }).notes.some(t => /9\.6\.1/.test(t)));
  truth('a wall with the vertical bars outside', Wall.panel({ ...P0, hOutside: false }).d2 === 36);
  // plain walls, 12.6.5
  const PL = { ...P0, plain: true, NEd: 400, Mtop: 4, Mbot: 2, accPl: 0.6 };
  const p2 = Wall.panel(PL), fcdpl = 0.6 * 32 / 1.5, l0p = 3500, etot = 4 / 400 * 1000 + l0p / 400, Phi = Math.min(1.14 * (1 - 2 * etot / 200) - 0.02 * l0p / 200, 1 - 2 * etot / 200);
  near('plain: β = 1 held top and bottom', p2.beta, 1, 1e-12); near('plain: Φ (12.11)', p2.Phi, Phi, 1e-12); near('plain: NRd = b h fcd,pl Φ (12.10)', p2.NRd, 1000 * 200 * fcdpl * Phi / 1e3, 1e-12);
  near('plain: three sides β = 1/(1 + (lw/3b)²)', Wall.panel({ ...PL, sides: '3', bSide: 2000 }).beta, 1 / (1 + Math.pow(3500 / 6000, 2)), 1e-12);
  near('plain: four sides, b ≥ lw: β = 1/(1 + (lw/b)²)', Wall.panel({ ...PL, sides: '4', bSide: 5000 }).beta, 1 / (1 + Math.pow(3500 / 5000, 2)), 1e-12);
  near('plain: four sides, b < lw: β = b/(2lw)', Wall.panel({ ...PL, sides: '4', bSide: 3000 }).beta, 3000 / 7000, 1e-12);
  near('plain: built in top and bottom × 0.85', Wall.panel({ ...PL, rigid: true }).beta, 0.85, 1e-12);
  near('plain: cantilever β = 2', Wall.panel({ ...PL, sides: 'cant' }).beta, 2, 1e-12);
  near('plain: λ ≤ 86', p2.checks.find(c => /86/.test(c.name)).util, l0p * Math.sqrt(12) / 200 / 86, 1e-12);
  truth('plain: an eccentricity of half the thickness has no resistance', Wall.panel({ ...PL, Mtop: 40 }).util === Infinity);
  throws('plain: b needed for side restraint', () => Wall.panel({ ...PL, sides: '3', bSide: 0 }), /b must be greater than 0/);
  throws('panel: tension', () => Wall.panel({ ...P0, NEd: -10 }), /compression/);
  throws('panel: bars must fit', () => Wall.panel({ ...P0, h: 100, cover: 40 }), /do not fit/);
  throws('panel: concrete class', () => Wall.panel({ ...P0, fck: 55 }), /f_ck/);
}

// ---------- 4 the core method as shipped ----------
{
  const box = { B: 3000, D: 4000, openings: [{ x: 250, y: 250, w: 2500, h: 3500 }] };
  const Lshape = { B: 3000, D: 3000, openings: [{ x: 300, y: 300, w: 2700, h: 2700 }] };   // two walls meeting at a corner
  const base = { L: 30, W: 18, Mns: 10000, Mew: 7000, cores: [{ ...box, x: 2, y: 2 }, { ...Lshape, x: 24, y: 10 }, { B: 6000, D: 250, x: 10, y: 15 }] };
  const D = Wall.distribute(base);
  for (const [dir, key, M] of [['NS', 'ns', base.Mns], ['EW', 'ew', base.Mew]]) {
    near(`${dir}: the cores carry the whole moment in its direction`, D.C.reduce((t, c) => t + (dir === 'NS' ? c[key][0].Mx : c[key][0].My), 0), M, 1e-12);
    near(`${dir}: the torsion forces across sum to zero`, D.C.reduce((t, c) => t + (dir === 'NS' ? c[key][0].My : c[key][0].Mx), 0), 0, 1e-12, M);
    const torque = D.C.reduce((t, c) => t + c[key][0].Mx * (c.X - D.xs) - c[key][0].My * (c.Y - D.ys), 0);
    near(`${dir}: the cores resist the torque about the stiffness centre`, torque, dir === 'NS' ? M * D.ex0 : -M * D.ey0, 1e-9);
  }
  const sym = Wall.distribute({ L: 20, W: 10, Mns: 1000, Mew: 500, cores: [{ ...box, x: 3, y: 3 }, { ...box, x: 14, y: 3 }] });
  truth('two equal cores placed symmetrically about the centre in x take half the NS wind each', sym.C.every(c => Math.abs(c.ns[0].Mx - 500) < 1e-9));
  const acc = Wall.distribute({ ...base, eAcc: 0.1 });
  truth('extra eccentricity: two NS cases at e ± 0.1L', acc.exs.length === 2 && Math.abs(acc.exs[0] - acc.exs[1] - 2 * 0.1 * 30000) < 1e-6);
  truth('extra eccentricity never lowers a core share', acc.C.every((c, k) => c.shareNS >= D.C[k].shareNS - 1e-12 && c.shareEW >= D.C[k].shareEW - 1e-12));
  // section properties of the L: two walls 300 thick
  const P = Wall.props(Lshape), A = 3000 * 300 + 2700 * 300, xc = (3000 * 300 * 1500 + 2700 * 300 * 150) / A;
  near('L-shaped core: area', P.A, A, 1e-12); near('L-shaped core: centroid (symmetric about the diagonal)', P.xc, xc, 1e-12); near('L-shaped core: x̄ = ȳ', P.yc, xc, 1e-12);
  truth('L-shaped core has a product of inertia', P.Ixy < 0 || P.Ixy > 0);
  // unsymmetric bending: the stresses integrate back to N, Mx and My
  const R = Wall.core({ ...base, design: 1, fck: 32, fyk: 500, loads: [{ x: 150, y: 1500, G: 800, Q: 200 }, { x: 2000, y: 150, G: 500, Q: 100 }], locations: [{ x: 150, y: 150, t: 300 }] }), c = R.c;
  for (const [N, Mx, My] of [[1000, 300, -200], [500, -800, 400]]) {
    let sN = 0, sX = 0, sY = 0; const g = 50, gp = [0.5 - 0.5 / Math.sqrt(3), 0.5 + 0.5 / Math.sqrt(3)];   // 2 × 2 Gauss points per cell: exact here
    for (const p of c.parts) for (let i = 0; i < p.w / g; i++) for (let j = 0; j < p.h / g; j++) for (const u of gp) for (const v of gp) { const x = p.x + (i + u) * g, y = p.y + (j + v) * g, s = R.stress(N, Mx, My, x, y) * p.s * g * g / 4; sN += s; sX += s * (y - c.yc); sY += s * (x - c.xc); }
    near(`stresses integrate to N (${N}, ${Mx}, ${My})`, sN / 1e3, N, 1e-9); near(`stresses integrate to Mx`, sX / 1e6, Mx, 1e-6, Math.max(Math.abs(Mx), Math.abs(My))); near(`stresses integrate to My`, sY / 1e6, My, 1e-6, Math.max(Math.abs(Mx), Math.abs(My)));
  }
  // the peaks at corners bound every point on the walls
  let worst = 0; for (let k = 0; k < 400; k++) { const x = (k * 37 % 300), y = (k * 53 % 3000); for (const cs of R.cases) for (const w of R.wind) { const s = R.stress(cs.N, cs.MxV + cs.gW * w.Mx, cs.MyV + cs.gW * w.My, x, y); worst = Math.max(worst, s - R.peakC.s, R.peakT.s - s); } }
  truth('no point on the walls exceeds the corner peaks', worst < 1e-9);
  // combinations
  const C1 = Wall.combos('6.10ab', 0.7), C2 = Wall.combos('6.10', 0.7);
  truth('6.10a/b: six combinations with ξγG = 1.25, wind ψ0 = 0.5', C1.length === 6 && Math.abs(C1[1].gG - 1.24875) < 1e-12 && C1[0].gW === 0.75 && C1[2].gW === 1.5 && C1[5].gQ === 0 && C1[5].gG === 1);
  truth('6.10: five combinations with 1.35G', C2.length === 5 && C2[0].gG === 1.35 && Math.abs(C2[1].gQ - 1.05) < 1e-12);
  // steel and bars
  const L1 = R.locs[0];
  near('tension steel = σt t / fyd', L1.AsT, L1.sT * 300 * 1000 / FYD, 1e-12);
  truth('steel needed ≥ 0.002 Ac', L1.need >= 0.002 * 300 * 1000 - 1e-9);
  truth('vertical bars: each face, spacing a multiple of 25 within min(3t, 400), enough steel', L1.bv && L1.bv.s % 25 === 0 && L1.bv.s <= 400 && L1.bv.As >= L1.need - 1e-9);
  truth('horizontal bars ≥ max(0.001 Ac, 0.25 of the vertical bars chosen)', L1.bh.As >= Math.max(300, 0.25 * L1.bv.As) - 1e-9 && L1.bh.s <= 400);
  near('panel NEd = σc t', L1.NEdPanel, L1.sMax * 300, 1e-12);
  const tog = Wall.core({ ...base, design: 1, fck: 32, fyk: 500, together: true, loads: [], locations: [{ x: 150, y: 150, t: 300 }] }), one = Wall.core({ ...base, design: 1, fck: 32, fyk: 500, loads: [], locations: [{ x: 150, y: 150, t: 300 }] });
  truth('both wind directions at once is never less severe', tog.locs[0].sT >= one.locs[0].sT - 1e-12);
  throws('opening outside the core', () => Wall.props({ B: 2000, D: 2000, openings: [{ x: 1500, y: 0, w: 600, h: 300 }] }), /not inside/);
  throws('openings overlapping', () => Wall.props({ B: 2000, D: 2000, openings: [{ x: 200, y: 200, w: 800, h: 800 }, { x: 600, y: 600, w: 800, h: 800 }] }), /overlap/);
  throws('nothing left', () => Wall.props({ B: 2000, D: 2000, openings: [{ x: 0, y: 0, w: 2000, h: 2000 }] }), /no wall/);
  throws('load outside the core', () => Wall.core({ ...base, design: 0, fck: 32, fyk: 500, loads: [{ x: 5000, y: 0, G: 1, Q: 0 }], locations: [] }), /outside core 1/);
  throws('location outside the core', () => Wall.core({ ...base, design: 0, fck: 32, fyk: 500, loads: [], locations: [{ x: 0, y: 9000, t: 250 }] }), /outside core 1/);
  throws('no cores', () => Wall.distribute({ L: 10, W: 10, cores: [] }), /at least one core/);
}

console.log(`\n${n - fails}/${n} passed`);
if (fails) process.exit(1);
/* Documented differences from the Concrete Centre's TCC63 (v4.0), which the tool reproduces only with its conventions
   (method 'tcc', both wind directions together, no product of inertia, TCC's six combinations):
   TCC's torsional stiffness takes only the cores bending in the direction of the wind (the tool adds the cores bending
   across it, so the floor's rotation is shared by every core), and TCC drops the forces the torsion puts on the cores
   across the wind; TCC places each core at the middle of its outline in y and at its centroid in x;
   TCC applies the NS and EW moments together, at full value (the tool, by default, one direction at a time);
   TCC's accompanying wind is 0.5Wk (EN 1990 with the UK NA: 1.5ψ0 = 0.75Wk), and with the wind leading on 1.0Gk it
   keeps ψ2Qk (the tool takes the imposed load as 0 or 1.5ψ0Qk);
   TCC measures the lever of the moments from eccentric vertical loads from the load eccentricity rather than the
   centroid (the TCC runs here put the resultant at the centroid, where the two agree);
   TCC ignores the product of inertia of an unsymmetric core (the tool uses unsymmetric bending). */
