// Loads "RC Column Design.html" in jsdom (NODE_PATH=<dir with node_modules>) with Chart.js, the canvas, jsPDF, KaTeX and
// html2canvas stubbed. run(w, inputs) sets the inputs by element id, calls checkDesign() and returns window.lastCalc.
// pdf(w) runs the report export against a recording jsPDF and returns its text and the LaTeX it was given.
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const PAGE = path.join(__dirname, '..', '..', 'RC Column Design.html');
function load(file = PAGE) {
  const html = fs.readFileSync(file, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) {
    w.Chart = class { constructor() { this.data = { datasets: [] }; } update() {} destroy() {} };
    w.alerts = []; w.alert = m => { w.alerts.push(m); }; w.confirm = () => true;
    w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => ({}) });
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
    w.pdfText = []; w.latex = [];
    w.jspdf = { jsPDF: class { constructor() { return new Proxy({}, { get: (t, k) => k === 'text' ? (s => { w.pdfText.push(String(s)); }) : k === 'save' ? (n => { w.saved = n; }) : () => {} }); } } };
    w.katex = { render: (s, el) => { w.latex.push(s); el.textContent = s; } };
    w.html2canvas = async () => ({ toDataURL: () => 'data:image/png;base64,' });
  } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message));
  return w;
}
function run(w, s) {
  const d = w.document, set = (id, v) => {
    const el = d.getElementById(id); if (!el) throw new Error(`no input ${id}`);
    if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === String(v))) throw new Error(`${id} has no option ${v}`);
    el.value = v;
  };
  w.setTab(s.tab || 'rect');
  for (const [k, v] of Object.entries(s)) if (!['tab', 'braced', 'pinned'].includes(k)) set(k, v);
  w.setBraced(s.braced !== false); w.setPinned(!!s.pinned);
  w.lastCalc = null; w.alerts.length = 0; w.checkDesign();
  return w.eval('window.lastCalc');
}
async function pdf(w) { w.pdfText.length = 0; w.latex.length = 0; await w.eval('exportPDF()'); return { text: w.pdfText.join('\n'), latex: [...w.latex] }; }
module.exports = { load, run, pdf, PAGE };
