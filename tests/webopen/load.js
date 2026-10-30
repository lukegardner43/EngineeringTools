// Loads the engines out of "Beam Web Openings.html" (sections + EC3 + Composite + Openings).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Beam Web Openings.html'), 'utf8');
const block = id => { const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`)); if (!m) throw new Error(id + ' block not found'); return m[1]; };
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String };
vm.createContext(sandbox);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3 = EC3; this.Composite = Composite; this.Openings = Openings; this.SECTION_DATA = SECTION_DATA;', sandbox);
module.exports = { EC3: sandbox.EC3, Composite: sandbox.Composite, Openings: sandbox.Openings, SECTION_DATA: sandbox.SECTION_DATA };
