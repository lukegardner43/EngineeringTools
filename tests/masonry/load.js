// Loads the engines out of "Steel Masonry Support.html" (EC3 + SecProps + Masonry).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Steel Masonry Support.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/); if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Float64Array, Int32Array, Array, Set, Map, Object, Number, Error, JSON, Infinity, String };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.EC3 = EC3; this.SecProps = SecProps; this.Masonry = Masonry;', sandbox);
module.exports = { EC3: sandbox.EC3, SecProps: sandbox.SecProps, Masonry: sandbox.Masonry };
