// Loads the EC5 core and the glulam engine out of "Glulam Beams.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Glulam Beams.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String, Set };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.EC5 = EC5; this.GlulamBeam = GlulamBeam;', sandbox);
module.exports = { EC5: sandbox.EC5, GlulamBeam: sandbox.GlulamBeam };
