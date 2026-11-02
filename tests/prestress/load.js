// Loads the engines out of "Prestressed Beam Design.html" (the EC2 core and the prestressed engine): tests run against the
// shipped page.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Prestressed Beam Design.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Set, Map, Object, Number, Error, JSON, Infinity, NaN, String, Boolean, parseFloat, isFinite };
vm.createContext(sandbox);
vm.runInContext(m[1].replace(/if \(typeof module !== 'undefined'\)[^\n]*\n/g, '') + '\n;this.PSC = PSC; this.EC2 = EC2;', sandbox);
module.exports = { PSC: sandbox.PSC, EC2: sandbox.EC2 };
