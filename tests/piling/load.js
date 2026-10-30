// Loads the piling engine out of "Sheet Pile Wall.html".
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Sheet Pile Wall.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/); if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Object, Number, Error, JSON, Infinity, Set, String };
vm.createContext(sandbox); vm.runInContext(m[1] + '\n;this.Piling = Piling;', sandbox);
module.exports = { Piling: sandbox.Piling };
