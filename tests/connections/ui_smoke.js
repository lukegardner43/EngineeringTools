// Drives ConnectionCheck.html in jsdom (needs the jsdom package: NODE_PATH=<dir with node_modules> node ui_smoke.js):
// every joint type calculates without error, and the P358 tying / detailing checks appear where expected.
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'ConnectionCheck.html'), 'utf8').replace(/<script src=[^>]*><\/script>/g, '');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/' });
const w = dom.window, errors = [];
w.addEventListener('error', e => errors.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));
let n = 0, fails = 0, near_;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
(async () => {
  await wait(100);
  for (const id of ['fin', 'pdep', 'fdep', 'dcleat', 'scleat', 'splice', 'base', 'rsplice', 'conc', 'moment', 'brace']) {
    w.switchJt(id); await wait(120);
    if (id === 'base') { w.document.getElementById('ba-M').value = '60'; }
    w.doCalc(); await wait(50);
    const eb = w.document.getElementById('err-box'), res = w.document.getElementById('results');
    const err = eb && eb.style.display !== 'none' ? eb.textContent : '';
    const txt = res ? res.textContent : '';
    truth(`${id}: calculates without error${err ? ' (' + err + ')' : ''}`, !err && res && res.style.display !== 'none');
    if (['fin', 'pdep', 'fdep'].includes(id)) truth(`${id}: tying checks reported`, /Tying/.test(txt));
    if (id === 'fin') truth('fin: P358 detailing checks reported', /Ductility/.test(txt) && /Torsional Restraint/.test(txt));
    if (id === 'base') truth('base: EN 1993-1-8 / EN 1992-4 checks reported', /Effective Area/.test(txt) && /Table 6.7/.test(txt) && /Concrete Cone/.test(txt));
    if (id === 'rsplice') truth('rsplice: T-stub check reported', /T-stub/.test(txt));
    if (id === 'splice') { truth('splice (bearing): net tension, 25% compression and tying checks', /Net Tension/.test(txt) && /25% of the Maximum Compression/.test(txt) && /Vertical Tying/.test(txt));
      w.document.getElementById('sp-type').value = 'nonbearing'; w.document.getElementById('sp-tdiv').value = '10'; w.doCalc(); await wait(50);
      const t2 = w.document.getElementById('results').textContent; truth('splice (non-bearing): minimum actions and plate buckling checks', /Design Actions \(non-bearing\)/.test(t2) && /buckling across the joint/.test(t2)); }
    if (id === 'moment') truth('moment: M_j,Rd reported', /Moment Resistance M_j,Rd/.test(txt) && /Panel Shear/.test(txt));
    if (id === 'conc') truth('conc: EN 1992-4 anchor checks reported', /Concrete Cone/.test(txt) && /Pry-out/.test(txt));
  }
  // parametric drawings: every joint draws an elevation and a second view from its inputs, redraws on input and stays with the results
  for (const id of ['fin', 'pdep', 'fdep', 'dcleat', 'scleat', 'splice', 'base', 'rsplice', 'conc', 'moment', 'brace']) {
    w.switchJt(id); await wait(150);
    const sv = w.document.querySelector('#diag-svg svg.jd'), txt = sv ? sv.textContent : '';
    truth(`${id}: drawing with two titled views`, !!sv && (txt.match(/ELEVATION|SECTION|VIEW ON|PLAN/g) || []).length >= 2);
  }
  // end plates: the view on the plate shows two bolt columns at the gauge, either side of the web (the form names it 'gauge')
  for (const id of ['pdep', 'fdep']) {
    w.switchJt(id); await wait(150);
    const xs = [...w.document.querySelectorAll('#diag-svg svg circle')].map(c => +c.getAttribute('cx')).filter(x => x > 600);
    truth(`${id}: view on the end plate shows two bolt columns`, new Set(xs.map(x => Math.round(x))).size >= 2);
  }
  // end plates: bottom edge distance below the last row (EN 1993-1-8 Table 3.3), rows per bolt line, no holes in the welded beam web
  {
    w.switchJt('pdep'); await wait(150);
    const g = w.eval('readPDEP()'), byId = (r, id) => r.checks.find(c => c.id === id);
    const r0 = w.calcPDEP(g), r1 = w.calcPDEP({ ...g, n: '6', hp: '200' }), r2 = w.calcPDEP({ ...g, n: '6', hp: '240' });
    truth('pdep default: bottom edge 310 − 50 − 3×70 = 50 mm ≥ 1.2 d₀ = 26.4 mm', byId(r0, 'D1').pass && Math.abs(byId(r0, 'D1').cap - 50) < 1e-9);
    truth('pdep default: plate 310 ≥ 0.6 × 460 = 276 mm (P358 torsional restraint)', byId(r0, 'D3').pass && Math.abs(byId(r0, 'D3').dem - 276) < 1e-9);
    truth('pdep default: every check passes', r0.allPass || (console.log(r0.checks.filter(c => !c.pass).map(c => c.id)), false));
    truth('pdep 6 bolts, h_p 240: plate shallower than 0.6 h_b fails D3', !byId(r2, 'D3').pass && byId(r2, 'D1').pass);
    truth('pdep h_p 200: bottom edge 10 mm fails, hole breaks out', !byId(r1, 'D1').pass && Math.abs(byId(r1, 'D1').cap - 10) < 1e-9 && /breaks out/.test(byId(r1, 'D1').lines.join(' ')));
    truth('pdep: net shear cuts n/2 holes per bolt line, (310 − 4×22)×10 = 2220 mm²', /= 2220 mm²/.test(byId(r0, '5').lines[0]));
    truth('pdep h_p 200: block shear runs to the nearer (bottom) end, A_nv = (10 + 140 − 55)×10 = 950 mm²', /= 950 mm²/.test(byId(r1, '6').lines.join(' ')));
    w.document.getElementById('pdep-n').value = '6'; w.document.getElementById('pdep-hp').value = '200'; w.drawDiag(); await wait(60);
    truth('pdep h_p 200: drawing flags the short bottom edge', /Bottom edge distance 10 mm is below 1\.2 d₀/.test(w.document.getElementById('diag-svg').textContent));
    w.document.getElementById('pdep-hp').value = '240'; w.drawDiag(); await wait(60);
    truth('pdep 6 bolts, h_p 240: drawing flags the plate depth', /below 0\.6 h_?b = 276 mm/.test(w.document.getElementById('diag-svg').textContent));
    w.document.getElementById('pdep-n').value = '8'; w.document.getElementById('pdep-hp').value = '310'; w.drawDiag(); await wait(60);
    truth('pdep default: drawing carries no warning', !/below|beyond the plate/.test(w.document.getElementById('diag-svg').textContent));
    let odd = ''; try { w.calcPDEP({ ...g, n: '5' }); } catch (e) { odd = e.message; } truth('pdep: an odd bolt count is rejected (two lines)', /must be even/.test(odd));
    w.switchJt('fdep'); await wait(150); const rF = w.calcFDEP(w.eval('readFDEP()'));
    truth('pdep / fdep: no net section or block shear on the welded beam web', ![...r0.checks, ...rF.checks].some(c => /Beam Web - (Net|Block)/.test(c.name)));
    truth('fdep: bottom edge distance checked', !!byId(rF, 'D1') && byId(rF, 'D1').pass);
    truth('fdep default: every check passes', rF.allPass);
  }
  // save / open a check: every connection type survives a round trip through the file format
  {
    const ids = ['fin', 'pdep', 'fdep', 'dcleat', 'scleat', 'splice', 'base', 'rsplice', 'conc', 'moment', 'brace'];
    for (const id of ids) {
      w.switchJt(id); await wait(120);
      const nums = [...w.document.querySelectorAll('#input-panel input[type=number]')];   // change every number so the defaults cannot pass for a restore
      nums.forEach((el, i) => { el.value = String((parseFloat(el.value) || 0) + 1 + i / 10); el.dispatchEvent(new w.Event('input', { bubbles: true })); });
      const d = JSON.parse(JSON.stringify(w.checkData()));
      w.switchJt(id === 'fin' ? 'pdep' : 'fin'); await wait(120);
      await w.applyCheck(d); const back = w.checkData();
      truth(`${id}: save then open restores all ${Object.keys(d.inputs).length} inputs (${nums.length} edited)`, w.eval('activeId') === id && nums.length > 3 && Object.entries(d.inputs).every(([k, v]) => back.inputs[k] === v));
    }
    // an edited check: the saved values win over the section auto-fill, and the project details come back
    w.switchJt('pdep'); await wait(120);
    const $ = id => w.document.getElementById(id), set = (id, v, ev = 'input') => { $(id).value = v; $(id).dispatchEvent(new w.Event(ev, { bubbles: true })); };
    set('pdep-beamSec', '533×210×92 UKB', 'change'); set('pdep-tw', '9.5'); set('pdep-hp', '400'); set('pdep-n', '10'); $('proj-ref').value = 'J-101';
    const saved = JSON.parse(JSON.stringify(w.checkData()));
    truth('file name from the reference and the connection type', w.checkFileName(saved) === 'J-101 Partial Depth End Plate.json');
    w.switchJt('fin'); await wait(120); $('proj-ref').value = '';
    const r = await w.applyCheck(saved);
    truth('opened check: section, overridden web thickness, plate and bolts restored', $('pdep-beamSec').value === '533×210×92 UKB' && $('pdep-tw').value === '9.5' && $('pdep-hp').value === '400' && $('pdep-n').value === '10' && r.skipped.length === 0);
    truth('opened check: project reference restored and the check recalculated', $('proj-ref').value === 'J-101' && $('results').style.display !== 'none' && /Partial Depth End Plate/.test($('results').textContent));
    const rej = async d => { try { await w.applyCheck(d); return ''; } catch (e) { return e.message; } };
    truth('open rejects a file from another tool', /not a Steel Connection Design check/.test(await rej({ app: 'something else', inputs: {} })));
    truth('open rejects an unknown connection type', /unknown connection type/.test(await rej({ ...saved, joint: 'gusset' })));
    truth('open rejects a newer file format', /newer version/.test(await rej({ ...saved, format: 99 })));
    const extra = { ...saved, inputs: { ...saved.inputs, 'pdep-retired': '1' } };
    await w.openCheckFile({ name: 'old.json', text: async () => JSON.stringify(extra) });
    truth('open reports saved values this version does not use', /Opened old\.json \(Partial Depth End Plate\)\. 1 saved value is not used/.test($('file-msg').textContent));
    await w.openCheckFile({ name: 'notes.json', text: async () => 'not json' });
    truth('open reports an unreadable file', /notes\.json is not a saved check/.test($('file-msg').textContent) && $('file-msg').classList.contains('bad'));
    w.switchJt('fin'); await wait(120);
    truth('switching connection type clears the file message', $('file-msg').textContent === '' && $('file-msg').style.display === 'none');
    $('proj-ref').value = '';
  }
  w.switchJt('fin'); await wait(150);
  const nC = () => w.document.querySelectorAll('#diag-svg svg circle').length, c0 = nC();
  const nIn = w.document.getElementById('fin-n'); nIn.value = '4'; nIn.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(250);
  truth('fin: drawing redraws with an extra bolt when n changes', nC() > c0);
  truth('fin: bolts beyond the plate are flagged on the drawing', /beyond the plate/.test(w.document.getElementById('diag-svg').textContent));
  w.doCalc(); await wait(60); truth('drawing stays visible after the calculation', !!w.document.querySelector('#diag-svg svg.jd'));
  near_ = (nm, a, b, t) => truth(`${nm}: ${a.toFixed(0)} vs ${b}`, Math.abs(a - b) <= t * b);
  near_('plastic modulus helper, 457x191x67 UKB (datasheet 1481 cm³)', w.eval("wplI(SECTIONS['457×191×67 UKB'])") / 1e3, 1481, 0.01);
  near_('plastic modulus helper, 254x254x89 UKC (datasheet 1246 cm³)', w.eval("wplI(SECTIONS['254×254×89 UKC'])") / 1e3, 1246, 0.01);
  truth('no script errors', errors.length === 0 || (console.log(errors), false));
  console.log(`\n${n - fails}/${n} ConnectionCheck UI checks passed`);
  process.exit(fails ? 1 : 0);
})();
