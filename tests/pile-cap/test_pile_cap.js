// Pile Cap engine checks: The Concrete Centre TCC82 (72 caps, outputs only) and hand checks of the pile loads, the bending
// and truss methods, shear across the cap, punching, anchorage and the pile resistance checks.
//   node tests/pile-cap/test_pile_cap.js
const { PileCap: P } = require('./load.js');
const REF = require('./ref_tcc82.json');
let n = 0, fails = 0;
const ok = (name, c, info = '') => { n++; if (!c) { fails++; console.log(`FAIL ${name} ${info}`); } };
const near = (name, a, b, tol = 1e-9) => ok(name, Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `got ${a}, want ${b}`);
const throws = (name, f, re) => { let e = null; try { f(); } catch (x) { e = x; } ok(name, !!e && (!re || re.test(e.message)), e ? e.message : 'no error'); };
const chk = (R, id) => R.checks.find(c => c.id === id);
const AREA = p => Math.PI * p * p / 4, srt = a => [...a].sort((p, q) => p - q);
const sameSet = (name, a, b, tol = 1e-9) => { const A = srt(a), B = srt(b); A.forEach((v, i) => near(`${name} (${i + 1})`, v, B[i], tol)); };

// ---------- TCC82 ----------
// The pile numbering differs, so the pile loads are compared as sets. TCC82 differences, set aside here:
//  - three-pile caps: it shares the cap's weight equally between the piles (this tool puts it at the centroid of the cap's
//    plan, matched below with an equal and opposite moment) and rounds the distance between the rows to the millimetre.
//  - two-pile caps: its lever for the cap's weight includes the pile tolerance (compared exactly when the tolerance is 0).
//  - shear: it deducts no cap weight from the pile loads beyond the section (four piles) or only the 0.3φ strip (two
//    piles), takes v_Ed = V/(b 0.9d) where (6.2) has V/(b d), and lets a_v go negative when a pile lies under the column;
//    compared here are the pile loads beyond each section, a_v, β and v_Rd,c, on the sections with a_v ≥ 0.
//  - punching: no β at the column face, no check inside the piles when a < d (this tool checks from a = d/2), and the
//    column load alone on the perimeter (this tool adds the cap's weight inside it).
//  - it uses its own 6.10a or 6.10b choice and its own ψ0 by building use; compared on that combination.
//  - with wind it takes W in full alongside Q in the characteristic and EC7 combinations; no wind is compared.
REF.cases.forEach((c, i) => {
  const o = c.out, tag = `TCC82 ${c.sheet} case ${i + 1}`;
  const base = { loads: { G: { N: c.G, Mx: c.MxG, My: c.MyG }, Q: { N: c.Q, Mx: c.MxQ, My: c.MyQ } }, dp: c.dp, e: c.A, H: c.H, c1: c.h, c2: c.b, tol: c.tol, fck: c.fck, cover: c.bc, phiX: 16, sX: 200, phiY: 16, sY: 200 };
  const pick = (R, g, q) => R.strRows.find(r => Math.abs(r.g - g) < 1e-9 && Math.abs(r.q - q) < 1e-9);
  if (c.sheet === '4CAP') {
    const Bc = c.sy + 2 * c.A, Lc = c.s + 2 * c.A;
    const R = P.design({ ...base, n: 4, s: c.s, sy: c.sy, ex: c.ex, ey: c.ey, phiX: o.C68, sX: AREA(o.C68) * Bc / o.C77, phiY: o.G68, sY: AREA(o.G68) * Lc / o.G77, bottom: o.O65 === 1 ? 'x' : 'y' });
    const cb = pick(R, o.N59, o.N60);
    near(`${tag}: cap weight`, R.Wc, o.C48);
    sameSet(`${tag}: G + Q pile loads`, R.charRows[0].R, [o.D52, o.E52, o.F52, o.G52]); sameSet(`${tag}: ULS pile loads`, cb.R, [o.D54, o.E54, o.F54, o.G54]);
    sameSet(`${tag}: DA1-1 pile loads`, R.geoRows.find(r => /^C1/.test(r.name)).R, [o.D57, o.E57, o.F57, o.G57]); sameSet(`${tag}: DA1-2 pile loads`, R.geoRows.find(r => /^C2/.test(r.name)).R, [o.D58, o.E58, o.F58, o.G58]);
    near(`${tag}: d along x`, R.dx, o.C71); near(`${tag}: d along y`, R.dy, o.G71);
    near(`${tag}: M at the column faces, bars along x`, R.best.Mcb.x[cb.name], o.C69); near(`${tag}: … bars along y`, R.best.Mcb.y[cb.name], o.G69);
    if (Math.abs(R.best.M.x.M - o.C69) < 1e-6) near(`${tag}: A_s along x`, R.BD.x.As, o.C74); if (Math.abs(R.best.M.y.M - o.G69) < 1e-6) near(`${tag}: A_s along y`, R.BD.y.As, o.G74);
    for (const [ax, V, av, beta, vR] of [['x', o.C86, o.C87, o.K86, o.G87 * o.K86], ['y', o.C90, o.C91, o.K90, o.G91 * o.K90]]) {
      const rows = R.sideRows.filter(r => r.ax === ax), s = rows.reduce((a, r) => r.Vp[cb.name] > a.Vp[cb.name] ? r : a, rows[0]);
      near(`${tag}: v_Rd,c, piles along ${ax}`, R.best.V[ax].vc, vR);
      if (av < c.tol) continue;   // a pile inside the face: TCC82's a_v goes negative
      near(`${tag}: pile load beyond the shear section, ${ax}`, R.best.Vcb[ax][cb.name], V); near(`${tag}: a_v, ${ax}`, s.av, av);
      if (av <= 2 * (ax === 'x' ? R.dx : R.dy)) near(`${tag}: β = a_v/2d, ${ax}`, s.beta, beta);
    }
    near(`${tag}: punching at the column face, N/(u₀d)`, cb.Ncol * 1e3 / (2 * (c.h + c.b) * R.dave), o.C96); near(`${tag}: v_Rd,max = 0.5νf_cd`, R.best.P0.vmax, o.C97);
    if (c.ex === 0 && c.ey === 0) {
      near(`${tag}: punching perimeter a`, R.best.aMax, o.N94);
      if (R.best.Pmax) { near(`${tag}: u at a`, R.best.Pmax.uLen, o.F95); near(`${tag}: v_Rd,c 2d/a`, R.best.Pmax.vRd, o.H97);
        if (o.N94 >= o.F96) near(`${tag}: v_Ed at a (column load)`, cb.Ncol * 1e3 / (R.best.Pmax.uLen * R.dave), o.H96); }
    }
  } else if (c.sheet === 'DOUBLE') {
    const R = P.design({ ...base, n: 2, s: c.s, ex: c.ex, c1: c.b, c2: c.h }), cb = pick(R, o.N55, o.N56);
    near(`${tag}: cap weight`, R.Wc, o.C46);
    sameSet(`${tag}: G + Q pile loads`, R.charRows[0].R, [o.J47, o.K47]); sameSet(`${tag}: ULS pile loads`, cb.R, [o.J49, o.K49]);
    sameSet(`${tag}: DA1-1`, R.geoRows.find(r => /^C1/.test(r.name)).R, [o.J52, o.K52]); sameSet(`${tag}: DA1-2`, R.geoRows.find(r => /^C2/.test(r.name)).R, [o.J53, o.K53]);
    near(`${tag}: M at the column face`, R.best.Mcb.x[cb.name], Math.max(o.C56, o.C57), c.tol === 0 ? 1e-9 : 5e-3);
  } else if (c.sheet === '3CAP') {
    const R0 = P.design({ ...base, n: 3, s: c.s, nBand: 4, phiBand: 20 }), mx = R0.Wc * R0.PP.cx / 1000, my = R0.Wc * R0.PP.cy / 1000;
    const R = P.design({ ...base, n: 3, s: c.s, nBand: 4, phiBand: 20, loads: { G: { N: c.G, Mx: c.MxG - mx, My: -c.MyG - my }, Q: { N: c.Q, Mx: c.MxQ, My: -c.MyQ } } });
    const cb = pick(R, o.N54, o.N55);
    near(`${tag}: cap weight`, R.Wc, o.C48, 1e-3);
    sameSet(`${tag}: G + Q pile loads`, R.charRows[0].R, [o.D53, o.E53, o.F53], 1e-3); sameSet(`${tag}: ULS pile loads`, cb.R, [o.D55, o.E55, o.F55], 1e-3);
    sameSet(`${tag}: DA1-1`, R.geoRows.find(r => /^C1/.test(r.name)).R, [o.I57, o.J57, o.K57], 1e-3); sameSet(`${tag}: DA1-2`, R.geoRows.find(r => /^C2/.test(r.name)).R, [o.I58, o.J58, o.K58], 1e-3);
  } else if (c.sheet === '5CAP') {
    const R = P.design({ ...base, n: 5, s: o.E10, sy: o.E11 }), cb = pick(R, o.N62, o.N63);
    near(`${tag}: cap weight`, R.Wc, o.C46);
    sameSet(`${tag}: G + Q pile loads`, R.charRows[0].R, [o.D60, o.E60, o.F60, o.G60, o.H60]); sameSet(`${tag}: ULS pile loads`, cb.R, [o.D62, o.E62, o.F62, o.G62, o.H62]);
    sameSet(`${tag}: DA1-1`, R.geoRows.find(r => /^C1/.test(r.name)).R, [o.D65, o.E65, o.F65, o.G65, o.H65]); sameSet(`${tag}: DA1-2`, R.geoRows.find(r => /^C2/.test(r.name)).R, [o.D66, o.E66, o.F66, o.G66, o.H66]);
  } else {   // TCC82's 6-pile cap has two piles along x and three along y: swap the axes; its building use gives ψ0 = 1.0
    const R = P.design({ ...base, n: 6, s: c.s, sy: c.sy, psiQ: 1, loads: { G: { N: c.G, Mx: c.MyG, My: c.MxG }, Q: { N: c.Q, Mx: c.MyQ, My: c.MxQ } } }), cb = pick(R, o.S65, o.S66);
    near(`${tag}: cap weight`, R.Wc, o.C50);
    sameSet(`${tag}: G + Q pile loads`, R.charRows[0].R, [o.D63, o.E63, o.F63, o.G63, o.H63, o.I63]); sameSet(`${tag}: ULS pile loads`, cb.R, [o.D65, o.E65, o.F65, o.G65, o.H65, o.I65]);
    sameSet(`${tag}: DA1-1`, R.geoRows.find(r => /^C1/.test(r.name)).R, [o.U60, o.V60, o.W60, o.X60, o.Y60, o.Z60]); sameSet(`${tag}: DA1-2`, R.geoRows.find(r => /^C2/.test(r.name)).R, [o.AA60, o.AB60, o.AC60, o.AD60, o.AE60, o.AF60]);
  }
});

