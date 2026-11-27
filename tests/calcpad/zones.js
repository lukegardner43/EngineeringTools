// Shared by the timber tools' test_calcpad.js: run a tool's full calculation through headless CalcPad, part by part and
// whole (as the page's button downloads it), and check that every value CalcPad works out is the tool's own, that every
// check of the tool sits in a part with its utilisation, and that no chip shows an error or a unit CalcPad cannot read.
const H = require('./harness.js').open();
function checker(CalcScript, toolName) {
  const st = { n: 0, bad: 0, runs: 0, zones: 0, kinds: new Set() };
  function values(tag, C, P) {
    for (const it of C.items) {
      if (!it.name) continue; st.n++;
      const exp = it.t === 'chk' ? it.v : CalcScript.toSI(it.v, it.unit), got = P.vars[it.name];
      const ok = got !== undefined && (Math.abs(got - exp) <= 1e-6 * Math.abs(exp) + 1e-9 * (/^mm[34]$/.test(it.unit) ? 1e-6 : 1) || (it.t === 'chk' && exp === Infinity && got > 1e12));
      if (!ok) { st.bad++; if (st.bad < 40) console.log('FAIL', tag, it.name, it.expr || '', 'tool', exp, 'calcpad', got); }
    }
    const er = P.chips.filter(c => c.err || c.dup); if (er.length) { st.bad++; console.log('CHIP', tag, er.slice(0, 3).map(c => c.text)); }
    if (P.warn) { st.bad++; console.log('BAD UNIT', tag, P.chips.filter(c => c.bad).slice(0, 5).map(c => c.name + ' [' + c.bad + ']')); }
    const pe = (P.plots || []).filter(p => p.err), np = C.items.filter(it => it.t === 'plot').length; if (pe.length || (P.plots || []).length !== np) { st.bad++; console.log('PLOT', tag, (P.plots || []).length, np, pe.slice(0, 2)); }
  }
  // Z: the tool's parts; checks: [{ id, util }]; zoneOf(id) → the part's key; utilMax: the tool's largest utilisation
  function run(tag, Z, checks, zoneOf, utilMax) {
    st.runs++;
    Z.forEach(z => st.kinds.add(z.key));
    for (const k of checks) {
      st.n++; const key = zoneOf(k.id), z = Z.find(zn => zn.key === key), want = Math.max(...checks.filter(c => zoneOf(c.id) === key).map(c => c.util));
      if (!z || !(z.util === want || Math.abs(z.util - want) <= 1e-12 * Math.max(1, want))) { st.bad++; console.log('MISSING', tag, k.id, key, z && z.util, want); }
    }
    for (const zn of Z) {
      st.zones++;
      const u = zn.C.items.filter(it => it.t === 'chk').map(it => it.v); st.n++;
      if (zn.util != null && !(Math.max(0, ...u) === zn.util || Math.abs(Math.max(0, ...u) - zn.util) <= 1e-9 * Math.max(1, zn.util))) { st.bad++; console.log('UTIL', tag, zn.key, u, zn.util); }
      values(`${tag} ${zn.key}`, zn.C, H.text(zn.C.calcpad()));
    }
    const all = CalcScript.merge(Z.map(z => ({ C: z.C, title: z.title })), { title: toolName });
    values(`${tag} whole`, all, H.text(all.calcpad()));
    st.n++; const top = Math.max(...Z.map(z => z.util ?? 0));
    if (utilMax != null && !(top === utilMax || Math.abs(top - utilMax) <= 1e-9 * Math.max(1, utilMax))) { st.bad++; console.log('TOOL UTIL', tag, Z.map(z => z.util), utilMax); }
  }
  function done(what) {
    console.log(`${st.runs} ${what}, ${st.zones} parts: ${[...st.kinds].join(', ')}`);
    console.log(`\n${st.n - st.bad}/${st.n} ${toolName} values reproduced by CalcPad`);
    process.exit(st.bad ? 1 : 0);
  }
  return { run, values, done, st };
}
module.exports = { checker };
