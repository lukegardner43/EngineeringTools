// Loads the engines out of "Steel Frame Design.html" (sections + Beam + EC3 + Design + Frame2D).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Frame Design.html'), 'utf8');
const block = id => { const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`)); if (!m) throw new Error(id + ' block not found'); return m[1]; };
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String };
vm.createContext(sandbox);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3 = EC3; this.Design = Design; this.Frame2D = Frame2D; this.SECTION_DATA = SECTION_DATA;', sandbox);
module.exports = { EC3: sandbox.EC3, Design: sandbox.Design, Frame2D: sandbox.Frame2D, SECTION_DATA: sandbox.SECTION_DATA };
