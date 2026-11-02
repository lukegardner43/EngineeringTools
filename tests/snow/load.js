// Loads the snow engine out of "Snow Loading.html": tests run against the shipped page.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Snow Loading.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.Snow = Snow;', sandbox);
module.exports = { Snow: sandbox.Snow };
