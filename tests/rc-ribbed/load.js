// Loads the EC2, beam, slab and ribbed engines out of "RC Ribbed and Waffle Slabs.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Ribbed and Waffle Slabs.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.EC2 = EC2; this.EC2Section = EC2Section; this.RCBeam = RCBeam; this.RCSlabDesign = RCSlabDesign; this.RCRibbed = RCRibbed;', sandbox);
module.exports = { EC2: sandbox.EC2, EC2Section: sandbox.EC2Section, RCBeam: sandbox.RCBeam, RCSlabDesign: sandbox.RCSlabDesign, RCRibbed: sandbox.RCRibbed };
