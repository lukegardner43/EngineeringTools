// Headless CalcPad (tests/calcpad/calcpad.html: CalcPad's index.html at lukegardner43/calcpad edab411 (PLOT and SECTION lines from ecee29e; STEEL lines and PLOT mark: and names: from f35b735, 7e52227 and edab411; formulas saved as definitions from 4e47011; shared values in a pack from dd29f6a; PUNCH lines from 4200990; powers in brackets from da10dbb; pages split on opening from dc5ec86); refresh it when CalcPad changes): load the app in jsdom, put lines of CalcPad text into the editor through its own paste path, rebuild
// the variables as the app does, and read every variable's value (SI) and the chips' text.
const { JSDOM, VirtualConsole } = require('jsdom'); const fs = require('fs');
function open(htmlPath = require('path').join(__dirname, 'calcpad.html')) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const vc = new VirtualConsole(); const errs = []; vc.on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://lukegardner43.github.io/CalcPad/', virtualConsole: vc });
  const w = dom.window;
  if (!w.CSS) w.CSS = { escape: v => String(v).replace(/[^a-zA-Z0-9_-]/g, ch => '\\' + ch) };   // jsdom has no CSS.escape
  const api = {
    w, errs,
    // text lines through the paste path, then a rebuild
    text(text) {
      const ed = w.document.getElementById('editor'); ed.innerHTML = '';
      const wv = {}, wu = {};
      text.split(/\r?\n/).forEach((line, i) => { if (i) ed.appendChild(w.document.createElement('br')); ed.appendChild(w.pasteLineToFragment(line, wv, wu)); });
      w.rebuildVars(); return api.read();
    },
    // a saved document (.perega object) as File ▸ Open does
    doc(doc) { w.applyDoc(doc); return api.read(); },
    // a project (.peregaproj object) as File ▸ Open project does, then each check opened in turn: [{ name, shared, ...read() }]
    project(p) {
      w.adoptLoadedProject(JSON.parse(JSON.stringify(p)), 'test.peregaproj');
      return p.checks.map(c => { w.openCheck(c.id); return { name: c.name, shared: !!c.shared, ...api.read() }; });
    },
    read() {
      const vars = w.eval('vars'), units = w.eval('varUnits');
      const chips = [...w.document.querySelectorAll('.var-def-chip')].map(c => ({ name: c.dataset.varName, val: +c.dataset.varVal, text: c.textContent, title: c.title, err: /mismatch|unknown unit|left over|Error/i.test(c.textContent), dup: c.classList.contains('dup-name'), bad: c.classList.contains('bad-unit') ? (c.dataset.badUnit || '?') : '', disp: c.dataset.varDisplayUnit || '' }));
      const errChips = [...w.document.querySelectorAll('.var-error-chip, .formula-chip.error, .chip-error')].map(c => c.textContent);
      // the 'Check these definitions' box (CalcPad's flagUnparseableUnits) is shown
      const warn = !!w.document.querySelector('#unitWarn.show');
      // the PLOT, SECTION and PUNCH lines, each drawn or showing its error
      const plots = [...w.document.querySelectorAll('.plot-chip')].map(c => ({ src: c.dataset.plot, err: c.classList.contains('error') ? c.textContent : '' }));
      return { vars: { ...vars }, units: { ...units }, chips, errChips, warn, plots };
    },
  };
  return api;
}
module.exports = { open };
