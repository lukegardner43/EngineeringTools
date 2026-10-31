// Loads the EC2 engines out of "RC Section Design Toolkit.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Section Design Toolkit.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.EC2 = EC2; this.EC2Section = EC2Section; this.EC2Toolkit = EC2Toolkit;', sandbox);
module.exports = { EC2: sandbox.EC2, EC2Section: sandbox.EC2Section, EC2Toolkit: sandbox.EC2Toolkit };
