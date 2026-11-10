// Loads the engines out of "RC Lintel Design.html" (EC2 core + section + Lintel).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Lintel Design.html'), 'utf8');
const block = id => { const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`)); if (!m) throw new Error(id + ' block not found'); return m[1]; };
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String };
vm.createContext(sandbox);
vm.runInContext(block('engine') + '\n;this.Lintel = Lintel; this.EC2Section = EC2Section;', sandbox);
module.exports = { Lintel: sandbox.Lintel, EC2Section: sandbox.EC2Section };
