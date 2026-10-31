// Loads the engines and section table out of "Steel Column and Base Plate Design.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Column and Base Plate Design.html'), 'utf8');
const block = id => { const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`)); if (!m) throw new Error(id + ' block not found'); return m[1]; };
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite };
vm.createContext(sandbox);
vm.runInContext(block('sections') + '\n' + block('engine') + '\n;this.EC3=EC3;this.Design=Design;this.Joints=Joints;this.ColumnBase=ColumnBase;this.JDraw=JDraw;this.SECTION_DATA=SECTION_DATA;', sandbox);
module.exports = sandbox;
