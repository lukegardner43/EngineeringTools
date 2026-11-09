// Loads the engines and section table out of the shipped pages (tests run against them): "Steel Column Design.html" for the
// column (EC3, Design, Joints, ColumnBase) and "Base Plate Design.html" for the base plate engine and the joint drawings (JDraw).
const fs = require('fs'), path = require('path'), vm = require('vm');
const page = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const block = (html, id) => { const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`)); if (!m) throw new Error(id + ' block not found'); return m[1]; };
const ctx = () => vm.createContext({ console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite });
const col = page('Steel Column Design.html'), base = page('Base Plate Design.html');
const sandbox = ctx();
vm.runInContext(block(col, 'sections') + '\n' + block(col, 'engine') + '\n;this.EC3=EC3;this.Design=Design;this.Joints=Joints;this.ColumnBase=ColumnBase;this.SECTION_DATA=SECTION_DATA;', sandbox);
const bs = ctx();
vm.runInContext(block(base, 'sections') + '\n' + block(base, 'engine') + '\n' + block(base, 'drawing-code') + '\n;this.EC3=EC3;this.Joints=Joints;this.BasePlate=BasePlate;this.JDraw=JDraw;this.DrawBase=DrawBase;this.SECTION_DATA=SECTION_DATA;', bs);
sandbox.JDraw = bs.JDraw; sandbox.base = bs;
module.exports = sandbox;
