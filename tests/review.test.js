'use strict';
// Tests added in the review (REVIEW.md). Run with: node --test tests/
//
// 1. The default Max week and the Pro week worked from raw numbers typed in
//    here, not from PARAMS, so a changed parameter can't silently change the
//    expected value as well.
// 2. Units: Wh vs kWh, g vs kg, and internal consistency between outputs.
// 3. low <= central <= high for every output, over every preset combination
//    the page offers and a seeded set of random overrides.
// 4. Static page text that must agree with model.js: preset options, the
//    energy-per-token boxes, the assumptions tables, the uncertainty notice.
// 5. CSS regressions found at 320px phone width.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const M = require('../docs/model.js');
const DOCS = path.join(__dirname, '..', 'docs');
const html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const css = fs.readFileSync(path.join(DOCS, 'style.css'), 'utf8');

function close(actual, expected, rel, msg) {
  rel = rel === undefined ? 1e-6 : rel;
  const tol = rel * Math.max(Math.abs(expected), 1e-12);
  assert.ok(Math.abs(actual - expected) <= tol, `${msg || ''} expected ${expected}, got ${actual}`);
}

function decode(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function text(fragment) {
  return decode(fragment.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function inner(tag, id) {
  const m = html.match(new RegExp('<' + tag + '[^>]*\\sid="' + id + '"[^>]*>([\\s\\S]*?)</' + tag + '>'));
  assert.ok(m, 'no <' + tag + ' id="' + id + '">');
  return m[1];
}
function optionValues(selectId) {
  return [...inner('select', selectId).matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
}

// ---------- 1. hand-worked weeks (REVIEW.md, "Maths") ----------

// Raw inputs, copied from PLAN.md section 3b by hand.
const RAW = {
  wh: { low: [50, 50, 1, 300], central: [200, 250, 20, 1000], high: [400, 800, 100, 3000] }, // input, write, read, output
  mix: { low: [0.001, 0.025, 0.970, 0.004], central: [0.002, 0.032, 0.960, 0.006], high: [0.008, 0.084, 0.900, 0.008] },
  pue: { low: 1.09, central: 1.14, high: 1.54 },
  grid: { low: 94, central: 350, high: 416 },
  tokensM: { pro: { low: 70, central: 185, high: 280 }, max: { low: 600, central: 930, high: 1500 } }
};

function byHand(plan, level) {
  // Wh per million tokens of the blended mix, at server level.
  let serverWhPerM = 0;
  for (let i = 0; i < 4; i++) serverWhPerM += RAW.mix[level][i] * RAW.wh[level][i];
  const serverWh = RAW.tokensM[plan][level] * serverWhPerM; // millions of tokens x Wh per million
  const kWh = serverWh * RAW.pue[level] / 1000; // Wh -> kWh
  const kg = kWh * RAW.grid[level] / 1000; // kWh x g/kWh = g; g -> kg
  return { serverWhPerM, kWh, kg };
}

test('hand-worked blended server Wh per million tokens: 3.47, 33.6, 184.4', () => {
  close(byHand('max', 'low').serverWhPerM, 3.47);
  close(byHand('max', 'central').serverWhPerM, 33.6);
  close(byHand('max', 'high').serverWhPerM, 184.4);
});

for (const plan of ['max', 'pro']) {
  test(`hand-worked ${plan} week agrees with planScenario and with PLAN.md section 4a`, () => {
    const r = M.planScenario(plan);
    for (const level of M.LEVELS) {
      const h = byHand(plan, level);
      close(r[level].kWh, h.kWh, 1e-9, `${plan} ${level} kWh`);
      close(r[level].kgCO2e, h.kg, 1e-9, `${plan} ${level} kg`);
    }
  });
}

test('hand-worked values, written out (REVIEW.md)', () => {
  // Max: 930 M x 33.6 Wh/M = 31,248 Wh; x 1.14 = 35,622.72 Wh = 35.623 kWh; x 350 g = 12.468 kg.
  close(byHand('max', 'central').kWh, 35.62272);
  close(byHand('max', 'central').kg, 12.467952);
  // Max low: 600 x 3.47 = 2,082 Wh; x 1.09 = 2,269.38 Wh = 2.269 kWh; x 94 g = 0.2133 kg.
  close(byHand('max', 'low').kWh, 2.26938);
  close(byHand('max', 'low').kg, 0.21332172);
  // Max high: 1,500 x 184.4 = 276,600 Wh; x 1.54 = 425,964 Wh = 425.96 kWh; x 416 g = 177.20 kg.
  close(byHand('max', 'high').kWh, 425.964);
  close(byHand('max', 'high').kg, 177.201024);
  // Pro: 185 x 33.6 = 6,216 Wh; x 1.14 = 7,086.24 Wh = 7.086 kWh; x 350 g = 2.480 kg.
  close(byHand('pro', 'central').kWh, 7.08624);
  close(byHand('pro', 'central').kg, 2.480184);
  close(byHand('pro', 'low').kWh, 0.264761);
  close(byHand('pro', 'high').kWh, 79.51328);
});

// ---------- 2. units and internal consistency ----------

test('units: kWh = server Wh x PUE / 1000, and kg = kWh x g/kWh / 1000', () => {
  for (const plan of Object.keys(M.PLANS)) {
    const r = M.planScenario(plan, { includeEmbodied: true });
    for (const level of M.LEVELS) {
      const e = r[level];
      close(e.kWh, e.serverWh * e.params.pue / 1000, 1e-12, 'kWh');
      close(e.kgCO2e, e.kWh * e.params.gridIntensity / 1000, 1e-12, 'kg');
      close(e.embodiedKg, e.kWh * M.PARAMS.embodiedGPerKWh / 1000, 1e-12, 'embodied kg');
      close(e.totalKgCO2e, e.kgCO2e + e.embodiedKg, 1e-12, 'total');
      // The blended per-million figures agree with the totals.
      close(e.perMTok.wh, e.kWh * 1000 / (e.totalTokens / 1e6), 1e-9, 'Wh per million tokens');
      close(e.perMTok.gCO2e, e.kgCO2e * 1000 / (e.totalTokens / 1e6), 1e-9, 'g per million tokens');
      // The breakdown by type adds up to the total.
      const sum = M.TOKEN_TYPES.reduce((a, t) => a + e.byTypeKWh[t], 0);
      close(sum, e.kWh, 1e-12, 'breakdown sum');
    }
  }
});

test('units: a full Max week is tens of kWh, not tens of thousands (Wh) or hundredths (MWh)', () => {
  const c = M.planScenario('max').central;
  assert.ok(c.kWh > 10 && c.kWh < 100, c.kWh);
  assert.ok(c.kgCO2e > 1 && c.kgCO2e < 50, c.kgCO2e);
  assert.ok(c.serverWh > 10000 && c.serverWh < 100000, c.serverWh);
});

test('comparison factors are in the stated units', () => {
  const k = M.COMPARISONS;
  close(k.petrolCarKgPerMile, 0.25994, 1e-4); // kg per mile, from 0.16152 kg per km
  assert.ok(k.ukGridKgPerKWh > 0.05 && k.ukGridKgPerKWh < 0.5, 'kg per kWh, not g');
  close(k.ukHomeKWhPerDay, 6.849, 1e-3);
  const c = M.comparisons(1, 1);
  close(c.geminiPrompts, 1000 / 0.24); // 1 kWh = 1000 Wh
  close(c.ukGridKg, 0.13096);
});

// ---------- 3. low <= central <= high everywhere ----------

function assertOrdered(range, label, checkPerMTok) {
  const keys = ['totalTokens', 'serverWh', 'kWh', 'kgCO2e', 'embodiedKg', 'totalKgCO2e'];
  for (const k of keys) {
    assert.ok(range.low[k] <= range.central[k] + 1e-12 && range.central[k] <= range.high[k] + 1e-12,
      `${label}: ${k} ${range.low[k]} / ${range.central[k]} / ${range.high[k]}`);
  }
  if (checkPerMTok !== false && range.central.perMTok) {
    assert.ok(range.low.perMTok.wh <= range.central.perMTok.wh && range.central.perMTok.wh <= range.high.perMTok.wh, label + ' Wh/MTok');
  }
}

test('low <= central <= high for every plan, mix, model, PUE, grid, share and embodied option on the page', () => {
  const mixes = [undefined, 'low', 'central', 'high'];
  const pues = [undefined, ...M.PUE_PRESETS.map((p) => p.value)];
  const grids = [undefined, ...M.GRID_PRESETS.map((p) => p.value)];
  let n = 0;
  for (const planId of Object.keys(M.PLANS)) {
    for (const mix of mixes) for (const model of Object.keys(M.MODELS)) for (const pue of pues) {
      for (const gridIntensity of grids) for (const shareUsed of [0, 0.5, 1]) for (const includeEmbodied of [false, true]) {
        assertOrdered(M.estimateRange({ planId, mix, model, pue, gridIntensity, shareUsed, includeEmbodied }),
          JSON.stringify({ planId, mix, model, pue, gridIntensity, shareUsed }));
        n++;
      }
    }
  }
  assert.ok(n > 3000);
});

test('low <= central <= high under random overrides (seeded)', () => {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 2000; i++) {
    const inputs = { planId: Object.keys(M.PLANS)[Math.floor(rnd() * 3)], shareUsed: rnd() };
    const wh = {};
    for (const t of M.TOKEN_TYPES) if (rnd() < 0.3) wh[t] = rnd() * 3000;
    inputs.whPerMTok = wh;
    if (rnd() < 0.3) {
      const raw = M.TOKEN_TYPES.map(() => rnd());
      const s = raw.reduce((a, b) => a + b, 0);
      inputs.mix = {}; M.TOKEN_TYPES.forEach((t, j) => { inputs.mix[t] = raw[j] / s; });
    }
    if (rnd() < 0.3) inputs.pue = 1 + rnd();
    if (rnd() < 0.3) inputs.gridIntensity = rnd() * 900;
    if (rnd() < 0.5) inputs.tokensByType = { input: rnd() * 1e7, cacheWrite: rnd() * 1e8, cacheRead: rnd() * 1e9, output: rnd() * 1e7 };
    inputs.includeEmbodied = rnd() < 0.5;
    // The blended Wh per million tokens is only ordered when the named mixes
    // vary by level and the energies keep their usual order (see the next test).
    const mixVaries = !inputs.mix && !inputs.tokensByType;
    assertOrdered(M.estimateRange(inputs), 'random case ' + i, !(mixVaries && Object.keys(wh).length));
  }
});

test('known edge case (REVIEW.md, open): cache-read energy set above output energy reverses the blended per-million order, not the totals', () => {
  // The "low-energy" mix has the most cache reads, so it is only low-energy while a
  // cache read costs less than the other token types. Setting it higher (against
  // all the evidence) makes low Wh per million tokens exceed central.
  const r = M.estimateRange({ planId: 'max', whPerMTok: { input: 100, cacheWrite: 100, cacheRead: 3000, output: 100 }, pue: 1.1 });
  assert.ok(r.low.perMTok.wh > r.central.perMTok.wh);
  assertOrdered(r, 'totals still ordered', false);
});

test('sensitivity rows: low <= central <= high for every plan, and the drivers table order', () => {
  for (const planId of Object.keys(M.PLANS)) {
    const s = M.sensitivity({ planId });
    for (const r of s.rows) {
      assert.ok(r.low.kWh <= s.central.kWh + 1e-9 && s.central.kWh <= r.high.kWh + 1e-9, planId + ' ' + r.id + ' kWh');
      assert.ok(r.low.kgCO2e <= s.central.kgCO2e + 1e-9 && s.central.kgCO2e <= r.high.kgCO2e + 1e-9, planId + ' ' + r.id + ' kg');
    }
    assert.equal(s.rows[0].id, 'cacheRead', planId + ': cache-read energy is the biggest driver');
  }
});

// ---------- 4. static page text agrees with model.js ----------

test('PUE and grid select options are exactly the presets in model.js', () => {
  assert.deepEqual(optionValues('pue-select'), ['range', ...M.PUE_PRESETS.map((p) => String(p.value)), 'custom']);
  assert.deepEqual(optionValues('grid-select'), ['range', ...M.GRID_PRESETS.map((p) => String(p.value)), 'custom']);
  const pueRange = text(inner('select', 'pue-select')).match(/Range: ([\d.]+), ([\d.]+), ([\d.]+)/);
  assert.deepEqual(pueRange.slice(1).map(Number), [M.PARAMS.pue.low, M.PARAMS.pue.central, M.PARAMS.pue.high]);
  const gridRange = text(inner('select', 'grid-select')).match(/Range: ([\d.]+), ([\d.]+), ([\d.]+)/);
  assert.deepEqual(gridRange.slice(1).map(Number),
    [M.PARAMS.gridIntensity.low, M.PARAMS.gridIntensity.central, M.PARAMS.gridIntensity.high]);
});

test('energy-per-token boxes start at the central values, with the right low/high hints', () => {
  for (const t of M.TOKEN_TYPES) {
    const r = M.PARAMS.whPerMTok[t];
    const m = html.match(new RegExp('id="wh-' + t + '"[^>]*value="([^"]+)"'));
    assert.ok(m, t);
    assert.equal(Number(m[1]), r.central, t);
    assert.equal(text(inner('span', 'hint-wh-' + t)), 'low ' + M.formatSig(r.low, 4) + ', high ' + M.formatSig(r.high, 4), t);
  }
});

test('the assumptions tables show the values model.js uses', () => {
  const assumptions = html.slice(html.indexOf('id="assumptions-title"'), html.indexOf('id="sources-title"'));
  const num = (s) => Number(s.replace(/,/g, '').replace(/M$/, '').replace(/%$/, ''));
  const rowCells = (label) => {
    const m = assumptions.match(new RegExp('<tr><th scope="row">' + label + '</th>((?:<td>[^<]*</td>){3})'));
    assert.ok(m, label);
    return [...m[1].matchAll(/<td>([^<]*)<\/td>/g)].map((x) => num(x[1]));
  };
  const lch = (r) => [r.low, r.central, r.high];
  for (const [label, t] of [['Output', 'output'], ['Fresh input', 'input'], ['Cache write', 'cacheWrite'], ['Cache read', 'cacheRead']]) {
    assert.deepEqual(rowCells(label), lch(M.PARAMS.whPerMTok[t]), label);
  }
  assert.deepEqual(rowCells('PUE'), lch(M.PARAMS.pue));
  assert.deepEqual(rowCells('Grid \\(g CO2e/kWh\\)'), lch(M.PARAMS.gridIntensity));
  assert.deepEqual(rowCells('Pro'), lch(M.PLANS.pro.tokens).map((x) => x / 1e6));
  assert.deepEqual(rowCells('Max \\(formerly Max 5x\\)'), lch(M.PLANS.max.tokens).map((x) => x / 1e6));
  assert.deepEqual(rowCells('Ultra \\(formerly Max 20x\\)'), lch(M.PLANS.ultra.tokens).map((x) => x / 1e6));
  // Mix rows: cache read, cache write, input, output, as percentages.
  for (const [label, lvl] of [['Low-energy', 'low'], ['Central', 'central'], ['High-energy', 'high']]) {
    const m = assumptions.match(new RegExp('<tr><th scope="row">' + label + '</th>((?:<td>[^<]*</td>){4})'));
    assert.ok(m, label);
    const cells = [...m[1].matchAll(/<td>([^<]*)<\/td>/g)].map((x) => num(x[1]) / 100);
    const mix = M.PARAMS.mix[lvl];
    const want = [mix.cacheRead, mix.cacheWrite, mix.input, mix.output];
    cells.forEach((c, i) => close(c, want[i], 1e-9, label));
  }
  // Fixed factors.
  assert.match(html, new RegExp(M.formatSig(M.COMPARISONS.ukGridKgPerKWh * 1000, 3) + ' g CO2e per kWh'));
  assert.match(html, new RegExp(M.formatSig(M.COMPARISONS.petrolCarKgPerMile, 2) + ' kg CO2e a mile'));
  assert.match(html, new RegExp(M.PARAMS.embodiedGPerKWh + ' g CO2e per kWh'));
});

test('the uncertainty notice quotes the spread the model actually gives', () => {
  const m = html.match(/<aside class="notice"[\s\S]*?<\/aside>/);
  assert.ok(m, 'uncertainty notice');
  const notice = text(m[0]);
  const max = M.planScenario('max');
  const kwhRatio = max.high.kWh / max.low.kWh;
  const kgRatio = max.high.kgCO2e / max.low.kgCO2e;
  assert.match(notice, new RegExp('about ' + M.roundSig(kwhRatio, 2) + ' times low in electricity'));
  assert.match(notice, new RegExp('about ' + M.roundSig(kgRatio, 2) + ' times in emissions'));
  // "96% of Claude Code tokens are cache reads" matches the central mix.
  assert.match(notice, new RegExp(Math.round(M.PARAMS.mix.central.cacheRead * 100) + '% of Claude Code tokens are cache reads'));
});

test('the page states no rename date that the cited sources do not give', () => {
  // S11 and S12 (read 20 Nov 2026) give no date for the Max 20x -> Ultra rename.
  assert.ok(!/30 October 2026/.test(html));
});

test('UK factors on the page are DESNZ 2026, not the superseded 2025 edition', () => {
  assert.ok(!/conversion-factors-2025/.test(html), 'link to the 2025 edition');
  assert.ok(!/\b177( g|<\/option>|\)|: 177)/.test(html) && !/UK grid[^<]*177/.test(html), 'the 2025 UK grid factor (177 g/kWh)');
  assert.ok(!/0\.16272/.test(html), 'the 2025 petrol car factor');
  const s21 = M.SOURCES.find((s) => s.id === 'S21');
  assert.match(s21.url, /conversion-factors-2026$/);
});

// ---------- 5. CSS regressions at phone width ----------

test('CSS: tables scroll inside their own box and the slider has no side margin', () => {
  // Found with headless Chrome at 320px: absolutely positioned .visually-hidden
  // captions escaped .table-wrap and widened the page by 11px.
  assert.match(css, /\.table-wrap\s*\{[^}]*position:\s*relative/);
  assert.match(css, /\.table-wrap\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /input\[type="range"\]\s*\{[^}]*margin:\s*[\d.]+rem 0[;\s]/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
});
