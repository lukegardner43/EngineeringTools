// Loads the engines out of "Concealed Plate Glulam Connections.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Concealed Plate Glulam Connections.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String, Set, Map, isFinite };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.EC5 = EC5; this.EC5F = EC5F; this.GlulamPlate = GlulamPlate;', sandbox);
module.exports = { EC5: sandbox.EC5, EC5F: sandbox.EC5F, GlulamPlate: sandbox.GlulamPlate };
