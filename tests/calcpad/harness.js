// Headless CalcPad (tests/calcpad/calcpad.html: CalcPad's index.html at lukegardner43/calcpad 603846b Save to a chosen place on disk, and keep saving back to it; refresh it when CalcPad changes): load the app in jsdom, put lines of CalcPad text into the editor through its own paste path, rebuild
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
    read() {
      const vars = w.eval('vars'), units = w.eval('varUnits');
      const chips = [...w.document.querySelectorAll('.var-def-chip')].map(c => ({ name: c.dataset.varName, val: +c.dataset.varVal, text: c.textContent, title: c.title, err: /mismatch|unknown unit|left over|Error/i.test(c.textContent), dup: c.classList.contains('dup-name'), bad: c.classList.contains('bad-unit') ? (c.dataset.badUnit || '?') : '', disp: c.dataset.varDisplayUnit || '' }));
      const errChips = [...w.document.querySelectorAll('.var-error-chip, .formula-chip.error, .chip-error')].map(c => c.textContent);
      // the 'Check these definitions' box (CalcPad's flagUnparseableUnits) is shown
      const warn = !!w.document.querySelector('#unitWarn.show');
      return { vars: { ...vars }, units: { ...units }, chips, errChips, warn };
    },
  };
  return api;
}
module.exports = { open };
