// Loads the frame engine out of "2D Frame Analysis.html" (sections + EC3 + Frame2D).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', '2D Frame Analysis.html'), 'utf8');
const block = id => { const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`)); if (!m) throw new Error(id + ' block not found'); return m[1]; };
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String };
vm.createContext(sandbox);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.Frame2D = Frame2D; this.EC3 = EC3;', sandbox);
module.exports = { Frame2D: sandbox.Frame2D, EC3: sandbox.EC3 };
