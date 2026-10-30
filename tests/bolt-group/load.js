// Loads the bolt group engine out of "Bolt Group Analysis.html".
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Bolt Group Analysis.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Set, Map, Object, Number, Error, JSON, Infinity };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.BoltGroup = BoltGroup;', sandbox);
module.exports = { BoltGroup: sandbox.BoltGroup };
