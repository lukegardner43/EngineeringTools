// Drives "Prestressed Beam Design.html" in jsdom (NODE_PATH=<dir with node_modules> node ui_smoke.js).
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'Prestressed Beam Design.html'), 'utf8');
let n = 0, fails = 0;
const truth = (name, c) => { n++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name}`); if (!c) fails++; };
function page(store) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) { w.print = () => { w.printed = true; }; w.scrollTo = () => {}; if (store) w.localStorage.setItem('et-prestress-v1', store); } });
  const w = dom.window; w.errs = []; w.addEventListener('error', e => w.errs.push(e.message)); return w;
}
const w = page(), d = w.document, $ = id => d.getElementById(id), res = () => $('results').textContent, shown = el => !el.classList.contains('hidden');
const change = id => $(id).dispatchEvent(new w.Event('change'));
truth('page loads without script errors', w.errs.length === 0);
truth('pretensioned first: double-tee and three strand layers', $('stype').value === 'dt' && d.querySelectorAll('#layRows .row').length === 3 && shown(d.querySelector('.pre')) && !shown(d.querySelector('.post')));
$('calc').click();
truth('calculate: verdict PASS', /PASS/.test(res()) && !$('results').querySelector('.err'));
truth('section, cable zone, Magnel and four charts drawn', !!$('results').querySelector('svg.psec') && $('results').querySelectorAll('svg.frame').length === 6);
truth('losses, checks and the shear table', /Elastic shortening at release/.test(res()) && /Tension chord|Bending resistance/.test(res()) && /Shear, support to mid-span/.test(res()));
truth('Magnel aids: feasible range and minimum moduli', /Feasible at mid-span/.test(res()) && /Minimum moduli/.test(res()));
$('addLay').click(); truth('add a strand layer', d.querySelectorAll('#layRows .row').length === 4);
d.querySelectorAll('#layRows .row')[3].querySelector('.xbtn').click(); truth('remove it', d.querySelectorAll('#layRows .row').length === 3);
$('stype').value = 'rect'; change('stype'); truth('rectangle fields', shown(d.querySelector('.st-rect')) && !shown(d.querySelector('.st-dt')));
$('stype').value = 'custom'; change('stype'); $('calc').click(); truth('layered section runs', /PASS|FAIL/.test(res()));
$('stype').value = 'dt'; change('stype');
$('crMode').value = 'given'; change('crMode'); truth('given creep fields', shown(d.querySelector('.cr-given')) && !shown(d.querySelector('.cr-ec2')));
$('calc').click(); truth('given creep and shrinkage used', /φ = 2\.00/.test(res()) && /400×10/.test(res()));
$('crMode').value = 'ec2'; change('crMode');
$('strand').value = 's157b'; change('strand'); truth('strand preset sets fpk', $('fpk').value === '1770');
$('strand').value = 's129'; change('strand');
$('addPt').click(); const pr = d.querySelector('#ptRows .row'); pr.querySelector('.a').value = '0.3'; pr.querySelector('.G').value = '20'; $('calc').click();
truth('point load near the support noted', /within 2d of a support/.test(res()));
pr.querySelector('.xbtn').click();
// post-tensioned: defaults swap in
d.querySelector('#modes button[data-m="post"]').click();
truth('post-tensioned: I beam defaults, tendon and end block inputs', $('stype').value === 'I' && shown(d.querySelector('.post')) && !shown(d.querySelector('.pre')) && $('L').value === '20');
$('calc').click();
truth('post-tensioned passes', /PASS/.test(res()));
truth('friction and draw-in in the losses', /Friction/.test(res()) && /Draw-in at lock-off/.test(res()));
truth('end block checks and links', /Bearing under the anchor/.test(res()) && /End block: bursting tie/.test(res()));
$('ebOn').checked = false; change('ebOn'); $('calc').click(); truth('end block off', !/Bearing under the anchor/.test(res()) && !shown(d.querySelector('.eb')));
$('expo').value = 'XC2'; $('calc').click(); truth('XC2: decompression check', /Decompression, quasi-permanent/.test(res()));
$('tS').value = 'zero'; change('tS'); $('tComb').value = 'char'; $('calc').click(); truth('no tension allowed: rule check shown', /No tension, characteristic/.test(res()));
$('printBtn').click(); truth('print: A4 sheet with drawings', w.printed && $('report').querySelectorAll('svg').length >= 3 && /Post-tensioned beam to BS EN 1992-1-1/.test($('report').textContent));
// bad input
$('L').value = '0'; $('calc').click(); truth('bad input: message, no crash', !!$('results').querySelector('.err') && /span/.test(res()));
$('L').value = '20';
// stored state restores in a fresh page
const store = w.localStorage.getItem('et-prestress-v1'), w2 = page(store), d2 = w2.document;
truth('stored state restores mode and inputs', d2.querySelector('#modes button[data-m="post"]').classList.contains('on') && d2.getElementById('expo').value === 'XC2' && w2.errs.length === 0);
// the default pretensioned page back to front: switching back restores the double-tee
d.querySelector('#modes button[data-m="pre"]').click();
truth('back to pretensioned', shown(d.querySelector('.pre')));
truth('no script errors throughout', w.errs.length === 0 && w2.errs.length === 0);
console.log(`${n - fails} / ${n} UI checks passed`);
if (fails) process.exit(1);
