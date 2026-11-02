// Loads the wind engine (the chart values and the Wind object) out of "Wind Loading.html": tests run against the shipped page.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Wind Loading.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) throw new Error('engine block not found');
const sandbox = { console, Math, Array, Set, Map, Object, Number, Error, JSON, Infinity, String, parseFloat, isFinite };
vm.createContext(sandbox);
vm.runInContext(m[1] + '\n;this.Wind = Wind; this.UKNA_CHARTS = UKNA_CHARTS;', sandbox);
module.exports = { Wind: sandbox.Wind, CHARTS: sandbox.UKNA_CHARTS };
