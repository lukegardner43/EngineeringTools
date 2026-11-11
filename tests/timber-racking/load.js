// Loads the EC5 core and the racking engine out of "Timber Racking Wall.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Timber Racking Wall.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String, Set };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.EC5 = EC5; this.TimberRacking = TimberRacking;', sandbox);
module.exports = { EC5: sandbox.EC5, TimberRacking: sandbox.TimberRacking };
