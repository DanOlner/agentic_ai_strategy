'use strict';
// Tests for docs/model.js (PLAN.md section 6). Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const M = require('../docs/model.js');

const MODEL_PATH = path.join(__dirname, '..', 'docs', 'model.js');

// Relative closeness: |a - b| <= rel * max(|b|, tiny).
function close(actual, expected, rel, msg) {
  rel = rel === undefined ? 1e-6 : rel;
  const tol = rel * Math.max(Math.abs(expected), 1e-12);
  assert.ok(Math.abs(actual - expected) <= tol,
    `${msg || ''} expected ${expected}, got ${actual} (rel tol ${rel})`);
}

function closeAbs(actual, expected, abs, msg) {
  assert.ok(Math.abs(actual - expected) <= abs,
    `${msg || ''} expected ${expected} ± ${abs}, got ${actual}`);
}

const C = M.PARAMS.mix.central;
const centralWh = { input: 200, cacheWrite: 250, cacheRead: 20, output: 1000 };

// ---------- 1. constants ----------

test('TOKEN_TYPES lists the four token types in order', () => {
  assert.deepEqual(M.TOKEN_TYPES, ['input', 'cacheWrite', 'cacheRead', 'output']);
  M.TOKEN_TYPES.forEach((t) => assert.ok(M.TOKEN_TYPE_LABELS[t]));
});

test('PARAMS match PLAN.md section 3b', () => {
  assert.deepEqual(M.PARAMS.whPerMTok, {
    input: { low: 50, central: 200, high: 400 },
    cacheWrite: { low: 50, central: 250, high: 800 },
    cacheRead: { low: 1, central: 20, high: 100 },
    output: { low: 300, central: 1000, high: 3000 }
  });
  assert.deepEqual(M.PARAMS.pue, { low: 1.09, central: 1.14, high: 1.54 });
  assert.deepEqual(M.PARAMS.gridIntensity, { low: 94, central: 350, high: 416 });
  assert.equal(M.PARAMS.embodiedGPerKWh, 42);
  assert.deepEqual(M.PARAMS.modelMultipliers, { opus: 1, sonnet: 0.5, haiku: 0.15 });
  assert.deepEqual(M.PARAMS.mix.central, { input: 0.002, cacheWrite: 0.032, cacheRead: 0.96, output: 0.006 });
});

test('every mix in PARAMS.mix is valid, and the low-energy mix has the most cache reads', () => {
  for (const level of M.LEVELS) assert.ok(M.validateMix(M.PARAMS.mix[level]), level);
  assert.ok(M.PARAMS.mix.low.cacheRead > M.PARAMS.mix.central.cacheRead);
  assert.ok(M.PARAMS.mix.central.cacheRead > M.PARAMS.mix.high.cacheRead);
});

test('low <= central <= high for energy, PUE, grid and plan tokens', () => {
  const ranges = [
    ...M.TOKEN_TYPES.map((t) => M.PARAMS.whPerMTok[t]),
    M.PARAMS.pue, M.PARAMS.gridIntensity,
    ...Object.values(M.PLANS).map((p) => p.tokens)
  ];
  for (const r of ranges) {
    assert.ok(r.low <= r.central && r.central <= r.high, JSON.stringify(r));
  }
});

test('PLANS have the three presets with current and former names', () => {
  assert.deepEqual(Object.keys(M.PLANS), ['pro', 'max', 'ultra']);
  assert.equal(M.PLANS.max.formerly, 'Max 5x');
  assert.equal(M.PLANS.ultra.formerly, 'Max 20x');
  assert.deepEqual(M.PLANS.max.tokens, { low: 600e6, central: 930e6, high: 1500e6 });
  assert.deepEqual(M.PLANS.pro.tokens, { low: 70e6, central: 185e6, high: 280e6 });
  assert.deepEqual(M.PLANS.ultra.tokens, { low: 1500e6, central: 1850e6, high: 2800e6 });
  assert.equal(M.DEFAULT_PLAN, 'max');
});

test('COMPARISONS factors', () => {
  assert.equal(M.COMPARISONS.kettleKWh, 0.11);
  close(M.COMPARISONS.ukHomeKWhPerDay, 2500 / 365);
  close(M.COMPARISONS.petrolCarKgPerMile, 0.16272 * 1.609344);
  assert.equal(M.COMPARISONS.ukGridKgPerKWh, 0.177);
  assert.equal(M.COMPARISONS.geminiPromptWh, 0.24);
});

