/*
 * UI wiring for the energy and carbon page: reads the controls, calls
 * window.CarbonModel, writes the results. No estimation maths here; that is
 * all in model.js. Classic script, loaded after model.js.
 *
 * Every element is looked up with byId('literal-id') so that
 * tests/page.test.js can check each id exists in index.html.
 */
(function () {
  'use strict';

  var M = window.CarbonModel;
  var doc = window.document;
  var T = M.TOKEN_TYPES;

  function byId(id) {
    var el = doc.getElementById(id);
    if (!el) throw new Error('index.html has no element #' + id);
    return el;
  }

  var el = {
    form: byId('controls'),
    plan: { pro: byId('plan-pro'), max: byId('plan-max'), ultra: byId('plan-ultra'), custom: byId('plan-custom') },
    customTokens: byId('custom-tokens'),
    tok: { input: byId('tok-input'), cacheWrite: byId('tok-cacheWrite'), cacheRead: byId('tok-cacheRead'), output: byId('tok-output') },
    customTotal: byId('custom-total'),
    fillTotal: byId('fill-total'),
    fillMix: byId('fill-mix'),
    fillButton: byId('fill-button'),
    shareGroup: byId('share-group'),
    share: byId('share-used'),
    shareValue: byId('share-used-value'),
    mixGroup: byId('mix-group'),
    mixSelect: byId('mix-select'),
    mixCustom: byId('mix-custom'),
    mix: { input: byId('mix-input'), cacheWrite: byId('mix-cacheWrite'), cacheRead: byId('mix-cacheRead'), output: byId('mix-output') },
    mixSum: byId('mix-sum'),
    model: byId('model-select'),
    advanced: byId('advanced'),
    wh: { input: byId('wh-input'), cacheWrite: byId('wh-cacheWrite'), cacheRead: byId('wh-cacheRead'), output: byId('wh-output') },
    whHint: { input: byId('hint-wh-input'), cacheWrite: byId('hint-wh-cacheWrite'), cacheRead: byId('hint-wh-cacheRead'), output: byId('hint-wh-output') },
    pueSelect: byId('pue-select'),
    pueCustomLabel: byId('pue-custom-label'),
    pueCustom: byId('pue-custom'),
    gridSelect: byId('grid-select'),
    gridCustomLabel: byId('grid-custom-label'),
    gridCustom: byId('grid-custom'),
    embodied: byId('embodied-toggle'),
    reset: byId('reset-button'),
    errors: byId('form-errors'),
    overrides: byId('overrides'),
    context: byId('hl-context'),
    kwhLabel: byId('hl-kwh-label'),
    kgLabel: byId('hl-kg-label'),
    kwh: byId('hl-kwh'),
    kwhRange: byId('hl-kwh-range'),
    kg: byId('hl-kg'),
    kgRange: byId('hl-kg-range'),
    words: byId('hl-words'),
    detail: byId('detail-body'),
    permtok: byId('permtok-body'),
    breakdownNote: byId('breakdown-note'),
    breakdown: byId('breakdown-body'),
    comparisons: byId('comparisons-body'),
    drivers: byId('drivers-body')
  };

  /* ---------- formatting ---------- */

  var fmt = M.formatSig;
  var DASH = ' – ';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmt3(x) { return fmt(x, 3); }

  function pct(share) {
    if (share === null || share === undefined || !isFinite(share)) return '–';
    return fmt(share * 100, 2) + '%';
  }

  function tokensText(n) {
    if (n >= 1e9) return fmt(n / 1e9, 3) + ' billion';
    if (n >= 1e6) return fmt(n / 1e6, 3) + ' million';
    return fmt(n, 3);
  }

  function planName(id) {
    var p = M.PLANS[id];
    return p.label + (p.formerly ? ' (formerly ' + p.formerly + ')' : '');
  }

  function row(label, cells, cls) {
    return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th scope="row">' + esc(label) + '</th>' +
      cells.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
  }

  function lch(range, f) {
    return [f(range.low), f(range.central), f(range.high)];
  }

  /* ---------- reading the controls ---------- */

  function num(input) {
    var s = String(input.value).trim();
    if (s === '') return NaN;
    return Number(s);
  }

  function selectedPlan() {
    var ids = ['pro', 'max', 'ultra', 'custom'];
    for (var i = 0; i < ids.length; i++) if (el.plan[ids[i]].checked) return ids[i];
    return M.DEFAULT_PLAN;
  }

  // Returns { inputs, overrides: [text], errors: [text], plan, shareUsed }.
  function readState() {
    var errors = [];
    var overrides = [];
    var inputs = {};
    var plan = selectedPlan();

    if (plan === 'custom') {
      inputs.tokensByType = {};
      T.forEach(function (t) {
        var v = num(el.tok[t]);
        if (String(el.tok[t].value).trim() === '') v = 0;
        var bad = !isFinite(v) || v < 0;
        setInvalid(el.tok[t], bad);
        if (bad) { errors.push(M.TOKEN_TYPE_LABELS[t] + ' tokens must be a number of 0 or more; using 0.'); v = 0; }
        inputs.tokensByType[t] = v * 1e6;
      });
    } else {
      inputs.planId = plan;
      inputs.shareUsed = Number(el.share.value) / 100;

      var mixMode = el.mixSelect.value;
      if (mixMode === 'custom') {
        var shares = {};
        var sum = 0;
        var mixBad = false;
        T.forEach(function (t) {
          var v = num(el.mix[t]);
          var bad = !isFinite(v) || v < 0;
          setInvalid(el.mix[t], bad);
          if (bad) mixBad = true;
          shares[t] = v;
          sum += v;
        });
        if (!mixBad && Math.abs(sum - 100) < 1e-6) {
          T.forEach(function (t) { shares[t] = shares[t] / sum; });
          inputs.mix = shares;
          overrides.push('token mix (your shares)');
          el.mixSum.textContent = 'The shares add up to 100%.';
        } else {
          var msg = mixBad ? 'Each share must be a number of 0 or more.' :
            'The shares add up to ' + fmt(sum, 4) + '%, not 100%.';
          el.mixSum.textContent = msg;
          errors.push('Token mix: ' + msg + ' Using the default mix range until this is fixed.');
        }
      } else {
        T.forEach(function (t) { setInvalid(el.mix[t], false); });
        if (mixMode !== 'range') {
          inputs.mix = mixMode;
          overrides.push('token mix (' + M.MIX_LABELS[mixMode].toLowerCase() + ')');
        }
      }
    }

    inputs.model = el.model.value;

    var wh = {};
    T.forEach(function (t) {
      var v = num(el.wh[t]);
      var central = M.PARAMS.whPerMTok[t].central;
      var bad = !isFinite(v) || v < 0;
      setInvalid(el.wh[t], bad);
      if (bad) {
        errors.push(M.TOKEN_TYPE_LABELS[t] + ' energy must be a number of 0 or more; using the default range.');
      } else if (v !== central) {
        wh[t] = v;
        overrides.push(M.TOKEN_TYPE_LABELS[t].toLowerCase() + ' energy (' + fmt(v, 4) + ' Wh per million tokens)');
      }
      el.wh[t].classList.toggle('overridden', !bad && v !== central);
    });
    inputs.whPerMTok = wh;

    var pue = readChoice(el.pueSelect, el.pueCustom, 1, 'PUE', 'PUE must be a number of 1 or more; using the default range.', errors);
    if (pue !== null) { inputs.pue = pue; overrides.push('PUE (' + fmt(pue, 4) + ')'); }

    var grid = readChoice(el.gridSelect, el.gridCustom, 0, 'grid', 'Grid intensity must be a number of 0 or more; using the default range.', errors);
    if (grid !== null) { inputs.gridIntensity = grid; overrides.push('grid intensity (' + fmt(grid, 4) + ' g CO2e per kWh)'); }

    inputs.includeEmbodied = el.embodied.checked;

    return { inputs: inputs, overrides: overrides, errors: errors, plan: plan };
  }

  // A select whose value is 'range', a preset number, or 'custom' (read the box).
  function readChoice(select, customBox, min, name, errorText, errors) {
    var v = select.value;
    setInvalid(customBox, false);
    if (v === 'range') return null;
    if (v === 'custom') {
      var n = num(customBox);
      if (!isFinite(n) || n < min) {
        setInvalid(customBox, true);
        errors.push(errorText);
        return null;
      }
      return n;
    }
    return Number(v);
  }

  function setInvalid(input, bad) {
    if (bad) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  /* ---------- writing the results ---------- */

  function render() {
    var plan = selectedPlan();
    var isCustom = plan === 'custom';

    // Show and hide the controls that apply.
    el.customTokens.hidden = !isCustom;
    el.shareGroup.hidden = isCustom;
    el.mixGroup.hidden = isCustom;
    el.mixCustom.hidden = el.mixSelect.value !== 'custom';
    el.mixSum.hidden = el.mixSelect.value !== 'custom';
    el.pueCustomLabel.hidden = el.pueSelect.value !== 'custom';
    el.gridCustomLabel.hidden = el.gridSelect.value !== 'custom';
    el.shareValue.textContent = el.share.value + '%';

    var state = readState();
    var range = M.estimateRange(state.inputs);
    var c = range.central;

    if (isCustom) {
      el.customTotal.textContent = fmt(c.totalTokens / 1e6, 4);
    }

    // Errors and overrides.
    el.errors.hidden = state.errors.length === 0;
    el.errors.innerHTML = state.errors.length ?
      '<p>Some entries could not be used:</p><ul>' + state.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '';
    el.overrides.textContent = state.overrides.length ?
      'You have set: ' + state.overrides.join('; ') + '. The low, central and high results all use your values for these; everything else keeps its own range.' :
      'Using the default ranges for every parameter.';

    // Headline.
    var modelText = { opus: 'Opus-class', sonnet: 'Sonnet-class', haiku: 'Haiku-class' }[state.inputs.model] + ' model';
    if (isCustom) {
      el.context.textContent = 'The tokens you entered (' + tokensText(c.totalTokens) + ' in total), ' + modelText + '.';
    } else {
      el.context.textContent = 'A full week of ' + planName(plan) + ', with ' + el.share.value +
        '% of the weekly limit used, ' + modelText + '.';
    }
    var period = isCustom ? '' : ' a week';
    el.kwhLabel.textContent = 'Electricity' + period;
    el.kgLabel.textContent = 'Emissions' + period + (state.inputs.includeEmbodied ? ', including embodied hardware' : '');
    el.kwh.textContent = fmt(c.kWh);
    el.kwhRange.textContent = fmt(range.low.kWh) + DASH + fmt(range.high.kWh);
    el.kg.textContent = fmt(c.totalKgCO2e);
    el.kgRange.textContent = fmt(range.low.totalKgCO2e) + DASH + fmt(range.high.totalKgCO2e);

    var cc = M.comparisons(c.kWh, c.totalKgCO2e);
    el.words.textContent = 'About ' + fmt(c.kWh) + ' kWh is roughly ' + fmt(cc.homeDays) +
      ' days of a typical GB home’s electricity, or ' + fmt(cc.kettleBoils) + ' one-litre kettle boils. About ' +
      fmt(c.totalKgCO2e) + ' kg CO2e is like driving an average petrol car ' + fmt(cc.carMiles) + ' miles.';

    renderDetail(range, state.inputs.includeEmbodied);
    renderPerMTok(range);
    renderBreakdown(c);
    renderComparisons(range);
    renderDrivers(state.inputs, isCustom);
  }

  function renderDetail(range, embodied) {
    var rows = [
      row('Tokens', lch(range, function (r) { return tokensText(r.totalTokens); })),
      row('Server energy (kWh)', lch(range, function (r) { return fmt3(r.serverWh / 1000); })),
      row('Data-centre electricity, after PUE (kWh)', lch(range, function (r) { return fmt3(r.kWh); })),
      row('Operational emissions (kg CO2e)', lch(range, function (r) { return fmt3(r.kgCO2e); }))
    ];
    if (embodied) {
      rows.push(row('Embodied hardware emissions (kg CO2e)', lch(range, function (r) { return fmt3(r.embodiedKg); })));
      rows.push(row('Total emissions (kg CO2e)', lch(range, function (r) { return fmt3(r.totalKgCO2e); })));
    }
    rows.push(row('PUE used', lch(range, function (r) { return fmt(r.params.pue, 4); })));
    rows.push(row('Grid intensity used (g CO2e/kWh)', lch(range, function (r) { return fmt(r.params.gridIntensity, 4); })));
    el.detail.innerHTML = rows.join('');
  }

  function renderPerMTok(range) {
    function cell(f) {
      return lch(range, function (r) { return r.perMTok ? f(r.perMTok) : '–'; });
    }
    var rows = [
      row('Blended mix (Wh)', cell(function (p) { return fmt3(p.wh); })),
      row('Blended mix (g CO2e)', cell(function (p) { return fmt3(p.gCO2e); }))
    ];
    T.forEach(function (t) {
      // Per-type figures don't depend on the mix, so show them even with no tokens.
      rows.push(row(M.TOKEN_TYPE_LABELS[t] + ' (Wh)', lch(range, function (r) {
        return fmt3(r.params.whPerMTok[t] * r.params.modelMultiplier * r.params.pue);
      })));
    });
    el.permtok.innerHTML = rows.join('');
  }

  var BREAKDOWN_ORDER = ['cacheRead', 'cacheWrite', 'output', 'input'];

  function renderBreakdown(c) {
    var total = c.kWh;
    var tokTotal = c.totalTokens;
    var max = 0;
    BREAKDOWN_ORDER.forEach(function (t) { if (c.byTypeKWh[t] > max) max = c.byTypeKWh[t]; });
    el.breakdown.innerHTML = BREAKDOWN_ORDER.map(function (t) {
      var kwh = c.byTypeKWh[t];
      var tokShare = tokTotal > 0 ? c.tokensByType[t] / tokTotal : null;
      var eShare = total > 0 ? kwh / total : null;
      var width = max > 0 ? (kwh / max) * 100 : 0;
      var label = M.TOKEN_TYPE_LABELS[t];
      var title = label + ': ' + fmt3(kwh) + ' kWh, ' + pct(eShare) + ' of the energy, ' + pct(tokShare) + ' of the tokens';
      return '<tr' + (t === 'cacheRead' ? ' class="highlight"' : '') + '><th scope="row">' + esc(label) + '</th>' +
        '<td>' + esc(pct(tokShare)) + '</td><td>' + esc(fmt3(kwh)) + '</td><td>' + esc(pct(eShare)) + '</td>' +
        '<td class="bar-col"><span class="bar-track" title="' + esc(title) + '"><span class="bar" style="width:' +
        width.toFixed(2) + '%"></span></span></td></tr>';
    }).join('');
    var cr = c.byTypeKWh.cacheRead;
    el.breakdownNote.textContent = (tokTotal > 0 && total > 0) ?
      'Cache reads are ' + pct(c.tokensByType.cacheRead / tokTotal) + ' of tokens and ' + pct(cr / total) + ' of the energy.' :
      'There are no tokens, so there is no energy to break down.';
  }

  function renderComparisons(range) {
    var cmp = {
      low: M.comparisons(range.low.kWh, range.low.totalKgCO2e),
      central: M.comparisons(range.central.kWh, range.central.totalKgCO2e),
      high: M.comparisons(range.high.kWh, range.high.totalKgCO2e)
    };
    function cells(key) { return lch(cmp, function (x) { return fmt(x[key]); }); }
    var k = M.COMPARISONS;
    el.comparisons.innerHTML = [
      row('One-litre kettle boils (' + fmt(k.kettleKWh) + ' kWh each)', cells('kettleBoils')),
      row('Days of a typical GB home’s electricity (' + fmt(k.ukHomeKWhPerDay, 3) + ' kWh a day)', cells('homeDays')),
      row('Miles in an average petrol car (' + fmt(k.petrolCarKgPerMile, 3) + ' kg CO2e a mile)', cells('carMiles')),
      row('The same electricity on the UK grid (kg CO2e at ' + fmt(k.ukGridKgPerKWh * 1000, 3) + ' g/kWh)', cells('ukGridKg')),
      row('Median Gemini text prompts (' + fmt(k.geminiPromptWh) + ' Wh each)', cells('geminiPrompts'))
    ].join('');
  }

  function renderDrivers(inputs, isCustom) {
    var s = M.sensitivity(inputs);
    var max = 0;
    s.rows.forEach(function (r) { if (r.high.kgCO2e > max) max = r.high.kgCO2e; });
    var centralPos = max > 0 ? (s.central.kgCO2e / max) * 100 : 0;
    el.drivers.innerHTML = s.rows.map(function (r) {
      var label = r.id === 'tokens' && isCustom ? 'Tokens' : r.label;
      var bar;
      if (!r.varies) {
        var why = (r.id === 'tokens' || r.id === 'mix') && isCustom ? 'fixed by your token counts' : 'set by you';
        bar = '<span class="no-spread">No spread: ' + why + '</span>';
      } else {
        var left = max > 0 ? (r.low.kgCO2e / max) * 100 : 0;
        var width = max > 0 ? ((r.high.kgCO2e - r.low.kgCO2e) / max) * 100 : 0;
        var title = label + ': ' + fmt3(r.low.kgCO2e) + DASH + fmt3(r.high.kgCO2e) + ' kg CO2e';
        bar = '<span class="bar-track range-track" title="' + esc(title) + '">' +
          '<span class="range-bar" style="left:' + left.toFixed(2) + '%;width:' + Math.max(width, 0.5).toFixed(2) + '%"></span>' +
          '<span class="central-tick" style="left:' + centralPos.toFixed(2) + '%"></span></span>';
      }
      return '<tr><th scope="row">' + esc(label) + '</th>' +
        '<td>' + esc(fmt3(r.low.kWh) + DASH + fmt3(r.high.kWh)) + '</td>' +
        '<td>' + esc(fmt3(r.low.kgCO2e) + DASH + fmt3(r.high.kgCO2e)) + '</td>' +
        '<td class="bar-col">' + bar + '</td></tr>';
    }).join('');
  }

  /* ---------- defaults, helpers and events ---------- */

  function fillCustom(totalMillions, mixId) {
    var mix = M.PARAMS.mix[mixId];
    var split = M.splitTokens(totalMillions, mix);
    T.forEach(function (t) { el.tok[t].value = String(M.roundSig(split[t], 6)); });
  }

  function resetToDefaults() {
    el.plan.max.checked = true;
    el.plan.pro.checked = false;
    el.plan.ultra.checked = false;
    el.plan.custom.checked = false;
    el.share.value = '100';
    el.mixSelect.value = 'range';
    T.forEach(function (t) {
      el.mix[t].value = String(M.roundSig(M.PARAMS.mix.central[t] * 100, 6));
      el.wh[t].value = String(M.PARAMS.whPerMTok[t].central);
    });
    el.fillTotal.value = String(M.PLANS.max.tokens.central / 1e6);
    el.fillMix.value = 'central';
    fillCustom(M.PLANS.max.tokens.central / 1e6, 'central');
    el.model.value = 'opus';
    el.pueSelect.value = 'range';
    el.pueCustom.value = '1.2';
    el.gridSelect.value = 'range';
    el.gridCustom.value = '200';
    el.embodied.checked = false;
    el.advanced.open = false;
  }

  function init() {
    T.forEach(function (t) {
      var r = M.PARAMS.whPerMTok[t];
      el.whHint[t].textContent = 'low ' + fmt(r.low, 4) + ', high ' + fmt(r.high, 4);
    });
    resetToDefaults();

    el.form.addEventListener('input', render);
    el.form.addEventListener('change', render);
    el.reset.addEventListener('click', function () { resetToDefaults(); render(); });
    el.fillButton.addEventListener('click', function () {
      var total = num(el.fillTotal);
      var bad = !isFinite(total) || total < 0;
      setInvalid(el.fillTotal, bad);
      if (!bad) fillCustom(total, el.fillMix.value);
      render();
    });
    render();
  }

  init();
})();
