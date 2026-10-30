// Loads the beam analysis engine straight out of "Beam Analysis.html" (the shipped file).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Beam Analysis.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.BeamFE = BeamFE;', sandbox);
module.exports = { BeamFE: sandbox.BeamFE };
