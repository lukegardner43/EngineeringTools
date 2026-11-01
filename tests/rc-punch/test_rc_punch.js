// RC Punching Shear: node test_rc_punch.js
// 1 The Concrete Centre TCC13 (110 punching runs, outputs only: internal columns with the UK NA factors and with beta
//   calculated for biaxial moments, edge and corner columns): rho_l, k, vRd,c, vRd,max, beta, u0, u1, the stresses,
//   fywd,ef, uout and Asw/sr.
// 2 Openings (6.4.2(3), Figure 6.14): the length lost from u1 against an independent sampling of the perimeter.
// 3 Closed forms and rules: vRd,c, vRd,max, beta (6.39, 6.41, 6.43, 6.46), u0, u1, uout, the link layout (9.4.3, 6.4.5, 9.11).
const { Punching } = require('./load.js');
const T13 = require('./ref_tcc13.json');
let n = 0, fails = 0;
const near = (name, got, exp, tol, scale = null) => { n++; const e = Math.abs(got - exp) / Math.max(Math.abs(scale ?? exp), 1e-9); const ok = e <= tol; if (!ok || process.env.V) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${(+got).toPrecision(8)} expected ${(+exp).toPrecision(8)}`); if (!ok) fails++; };
const truth = (name, c) => { n++; if (!c || process.env.V) console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
const throws = (name, fn, re) => { let m = ''; try { fn(); } catch (e) { m = e.message; } truth(`${name} (${m || 'no error'})`, re.test(m)); };
const AREA = p => Math.PI * p * p / 4;

// ---------- 1 TCC13 ----------
T13.forEach(({ inp, tcc: t }, i) => {
  const R = Punching.design(inp), tag = `TCC13 ${i} ${inp.type}${inp.beta.method === 'calc' ? ' calc' : ''}`;
  near(`${tag}: rho_l`, R.rhoL * 100, t.rhoPct, 1e-12); near(`${tag}: k`, R.k, t.k, 1e-12); near(`${tag}: vRd,c`, R.vRdc, t.vRdc, 1e-12);
  near(`${tag}: vRd,max`, R.vRdmax, t.vRdmax, 1e-12); near(`${tag}: beta`, R.beta, t.beta, 1e-10); near(`${tag}: u0`, R.u0, t.u0, 1e-9);
  near(`${tag}: vEd,0`, R.vEd0, t.vEd0, 1e-9); near(`${tag}: u1`, R.u1, t.u1, 1e-9); near(`${tag}: vEd at u1`, R.vEd1, t.vEd1, 1e-9);
  near(`${tag}: fywd,ef`, R.fywdef, t.fywdef, 1e-12);
  // TCC stops its search at about the column face when uout,ef is shorter than the perimeter there
  near(`${tag}: uout (perimeter at r_out)`, Punching.uGross(R.G, R.rout), t.uout, R.rout < 0.02 * R.d ? 5e-3 : 2e-4);
  const AswSr = Math.max(0, (R.vEd1 - 0.75 * R.vRdc) * R.u1 / (1.5 * R.fywdef));
  near(`${tag}: Asw/sr`, R.links ? R.links.AswSr : AswSr, t.AswSr, 1e-9, Math.max(t.AswSr, 1e-3));
});

// ---------- 2 openings: an independent sampling of u1 (internal rectangular column, centre at the origin) ----------
function sampledLoss(ax, ay, r, inShadow, N = 400000) {
  // the rounded rectangle at r from the faces: 4 sides and 4 quarter arcs, sampled evenly by length
  const parts = [[2 * ay, s => [ax + r, -ay + s]], [Math.PI * r / 2, s => [ax + r * Math.cos(s / r), ay + r * Math.sin(s / r)]],
    [2 * ax, s => [ax - s, ay + r]], [Math.PI * r / 2, s => [-ax - r * Math.sin(s / r), ay + r * Math.cos(s / r)]],
    [2 * ay, s => [-ax - r, ay - s]], [Math.PI * r / 2, s => [-ax - r * Math.cos(s / r), -ay - r * Math.sin(s / r)]],
    [2 * ax, s => [-ax + s, -ay - r]], [Math.PI * r / 2, s => [ax + r * Math.sin(s / r), -ay - r * Math.cos(s / r)]]];
  const L = parts.reduce((a, p) => a + p[0], 0), ds = L / N; let lost = 0, s = ds / 2, k = 0, s0 = 0;
  for (let m = 0; m < N; m++, s += ds) { while (s > s0 + parts[k][0]) { s0 += parts[k][0]; k++; } const [x, y] = parts[k][1](s - s0); if (inShadow(x, y)) lost += ds; }
  return { L, lost };
}
const cone = (lo, hi) => (x, y) => { const a = Math.atan2(y, x); return a >= lo && a <= hi; };
const P0 = { type: 'internal', shape: 'rect', c1: 400, c2: 400, h: 250, cover: 30, phiX: 16, sX: 150, phiY: 16, sY: 150, outer: 'x', fck: 32, fyk: 500, VEd: 700, beta: { method: 'factors' } };
{
  const R = Punching.design({ ...P0, holes: [{ x: 600, y: 0, a: 300, b: 300 }] }), d = R.d, h = Math.atan(150 / 450);   // l1 = l2: tangents to the near corners
  const ref = sampledLoss(200, 200, 2 * d, cone(-h, h));
  near('opening 300 x 300 facing the column: u1 lost', R.lost1, ref.lost, 2e-4); near('opening 300 x 300: gross u1', R.u1g, ref.L, 1e-6);
  near('opening 300 x 300: about 2 (ax + 2d) tan(phi) (the straight side)', R.lost1, 2 * (200 + 2 * d) * 150 / 450, 3e-3);
  near('opening 300 x 300: net u1', R.u1, R.u1g - R.lost1, 1e-12);
}
{
  const R = Punching.design({ ...P0, holes: [{ x: 600, y: 0, a: 600, b: 200 }] }), d = R.d;   // l1 = 600 > l2 = 200: l2 -> sqrt(l1 l2) at the near edge
  const h = Math.atan(Math.sqrt(600 * 200) / 2 / 300), ref = sampledLoss(200, 200, 2 * d, cone(-h, h));
  near('slot 600 x 200 pointing at the column (Figure 6.14, l1 > l2): u1 lost', R.lost1, ref.lost, 1e-4);
  truth('slot: the widened shadow is wider than the tangents to the corners', h > Math.atan(100 / 300));
}
{
  const R = Punching.design({ ...P0, holes: [{ x: 500, y: 500, a: 200, b: 200 }] }), d = R.d;   // diagonal: tangents to two corners
  const ref = sampledLoss(200, 200, 2 * d, cone(Math.atan2(400, 600), Math.atan2(600, 400)));
  near('opening on the diagonal: u1 lost', R.lost1, ref.lost, 1e-4);
}
{
  const R0 = Punching.design(P0), d = R0.d, far = Punching.design({ ...P0, holes: [{ x: 200 + 6 * d + 150 + 5, y: 0, a: 300, b: 300 }] });
  truth('an opening more than 6d from the face is ignored', far.lost1 === 0 && far.u1 === R0.u1 && !far.S[0].active);
  const near6 = Punching.design({ ...P0, holes: [{ x: 200 + 6 * d + 150 - 5, y: 0, a: 300, b: 300 }] });
  truth('an opening just within 6d reduces u1', near6.lost1 > 0 && near6.vEd1 > R0.vEd1);
  const two = Punching.design({ ...P0, holes: [{ x: 600, y: 0, a: 300, b: 300 }, { x: -600, y: 0, a: 300, b: 300 }] }), one = Punching.design({ ...P0, holes: [{ x: 600, y: 0, a: 300, b: 300 }] });
  near('two symmetrical openings lose twice the length', two.lost1, 2 * one.lost1, 1e-6);
  truth('openings also reduce u0 and lengthen uout', two.u0 < R0.u0 && two.rout > R0.rout);
  throws('openings all round the column', () => Punching.design({ ...P0, holes: [{ x: 1000, y: 0, a: 1200, b: 2400 }, { x: -1000, y: 0, a: 1200, b: 2400 }, { x: 0, y: 1000, a: 2400, b: 1200 }, { x: 0, y: -1000, a: 2400, b: 1200 }] }), /whole basic control perimeter/);
  throws('an opening over the column', () => Punching.design({ ...P0, holes: [{ x: 250, y: 0, a: 200, b: 200 }] }), /overlaps the column/);
}

// ---------- 3 closed forms and rules ----------
{
  const R = Punching.design(P0), dX = 250 - 30 - 8, dY = 250 - 30 - 16 - 8, d = (dX + dY) / 2, As = AREA(16) * 1000 / 150;
  const rho = Math.sqrt(As / 1000 / dX * As / 1000 / dY), k = 1 + Math.sqrt(200 / d);
  near('d = (dx + dy) / 2 (6.32)', R.d, d, 1e-12); near('rho_l = sqrt(rho_x rho_y)', R.rhoL, rho, 1e-12);
  near('vRd,c (6.47)', R.vRdc, Math.max(0.12 * k * (100 * rho * 32) ** (1 / 3), 0.035 * k ** 1.5 * Math.sqrt(32)), 1e-12);
  near('vRd,max = 0.5 nu fcd (UK NA)', R.vRdmax, 0.5 * 0.6 * (1 - 32 / 250) * 32 / 1.5, 1e-12);
  near('u1 = 2(c1 + c2) + 4 pi d', R.u1, 1600 + 4 * Math.PI * d, 1e-9); near('u0 = 2(c1 + c2)', R.u0, 1600, 1e-12);
  near('vEd at u1 = 1.15 VEd / (u1 d)', R.vEd1, 1.15 * 700e3 / (R.u1 * d), 1e-12);
  near('uout = beta VEd / (vRd,c d) (6.54)', Punching.uGross(R.G, R.rout), 1.15 * 700e3 / (R.vRdc * d), 1e-6);
  const big = Punching.design({ ...P0, dX: 220, dY: 220, AsX: 5000, AsY: 5000 });
  near('rho_l capped at 0.02', big.rhoL, 0.02, 1e-12);
  const hi = Punching.design({ ...P0, fck: 70 });
  near('fck above 50 taken as 50 in vRd,c', hi.vRdc, Punching.design({ ...P0, fck: 50 }).vRdc, 1e-12);
  near('k at most 2', Punching.design({ ...P0, h: 160, cover: 20, phiX: 10, phiY: 10 }).k, 2, 1e-12);
  ['internal', 'edge', 'corner'].forEach(t => near(`UK NA beta, ${t}`, Punching.design({ ...P0, type: t }).beta, { internal: 1.15, edge: 1.4, corner: 1.5 }[t], 1e-12));
}
{
  // beta calculated: (6.39) with W1 (6.41); (6.43) biaxial; (6.46) corner
  const c1 = 600, c2 = 300, R = Punching.design({ ...P0, c1, c2, VEd: 600, beta: { method: 'calc', Mx: 60, My: 0 } }), d = R.d;
  const W1 = c1 * c1 / 2 + c1 * c2 + 4 * c2 * d + 16 * d * d + 2 * Math.PI * d * c1, kk = 0.45 + 0.15 * (c1 / c2 - 0.5) / 0.5 > 0.6 ? 0.6 + 0.1 * (c1 / c2 - 1) : 0;
  near('beta (6.39) with W1 (6.41), e parallel to c1 = 600 (c1/c2 = 2: k = 0.7)', R.beta, 1 + 0.7 * (60e6 / 600e3) * R.u1 / W1, 1e-12);
  truth('Table 6.1 k(2) = 0.7', Math.abs(Punching.kTable(2) - 0.7) < 1e-12 && Math.abs(Punching.kTable(0.5) - 0.45) < 1e-12 && Math.abs(Punching.kTable(3) - 0.8) < 1e-12 && kk >= 0);
  const B = Punching.design({ ...P0, VEd: 800, beta: { method: 'calc', Mx: 40, My: 24 } }), db = B.d, bx = 400 + 4 * db, by = 400 + 4 * db;
  near('beta (6.43) biaxial', B.beta, 1 + 1.8 * Math.sqrt((24e6 / 800e3 / bx) ** 2 + (40e6 / 800e3 / by) ** 2), 1e-12);
  const C = Punching.design({ ...P0, type: 'corner', c1: 400, c2: 300, VEd: 250, beta: { method: 'calc' } }), dc = C.d;
  near('beta (6.46) corner = u1 / u1*', C.beta, C.u1 / (Math.min(200, 1.5 * dc) + Math.min(150, 1.5 * dc) + Math.PI * dc), 1e-12);
  near('corner u0 = min(1.5d, c1) + min(1.5d, c2) (the TCC13 reading of 3d <= c1 + c2)', C.u0, Math.min(1.5 * dc, 400) + Math.min(1.5 * dc, 300), 1e-12);
  const E = Punching.design({ ...P0, type: 'edge', c1: 400, c2: 500, VEd: 400 }), de = E.d;
  near('edge u0 = min(c2 + 3d, c2 + 2c1)', E.u0, Math.min(500 + 3 * de, 500 + 800), 1e-12);
  near('edge u1 = c2 + 2c1 + 2 pi d', E.u1, 500 + 800 + 2 * Math.PI * de, 1e-9);
}
// link layout over many cases
{
  let cases = 0;
  for (const type of ['internal', 'edge', 'corner']) for (const h of [200, 250, 300]) for (const V of [1.0, 1.4, 1.8]) for (const fck of [30, 40]) {
    const base = { ...P0, type, h, fck, c1: 400, c2: 450 }, R0 = Punching.design({ ...base, VEd: 1 }), V1 = V * R0.vRdc * R0.u1 * R0.d / R0.beta / 1e3;
    const R = Punching.design({ ...base, VEd: V1 }), tag = `${type} h${h} fck${fck} v/vRd,c ${V}`, d = R.d;
    if (!R.needLinks) { truth(`${tag}: no links when vEd <= vRd,c`, R.vEd1 <= R.vRdc + 1e-12 && R.links == null); continue; }
    const L = R.links; cases++;
    truth(`${tag}: radial spacing <= 0.75d`, L.sr <= 0.75 * d + 1e-9);
    truth(`${tag}: first perimeter 0.3d to 0.5d from the face`, L.s0 >= 0.3 * d - 1e-9 && L.s0 <= 0.5 * d + 1e-9);
    truth(`${tag}: outermost perimeter within 1.5d of uout`, L.per[L.per.length - 1].r >= R.rout - 1.5 * d - 1e-9);
    truth(`${tag}: perimeters at sr`, L.per.every((p, i) => Math.abs(p.r - (L.s0 + i * L.sr)) < 1e-9));
    truth(`${tag}: tangential spacing <= 1.5d within 2d, 2d beyond`, L.per.every(p => p.st <= (p.r <= 2 * d + 1e-9 ? 1.5 * d : 2 * d) + 1e-9));
    truth(`${tag}: each perimeter carries Asw = (Asw/sr) sr`, L.per.every(p => p.Asw >= L.AswSr * L.sr - 1e-9));
    truth(`${tag}: Asw,min per leg (9.11)`, L.per.every(p => L.A / (L.sr * p.st) >= 0.08 * Math.sqrt(fck) / 500 / 1.5 - 1e-12));
    near(`${tag}: vRd,cs (6.52)`, L.vRdcs, 0.75 * R.vRdc + 1.5 * (d / L.sr) * L.AswProv * R.fywdef / (R.u1 * d), 1e-12);
    truth(`${tag}: vRd,cs covers vEd (or the check fails)`, (L.vRdcs >= R.vEd1 - 1e-9) === (R.checks.find(c => c.id === 'cs').util <= 1 + 1e-12));
    if (R.vEd1 > 2 * R.vRdc) truth(`${tag}: beyond kmax vRd,c the check fails`, R.util > 1);
  }
  truth('link layouts were exercised', cases >= 20);
}

console.log(`\n${n - fails}/${n} passed`);
if (fails) process.exit(1);
/* Documented differences from the Concrete Centre's TCC13:
   with beta calculated and no moment about one axis TCC uses beta = 1 (its L16 picks J59); those runs are not stored.
   When uout,ef is shorter than the perimeter close to the face TCC's search stops at about the face (within 1 mm). */
