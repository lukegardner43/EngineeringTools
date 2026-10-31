// Loads the EC2 and RC beam engines out of "RC Beam Analysis and Design.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Beam Analysis and Design.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.EC2 = EC2; this.EC2Section = EC2Section; this.RCBeam = RCBeam; this.RCBeamDesign = RCBeamDesign;', sandbox);
module.exports = { EC2: sandbox.EC2, EC2Section: sandbox.EC2Section, RCBeam: sandbox.RCBeam, RCBeamDesign: sandbox.RCBeamDesign };
