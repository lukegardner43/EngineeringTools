// Loads the section properties engine (and the section tables) out of "Section Properties.html".
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Section Properties.html'), 'utf8');
const block = id => { const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`)); if (!m) throw new Error(id + ' block not found'); return m[1]; };
const sandbox = { console, Math, Float64Array, Array, Set, Map, Object, Number, Error, JSON, Infinity };
vm.createContext(sandbox);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.SecProps = SecProps; this.SECTION_DATA = SECTION_DATA; this.PFC_DATA = PFC_DATA;', sandbox);
module.exports = { SecProps: sandbox.SecProps, SECTION_DATA: sandbox.SECTION_DATA, PFC_DATA: sandbox.PFC_DATA };