// ---------- hand checks ----------
const B4 = { n: 4, s: 1500, sy: 1500, e: 450, dp: 500, H: 1000, c1: 500, c2: 500, tol: 0, fck: 32, cover: 75, phiX: 20, sX: 150, phiY: 20, sY: 150, loads: { G: { N: 2000 } } };
const run = o => P.design({ ...B4, ...o });
{ // pile loads: V/n + M x/Σx² + M y/Σy², the cap's weight
  const R = run({ loads: { G: { N: 2000, Mx: 300, My: -150, Hx: 20 } } });
  const Wc = 25 * 2.4 * 2.4 * 1.0; near('cap weight 25 × 2.4 × 2.4 × 1.0', R.Wc, Wc);
  const V = 2000 + Wc, Mx = 300 + 20 * 1.0, My = -150, Sx2 = 4 * 0.75 ** 2;
  const exp = R.piles.map(([x, y]) => V / 4 + Mx * (x / 1000) / Sx2 + My * (y / 1000) / Sx2);
  R.charRows[0].R.forEach((v, i) => near(`pile ${i + 1}: V/n + M_x x/Σx² + M_y y/Σy², H × the cap depth`, v, exp[i]));
  const U = run({ ex: 100, loads: { G: { N: 2000 } } });
  near('column offset: N e_x moves the load, the cap weight stays central', U.charRows[0].R[1] - U.charRows[0].R[0], 2 * 2000 * 0.1 * 0.75 / Sx2);
  const C1 = run({ loads: { G: { N: 2000 }, Q: { N: 1000 } } });
  near('DA1-1: 1.35(G + cap) + 1.5Q', C1.geoRows[0].R[0], (1.35 * (2000 + Wc) + 1500) / 4); near('DA1-2: 1.0(G + cap) + 1.3Q', C1.geoRows[1].R[0], (2000 + Wc + 1300) / 4);
}
{ // bending method: M at the column face from the piles beyond it, less the cap beyond it; with tolerance
  const R = run({ tol: 75 }), r = R.strRows[0], Rp = r.R[1];
  const w = 25 * 2.4 * 1.0 / 1000;   // kN per mm length of cap
  const M = (2 * Rp * (750 - 250 + 75) - r.g * w * 950 * 950 / 2) / 1000;
  near('M_Ed = ΣR (a + tolerance) − γ_G w l²/2', R.best.Mcb.x[r.name], M, 1e-12);
  near('…symmetric both ways', R.best.Mcb.y[r.name], M, 1e-12);
  near('d along x and y', R.dx, 1000 - 75 - 10); near('d', R.dy, 1000 - 75 - 20 - 10);
  near('A_s over the full width: utilisation', chk(R, 'bendx').util, R.BD.x.As / (AREA(20) / 150 * 2400), 1e-12);
  // shear: the section 0.3φ inside the piles, a_v to the column face + tolerance, β = a_v/2d
  const s = R.sideRows.find(x => x.ax === 'x' && x.side === 1);
  near('shear section at 0.3φ_p inside the pile centres', s.secS, 750 - 150); near('a_v = 750 − 150 − 250 + 75', s.av, 425); near('β = max(a_v, d/2)/2d', s.beta, Math.max(425, 915 / 2) / (2 * 915));
  const V = R.best.V.x; near('V_Ed = the piles beyond less the cap beyond the section', V.VEd, Math.max(...R.strRows.map(q => 2 * q.R[1] - q.g * w * (450 + 150))), 1e-12);
  const rho = AREA(20) / 150 * 2400 / (2400 * 915), k = 1 + Math.sqrt(200 / 915);
  near('v_Rd,c (6.2.a)', V.vc, Math.max(0.12 * k * (100 * rho * 32) ** (1 / 3), 0.035 * k ** 1.5 * Math.sqrt(32)), 1e-12);
  near('shear utilisation βV/V_Rd,c', chk(R, 'shearx').util, V.beta * V.VEd / (V.vc * 2400 * 915 / 1e3), 1e-12);
  near('(6.5): V_Ed ≤ 0.5 b d ν f_cd', chk(R, 'smaxx').util, V.VEd / (0.5 * 2400 * 915 * 0.6 * (1 - 32 / 250) * 32 / 1.5 / 1e3), 1e-12);
  // punching at the column face
  const N = Math.max(...R.strRows.map(q => q.Ncol)), d = (915 + 895) / 2;
  near('column face: N/(u₀ d) against 0.5νf_cd', chk(R, 'punch0').util, N * 1e3 / (2000 * d) / (0.5 * 0.6 * (1 - 32 / 250) * 32 / 1.5), 1e-12);
  near('perimeter a = min(2d, pile distance − 0.3φ_p)', R.best.aMax, 500 - 150);
  // anchorage: from the pile's inner face to the end of the bar, σ_sd from A_s,req/A_s,prov
  const a = R.anch.x; near('available length e + φ_p/2 − cover', a.lAvail, 450 + 250 - 75); near('σ_sd = f_yd A_s,req/A_s,prov', a.ss, 500 / 1.15 * R.BD.x.As / (AREA(20) / 150 * 2400), 1e-12);
}
{ // truss method: classic forms
  const T2 = P.design({ ...B4, n: 2, s: 1500, method: 'truss', c1: 400, c2: 400, loads: { G: { N: 1000 } } }), r2 = T2.strRows[0], R2 = r2.R[0];
  near('2 piles: T = R (s/2 − c/4)/d', T2.truss.ties[0].T, R2 * (750 - 100) / T2.dx, 1e-12);
  const T4 = run({ method: 'truss' }), r4 = T4.strRows[0];
  near('4 piles: T along x = R (s/2 − c/4)/d', T4.truss.ties.find(t => t.dir === 'x').T, r4.R[0] * (750 - 125) / T4.dx, 1e-12);
  near('4 piles: T along y with d_y', T4.truss.ties.find(t => t.dir === 'y').T, r4.R[0] * (750 - 125) / T4.dy, 1e-12);
  near('tie steel in a 3φ_p band', T4.truss.ties[0].As, AREA(20) / 150 * 1500);
  near('CCC node: N/(h b) ≤ ν′f_cd, ν′ = 1 − f_ck/250, f_cd = 0.85f_ck/1.5', chk(T4, 'ccc').util, Math.max(...T4.strRows.map(q => q.Ncol)) * 1e3 / 250000 / ((1 - 32 / 250) * 0.85 * 32 / 1.5), 1e-12);
  near('CCT node: R/A_pile ≤ 0.85ν′f_cd', chk(T4, 'cct').util, Math.max(...T4.strRows.flatMap(q => q.R)) * 1e3 / AREA(500) / (0.85 * (1 - 32 / 250) * 0.85 * 32 / 1.5), 1e-12);
  const T3 = P.design({ ...B4, n: 3, s: 1500, c1: 1e-3, c2: 1e-3, nBand: 5, phiBand: 25, loads: { G: { N: 1500 } } });
  const r3 = T3.strRows[0];
  T3.truss.ties.forEach((t, k) => near(`3 piles, a point column: T = R s/(3d) on side ${k + 1} (N l/9d)`, t.T, Math.max(...t.piles.map(i => r3.R[i])) * 1500 / (3 * T3.dave), 1e-6));
  ok('3 piles: always the truss method', P.design({ ...B4, n: 3, nBand: 5, phiBand: 25, method: 'bending' }).method === 'truss');
}
{ // piles: resistance checks, tension and hogging
  const R = run({ swl: 700, Rcd: 900, loads: { G: { N: 2000 }, Q: { N: 500 } } });
  near('safe working load: the largest characteristic load', chk(R, 'swl').util, Math.max(...R.Rchar.map(x => x.max)) / 700);
  near('R_c,d: the largest DA1 load', chk(R, 'rcd').util, Math.max(...R.Rgeo.map(x => x.max)) / 900);
  const T = run({ loads: { G: { N: 400 }, W: { Mx: 900 } } });
  ok('a pile in tension without R_t,d fails', chk(T, 'rtd').util === Infinity && T.util > 1);
  ok('…and hogging asks for top steel', chk(T, 'hogx') && chk(T, 'hogx').util === Infinity);
  const T2 = run({ Rtd: 400, AsTop: 2000, loads: { G: { N: 400 }, W: { Mx: 900 } } });
  ok('with R_t,d and top steel both are checked', Number.isFinite(chk(T2, 'rtd').util) && Number.isFinite(chk(T2, 'hogx').util));
  const two = P.design({ ...B4, n: 2, loads: { G: { N: 1000, My: 50 } } });
  ok('2 piles: M_y is left out with a note', two.warnings.some(w => /cannot carry M_y/.test(w)) && two.charRows[0].R[0] === two.charRows[0].R[1]);
}
{ // links, 6.10, errors, warnings
  const wide = { s: 2400, sy: 2400, e: 450, H: 900 };
  const A = run({ ...wide, loads: { G: { N: 4000 }, Q: { N: 2000 } } }), Bl = run({ ...wide, loads: { G: { N: 4000 }, Q: { N: 2000 } }, links: { legs: 8, phi: 12, s: 150 } });
  ok('links lift the shear resistance', chk(Bl, 'shearx').util < chk(A, 'shearx').util && Bl.best.V.x.VRds > 0);
  const AswS = 8 * AREA(12) / 150; near('a_v ≤ 2d: (6.19) A_sw f_ywd within 0.75a_v', Bl.best.V.x.VRds, AswS * 0.75 * Bl.best.V.x.av * 500 / 1.15 / 1e3, 1e-12);
  const Cl = run({ s: 4200, sy: 2400, e: 450, H: 900, loads: { G: { N: 4000 } }, links: { legs: 8, phi: 12, s: 150 } });
  ok('the section lies beyond 2d', Cl.best.V.x.av > 2 * Cl.dx);
  near('a_v > 2d: V_Rd,s = A_sw/s 0.9d f_ywd cot θ, cot θ 2.5', Cl.best.V.x.VRds, AswS * 0.9 * Cl.dx * 500 / 1.15 * 2.5 / 1e3, 1e-12);
  near('…β = 1 beyond 2d', Cl.best.V.x.beta, 1);
  const S6 = run({ comb: '6.10', loads: { G: { N: 2000 }, Q: { N: 800 } } }); ok('6.10: one combination 1.35G + 1.5Q', S6.strRows.length === 1 && S6.strRows[0].g === 1.35 && S6.strRows[0].q === 1.5);
  throws('the column must sit on the cap', () => run({ ex: 1500 }), /not on the cap/);
  throws('the edge must reach past the pile', () => run({ e: 200 }), /edge distance/);
  throws('2 to 6 piles', () => run({ n: 7 }), /2, 3, 4, 5 or 6/);
  ok('close piles get a note', run({ s: 1200, sy: 1200 }).warnings.some(w => /3 × their diameter/.test(w)));
  ok('a short edge gets a note', run({ e: 350 }).warnings.some(w => /150 mm/.test(w)));
  const F = run({ method: 'truss', H: 450, s: 2400, sy: 2400 }); ok('a flat strut gets a note', F.warnings.some(w => /truss model is unreliable/.test(w)));
}
console.log(`\n${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
