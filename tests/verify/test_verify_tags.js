// The verification tags agree with the ROADMAP's Verification status: a "Not yet verified" or "Partly verified" pill under
// the title of each tool not fully verified (with the same note at the top of its printed sheet), the same tag on its home
// page row, and no tag on a verified tool. Run with: NODE_PATH=<jsdom>/node_modules node tests/verify/test_verify_tags.js
const fs = require('fs'), path = require('path'), { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.resolve(__dirname, '../..'), read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0; const truth = (n, ok) => { ok ? pass++ : fail++; if (!ok || process.env.VERBOSE) console.log((ok ? 'ok   ' : 'FAIL ') + n); };

// the ROADMAP table: tool name -> part | no | none | ok
const rm = read('ROADMAP.md'), sec = rm.slice(rm.indexOf('## Verification status'));
const rows = sec.slice(sec.indexOf('| Tool | Status')).split('\n\n')[0].split('\n').slice(2);
const STATUS = { 'Verified': 'ok', '**Partly verified**': 'part', '**Not independently verified**': 'no', '**No calculation tests**': 'none' };
const want = new Map();
for (const r of rows) {
  const [, names, st] = r.split('|').map(s => s.trim());
  truth(`ROADMAP status "${st}" is one of the four`, st in STATUS);
  for (const n of names.split(';')) want.set(n.replace(/\(.*?\)/g, '').trim(), STATUS[st]);
}
const count = k => [...want.values()].filter(v => v === k).length;
const m = sec.match(/Of the (\d+) live tools, (\d+) are verified, (\d+) partly verified.*? and (\d+) not independently verified(?:, (\w+) of them with no calculation tests|; (every) live tool now has calculation tests)/);
truth('ROADMAP counts sentence found', !!m);
if (m) {
  truth(`ROADMAP counts agree with its table (${want.size} tools)`, +m[1] === want.size && +m[2] === count('ok') && +m[3] === count('part') && +m[4] === count('no') + count('none') && (m[6] ? count('none') === 0 : m[5] === ['zero', 'one', 'two', 'three'][count('none')]));
}

// the home page
const vc = new VirtualConsole(), asserts = []; vc.on('jsdomError', () => {}); vc.on('assert', (ok, msg) => { if (!ok) asserts.push(msg); });
const idx = read('index.html'), w = new JSDOM(idx, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/index.html', virtualConsole: vc,
  beforeParse: win => { win.matchMedia = () => ({ matches: true, addEventListener() {} }); } }).window;   // reduced motion: no slideshow
const TOOLS = w.eval('TOOLS'), VERIFY = w.eval('VERIFY'), live = TOOLS.filter(t => t[1]);
truth('home page asserts all hold', asserts.length === 0);
truth('every live tool has a ROADMAP status', live.every(t => want.has(t[2])));
truth('every ROADMAP tool is live on the home page', [...want.keys()].every(n => live.some(t => t[2] === n)));
const rowsOf = {}; w.document.querySelectorAll('#groups li a').forEach(a => { rowsOf[decodeURI(a.getAttribute('href'))] = a; });
const LABEL = { part: 'Partly verified', no: 'Not yet verified', none: 'Not yet verified' };

for (const [g, page, name] of live) {
  const st = want.get(name), lab = LABEL[st], html = read(page);
  const blocks = html.match(/<!-- @@VERIFY[\s\S]*?<!-- \/@@VERIFY -->/g) || [];
  const pill = (rowsOf[page] && rowsOf[page].querySelector('.std .pill')) || null;
  if (st === 'ok') {
    truth(`${name}: verified, so no tag on its page`, blocks.length === 0);
    truth(`${name}: verified, so no tag on the home page`, !(page in VERIFY) && !pill);
    continue;
  }
  truth(`${name}: one tag on its page`, blocks.length === 1);
  const b = blocks[0] || '';
  truth(`${name}: the page's pill reads "${lab}"`, b.includes(`>${lab}</span>`) && b.includes(st === 'part' ? 'vt-pill vt-part' : 'vt-pill vt-no'));
  truth(`${name}: the page says why`, /<span class="vt-why">[^<]{40,}<\/span>/.test(b));
  truth(`${name}: the tag sits in the title block, after the title`, (() => { const i = html.indexOf(b), h = html.lastIndexOf('</h1>', i), d = html.lastIndexOf('page-hdr', i); return h > d && d > 0 && !html.slice(h, i).includes('</div>') && !html.slice(h, i).includes('</header>'); })());
  truth(`${name}: the printed sheet carries the note`, new RegExp(`@media print\\{(#report|\\.disclaimer)::before\\{content:"${lab}: `).test(b) && (b.includes('#report::before') ? html.includes('id="report"') : html.includes('class="disclaimer"')));
  truth(`${name}: home page row tagged "${lab}"`, VERIFY[page] === (st === 'part' ? 'part' : 'no') && !!pill && pill.textContent === lab);
}
truth('the home page footer explains both tags', /Not yet verified<\/span> tools[^]*Partly verified<\/span> tools/.test(idx));
// searching "verified" finds the tagged tools
w.document.getElementById('q').value = 'partly verified'; w.document.getElementById('q').dispatchEvent(new w.Event('input'));
truth('searching "partly verified" lists the partly verified tools', w.document.querySelectorAll('#groups li a').length === count('part'));
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
