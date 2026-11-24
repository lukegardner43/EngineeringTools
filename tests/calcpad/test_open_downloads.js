// A tool's whole calculation as it reaches CalcPad (node test_open_downloads.js [tool.html ...]; needs Playwright with
// Chromium, and skips without them). Each tool's page is opened in Chromium and calculated, its whole calculation
// downloaded as the page's button does (one .perega), and the file opened in CalcPad (tests/calcpad/calcpad.html) through
// File > Open. Every page must hold no more than fits (an opened calculation is split into pages, CalcPad dc5ec86), every
// chip of the file must be on the pages with no error and CalcPad's value the file's, and every drawing the calculation
// carries must arrive as a picture that loads and is not blank.
const path = require('path'), fs = require('fs'), os = require('os');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('Playwright is not installed: skipped'); process.exit(0); }
const ROOT = path.join(__dirname, '..', '..'), CP = path.join(__dirname, 'calcpad.html');
const STEEL = ['Steel Member Design.html', 'Steel Beam Analysis and Design.html', 'Steel Column Design.html', 'Steel Frame Design.html', 'Steel Member Fire Design.html',
  'Steel Beam Torsion.html', 'Hollowcore Support Beam.html', 'Composite Beam Design.html', 'Beam Web Openings.html', 'Base Plate Design.html', 'Bolt Group Analysis.html',
  'Floor Vibration.html', 'ConnectionCheck.html'];
const TIMBER = ['Timber Beam.html', 'Timber Member.html', 'Timber Stud Wall.html', 'Timber Racking Wall.html', 'Timber Connections.html', 'Glulam Beams.html', 'Flitch Beams.html',
  'CLT Panels.html', 'Concealed Plate Glulam Connections.html', 'Timber 2D Frame Analysis and Design.html'];
const tools = process.argv.slice(2).length ? process.argv.slice(2) : [...STEEL, ...TIMBER, 'RC Beam Analysis and Design.html', 'Pad Foundation.html'];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'et-perega-'));
let n = 0, bad = 0;
const truth = (name, ok) => { n++; if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
(async () => {
  let b; try { b = await chromium.launch(); } catch (e) { console.log('Chromium could not start: skipped'); process.exit(0); }
  const ctx = await b.newContext({ acceptDownloads: true });
  for (const tool of tools) {
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.join(ROOT, tool)); await p.waitForTimeout(800);
    if (!(await p.$('[data-cp="all"]:visible'))) { const c = await p.$('button.btn-calc:visible, #calc'); if (c) await c.click(); await p.waitForTimeout(2500); }
    // the calculation's parts as the page keeps them (lastZ on most pages, last.Z on some)
    const want = await p.evaluate(() => { const Z = typeof lastZ !== 'undefined' && lastZ ? lastZ : typeof last !== 'undefined' && last && last.Z ? last.Z : null;
      return Z ? Z.reduce((k, z) => k + z.C.items.filter(it => it.t === 'img').length, 0) : -1; });
    let f = null;
    try { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('[data-cp="all"]')]); f = path.join(dir, path.basename(tool, '.html') + '.perega'); await dl.saveAs(f); } catch (e) { /* reported below */ }
    await p.close();
    if (!f) { truth(`${tool}: downloads the whole calculation`, false); continue; }
    const doc = JSON.parse(fs.readFileSync(f, 'utf8')), src = doc.pages.join('');
    const fileVals = [...src.matchAll(/data-var-name="([^"]*)" data-var-val="([^"]*)"/g)].map(m => [m[1], +m[2]]);
    const pics = [...src.matchAll(/<img src="(data:image\/png[^"]*)"/g)].map(m => m[1]);
    const q = await ctx.newPage(); q.on('pageerror', e => errs.push(e.message));
    await q.goto('file://' + CP); await q.waitForTimeout(600);
    await q.setInputFiles('#openFileInput', f);
    // until two looks a second apart agree (pictures and fonts arrive late, and the pages are split again then)
    let s, prev = '';
    for (let k = 0; k < 30; k++) {
      await q.waitForTimeout(1000);
      s = await q.evaluate(() => {
        const eds = Array.from(document.querySelectorAll('.page-wrap .calc-area'));
        const low = e => { const top = e.getBoundingClientRect().top; let m = 0; for (const x of e.childNodes) { let r; if (x.nodeType === 1) r = x.getBoundingClientRect(); else if (x.textContent.trim()) { const g = document.createRange(); g.selectNode(x); r = g.getBoundingClientRect(); } else continue; if (r.height > 0) m = Math.max(m, r.bottom - top); } return m; };
        const chips = Array.from(document.querySelectorAll('.page-wrap .var-def-chip'));
        return { pages: eds.length, over: eds.map((e, i) => [i + 1, Math.round(low(e)), e.closest('.pg-content').clientHeight]).filter(([, a, h]) => a > h + 1),
          vals: chips.map(c => [c.dataset.varName, +c.dataset.varVal]),
          err: chips.filter(c => /mismatch|unknown unit|left over|Error/i.test(c.textContent) || c.classList.contains('dup-name')).length + document.querySelectorAll('.page-wrap .var-error-chip, .page-wrap .formula-chip.error, .page-wrap .plot-chip.error').length,
          imgs: Array.from(document.querySelectorAll('.page-wrap img')).map(i => i.complete && i.naturalWidth > 0) };
      });
      const key = JSON.stringify(s); if (key === prev) break; prev = key;
    }
    await q.close();
    const diff = s.vals.filter(([nm, v], i) => !fileVals[i] || fileVals[i][0] !== nm || Math.abs(v - fileVals[i][1]) > 1e-6 * Math.abs(v) + 1e-5).length;
    truth(`${tool}: opens on ${s.pages} pages, none holding more than fits${s.over.length ? ' (over: ' + JSON.stringify(s.over.slice(0, 3)) + ')' : ''}`, s.pages > 1 && !s.over.length);
    truth(`${tool}: all ${fileVals.length} values on the pages, none in error, CalcPad's the file's`, s.vals.length === fileVals.length && !s.err && !diff);
    truth(`${tool}: every drawing in the calculation (${want}) a picture in CalcPad that loads and is not blank`, want > 0 && pics.length === want && s.imgs.length === want && s.imgs.every(Boolean) && pics.every(u => u.length > 3000));
    truth(`${tool}: no script errors`, !errs.length || (console.log(errs.slice(0, 2)), false));
  }
  await b.close(); fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${n - bad}/${n} checks on downloads opened in CalcPad`); process.exit(bad ? 1 : 0);
})();
