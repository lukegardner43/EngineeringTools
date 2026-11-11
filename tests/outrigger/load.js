// Loads the EC5 core and the outrigger engine out of "Outrigger Loading.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Outrigger Loading.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String, Set };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.Outrigger = Outrigger; this.EC5 = EC5;', sandbox);
module.exports = { Outrigger: sandbox.Outrigger, EC5: sandbox.EC5 };