test('every source has an id, title, organisation, date, https URL and figure; ids are unique', () => {
  assert.equal(M.SOURCES.length, 22);
  const ids = new Set();
  for (const s of M.SOURCES) {
    for (const k of ['id', 'title', 'organisation', 'date', 'url', 'figure']) {
      assert.ok(typeof s[k] === 'string' && s[k].length > 0, `${s.id} ${k}`);
    }
    assert.match(s.url, /^https:\/\//);
    assert.ok(!ids.has(s.id), s.id);
    ids.add(s.id);
  }
});

test('PUE and grid presets point at known sources and include the PLAN values', () => {
  const ids = new Set(M.SOURCES.map((s) => s.id));
  for (const p of [...M.PUE_PRESETS, ...M.GRID_PRESETS]) assert.ok(ids.has(p.source), p.id);
  assert.deepEqual(M.PUE_PRESETS.map((p) => p.value), [1.09, 1.14, 1.54]);
  assert.deepEqual(M.GRID_PRESETS.map((p) => p.value), [94, 177, 195, 287, 297.6, 350, 416]);
});

// ---------- 2. splitTokens ----------

test('splitTokens splits a total by the mix', () => {
  const s = M.splitTokens(1e6, C);
  close(s.input, 2000); close(s.cacheWrite, 32000); close(s.cacheRead, 960000); close(s.output, 6000);
});

test('splitTokens: shareUsed 0.5 halves, 0 gives zeros, default is 1', () => {
  const full = M.splitTokens(1e6, C);
  const half = M.splitTokens(1e6, C, 0.5);
  const none = M.splitTokens(1e6, C, 0);
  for (const t of M.TOKEN_TYPES) {
    close(half[t], full[t] / 2);
    assert.equal(none[t], 0);
  }
  assert.deepEqual(M.splitTokens(1e6, C, 1), full);
});

test('splitTokens: zero total gives zeros; bad inputs throw', () => {
  const z = M.splitTokens(0, C);
  for (const t of M.TOKEN_TYPES) assert.equal(z[t], 0);
  assert.throws(() => M.splitTokens(-1, C), RangeError);
  assert.throws(() => M.splitTokens(NaN, C), RangeError);
  assert.throws(() => M.splitTokens(1e6, C, 1.5), RangeError);
  assert.throws(() => M.splitTokens(1e6, C, -0.1), RangeError);
  assert.throws(() => M.splitTokens(1e6, { input: 0.5, cacheWrite: 0, cacheRead: 0, output: 0 }), RangeError);
});

// ---------- 3. validateMix ----------

test('validateMix accepts sums of 1 and rejects 0.99, 1.01, negatives and missing types', () => {
  assert.equal(M.validateMix({ input: 0.25, cacheWrite: 0.25, cacheRead: 0.25, output: 0.25 }), true);
  assert.equal(M.validateMix({ input: 0, cacheWrite: 0, cacheRead: 1, output: 0 }), true);
  assert.equal(M.validateMix({ input: 0.24, cacheWrite: 0.25, cacheRead: 0.25, output: 0.25 }), false);
  assert.equal(M.validateMix({ input: 0.26, cacheWrite: 0.25, cacheRead: 0.25, output: 0.25 }), false);
  assert.equal(M.validateMix({ input: -0.1, cacheWrite: 0.35, cacheRead: 0.5, output: 0.25 }), false);
  assert.equal(M.validateMix({ input: 0.5, cacheRead: 0.5, output: 0 }), false);
  assert.equal(M.validateMix({ input: NaN, cacheWrite: 0, cacheRead: 1, output: 0 }), false);
  assert.equal(M.validateMix(null), false);
});

// ---------- mixFromTokens ----------

test('mixFromTokens gives shares, and null for zero tokens', () => {
  const m = M.mixFromTokens({ input: 1, cacheWrite: 1, cacheRead: 2, output: 0 });
  assert.deepEqual(m, { input: 0.25, cacheWrite: 0.25, cacheRead: 0.5, output: 0 });
  assert.ok(M.validateMix(m));
  assert.equal(M.mixFromTokens({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }), null);
});

// ---------- 4. serverEnergyWh ----------

test('serverEnergyWh: 1M tokens of each type alone at central gives 200, 250, 20, 1000 Wh', () => {
  const expected = { input: 200, cacheWrite: 250, cacheRead: 20, output: 1000 };
  for (const t of M.TOKEN_TYPES) {
    const tokens = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
    tokens[t] = 1e6;
    close(M.serverEnergyWh(tokens, centralWh), expected[t], 1e-9, t);
  }
});

test('serverEnergyWh: model multiplier scales, zero tokens gives 0, missing types count as 0', () => {
  const tokens = M.splitTokens(1e6, C);
  close(M.serverEnergyWh(tokens, centralWh, 0.5), M.serverEnergyWh(tokens, centralWh) / 2);
  close(M.serverEnergyWh(tokens, centralWh), 33.6);
  assert.equal(M.serverEnergyWh({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, centralWh), 0);
  close(M.serverEnergyWh({ output: 2e6 }, centralWh), 2000);
  assert.throws(() => M.serverEnergyWh({ output: -1 }, centralWh), RangeError);
});

// ---------- 5-7. dataCentreKWh, emissionsKg, embodiedKg ----------

test('dataCentreKWh(1000, 1.14) = 1.14', () => {
  close(M.dataCentreKWh(1000, 1.14), 1.14);
  assert.equal(M.dataCentreKWh(0, 1.14), 0);
  assert.throws(() => M.dataCentreKWh(1, -1), RangeError);
});

test('emissionsKg(10, 350) = 3.5 and emissionsKg(1, 0) = 0', () => {
  close(M.emissionsKg(10, 350), 3.5);
  assert.equal(M.emissionsKg(1, 0), 0);
  assert.throws(() => M.emissionsKg(1, -5), RangeError);
});

test('embodiedKg(100, 42) = 4.2', () => {
  close(M.embodiedKg(100, 42), 4.2);
  assert.equal(M.embodiedKg(0, 42), 0);
});

// ---------- 8. perMillionTokens ----------

test('perMillionTokens at low, central and high (PLAN.md section 3c)', () => {
  const expected = {
    low: { wh: 3.782, g: 0.356 },
    central: { wh: 38.304, g: 13.406 },
    high: { wh: 283.976, g: 118.134 }
  };
  for (const level of M.LEVELS) {
    const wh = {};
    for (const t of M.TOKEN_TYPES) wh[t] = M.PARAMS.whPerMTok[t][level];
    const r = M.perMillionTokens(M.PARAMS.mix[level], wh, 1, M.PARAMS.pue[level], M.PARAMS.gridIntensity[level]);
    // PLAN.md gives these to 3 decimal places: allow half a unit in the last place.
    closeAbs(r.wh, expected[level].wh, 0.0005, level + ' Wh');
    closeAbs(r.gCO2e, expected[level].g, 0.0005, level + ' g');
  }
});

test('perMillionTokens byType applies the model multiplier and PUE', () => {
  const r = M.perMillionTokens(C, centralWh, 0.5, 1.14, 350);
  close(r.byType.input, 200 * 0.5 * 1.14);
  close(r.byType.cacheRead, 20 * 0.5 * 1.14);
  close(r.byType.output, 1000 * 0.5 * 1.14);
  close(r.wh, 38.304 / 2);
  const d = M.perMillionTokens(C, centralWh);
  close(d.wh, 33.6);
  assert.equal(d.gCO2e, 0);
});

// ---------- 9. preset scenarios ----------

const PRESETS = {
  pro: { low: [0.2648, 0.0249], central: [7.0862, 2.4802], high: [79.5133, 33.0775] },
  max: { low: [2.2694, 0.2133], central: [35.6227, 12.4680], high: [425.9640, 177.2010] },
  ultra: { low: [5.6735, 0.5333], central: [70.8624, 24.8018], high: [795.1328, 330.7752] }
};

for (const [planId, levels] of Object.entries(PRESETS)) {
  test(`planScenario('${planId}') matches PLAN.md section 4a`, () => {
    const r = M.planScenario(planId);
    for (const level of M.LEVELS) {
      close(r[level].kWh, levels[level][0], 1e-3, `${planId} ${level} kWh`);
      close(r[level].kgCO2e, levels[level][1], 1e-3, `${planId} ${level} kg`);
      assert.equal(r[level].embodiedKg, 0);
      assert.equal(r[level].totalKgCO2e, r[level].kgCO2e);
      close(r[level].totalTokens, M.PLANS[planId].tokens[level], 1e-9);
    }
  });
}

test('planScenario rejects unknown plans', () => {
  assert.throws(() => M.planScenario('enterprise'), RangeError);
});

test('the default estimate (no inputs) is a full week of Max', () => {
  const r = M.estimateRange({});
  close(r.central.kWh, 35.6227, 1e-3);
  close(r.low.kWh, 2.2694, 1e-3);
  close(r.high.kWh, 425.964, 1e-3);
});

// ---------- 10. share used ----------

test('Max at 50% of the plan gives exactly half', () => {
  const full = M.planScenario('max');
  const half = M.planScenario('max', { shareUsed: 0.5 });
  for (const level of M.LEVELS) {
    close(half[level].kWh, full[level].kWh / 2, 1e-12);
    close(half[level].kgCO2e, full[level].kgCO2e / 2, 1e-12);
  }
});

test('Max at 0% of the plan gives zero, with the per-million figures still defined', () => {
  const r = M.planScenario('max', { shareUsed: 0 });
  for (const level of M.LEVELS) {
    assert.equal(r[level].kWh, 0);
    assert.equal(r[level].kgCO2e, 0);
    assert.equal(r[level].totalTokens, 0);
  }
  close(r.central.perMTok.wh, 38.304, 1e-3);
});

// ---------- 11. model size ----------

test('Max central with Sonnet gives 17.8114 kWh; Haiku 0.15x; modelMultiplier number works', () => {
  close(M.planScenario('max', { model: 'sonnet' }).central.kWh, 17.8114, 1e-3);
  close(M.planScenario('max', { model: 'haiku' }).central.kWh, 35.6227 * 0.15, 1e-3);
  close(M.planScenario('max', { modelMultiplier: 0.5 }).central.kWh, 17.8114, 1e-3);
  assert.throws(() => M.planScenario('max', { model: 'gpt' }), RangeError);
});

// ---------- 12. breakdown ----------

test('Max central breakdown by type (PLAN.md section 4a)', () => {
  const r = M.planScenario('max').central;
  close(r.byTypeKWh.cacheRead, 20.356, 1e-3);
  close(r.byTypeKWh.cacheWrite, 8.482, 1e-3);
  close(r.byTypeKWh.output, 6.361, 1e-3);
  close(r.byTypeKWh.input, 0.424, 1e-3);
  const sum = M.TOKEN_TYPES.reduce((s, t) => s + r.byTypeKWh[t], 0);
  close(sum, r.kWh, 1e-9);
  close(sum, 35.623, 1e-3);
});

// ---------- 13. overrides ----------

test('a PUE override applies at all three levels and leaves other parameters at their own levels', () => {
  const r = M.estimateRange({ planId: 'max', pue: 1.0 });
  close(r.central.kWh, 31.2480, 1e-3);
  close(r.central.kWh, 35.6227 / 1.14, 1e-6);
  close(r.low.kWh, 2.2694 / 1.09, 1e-3);
  close(r.high.kWh, 425.964 / 1.54, 1e-3);
  for (const level of M.LEVELS) assert.equal(r[level].params.pue, 1.0);
  assert.equal(r.low.params.gridIntensity, 94);
  assert.equal(r.high.params.whPerMTok.cacheRead, 100);
});

test('whPerMTok, grid, mix and token overrides', () => {
  const wh = M.estimateRange({ whPerMTok: { cacheRead: 5 } });
  for (const level of M.LEVELS) assert.equal(wh[level].params.whPerMTok.cacheRead, 5);
  assert.equal(wh.low.params.whPerMTok.output, 300);
  assert.equal(wh.high.params.whPerMTok.output, 3000);

  const grid = M.estimateRange({ gridIntensity: 177 });
  close(grid.central.kgCO2e, 35.6227 * 0.177, 1e-3);
  close(grid.high.kgCO2e, 425.964 * 0.177, 1e-3);

  const mixNamed = M.estimateRange({ mix: 'central' });
  for (const level of M.LEVELS) assert.deepEqual(mixNamed[level].mix, M.PARAMS.mix.central);

  const custom = { input: 0, cacheWrite: 0, cacheRead: 1, output: 0 };
  const mixCustom = M.estimate({ mix: custom, totalTokens: 1e6 });
  close(mixCustom.kWh, 20 * 1.14 / 1000);

  const tok = M.estimateRange({ totalTokens: 1e9 });
  for (const level of M.LEVELS) assert.equal(tok[level].totalTokens, 1e9);
  assert.throws(() => M.estimate({ mix: 'wild' }), RangeError);
});

test('resolveInputs gives concrete values for each level', () => {
  const lo = M.resolveInputs({}, 'low');
  assert.equal(lo.pue, 1.09);
  assert.equal(lo.totalTokens, 600e6);
  assert.deepEqual(lo.mix, M.PARAMS.mix.low);
  assert.equal(lo.modelMultiplier, 1);
  assert.equal(lo.custom, false);
  const c = M.resolveInputs({ planId: 'pro', pue: 1.2, model: 'haiku' });
  assert.equal(c.level, 'central');
  assert.equal(c.totalTokens, 185e6);
  assert.equal(c.pue, 1.2);
  assert.equal(c.modelMultiplier, 0.15);
  assert.throws(() => M.resolveInputs({}, 'extreme'), RangeError);
  assert.throws(() => M.resolveInputs({ planId: 'nope' }), RangeError);
});

// ---------- 14. embodied ----------

test('Max central with embodied emissions adds 1.4962 kg', () => {
  const r = M.planScenario('max', { includeEmbodied: true }).central;
  close(r.embodiedKg, 1.4962, 1e-3);
  close(r.totalKgCO2e, 12.468 + 1.4962, 1e-3);
  close(r.kgCO2e, 12.468, 1e-3);
  const custom = M.planScenario('max', { includeEmbodied: true, embodiedGPerKWh: 0 }).central;
  assert.equal(custom.embodiedKg, 0);
});

// ---------- 15. comparisons ----------

test('comparisons(35.6227, 12.4680)', () => {
  const c = M.comparisons(35.6227, 12.4680);
  close(c.kettleBoils, 323.8, 1e-3);
  close(c.homeDays, 5.201, 1e-3);
  close(c.carMiles, 47.61, 1e-3);
  close(c.ukGridKg, 6.305, 1e-3);
  close(c.geminiPrompts, 35622.7 / 0.24, 1e-6);
  const z = M.comparisons(0, 0);
  for (const v of Object.values(z)) assert.equal(v, 0);
  assert.throws(() => M.comparisons(-1, 0), RangeError);
});

test('comparisons for the scenario table in PLAN.md section 4c', () => {
  const max = M.planScenario('max');
  const lo = M.comparisons(max.low.kWh, max.low.kgCO2e);
  const hi = M.comparisons(max.high.kWh, max.high.kgCO2e);
  closeAbs(lo.kettleBoils, 21, 0.5);
  closeAbs(hi.kettleBoils, 3872, 0.5);
  closeAbs(hi.homeDays, 62, 0.5);
  closeAbs(hi.carMiles, 677, 0.5);
});

// ---------- 16. sensitivity ----------

test('sensitivity for Max central matches PLAN.md section 4b', () => {
  const s = M.sensitivity({ planId: 'max' });
  close(s.central.kWh, 35.6227, 1e-3);
  const row = (id) => s.rows.find((r) => r.id === id);
  const expected = {
    cacheRead: [16.3, 117.0, 5.70, 41.0],
    tokens: [23.0, 57.5, 8.04, 20.1],
    cacheWrite: [28.8, 54.3, 10.1, 19.0],
    mix: [31.6, 51.5, 11.1, 18.0],
    output: [31.2, 48.3, 10.9, 16.9],
    pue: [34.1, 48.1, 11.9, 16.8],
    input: [35.3, 36.0, 12.4, 12.6]
  };
  for (const [id, [kl, kh, gl, gh]] of Object.entries(expected)) {
    closeAbs(row(id).low.kWh, kl, 0.05, id + ' low kWh');
    closeAbs(row(id).high.kWh, kh, 0.06, id + ' high kWh');
    closeAbs(row(id).low.kgCO2e, gl, 0.05, id + ' low kg');
    closeAbs(row(id).high.kgCO2e, gh, 0.05, id + ' high kg');
  }
  const grid = row('gridIntensity');
  close(grid.low.kWh, s.central.kWh, 1e-12);
  close(grid.high.kWh, s.central.kWh, 1e-12);
  closeAbs(grid.low.kgCO2e, 3.35, 0.01);
  closeAbs(grid.high.kgCO2e, 14.8, 0.05);
  assert.equal(s.rows.length, 8);
  assert.equal(s.rows[0].id, 'cacheRead');
  for (let i = 1; i < s.rows.length; i++) assert.ok(s.rows[i - 1].spreadKg >= s.rows[i].spreadKg);
  assert.ok(s.rows.every((r) => r.varies));
});

test('sensitivity: an overridden parameter shows no spread', () => {
  const s = M.sensitivity({ planId: 'max', pue: 1.2, whPerMTok: { cacheRead: 20 } });
  const pue = s.rows.find((r) => r.id === 'pue');
  assert.equal(pue.varies, false);
  assert.equal(pue.low.kWh, pue.high.kWh);
  assert.equal(s.rows.find((r) => r.id === 'cacheRead').varies, false);
  assert.equal(s.rows.find((r) => r.id === 'output').varies, true);
});

test('sensitivity with custom tokens: tokens and mix rows are fixed', () => {
  const s = M.sensitivity({ tokensByType: { input: 1e6, cacheWrite: 1e6, cacheRead: 1e8, output: 1e6 } });
  assert.equal(s.rows.find((r) => r.id === 'tokens').varies, false);
  assert.equal(s.rows.find((r) => r.id === 'mix').varies, false);
  assert.equal(s.rows.find((r) => r.id === 'cacheRead').varies, true);
});

// ---------- 17. custom tokens ----------

test('estimate with custom token counts ignores shareUsed, mix and plan', () => {
  const tokens = { input: 1e6, cacheWrite: 2e6, cacheRead: 3e7, output: 5e5 };
  const a = M.estimate({ tokensByType: tokens });
  const b = M.estimate({ tokensByType: tokens, shareUsed: 0.1, mix: 'high', planId: 'ultra', totalTokens: 5 });
  assert.equal(a.kWh, b.kWh);
  assert.deepEqual(a.tokensByType, tokens);
  assert.equal(a.totalTokens, 3.35e7);
  const serverWh = 1 * 200 + 2 * 250 + 30 * 20 + 0.5 * 1000;
  close(a.serverWh, serverWh);
  close(a.kWh, serverWh * 1.14 / 1000);
  close(a.kgCO2e, serverWh * 1.14 / 1000 * 0.35);
  assert.ok(M.validateMix(a.mix));
  close(a.perMTok.wh, serverWh * 1.14 / 33.5);
});

test('custom tokens: zero tokens, missing types, and invalid counts', () => {
  const z = M.estimateRange({ tokensByType: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 } });
  for (const level of M.LEVELS) {
    assert.equal(z[level].kWh, 0);
    assert.equal(z[level].kgCO2e, 0);
    assert.equal(z[level].mix, null);
    assert.equal(z[level].perMTok, null);
  }
  const partial = M.estimate({ tokensByType: { output: 1e6 } });
  close(partial.kWh, 1.14);
  assert.equal(partial.tokensByType.input, 0);
  assert.throws(() => M.estimate({ tokensByType: { output: -5 } }), RangeError);
  assert.throws(() => M.estimate({ tokensByType: { output: Infinity } }), RangeError);
});

test('custom tokens give a range from the energy, PUE and grid ranges only', () => {
  const tokens = { input: 0, cacheWrite: 0, cacheRead: 1e6, output: 0 };
  const r = M.estimateRange({ tokensByType: tokens });
  close(r.low.kWh, 1 * 1.09 / 1000);
  close(r.central.kWh, 20 * 1.14 / 1000);
  close(r.high.kWh, 100 * 1.54 / 1000);
});

// ---------- rounding ----------

test('roundSig and formatSig', () => {
  assert.equal(M.roundSig(35.6227), 36);
  assert.equal(M.roundSig(425.964), 430);
  assert.equal(M.roundSig(2.2694), 2.3);
  assert.equal(M.roundSig(0.21332), 0.21);
  assert.equal(M.roundSig(12.468, 3), 12.5);
  assert.equal(M.roundSig(0), 0);
  assert.equal(M.formatSig(35.6227), '36');
  assert.equal(M.formatSig(425.964), '430');
  assert.equal(M.formatSig(3872.4), '3,900');
  assert.equal(M.formatSig(0.21332), '0.21');
  assert.equal(M.formatSig(2.0001), '2');
  assert.equal(M.formatSig(930e6, 3), '930,000,000');
  assert.equal(M.formatSig(0), '0');
  assert.equal(M.formatSig(0.0004567, 2), '0.00046');
});

// ---------- 18. browser export ----------

test('loading model.js in a fake browser global defines window.CarbonModel', () => {
  const code = fs.readFileSync(MODEL_PATH, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const CM = sandbox.window.CarbonModel;
  assert.ok(CM, 'window.CarbonModel is defined');
  assert.equal(typeof CM.estimateRange, 'function');
  close(CM.planScenario('max').central.kWh, 35.6227, 1e-3);
  assert.equal(sandbox.module, undefined);
});

test('every exported function is covered by name in this test file', () => {
  const src = fs.readFileSync(__filename, 'utf8');
  for (const [name, value] of Object.entries(M)) {
    if (typeof value === 'function') assert.ok(src.includes('M.' + name + '('), name);
  }
});
