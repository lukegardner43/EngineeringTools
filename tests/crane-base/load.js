// Loads the EC2 core and the crane base engine out of "Tower Crane Base.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Tower Crane Base.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String, Float64Array };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.CraneBase = CraneBase; this.EC2 = EC2;', sandbox);
module.exports = { CraneBase: sandbox.CraneBase, EC2: sandbox.EC2 };
