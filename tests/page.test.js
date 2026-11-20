'use strict';
// Checks on docs/index.html and docs/app.js. Run with: node --test tests/
//
// There is no browser here, so the HTML is parsed with regular expressions,
// and app.js is run against a minimal fake DOM with one stub element per id
// found in index.html.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DOCS = path.join(__dirname, '..', 'docs');
const html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
const appSrcRaw = fs.readFileSync(path.join(DOCS, 'app.js'), 'utf8');
// app.js without comments, for scanning its byId calls.
const appSrc = appSrcRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const modelSrc = fs.readFileSync(path.join(DOCS, 'model.js'), 'utf8');
const M = require('../docs/model.js');

// Remove comments so commented-out markup doesn't count.
const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, '');

function htmlIds() {
  const ids = [];
  const re = /\sid\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(htmlNoComments))) ids.push(m[1]);
  return ids;
}

function appIds() {
  const ids = [];
  const re = /byId\(\s*(['"])([^'"]+)\1\s*\)/g;
  let m;
  while ((m = re.exec(appSrc))) ids.push(m[2]);
  return ids;
}

function decode(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

// Visible text of an HTML fragment, with whitespace collapsed.
function text(fragment) {
  return decode(fragment.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Inner HTML of the element with this id in index.html (no nesting of the same tag assumed).
function staticInner(id) {
  const re = new RegExp('<([a-z0-9]+)[^>]*\\sid="' + id + '"[^>]*>([\\s\\S]*?)</\\1>');
  const m = htmlNoComments.match(re);
  assert.ok(m, 'no element #' + id + ' with content in index.html');
  return m[2];
}

// ---------- static checks ----------

test('every element id used by app.js exists in index.html', () => {
  const ids = new Set(htmlIds());
  const used = appIds();
  assert.ok(used.length > 50, 'found the byId calls');
  for (const id of used) assert.ok(ids.has(id), `#${id} is used by app.js but missing from index.html`);
});

test('app.js looks up elements only with literal ids', () => {
  const calls = (appSrc.match(/byId\(/g) || []).length;
  const definitions = (appSrc.match(/function byId\(/g) || []).length;
  assert.equal(calls - definitions, appIds().length, 'every byId(...) call uses a string literal');
  assert.ok(!/getElementById\(\s*[^'"\s]/.test(appSrc.replace('doc.getElementById(id)', '')),
    'getElementById is only called inside byId');
  assert.ok(!/querySelector/.test(appSrc), 'no selector lookups that the id check cannot see');
});

test('ids in index.html are unique', () => {
  const seen = new Set();
  for (const id of htmlIds()) {
    assert.ok(!seen.has(id), 'duplicate id ' + id);
    seen.add(id);
  }
});

test('every label for= and output for= points at an existing id', () => {
  const ids = new Set(htmlIds());
  const re = /<(label|output)[^>]*\sfor="([^"]+)"/g;
  let m;
  let n = 0;
  while ((m = re.exec(htmlNoComments))) {
    for (const id of m[2].split(/\s+/)) { assert.ok(ids.has(id), `${m[1]} for="${id}"`); n++; }
  }
  assert.ok(n > 20);
});

test('every form control has a label', () => {
  const labelled = new Set();
  const re = /<label[^>]*\sfor="([^"]+)"/g;
  let m;
  while ((m = re.exec(htmlNoComments))) labelled.add(m[1]);
  const controls = /<(input|select)\b[^>]*\sid="([^"]+)"[^>]*>/g;
  while ((m = controls.exec(htmlNoComments))) {
    if (/type="radio"/.test(m[0])) continue; // radios are wrapped in their labels
    assert.ok(labelled.has(m[2]), `#${m[2]} has a <label for>`);
  }
});

test('classic scripts, model.js before app.js, and no external resources', () => {
  const scripts = [...htmlNoComments.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
  assert.deepEqual(scripts.map((a) => (a.match(/src="([^"]+)"/) || [])[1]), ['model.js', 'app.js']);
  for (const a of scripts) assert.ok(!/type="module"/.test(a), 'no ES modules (they fail from file://)');
  for (const m of htmlNoComments.matchAll(/<(script|link|img|iframe)\b[^>]*(src|href)="([^"]+)"/g)) {
    assert.ok(!/^(https?:)?\/\//.test(m[3]), `external resource ${m[3]}`);
  }
  assert.match(htmlNoComments, /<link rel="stylesheet" href="style.css">/);
  assert.match(htmlNoComments, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(htmlNoComments, /<html lang="en-GB">/);
  assert.ok(!/\bimport\s|\bexport\s/.test(appSrc + modelSrc.replace(/module\.exports/g, '')), 'no import/export');
});

test('docs/.nojekyll, style.css and model.js exist', () => {
  for (const f of ['.nojekyll', 'style.css', 'model.js', 'app.js', 'index.html']) {
    assert.ok(fs.existsSync(path.join(DOCS, f)), f);
  }
});

test('the sources section links every source in model.js', () => {
  const list = staticInner('sources-list');
  for (const s of M.SOURCES) {
    const url = s.url.replace(/&/g, '&amp;');
    assert.ok(list.includes(`href="${url}"`), `${s.id} ${s.url}`);
    assert.ok(list.includes(`id="source-${s.id}"`), s.id);
    if (s.extraUrl) assert.ok(list.includes(`href="${s.extraUrl}"`), `${s.id} extra`);
  }
});

test('the page covers the method, assumptions, sources and research date', () => {
  for (const id of ['method-title', 'assumptions-title', 'sources-title', 'notice-title']) {
    assert.ok(htmlIds().includes(id), id);
  }
  assert.match(html, /20 November 2026/);
  assert.match(html, /location-based/i);
  assert.match(html, /market-based/i);
  assert.match(html, /own assumption/);
  assert.match(html, /Max \(formerly Max 5x\)|formerly Max 5x/);
  assert.match(html, /formerly Max 20x/);
});

// ---------- running app.js against a fake DOM ----------

function makeElement(id) {
  const classes = new Set();
  const attrs = {};
  return {
    id,
    value: '',
    checked: false,
    hidden: false,
    open: false,
    textContent: '',
    innerHTML: '',
    listeners: {},
    classList: {
      toggle(c, on) { if (on === undefined ? !classes.has(c) : on) classes.add(c); else classes.delete(c); },
      contains(c) { return classes.has(c); }
    },
    setAttribute(k, v) { attrs[k] = String(v); },
    removeAttribute(k) { delete attrs[k]; },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  };
}

function loadPage() {
  const elements = {};
  for (const id of htmlIds()) elements[id] = makeElement(id);
  const document = { getElementById: (id) => elements[id] || null };
  const window = { document };
  const ctx = vm.createContext({ window, document });
  vm.runInContext(modelSrc, ctx, { filename: 'model.js' });
  vm.runInContext(appSrcRaw, ctx, { filename: 'app.js' });
  const fire = (id, type) => (elements[id].listeners[type] || []).forEach((fn) => fn({ type }));
  // The page listens on the form, so a change anywhere bubbles to #controls.
  const change = () => fire('controls', 'change');
  return { el: elements, fire, change };
}

const DASH = ' – ';

test('app.js loads and shows a full week of Max by default', () => {
  const { el } = loadPage();
  assert.equal(el['hl-kwh'].textContent, '36');
  assert.equal(el['hl-kwh-range'].textContent, '2.3' + DASH + '430');
  assert.equal(el['hl-kg'].textContent, '12');
  assert.equal(el['hl-kg-range'].textContent, '0.21' + DASH + '180');
  assert.equal(el['plan-max'].checked, true);
  assert.equal(el['custom-tokens'].hidden, true);
  assert.equal(el['share-group'].hidden, false);
  assert.equal(el['form-errors'].hidden, true);
  assert.match(el['hl-context'].textContent, /Max \(formerly Max 5x\)/);
  assert.equal(el['hint-wh-output'].textContent, 'low 300, high 3,000');
});

test('the static (no-JavaScript) figures in index.html match what app.js renders', () => {
  const { el } = loadPage();
  for (const id of ['detail-body', 'permtok-body', 'breakdown-body', 'comparisons-body', 'drivers-body']) {
    assert.equal(text(el[id].innerHTML), text(staticInner(id)), id);
  }
  for (const id of ['hl-kwh', 'hl-kwh-range', 'hl-kg', 'hl-kg-range', 'hl-context', 'hl-words',
    'hl-kwh-label', 'hl-kg-label', 'breakdown-note', 'overrides', 'share-used-value']) {
    assert.equal(el[id].textContent, text(staticInner(id)), id);
  }
});

test('switching plan to Pro and Ultra updates the headline', () => {
  const page = loadPage();
  const { el } = page;
  el['plan-max'].checked = false;
  el['plan-pro'].checked = true;
  page.change();
  assert.equal(el['hl-kwh'].textContent, M.formatSig(7.0862));
  assert.match(el['hl-context'].textContent, /^A full week of Pro,/);
  el['plan-pro'].checked = false;
  el['plan-ultra'].checked = true;
  page.change();
  assert.equal(el['hl-kwh'].textContent, M.formatSig(70.8624));
  assert.match(el['hl-context'].textContent, /Ultra \(formerly Max 20x\)/);
});

test('share of plan used scales the results, and 0% gives zero', () => {
  const page = loadPage();
  const { el } = page;
  el['share-used'].value = '50';
  page.change();
  assert.equal(el['share-used-value'].textContent, '50%');
  assert.equal(el['hl-kwh'].textContent, M.formatSig(35.6227 / 2));
  el['share-used'].value = '0';
  page.change();
  assert.equal(el['hl-kwh'].textContent, '0');
  assert.equal(el['hl-kg'].textContent, '0');
  assert.match(el['breakdown-note'].textContent, /no tokens/);
});

test('custom token counts: defaults to a central Max week, hides share and mix, and handles bad input', () => {
  const page = loadPage();
  const { el } = page;
  el['plan-max'].checked = false;
  el['plan-custom'].checked = true;
  page.change();
  assert.equal(el['custom-tokens'].hidden, false);
  assert.equal(el['share-group'].hidden, true);
  assert.equal(el['mix-group'].hidden, true);
  assert.equal(el['hl-kwh'].textContent, '36');
  assert.equal(el['custom-total'].textContent, '930');
  assert.equal(el['hl-kwh-label'].textContent, 'Electricity');

  for (const t of M.TOKEN_TYPES) el['tok-' + t].value = '0';
  page.change();
  assert.equal(el['hl-kwh'].textContent, '0');

  el['tok-output'].value = '1';
  page.change();
  assert.equal(el['hl-kwh'].textContent, M.formatSig(1.14));

  el['tok-output'].value = '-3';
  page.change();
  assert.equal(el['form-errors'].hidden, false);
  assert.equal(el['tok-output'].getAttribute('aria-invalid'), 'true');
  assert.equal(el['hl-kwh'].textContent, '0');

  el['fill-total'].value = '185';
  el['fill-mix'].value = 'central';
  page.fire('fill-button', 'click');
  assert.equal(el['hl-kwh'].textContent, M.formatSig(7.0862));
  assert.equal(el['form-errors'].hidden, true);
});

test('overrides: PUE, grid, energy per token and mix collapse the range and are listed', () => {
  const page = loadPage();
  const { el } = page;
  el['pue-select'].value = 'custom';
  el['pue-custom'].value = '1';
  page.change();
  assert.equal(el['pue-custom-label'].hidden, false);
  assert.equal(el['hl-kwh'].textContent, M.formatSig(31.248));
  assert.match(el['overrides'].textContent, /PUE \(1\)/);

  el['pue-select'].value = 'range';
  el['grid-select'].value = '131';
  page.change();
  assert.equal(el['hl-kg'].textContent, M.formatSig(35.6227 * 0.131));
  assert.match(el['overrides'].textContent, /grid intensity/);

  el['grid-select'].value = 'range';
  el['wh-cacheRead'].value = '1';
  page.change();
  assert.ok(el['wh-cacheRead'].classList.contains('overridden'));
  assert.match(el['overrides'].textContent, /cache read energy/);
  assert.match(el['drivers-body'].innerHTML, /No spread: set by you/);

  el['wh-cacheRead'].value = '20';
  el['mix-select'].value = 'high';
  page.change();
  assert.ok(!el['wh-cacheRead'].classList.contains('overridden'));
  const r = M.estimateRange({ mix: 'high' });
  assert.equal(el['hl-kwh-range'].textContent, M.formatSig(r.low.kWh) + DASH + M.formatSig(r.high.kWh));
});

test('a custom mix that does not add up to 100% shows an error and is ignored', () => {
  const page = loadPage();
  const { el } = page;
  el['mix-select'].value = 'custom';
  page.change();
  assert.equal(el['mix-custom'].hidden, false);
  assert.equal(el['form-errors'].hidden, true, 'the default shares add up');
  assert.equal(el['hl-kwh'].textContent, '36');

  el['mix-cacheRead'].value = '95';
  page.change();
  assert.equal(el['form-errors'].hidden, false);
  assert.match(el['mix-sum'].textContent, /99%, not 100%/);
  assert.equal(el['hl-kwh-range'].textContent, '2.3' + DASH + '430', 'falls back to the range');
});

test('model size and embodied emissions', () => {
  const page = loadPage();
  const { el } = page;
  el['model-select'].value = 'sonnet';
  page.change();
  assert.equal(el['hl-kwh'].textContent, M.formatSig(17.8114));
  assert.match(el['hl-context'].textContent, /Sonnet-class/);
  el['model-select'].value = 'opus';
  el['embodied-toggle'].checked = true;
  page.change();
  assert.equal(el['hl-kg'].textContent, M.formatSig(12.468 + 1.4962));
  assert.match(el['detail-body'].innerHTML, /Embodied hardware emissions/);
  assert.match(el['hl-kg-label'].textContent, /embodied/);
});

test('reset to defaults restores the default view', () => {
  const page = loadPage();
  const { el } = page;
  el['plan-max'].checked = false;
  el['plan-ultra'].checked = true;
  el['share-used'].value = '10';
  el['pue-select'].value = '1.54';
  el['wh-output'].value = '5';
  el['embodied-toggle'].checked = true;
  el['advanced'].open = true;
  page.change();
  assert.notEqual(el['hl-kwh'].textContent, '36');
  page.fire('reset-button', 'click');
  assert.equal(el['hl-kwh'].textContent, '36');
  assert.equal(el['hl-kwh-range'].textContent, '2.3' + DASH + '430');
  assert.equal(el['plan-max'].checked, true);
  assert.equal(el['plan-ultra'].checked, false);
  assert.equal(el['share-used'].value, '100');
  assert.equal(el['wh-output'].value, '1000');
  assert.equal(el['embodied-toggle'].checked, false);
  assert.equal(el['advanced'].open, false);
  assert.equal(el['overrides'].textContent, 'Using the default ranges for every parameter.');
});
