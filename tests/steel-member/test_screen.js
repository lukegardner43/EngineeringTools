// The Weyl-bound screen must never change a result: compare screened vs exhaustive on random continuous beams.
const fs = require('fs'), path = require('path');
const dir = __dirname;
const { EC3, Design, SECTION_DATA } = require('./load.js');
const sb = { EC3, Design };
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let bad = 0, nCase = 0, solved = 0, cand = 0;
for (let t = 0; t < 40; t++) {
  const row = SECTION_DATA.filter(r => r[0].includes('UKB'))[Math.floor(rnd() * 130)];
  const sec = sb.EC3.fromRow(row);
  const ns = 1 + Math.floor(rnd() * 3), spans = Array.from({ length: ns }, () => 3000 + Math.round(rnd() * 6000));
  const cantR = rnd() < 0.4 ? 1000 + Math.round(rnd() * 1500) : 0, cantL = rnd() < 0.2 ? 1000 : 0;
  const nm = ns + (cantR ? 1 : 0) + (cantL ? 1 : 0);
  const loads = [];
  for (let m = 0; m < nm; m++) { loads.push({ case: 'G', member: m, type: 'udl', w: 3 + rnd() * 10 }); if (rnd() < 0.8) loads.push({ case: 'Q', member: m, type: 'udl', w: 3 + rnd() * 15 }); if (rnd() < 0.3) loads.push({ case: 'Q', member: m, type: 'point', P: 1e4 + rnd() * 5e4, a: 500 + rnd() * 1000 }); }
  const restraint = Array.from({ length: nm }, () => rnd() < 0.3 ? { mode: 'points', pts: [1200] } : { mode: 'ends' });
  const inp = { sec, grade: 'S355', spans, cantL, cantR, loads, selfWeight: true, rule: rnd() < 0.5 ? '6.10' : '6.10ab', psi0: 0.7, N: rnd() < 0.4 ? rnd() * 3e5 : 0, restraint, destab: rnd() < 0.5 };
  const a = sb.Design.designBeam(inp), b = sb.Design.designBeam({ ...inp, noScreen: true });
  for (const k of ['ltb', 'interaction']) if (b.gov[k]) { nCase++; if (Math.abs(a.gov[k].util - b.gov[k].util) > 1e-9) { bad++; console.log('MISMATCH', t, k, a.gov[k].util, b.gov[k].util); } }
  b.segResults.forEach((r, i) => { if (r) { nCase++; if (Math.abs(a.segResults[i].util - r.util) > 1e-9) { bad++; console.log('SEG MISMATCH', t, i); } } });
  solved += a.ltbStats.solved; cand += a.ltbStats.candidates;
}
console.log(`screen vs exhaustive: ${nCase - bad}/${nCase} identical; exact solves ${solved}/${cand}`);
process.exit(bad ? 1 : 0);
