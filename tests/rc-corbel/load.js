// Loads the EC2 core and the corbel engine out of "RC Corbel and Nib Design.html": tests run against the shipped page.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'RC Corbel and Nib Design.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.Corbel = Corbel; this.EC2 = EC2;', sandbox);
module.exports = { Corbel: sandbox.Corbel, EC2: sandbox.EC2 };
