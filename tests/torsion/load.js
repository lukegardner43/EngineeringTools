// Loads the EC3 engine and the torsion engine out of "Steel Beam Torsion.html".
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Beam Torsion.html'), 'utf8');
const block = id => { const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`)); if (!m) throw new Error(id + ' block not found'); return m[1]; };
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity };
vm.createContext(sandbox);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3 = EC3; this.Torsion = Torsion; this.SECTION_DATA = SECTION_DATA; this.PFC_DATA = PFC_DATA;', sandbox);
module.exports = { EC3: sandbox.EC3, Torsion: sandbox.Torsion, SECTION_DATA: sandbox.SECTION_DATA, PFC_DATA: sandbox.PFC_DATA };
