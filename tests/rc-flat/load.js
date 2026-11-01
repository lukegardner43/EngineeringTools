// Loads the engines out of "RC Flat Slab Design.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Flat Slab Design.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.EC2 = EC2; this.RCBeam = RCBeam; this.Punching = Punching; this.FlatSlab = FlatSlab;', sandbox);
module.exports = { EC2: sandbox.EC2, RCBeam: sandbox.RCBeam, Punching: sandbox.Punching, FlatSlab: sandbox.FlatSlab };
