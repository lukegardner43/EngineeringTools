// Loads the trees engine out of "Foundations Near Trees.html" (tests run against the shipped page).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Foundations Near Trees.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, String };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.TreeFoundations = TreeFoundations;', sandbox);
module.exports = { TreeFoundations: sandbox.TreeFoundations };
