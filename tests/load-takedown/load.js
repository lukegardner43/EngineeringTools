// Loads the load take-down engine out of "Load Take-down.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Load Take-down.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String, Set };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.LoadTakedown = LoadTakedown;', sandbox);
module.exports = { LoadTakedown: sandbox.LoadTakedown };
