// Loads the engines out of "Pile Cap.html" (EC2 core + PileCap).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Pile Cap.html'), 'utf8');
const block = id => { const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`)); if (!m) throw new Error(id + ' block not found'); return m[1]; };
const sandbox = { console, Math, Array, Set, Map, Object, Number, Error, JSON, Infinity, String };
vm.createContext(sandbox);
vm.runInContext(block('engine') + '\n;this.PileCap = PileCap; this.EC2 = EC2;', sandbox);
module.exports = { PileCap: sandbox.PileCap, EC2: sandbox.EC2 };
