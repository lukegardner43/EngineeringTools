// Save / open on every tool (shared EngFile module). Run with NODE_PATH pointing at a jsdom install:
//   NODE_PATH=<jsdom>/node_modules node tests/fileio/test_fileio.js
// The full round trip through a real browser reload is checked separately with Playwright; this covers the wiring.
const fs = require('fs'), path = require('path'), { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.resolve(__dirname, '../..');
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && f !== 'index.html').sort();
let pass = 0, fail = 0; const truth = (n, ok) => { ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const load = f => {
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});   // CDN libraries (charts, maths) are not fetched here
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, f), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/' + encodeURIComponent(f), virtualConsole: vc });
  return dom.window;
};
(async () => {
  const keys = new Map(); let prev = null;
  for (const f of pages) {
    const w = load(f); await wait(250);
    const E = w.EngFile;
    if (!E) { truth(`${f}: Save / Open present`, false); continue; }
    const hdr = w.document.querySelector('.page-hdr');
    truth(`${f}: Open and Save on the page header`, !!(hdr && hdr.querySelector('#ef-open') && hdr.querySelector('#ef-save')));
    let d = null; try { d = E.data(); } catch (e) { d = null; }
    const store = w.eval("typeof STORE === 'string' ? STORE : null");
    truth(`${f}: file holds the tool's state under its own key`, !!d && d.app === 'EngineeringTools' && d.format === 1 && !!d.key && d.state && typeof d.state === 'object' && (!store || d.key === store));
    if (d) {
      truth(`${f}: key not shared with another tool`, !keys.has(d.key)); keys.set(d.key, f);
      if (prev) { let m = ''; try { E.stateOf(prev); } catch (e) { m = e.message; } truth(`${f}: refuses a ${prev.tool} file, naming it`, m === `it was saved in ${prev.tool}, so open it there`); }
      let m2 = ''; try { E.stateOf({ app: 'x' }); } catch (e) { m2 = e.message; } truth(`${f}: refuses a file that is not from the tools`, /not an Engineering Tools file/.test(m2));
      prev = d;
    }
    // file name: job no. and member ref. lead, where the page has them
    const job = w.document.getElementById('pJob'), ref = w.document.getElementById('pRef');
    if (job && ref) { job.value = '24-123'; ref.value = 'B1/3'; truth(`${f}: file name from job no. and member ref.`, E.fileName() === `24-123 B1-3 ${d.tool}.json`); job.value = ''; ref.value = ''; }
    w.close();
  }
  // the plain-form tools restore their fields directly
  for (const [f, id] of [['Concrete Tie Force.html', 'nStoreys'], ['RC Crack Width.html', 'h'], ['RC Column Design.html', 'rb']]) {
    const w = load(f); await wait(250); const el = w.document.getElementById(id);
    el.value = '123'; const d = JSON.parse(JSON.stringify(w.EngFile.data())); el.value = '1';
    const r = await w.EngFile.apply(d, 'x.json').catch(e => ({ err: e.message }));
    truth(`${f}: open restores the fields (${id})`, el.value === '123' && !r.err);
    w.close();
  }
  { // RC Column: section shape and bracing toggles travel with the fields
    const w = load('RC Column Design.html'); await wait(250);
    w.setTab('circ'); w.setBraced(false); const d = JSON.parse(JSON.stringify(w.EngFile.data())); w.setTab('rect'); w.setBraced(true);
    await w.EngFile.apply(d, 'x.json').catch(() => {});
    truth('RC Column Design: open restores the section shape and bracing', w.eval('currentTab') === 'circ' && w.eval('isBraced') === false);
    w.close();
  }
  console.log(`\n${pass}/${pass + fail} save / open checks passed`); process.exit(fail ? 1 : 0);
})();
