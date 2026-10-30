// Loads the engines out of "Windpost Design.html" (sections + Beam + EC3 + Design + Windpost).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Windpost Design.html'), 'utf8');
const block = id => { const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`)); if (!m) throw new Error(id + ' block not found'); return m[1]; };
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String };
vm.createContext(sandbox);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3 = EC3; this.Design = Design; this.Windpost = Windpost; this.SECTION_DATA = SECTION_DATA; this.PFC_DATA = PFC_DATA;', sandbox);
module.exports = { EC3: sandbox.EC3, Design: sandbox.Design, Windpost: sandbox.Windpost, SECTION_DATA: sandbox.SECTION_DATA, PFC_DATA: sandbox.PFC_DATA };
