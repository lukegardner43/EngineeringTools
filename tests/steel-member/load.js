// Loads the engine and section table straight out of "Steel Member Design.html", so the tests always run
// against the shipped file (no separate copy of the engine to drift).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Member Design.html'), 'utf8');
const block = id => { const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`)); if (!m) throw new Error('script block ' + id + ' not found'); return m[1]; };
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON };
vm.createContext(sandbox);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.Beam=Beam;this.EC3=EC3;this.Design=Design;this.SECTION_DATA=SECTION_DATA;this.PFC_DATA=PFC_DATA;this.HIST_SERIES=HIST_SERIES;', sandbox);
module.exports = { Beam: sandbox.Beam, EC3: sandbox.EC3, Design: sandbox.Design, SECTION_DATA: sandbox.SECTION_DATA, PFC_DATA: sandbox.PFC_DATA, HIST_SERIES: sandbox.HIST_SERIES };
