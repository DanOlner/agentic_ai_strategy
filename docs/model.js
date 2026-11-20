/*
 * CarbonModel: the estimation maths for the Claude Code energy and carbon page.
 *
 * Pure functions and data only: no DOM code. This is a classic script (not an
 * ES module) so the page works from file://. In the browser it sets
 * window.CarbonModel; under Node it sets module.exports.
 *
 * Every number here comes from PLAN.md (sections 1 to 4), which gives the
 * source for each. Units: tokens, Wh per million tokens (Wh/MTok) at server
 * level, kWh at data-centre level (after PUE), gCO2e/kWh for grids and
 * kg CO2e for results.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.CarbonModel = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' && globalThis.window) || null, function () {
  'use strict';

  var TOKEN_TYPES = ['input', 'cacheWrite', 'cacheRead', 'output'];
  var LEVELS = ['low', 'central', 'high'];

  var TOKEN_TYPE_LABELS = {
    input: 'Fresh input',
    cacheWrite: 'Cache write',
    cacheRead: 'Cache read',
    output: 'Output'
  };

  /* Parameter ranges (PLAN.md section 3b). "low" is always the value that
   * gives the lower energy or emissions. */
  var PARAMS = {
    // Server-level Wh per million tokens, Opus-class model.
    whPerMTok: {
      input: { low: 50, central: 200, high: 400 },
      cacheWrite: { low: 50, central: 250, high: 800 },
      cacheRead: { low: 1, central: 20, high: 100 },
      output: { low: 300, central: 1000, high: 3000 }
    },
    // Shares of all tokens. The low-energy mix has the most cache reads.
    mix: {
      low: { input: 0.001, cacheWrite: 0.025, cacheRead: 0.970, output: 0.004 },
      central: { input: 0.002, cacheWrite: 0.032, cacheRead: 0.960, output: 0.006 },
      high: { input: 0.008, cacheWrite: 0.084, cacheRead: 0.900, output: 0.008 }
    },
    pue: { low: 1.09, central: 1.14, high: 1.54 },
    gridIntensity: { low: 94, central: 350, high: 416 },
    embodiedGPerKWh: 42,
    modelMultipliers: { opus: 1, sonnet: 0.5, haiku: 0.15 },
    shareUsed: 1
  };

  var MODELS = {
    opus: { label: 'Opus (default)', multiplier: 1 },
    sonnet: { label: 'Sonnet', multiplier: 0.5 },
    haiku: { label: 'Haiku', multiplier: 0.15 }
  };

  var MIX_LABELS = {
    low: 'Low-energy mix (97% cache reads)',
    central: 'Central mix (96% cache reads)',
    high: 'High-energy mix (90% cache reads)'
  };

  /* Weekly tokens for a full week of each plan (PLAN.md section 3b). */
  var PLANS = {
    pro: {
      label: 'Pro',
      formerly: null,
      price: '$20 a month',
      tokens: { low: 70e6, central: 185e6, high: 280e6 }
    },
    max: {
      label: 'Max',
      formerly: 'Max 5x',
      price: '$100 a month',
      tokens: { low: 600e6, central: 930e6, high: 1500e6 }
    },
    ultra: {
      label: 'Ultra',
      formerly: 'Max 20x',
      price: '$200 a month',
      tokens: { low: 1500e6, central: 1850e6, high: 2800e6 }
    }
  };

  var DEFAULT_PLAN = 'max';

  /* Named presets offered on the page. */
  var PUE_PRESETS = [
    { id: 'google', label: 'Google fleet 2025', value: 1.09, source: 'S16' },
    { id: 'aws', label: 'AWS global 2025', value: 1.14, source: 'S17' },
    { id: 'industry', label: 'Industry average (Uptime 2025)', value: 1.54, source: 'S16' }
  ];

  var GRID_PRESETS = [
    { id: 'google-market', label: 'Google 2024, market-based', value: 94, source: 'S4' },
    { id: 'uk', label: 'UK grid 2025', value: 177, source: 'S21' },
    { id: 'camx', label: 'California (eGRID CAMX)', value: 195, source: 'S20' },
    { id: 'jegham-aws', label: 'AWS factor used by Jegham et al.', value: 287, source: 'S6' },
    { id: 'aws-us-west-2', label: 'AWS us-west-2 (Luccioni et al.)', value: 297.6, source: 'S7' },
    { id: 'us', label: 'US average (eGRID2023)', value: 350, source: 'S20' },
    { id: 'rfcw', label: 'RFC West / Indiana (eGRID)', value: 416, source: 'S20' }
  ];

  /* Comparison factors (PLAN.md section 4c). */
  var COMPARISONS = {
    kettleKWh: 0.11, // own physics: 1 litre from 15 to 100 °C at ~90% efficiency
    ukHomeKWhPerDay: 2500 / 365, // Ofgem 2026 medium TDCV (S22)
    petrolCarKgPerMile: 0.16272 * 1.609344, // DESNZ 2025 average petrol car (S21)
    ukGridKgPerKWh: 0.177, // DESNZ 2025 UK electricity generated (S21)
    geminiPromptWh: 0.24 // Google median Gemini Apps text prompt (S4)
  };

  /* Sources (PLAN.md section 1). */
  var SOURCES = [
    { id: 'S1', title: 'The real energy use of agentic AI', organisation: 'Zeke Hausfather, The Climate Brink', date: '5 Aug 2026', url: 'https://www.theclimatebrink.com/p/the-real-energy-use-of-agentic-ai', figure: '3.2 billion tokens of Claude Code use over 8 weeks, about 170 kWh (70 to 330). 96% cache reads, 0.4% output. Cache reads at 10% of input (1% to 25%). Grid 341 gCO2e/kWh.' },
    { id: 'S2', title: 'Claude Code’s environmental impact', organisation: 'Simon P. Couch', date: '20 Jan 2026', url: 'https://simonpcouch.com/blog/2026-01-20-cc-impact/', figure: 'Wh per million tokens: input ~390, output ~1,950, cache read ~39, cache write ~490 ("napkin math").' },
    { id: 'S3', title: 'How much energy does ChatGPT use?', organisation: 'Josh You, Epoch AI', date: '7 Feb 2025', url: 'https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use', figure: 'About 0.3 Wh per GPT-4o query (500 output tokens); 10k input tokens ~2.4 Wh, 100k ~40 Wh. Derived: ~600 Wh per million output tokens.' },
    { id: 'S4', title: 'Measuring the environmental impact of delivering AI at Google Scale (arXiv 2508.15734)', organisation: 'Cooper Elsworth et al., Google', date: '21 Aug 2025', url: 'https://arxiv.org/abs/2508.15734', figure: 'Median Gemini Apps text prompt 0.24 Wh and 0.03 gCO2e. Google 2024 grid: 345 location-based, 94 market-based gCO2e/kWh. Derived: embodied ~42 gCO2e per kWh.' },
    { id: 'S5', title: 'Our contribution to a global environmental standard for AI', organisation: 'Mistral AI', date: '22 Jul 2025', url: 'https://mistral.ai/news/our-contribution-to-a-global-environmental-standard-for-ai', figure: '1.14 gCO2e and 45 mL of water for a 400-token Le Chat response (lifecycle). Cross-check only.' },
    { id: 'S6', title: 'How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference (arXiv 2505.09598 v6)', organisation: 'Nidhal Jegham et al.', date: '14 May 2025, revised 24 Nov 2025', url: 'https://arxiv.org/abs/2505.09598', figure: 'Claude 3.7 Sonnet 0.950 / 2.989 / 5.671 Wh per query at 100/300, 1k/1k, 10k/1.5k tokens. AWS PUE 1.14, 0.287 kgCO2e/kWh. Derived: ~3,000 Wh per million output tokens.' },
    { id: 'S7', title: 'Power Hungry Processing: Watts Driving the Cost of AI Deployment? (FAccT ’24)', organisation: 'Alexandra Sasha Luccioni, Yacine Jernite, Emma Strubell', date: 'Nov 2023 (v3 Oct 2024)', url: 'https://arxiv.org/abs/2311.16863', figure: 'Text generation: about 0.05 kWh per 1,000 queries on small open models. AWS us-west-2 grid 297.6 gCO2e/kWh.' },
    { id: 'S8', title: 'claude-carbon METHODOLOGY.md', organisation: 'metztim (GitHub)', date: 'v1.2, 18 Dec 2025', url: 'https://github.com/metztim/claude-carbon/blob/main/METHODOLOGY.md', figure: 'Haiku 0.3, Sonnet 1.0, Opus 2.0 J per token; cache read 0.1x, cache write 1.25x input; PUE 1.2; grid 384 gCO2e/kWh. Used for the model-size multipliers.' },
    { id: 'S9', title: 'An open framework for AI emissions measurement', organisation: 'John Bistline, Watershed', date: '22 Jul 2026', url: 'https://watershed.com/en-GB/blog/ai-emissions-framework', figure: 'Benchmarks can overstate inference electricity "by 4 to 20 times"; training is 32% to 56% of a model’s footprint. Context only.' },
    { id: 'S10', title: 'Energy and AI', organisation: 'International Energy Agency', date: '10 Apr 2025', url: 'https://www.iea.org/reports/energy-and-ai', figure: 'Data centres used around 415 TWh (about 1.5% of world electricity) in 2024; around 945 TWh by 2030 in the Base Case. Context only.' },
    { id: 'S11', title: 'Claude pricing', organisation: 'Anthropic', date: 'read 20 Nov 2026', url: 'https://claude.com/pricing', figure: 'Pro $20/month; Max $100, "5x Pro usage every 5 hours and every week"; Ultra $200, "10x Pro usage every week".' },
    { id: 'S12', title: 'What is the Ultra plan? / Use Claude Code with your Pro, Max, or Ultra plan', organisation: 'Anthropic help centre', date: 'read 20 Nov 2026', url: 'https://support.claude.com/en/articles/17728952', extraUrl: 'https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan', figure: '"The Max 20x plan is now called the Ultra plan." Ultra includes 10 times Pro’s weekly usage.' },
    { id: 'S13', title: 'Claude Usage Limits (November 2026)', organisation: 'Wokey', date: 'data updated 16 Nov 2026', url: 'https://wokey.ai/claude-usage-limits', figure: 'Pro about 71.8M tokens a week ($163 at API prices); Ultra about 1.78B tokens a week ($1,576), about 9.7x Pro.' },
    { id: 'S14', title: 'How many tokens do you get with Claude Pro and Max? We counted them', organisation: 'FinOps LLM', date: '27 Sep 2026, updated 14 Nov 2026', url: 'https://finopsllm.com/research/claude-pro-max-tokens-limit', figure: 'Max 20x/Ultra ~1.9B tokens a week (1.8 to 2.3B); Max 5x at least 1.3B. One user’s mix: 96% cache reads, 3.3% cache writes, 0.57% output.' },
    { id: 'S15', title: 'Pricing (Claude API)', organisation: 'Anthropic', date: 'read 20 Nov 2026', url: 'https://platform.claude.com/docs/en/about-claude/pricing', figure: 'Opus 5.5 per million tokens: input $4, 5-minute cache write $5, 1-hour write $8, cache read $0.20, output $20.' },
    { id: 'S16', title: 'Data centre efficiency', organisation: 'Google', date: 'read 20 Nov 2026 (data to Q2 2026)', url: 'https://datacenters.google/efficiency/', figure: 'Fleet PUE 1.09 in 2025. Quotes Uptime Institute 2025: global average PUE 1.54.' },
    { id: 'S17', title: 'AWS Cloud sustainability', organisation: 'Amazon', date: 'read 20 Nov 2026 (2025 report)', url: 'https://sustainability.aboutamazon.com/products-services/aws-cloud', figure: 'Average global PUE 1.14 in 2025.' },
    { id: 'S18', title: 'Anthropic and Amazon expand compute partnership / Google and Broadcom partnership', organisation: 'Anthropic', date: '20 Apr 2026 and 6 Apr 2026', url: 'https://www.anthropic.com/news/anthropic-amazon-compute', extraUrl: 'https://www.anthropic.com/news/google-broadcom-partnership-compute', figure: 'Claude is trained and served on AWS Trainium, Google TPUs and NVIDIA GPUs.' },
    { id: 'S19', title: 'AI data centres directory: Anthropic–Amazon New Carlisle', organisation: 'Epoch AI', date: 'updated 2 Aug 2026', url: 'https://epoch.ai/data/ai-data-centers/directory/anthropic-amazon-new-carlisle', figure: 'Project Rainier’s main campus is in New Carlisle, Indiana.' },
    { id: 'S20', title: 'eGRID summary data (eGRID2023)', organisation: 'US Environmental Protection Agency', date: '15 Jan 2025, rev. 12 Jun 2025', url: 'https://www.epa.gov/egrid/summary-data', figure: 'US average 349.7, RFC West 415.5, California (CAMX) 195.0 gCO2e/kWh (derived from lb/MWh).' },
    { id: 'S21', title: 'Greenhouse gas reporting: conversion factors 2025', organisation: 'UK Department for Energy Security and Net Zero', date: '10 Jun 2025', url: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025', figure: 'UK electricity 0.177 kgCO2e/kWh; average petrol car 0.16272 kgCO2e/km.' },
    { id: 'S22', title: 'Review of typical domestic consumption values: decision', organisation: 'Ofgem', date: '27 May 2026', url: 'https://www.ofgem.gov.uk/sites/default/files/2026-05/Review%20of%20typical%20domestic%20consumption%20values%20decision.pdf', figure: 'Typical GB household electricity: medium 2,500 kWh a year.' }
  ];

  var RESEARCH_DATE = '20 November 2026';

  /* ---------- helpers ---------- */

  function isObject(x) {
    return x !== null && typeof x === 'object';
  }

  function checkNonNegative(x, name) {
    if (typeof x !== 'number' || !isFinite(x) || x < 0) {
      throw new RangeError(name + ' must be a finite number ≥ 0 (got ' + x + ')');
    }
  }

  function checkShareUsed(shareUsed) {
    checkNonNegative(shareUsed, 'shareUsed');
    if (shareUsed > 1) {
      throw new RangeError('shareUsed must be between 0 and 1 (got ' + shareUsed + ')');
    }
  }

  function isRange(x) {
    return isObject(x) && 'low' in x && 'central' in x && 'high' in x;
  }

  /* A value given as a number applies at every level (an override); a value
   * given as {low, central, high} gives a different value at each level. */
  function pickLevel(value, level) {
    return isRange(value) ? value[level] : value;
  }

  function sumTokens(tokensByType) {
    var total = 0;
    TOKEN_TYPES.forEach(function (t) { total += tokensByType[t] || 0; });
    return total;
  }

  /* ---------- the formulas (PLAN.md section 3a) ---------- */

  // True when every share is a finite number >= 0 and they sum to 1.
  function validateMix(mix) {
    if (!isObject(mix)) return false;
    var sum = 0;
    for (var i = 0; i < TOKEN_TYPES.length; i++) {
      var s = mix[TOKEN_TYPES[i]];
      if (typeof s !== 'number' || !isFinite(s) || s < 0) return false;
      sum += s;
    }
    return Math.abs(sum - 1) <= 1e-9;
  }

  // Formula 1: tokens_t = totalTokens x share_t x shareUsed.
  function splitTokens(total, mix, shareUsed) {
    if (shareUsed === undefined) shareUsed = 1;
    checkNonNegative(total, 'total');
    checkShareUsed(shareUsed);
    if (!validateMix(mix)) throw new RangeError('mix shares must be ≥ 0 and sum to 1');
    var out = {};
    TOKEN_TYPES.forEach(function (t) { out[t] = total * mix[t] * shareUsed; });
    return out;
  }

  // The shares implied by a set of token counts; null when there are no tokens.
  function mixFromTokens(tokensByType) {
    var total = sumTokens(tokensByType);
    if (total === 0) return null;
    var mix = {};
    TOKEN_TYPES.forEach(function (t) { mix[t] = (tokensByType[t] || 0) / total; });
    return mix;
  }

  // Formula 2: serverWh = sum_t (tokens_t / 1e6) x whPerMTok_t x modelMultiplier.
  function serverEnergyWh(tokensByType, whPerMTok, modelMultiplier) {
    if (modelMultiplier === undefined) modelMultiplier = 1;
    checkNonNegative(modelMultiplier, 'modelMultiplier');
    var wh = 0;
    TOKEN_TYPES.forEach(function (t) {
      var n = tokensByType[t] || 0;
      checkNonNegative(n, 'tokens.' + t);
      checkNonNegative(whPerMTok[t], 'whPerMTok.' + t);
      wh += (n / 1e6) * whPerMTok[t] * modelMultiplier;
    });
    return wh;
  }

  // Formula 3: kWh = serverWh x PUE / 1000.
  function dataCentreKWh(serverWh, pue) {
    checkNonNegative(serverWh, 'serverWh');
    checkNonNegative(pue, 'pue');
    return serverWh * pue / 1000;
  }

  // Formula 4: kgCO2e = kWh x grid (g/kWh) / 1000.
  function emissionsKg(kWh, gridGPerKWh) {
    checkNonNegative(kWh, 'kWh');
    checkNonNegative(gridGPerKWh, 'gridIntensity');
    return kWh * gridGPerKWh / 1000;
  }

  // Formula 5: embodied kg = kWh x embodied g/kWh / 1000.
  function embodiedKg(kWh, gPerKWh) {
    checkNonNegative(kWh, 'kWh');
    checkNonNegative(gPerKWh, 'embodiedGPerKWh');
    return kWh * gPerKWh / 1000;
  }

  // Formula 6: blended data-centre Wh and gCO2e per million tokens for a mix,
  // plus data-centre Wh per million tokens of each type.
  function perMillionTokens(mix, whPerMTok, modelMultiplier, pue, grid) {
    if (modelMultiplier === undefined) modelMultiplier = 1;
    if (pue === undefined) pue = 1;
    if (grid === undefined) grid = 0;
    var byType = {};
    var wh = 0;
    TOKEN_TYPES.forEach(function (t) {
      byType[t] = whPerMTok[t] * modelMultiplier * pue;
      wh += mix[t] * byType[t];
    });
    return { wh: wh, gCO2e: wh * grid / 1000, byType: byType };
  }

  /* ---------- scenarios ---------- */

  /*
   * Turn user inputs into concrete values for one level ('low', 'central'
   * or 'high'). Any parameter the user has set (a plain number, or a mix
   * object) is an override and applies at every level; anything not set
   * takes that level's value from PARAMS.
   *
   * inputs (all optional):
   *   tokensByType   custom counts by type; when given, totalTokens, mix and
   *                  shareUsed are ignored
   *   planId         'pro' | 'max' | 'ultra' (used when totalTokens is absent)
   *   totalTokens    number (override) or {low, central, high}
   *   shareUsed      0..1, default 1
   *   mix            shares object, or 'low' | 'central' | 'high' for a named
   *                  mix at every level; absent = the mix range
   *   whPerMTok      partial {input, cacheWrite, cacheRead, output} overrides
   *   pue, gridIntensity   number overrides
   *   model          'opus' | 'sonnet' | 'haiku', or modelMultiplier (number)
   *   includeEmbodied, embodiedGPerKWh
   */
  function resolveInputs(inputs, level) {
    inputs = inputs || {};
    level = level || 'central';
    if (LEVELS.indexOf(level) < 0) throw new RangeError('unknown level ' + level);

    var c = { level: level };

    if (inputs.tokensByType) {
      c.tokensByType = {};
      TOKEN_TYPES.forEach(function (t) {
        var n = inputs.tokensByType[t] || 0;
        checkNonNegative(n, 'tokensByType.' + t);
        c.tokensByType[t] = n;
      });
      c.custom = true;
    } else {
      var total = inputs.totalTokens;
      if (total === undefined) {
        var planId = inputs.planId || DEFAULT_PLAN;
        if (!PLANS[planId]) throw new RangeError('unknown plan ' + planId);
        total = PLANS[planId].tokens;
      }
      c.totalTokens = pickLevel(total, level);
      c.shareUsed = inputs.shareUsed === undefined ? PARAMS.shareUsed : inputs.shareUsed;
      var mix = inputs.mix;
      if (mix === undefined || mix === null) mix = PARAMS.mix[level];
      else if (typeof mix === 'string') {
        if (!PARAMS.mix[mix]) throw new RangeError('unknown mix ' + mix);
        mix = PARAMS.mix[mix];
      }
      c.mix = mix;
      c.custom = false;
    }

    c.whPerMTok = {};
    var wOver = inputs.whPerMTok || {};
    TOKEN_TYPES.forEach(function (t) {
      c.whPerMTok[t] = wOver[t] !== undefined && wOver[t] !== null ? wOver[t] : PARAMS.whPerMTok[t][level];
    });

    c.pue = inputs.pue !== undefined && inputs.pue !== null ? inputs.pue : PARAMS.pue[level];
    c.gridIntensity = inputs.gridIntensity !== undefined && inputs.gridIntensity !== null ? inputs.gridIntensity : PARAMS.gridIntensity[level];

    if (typeof inputs.modelMultiplier === 'number') c.modelMultiplier = inputs.modelMultiplier;
    else {
      var model = inputs.model || 'opus';
      if (!(model in PARAMS.modelMultipliers)) throw new RangeError('unknown model ' + model);
      c.modelMultiplier = PARAMS.modelMultipliers[model];
    }

    c.includeEmbodied = !!inputs.includeEmbodied;
    c.embodiedGPerKWh = inputs.embodiedGPerKWh !== undefined ? inputs.embodiedGPerKWh : PARAMS.embodiedGPerKWh;
    return c;
  }

  // Run formulas 1 to 6 on concrete values from resolveInputs.
  function computeConcrete(c) {
    var tokensByType = c.tokensByType ? c.tokensByType : splitTokens(c.totalTokens, c.mix, c.shareUsed);
    var serverWh = serverEnergyWh(tokensByType, c.whPerMTok, c.modelMultiplier);
    var kWh = dataCentreKWh(serverWh, c.pue);
    var kg = emissionsKg(kWh, c.gridIntensity);
    var emb = c.includeEmbodied ? embodiedKg(kWh, c.embodiedGPerKWh) : 0;

    var byTypeKWh = {};
    TOKEN_TYPES.forEach(function (t) {
      var single = {};
      single[t] = tokensByType[t];
      byTypeKWh[t] = dataCentreKWh(serverEnergyWh(single, c.whPerMTok, c.modelMultiplier), c.pue);
    });

    var mix = c.tokensByType ? mixFromTokens(tokensByType) : c.mix;
    return {
      level: c.level,
      tokensByType: tokensByType,
      totalTokens: sumTokens(tokensByType),
      mix: mix,
      serverWh: serverWh,
      kWh: kWh,
      kgCO2e: kg,
      embodiedKg: emb,
      totalKgCO2e: kg + emb,
      byTypeKWh: byTypeKWh,
      perMTok: mix ? perMillionTokens(mix, c.whPerMTok, c.modelMultiplier, c.pue, c.gridIntensity) : null,
      params: {
        whPerMTok: c.whPerMTok,
        modelMultiplier: c.modelMultiplier,
        pue: c.pue,
        gridIntensity: c.gridIntensity
      }
    };
  }

  // A single estimate at one level (default central).
  function estimate(inputs, level) {
    return computeConcrete(resolveInputs(inputs, level || 'central'));
  }

  // Low, central and high estimates, each with every parameter the user has
  // not overridden at that level's value.
  function estimateRange(inputs) {
    return {
      low: estimate(inputs, 'low'),
      central: estimate(inputs, 'central'),
      high: estimate(inputs, 'high')
    };
  }

  // estimateRange for a plan preset. options as for resolveInputs.
  function planScenario(planId, options) {
    if (!PLANS[planId]) throw new RangeError('unknown plan ' + planId);
    var inputs = {};
    var o = options || {};
    Object.keys(o).forEach(function (k) { inputs[k] = o[k]; });
    inputs.planId = planId;
    delete inputs.tokensByType;
    return estimateRange(inputs);
  }

  // Everyday comparisons for an amount of electricity and emissions.
  function comparisons(kWh, kgCO2e) {
    checkNonNegative(kWh, 'kWh');
    checkNonNegative(kgCO2e, 'kgCO2e');
    return {
      kettleBoils: kWh / COMPARISONS.kettleKWh,
      homeDays: kWh / COMPARISONS.ukHomeKWhPerDay,
      carMiles: kgCO2e / COMPARISONS.petrolCarKgPerMile,
      ukGridKg: kWh * COMPARISONS.ukGridKgPerKWh,
      geminiPrompts: kWh * 1000 / COMPARISONS.geminiPromptWh
    };
  }

  /*
   * One-at-a-time sensitivity (PLAN.md section 4b): start from the central
   * estimate for these inputs, then move one parameter at a time to its low
   * and high value (overridden parameters have low = high, so they show no
   * spread). Rows are sorted by the spread in kg CO2e, largest first.
   */
  var SENSITIVITY_PARAMS = [
    { id: 'cacheRead', label: 'Cache-read energy' },
    { id: 'tokens', label: 'Weekly tokens' },
    { id: 'cacheWrite', label: 'Cache-write energy' },
    { id: 'mix', label: 'Token mix' },
    { id: 'output', label: 'Output energy' },
    { id: 'pue', label: 'PUE (data-centre overhead)' },
    { id: 'gridIntensity', label: 'Grid intensity' },
    { id: 'input', label: 'Fresh-input energy' }
  ];

  function sensitivity(inputs) {
    var lo = resolveInputs(inputs, 'low');
    var ce = resolveInputs(inputs, 'central');
    var hi = resolveInputs(inputs, 'high');
    var base = computeConcrete(ce);

    function withParam(id, from) {
      var c = {};
      Object.keys(ce).forEach(function (k) { c[k] = ce[k]; });
      c.whPerMTok = {};
      TOKEN_TYPES.forEach(function (t) { c.whPerMTok[t] = ce.whPerMTok[t]; });
      if (TOKEN_TYPES.indexOf(id) >= 0) c.whPerMTok[id] = from.whPerMTok[id];
      else if (id === 'tokens') c.totalTokens = from.totalTokens;
      else c[id] = from[id];
      return computeConcrete(c);
    }

    var rows = SENSITIVITY_PARAMS.map(function (p) {
      var l = withParam(p.id, lo);
      var h = withParam(p.id, hi);
      return {
        id: p.id,
        label: p.label,
        low: { kWh: l.kWh, kgCO2e: l.totalKgCO2e },
        high: { kWh: h.kWh, kgCO2e: h.totalKgCO2e },
        spreadKg: h.totalKgCO2e - l.totalKgCO2e,
        varies: h.totalKgCO2e !== l.totalKgCO2e
      };
    });
    rows.sort(function (a, b) { return b.spreadKg - a.spreadKg; });
    return { central: { kWh: base.kWh, kgCO2e: base.totalKgCO2e }, rows: rows };
  }

  /* ---------- rounding for display ---------- */

  // Round to a number of significant figures (default 2).
  function roundSig(x, sig) {
    if (sig === undefined) sig = 2;
    if (x === 0 || !isFinite(x)) return x;
    return Number(x.toPrecision(sig));
  }

  // Round to significant figures and format with thousands separators.
  function formatSig(x, sig) {
    var r = roundSig(x, sig);
    if (!isFinite(r)) return String(r);
    var abs = Math.abs(r);
    var decimals = abs === 0 ? 0 : Math.max(0, (sig === undefined ? 2 : sig) - 1 - Math.floor(Math.log10(abs)));
    return r.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: Math.min(decimals, 20) });
  }

  return {
    TOKEN_TYPES: TOKEN_TYPES,
    TOKEN_TYPE_LABELS: TOKEN_TYPE_LABELS,
    LEVELS: LEVELS,
    PARAMS: PARAMS,
    MODELS: MODELS,
    MIX_LABELS: MIX_LABELS,
    PLANS: PLANS,
    DEFAULT_PLAN: DEFAULT_PLAN,
    PUE_PRESETS: PUE_PRESETS,
    GRID_PRESETS: GRID_PRESETS,
    COMPARISONS: COMPARISONS,
    SOURCES: SOURCES,
    RESEARCH_DATE: RESEARCH_DATE,
    SENSITIVITY_PARAMS: SENSITIVITY_PARAMS,
    validateMix: validateMix,
    splitTokens: splitTokens,
    mixFromTokens: mixFromTokens,
    serverEnergyWh: serverEnergyWh,
    dataCentreKWh: dataCentreKWh,
    emissionsKg: emissionsKg,
    embodiedKg: embodiedKg,
    perMillionTokens: perMillionTokens,
    resolveInputs: resolveInputs,
    estimate: estimate,
    estimateRange: estimateRange,
    planScenario: planScenario,
    comparisons: comparisons,
    sensitivity: sensitivity,
    roundSig: roundSig,
    formatSig: formatSig
  };
});
