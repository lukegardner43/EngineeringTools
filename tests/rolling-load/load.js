// Loads the beam stiffness and rolling load engines out of "Rolling Load Analysis.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Rolling Load Analysis.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String, Set, Float64Array, Map };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.RollingLoad = RollingLoad;', sandbox);
module.exports = { RollingLoad: sandbox.RollingLoad };
