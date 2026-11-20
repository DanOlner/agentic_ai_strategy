# Review of the Claude Code energy and carbon estimator

Reviewed on 20 November 2026, before publication. The review covered `PLAN.md`, `docs/` (the page, `model.js`, `app.js`, `style.css`) and `tests/`. It was run unattended, so the judgement calls are listed in "Decisions made without the owner" at the end.

In short: the arithmetic is right, and the page agrees with `PLAN.md` and the tests. Most of the published figures check out against their sources. The review found:

- one out-of-date source (UK conversion factors);
- one unsupported claim (a plan-rename date);
- a wrong article title;
- several figures quoted without the qualifiers their sources put on them;
- one place where the uncertainty was understated (the emissions spread);
- a phone-width layout bug;
- a grammar bug in the summary sentence.

All of these are fixed. Several modelling choices remain open and are listed with reasons in "What's still uncertain".

## 1. What was checked, and how

- **Sources.** All 22 sources in `PLAN.md` were re-fetched on 20 November 2026, and every figure the page or `model.js` uses was compared with the source text. The two PDFs (Ofgem, and the DESNZ 2026 methodology paper) were checked with `pdftotext`. The DESNZ 2026 flat-file spreadsheet was downloaded and the factors were read from it directly.
- **Maths.** The default Max week and the Pro week were worked by hand at low, central and high (section 3). The results were compared with `PLAN.md` section 4a, with `model.js`, and with what the page shows in a real browser.
- **The page.** It was loaded in headless Google Chrome (the installed Chrome, driven over the DevTools protocol), at desktop width and with mobile emulation at 320, 375 and 390 px, in light and dark mode. Every control was exercised, and console messages and exceptions were collected. The scripts are not in the repository; they were scratch work.
- **Tests.** The existing 62 tests were read for coverage. New tests were added for what was missing (section 6). As a check that the new tests bite, three of the fixed faults were briefly reintroduced, and each made the suite fail.

## 2. Numbers: each source against the page

"OK" means the figure as used matches the source. Corrections are in **bold**.

| # | Source | Verdict | Notes |
|---|--------|---------|-------|
| S1 | Climate Brink (Hausfather) | OK | 3.2B tokens, ~170 kWh (70 to 330), 96% cache reads, 0.4% output, cache reads at 10% of input (1% and 25%), 341 g/kWh: all verbatim. The B300 "quarter of the energy" claim is qualified in the source ("running at their lowest supported precision"); **PLAN.md now quotes the qualifier**. The post applies no PUE. |
| S2 | Couch | **Title wrong** | The post is titled "Electricity use of AI coding agents", not "Claude Code's environmental impact". **Fixed on the page, in `model.js` and in PLAN.md.** The figures (390, 1,950, 39, 490 Wh/MTok; median session 41 Wh) are right, but the 390 and 1,950 come from Epoch's 100k-token "maximum" context case. **That is now stated.** |
| S3 | Epoch AI | OK, qualified | 0.3 Wh, 100B active parameters, 500 output tokens and 10% utilisation are right. The 10k-token figure is "around 2.5 Wh" in the main text and 2.4 in the appendix; **both are now given**. "~1,500 W" is a peak ("up to"), scaled by a 70% power factor. |
| S4 | Google (Elsworth et al.) | OK | 0.24 Wh; 0.14 / 0.06 / 0.02 / 0.02 breakdown; 0.03 g (0.023 Scope 2 market-based + 0.010 Scope 1+3); 345 and 94 g/kWh; 1.72 scaling: all verbatim. The paper calls the Scope 1+3 part "the embodied emissions of the compute hardware", so the 42 g/kWh embodied ratio (0.010 / 0.24 Wh = 41.7) is used within what it measures. |
| S5 | Mistral | **Misquoted in PLAN.md** | 1.14 g, 45 mL and 0.16 mg Sb eq are right. The 20.4 kt is for Large 2 "after 18 months of usage" (training and use together), not training alone. **Corrected in PLAN.md**; the page does not use it. |
| S6 | Jegham et al. | OK, qualified | v6 (24 Nov 2025) is the latest version, and the Claude 3.7 Sonnet, Haiku and GPT-4o values match the table. The per-query energies **include PUE 1.14** and assume batch size 8; **now stated** on the page and in PLAN.md. See the open item on double-counting. |
| S7 | Luccioni et al. | OK | 0.047 kWh per 1,000 (Table 2) and 297.6 g/kWh (us-west-2) are right. The paper's own text says both "0.042" and "around 0.05"; the page uses neither in calculations. |
| S8 | claude-carbon | OK, quote fixed | 0.3 / 1.0 / 2.0 J per token, 0.1x and 1.25x, PUE 1.2 and 384 g are right. The "pricing ratios, not direct energy measurements" phrase is said of the cache weights, and the page's own accuracy claims differ ("2-4×" and "2-5×"). **PLAN.md corrected.** The J/token values are per token generally, so using their ratios as model-size multipliers is within what they measure. |
| S9 | Watershed | OK | "4 to 20 times" (attributed by Watershed to Oviedo et al., 2026), 32% to 56% and "roughly 30 times" are all verbatim. |
| S10 | IEA | OK | 415 TWh, 1.5% and 945 TWh in the Base Case are verbatim. The IEA has since published "Key Questions on Energy and AI" (April 2026); it was not checked, because this figure is context only. |
| S11 | Claude pricing | OK, qualified | Max $100 "5x Pro usage every 5 hours and every week" and Ultra $200 "10x Pro usage every week" are verbatim. Pro is $20 billed monthly or $17 billed annually; **the page now says "billed monthly"**. |
| S12 | Help centre | OK | "The Max 20x plan is now called the Ultra plan." and "10 times the Pro plan's usage every week" are verbatim. **Neither page gives a date for the rename.** The page's "renamed its plans on 30 October 2026" had no cited source, so **the date was removed**. |
| S13 | Wokey | OK | Every figure checks out (as of 16 Nov 2026). Max is still "Collecting (4 accounts)". Pro's cache-read share is 76%, not 75%; **fixed in PLAN.md**. |
| S14 | FinOps LLM | OK | ~1.9B (1.8 to 2.3B), Max 5x ≥ 1.3B ("cap never hit") and the Opus 5 mix are all right. The mix is from August 2026 (one month); **now stated**. Pro was not measured. |
| S15 | API pricing | OK | All Opus 5.5 and Sonnet 5.5 prices and multipliers are right, including the 0.05x cache-read footnote. |
| S16 | Google PUE | OK | 1.09 (2025) and Uptime's 1.54 are verbatim. Partial 2026 data on the same page (1.09 trailing twelve months, as of Q2) doesn't change the value. |
| S17 | AWS PUE | OK | 1.14 in 2025 and 1.15 in 2024 are verbatim. |
| S18 | Anthropic compute news | OK | Both quotes and dates are verbatim. |
| S19 | Epoch directory | **Date and wording wrong** | The page says "Updated Oct. 19, 2026", not 2 August, and calls New Carlisle "part of" Project Rainier, not its "main campus". **Fixed in both places.** |
| S20 | eGRID | OK | eGRID2023 is still EPA's current edition (no eGRID2024 found). The rates check out: 770.884, 916.054 and 429.983 lb/MWh, which convert to 349.7, 415.5 and 195.0 g/kWh. |
| S21 | DESNZ conversion factors | **Out of date** | The page used the 2025 edition (0.177 kg/kWh; petrol car 0.16272 kg/km). The **2026 edition** (11 June 2026; flat file revised 31 July 2026) gives **0.13096 kg/kWh** for UK electricity generated (2025 data) and **0.16152 kg/km** for the average petrol car. **Updated everywhere.** Part of the big drop in the electricity factor comes from a change of method (2026 uses 2025 data, skipping 2024), which the page now notes. The 2025 values were confirmed in Table 9 of the 2026 methodology paper, so they were quoted correctly; they were just superseded. |
| S22 | Ofgem | OK | 1,600 / 2,500 / 3,800 kWh (down from 1,800 / 2,700 / 4,100), published 27 May 2026 and in force from 1 July 2026: confirmed from the PDF. |
| — | Kettle | OK | 4.186 × 85 = 355.8 kJ = 0.0988 kWh; ÷ 0.9 = 0.110 kWh. |

### Figures used outside what they measure

These were checked specifically. Each is either within reason and labelled, or listed as open.

- **Per-query figures turned into per-token figures.**
  - Epoch: 0.3 Wh ÷ 500 output tokens = 600 Wh/MTok. This treats the whole query as output, which is reasonable because the query is mostly decode. It is labelled "derived".
  - Jegham: 0.950 Wh ÷ 300 output tokens ≈ 3,170 Wh/MTok. This puts the whole query, input included, down to output, and the figure already contains PUE. It is labelled as such on the page now, and listed as open item 1.
  - The checks against Epoch's long-input figures support the input energies: (2.5 − 0.3) Wh ÷ 10k tokens ≈ 220 Wh/MTok, close to the central 200, and 40 Wh ÷ 100k tokens = 400 Wh/MTok, which is the high.
- **Price ratios used as energy ratios** (output 5x, cache read 0.1x, cache write 1.25x, model multipliers). The page says so, and marks them as assumptions. Opus 5.5 now prices cache reads at 0.05x, not 0.1x. The model keeps 0.1x as central, which is within the stated 0.02 to 0.25 range.
- **Google per prompt.** Used only as a ratio (embodied g per operational kWh) and as a comparison ("median Gemini prompts"), never as a per-token figure. OK.
- **Mistral** gives lifecycle CO2e per response, with no kWh figure. It is used only as context and doesn't enter the maths. OK.
- **Climate Brink's 341 g/kWh** is described as "eGRID 2024", but EPA has not published eGRID2024. It is quoted as the source states it, and not used in the maths.

## 3. Maths: the default Max week and the Pro week by hand

The formulas are from PLAN.md section 3a: tokens by type = total × share; server Wh = Σ (millions of tokens × Wh per million); kWh = server Wh × PUE ÷ 1000; kg CO2e = kWh × g/kWh ÷ 1000. Every level takes every parameter at that level.

### Max (formerly Max 5x), full week: the default

**Central** (930M tokens, central mix, central energies, PUE 1.14, grid 350 g/kWh):

| Type | Share | Tokens (M) | Wh/MTok | Server Wh |
|------|------:|-----------:|--------:|----------:|
| Fresh input | 0.2% | 1.86 | 200 | 372 |
| Cache write | 3.2% | 29.76 | 250 | 7,440 |
| Cache read | 96.0% | 892.8 | 20 | 17,856 |
| Output | 0.6% | 5.58 | 1,000 | 5,580 |
| **Total** | | 930 | | **31,248** |

- 31,248 Wh × 1.14 = 35,622.7 Wh = **35.62 kWh**.
- 35.62 kWh × 350 g/kWh = 12,468 g = **12.47 kg CO2e**.
- By type (× 1.14 ÷ 1000): cache read 20.36 kWh (57%), cache write 8.48, output 6.36, input 0.42.

**Low** (600M tokens, low-energy mix, low energies, PUE 1.09, grid 94):

- Input 0.6M × 50 = 30 Wh; write 15M × 50 = 750; read 582M × 1 = 582; output 2.4M × 300 = 720. Total 2,082 Wh.
- × 1.09 = 2,269.4 Wh = **2.269 kWh**; × 94 g/kWh = 213.3 g = **0.2133 kg**.

**High** (1,500M, high-energy mix, high energies, PUE 1.54, grid 416):

- Input 12M × 400 = 4,800 Wh; write 126M × 800 = 100,800; read 1,350M × 100 = 135,000; output 12M × 3,000 = 36,000. Total 276,600 Wh.
- × 1.54 = 425,964 Wh = **425.96 kWh**; × 416 g/kWh = 177,201 g = **177.20 kg**.

### Pro, full week

- **Central** (185M): input 0.37M × 200 = 74 Wh; write 5.92M × 250 = 1,480; read 177.6M × 20 = 3,552; output 1.11M × 1,000 = 1,110. Total 6,216 Wh. × 1.14 = 7,086.2 Wh = **7.086 kWh**; × 350 = **2.480 kg**.
- **Low** (70M): 3.5 + 87.5 + 67.9 + 84 = 242.9 Wh. × 1.09 = 264.8 Wh = **0.2648 kWh**; × 94 = **0.0249 kg**.
- **High** (280M): 896 + 18,816 + 25,200 + 6,720 = 51,632 Wh. × 1.54 = 79,513 Wh = **79.51 kWh**; × 416 = **33.08 kg**.

### Agreement

| | Hand | PLAN.md 4a | `planScenario` (tests) | Page (headless Chrome) |
|-|------|-----------|------------------------|------------------------|
| Max kWh | 2.269 / 35.62 / 425.96 | 2.2694 / 35.6227 / 425.9640 | same, to 1e-9 | 36 (2.3 – 430) |
| Max kg | 0.2133 / 12.47 / 177.20 | 0.2133 / 12.4680 / 177.2010 | same | 12 (0.21 – 180) |
| Pro kWh | 0.2648 / 7.086 / 79.51 | 0.2648 / 7.0862 / 79.5133 | same | 7.1 (0.26 – 80) |
| Pro kg | 0.0249 / 2.480 / 33.08 | 0.0249 / 2.4802 / 33.0775 | same | 2.5 (0.025 – 33) |

The page rounds the headline to 2 significant figures, so the central kg shows "12" where PLAN.md's prose says "12.5". The detail table shows 12.5.

### Units

Wh and kWh are kept apart throughout: Wh per million tokens at server level, kWh after PUE. Grams and kilograms are too: grid intensity in g/kWh, results in kg. The per-million table is in Wh and g on purpose, because those values are small.

A new test checks the conversions on every output:

- kWh = server Wh × PUE ÷ 1000;
- kg = kWh × g/kWh ÷ 1000;
- the blended Wh and g per million tokens equal the totals divided by the tokens;
- the breakdown by type sums to the total;
- a Max week falls between 10 and 100 kWh, which would catch a Wh/kWh slip.

### low ≤ central ≤ high

This holds for every parameter in `PARAMS` and `PLANS`. In the outputs, it holds for tokens, server Wh, kWh, kg, embodied kg and total kg in all of these cases:

- every combination of the page's plan, mix, model, PUE, grid, share (0, 50%, 100%) and embodied options (6,912 combinations);
- 2,000 seeded random overrides;
- every row of the drivers table, for every plan.

There is one exception, which is open (item 5).

## 4. The page

Checked in headless Chrome:

- **Every control changes the outputs.** This held for:
  - the plans (Pro, Ultra, custom);
  - the share slider and the mix options (range, low, central, high, custom shares);
  - the model (Sonnet, Haiku);
  - each of the four energy boxes;
  - each PUE and grid preset, plus the custom PUE and custom grid boxes;
  - embodied emissions;
  - each of the four custom token boxes, and the fill helper (total and mix).

  Undoing each change restored the default output exactly.
- **Reset works.** After changing share, model, PUE, cache-read energy and embodied, and opening the advanced section, reset restored the default output exactly, closed the advanced section and hid the custom token boxes.
- **No console errors** were logged, and no exceptions were thrown, in any run.
- **The sources link correctly.** All 24 external links are https URLs that match `SOURCES`, and all 24 were fetched successfully during the review. The skip link's target (`#results`) exists. The links that changed were S21 (now the 2026 edition) and the corrected S2 title.
- **Phone width.** Before the fix, the page was 11 px wider than a 320 px screen. The cause was the `.visually-hidden` table captions: they are positioned absolutely, and with no positioned ancestor they escaped the scrolling `.table-wrap`. A 2 px slider margin added a smaller overflow. **Both are fixed in `style.css`.** There is now no horizontal overflow at 320, 375 or 390 px, with the advanced section and the custom token boxes open as well. Wide tables scroll inside their own box, and dark mode is readable.
- **Grammar.** The Pro summary read "roughly 1 days of a typical GB home's electricity". **Fixed** in `app.js`, so a rounded value of exactly 1 now takes "day", "mile" or "kettle boil".
- **Uncertainty text.** Changes made so the page doesn't overclaim:
  - The notice said the spread was "about 190 times". That is the electricity spread; the emissions spread is **about 830 times**, because grid intensity widens it. Both are now given, and a test checks them against the model.
  - "Low and high are bounds" became "extreme cases ... not guaranteed limits either", because every input is uncertain. The same change was made in "How this works" and in the README.
  - "The central value could easily be wrong by a factor of 3" is now marked as "in our judgement".
  - "A cache read ... costs much less" became "should cost much less (how much less has not been measured)".
  - The central mix is now described as one FinOps LLM user's measured mix.
  - The output-high basis now says it is a per-query figure put down to output, with PUE already included.

  The remaining text matches the evidence. It says plainly that Anthropic publishes nothing, that token allowances are inferred, that the central value is a judgement, and what is excluded.

## 5. What was changed

| Commit | Change |
|--------|--------|
| `4b46f09` | DESNZ 2026 factors (UK grid preset 177 → 131 g/kWh; comparison 0.177 → 0.13096 kg/kWh; petrol car 0.16272 → 0.16152 kg/km). Source corrections in `model.js` and the page: S2 title, S3, S6, S11, S19, S21. Rename date removed. Uncertainty notice (830x). CSS fixes for 320 px. Static fallback figures updated. |
| `7637bd2` | `tests/review.test.js` (section 6). |
| `e3a8cb1` | PLAN.md corrections (sections 1, 2, 3b and 4c) and the README. |
| `104b5f9` | Page wording: "extreme cases"; the central mix is one user's. |
| `a15e78a` | "1 day", not "1 days"; with a test. |

The model's parameters, and every expected value in PLAN.md section 4a and the original tests, are unchanged. Only the UK grid and petrol-car comparisons moved:

- central Max week on the UK grid: 6.3 → 4.7 kg;
- central Max week in petrol-car miles: 47.6 → 48.0;
- high Max week in petrol-car miles: 677 → 682.

## 6. Tests added

`tests/review.test.js` (18 tests) and one test in `tests/page.test.js` cover:

1. **Hand-worked weeks.** The Max and Pro weeks at each level are calculated from raw numbers typed into the test, not read from `PARAMS`, and must match `planScenario`. A changed parameter can no longer move the expected value along with it.
2. **Units and internal consistency**, as in section 3.
3. **Ordering.** low ≤ central ≤ high over every page option combination and 2,000 random overrides, plus every drivers-table row. Cache-read energy is checked to be the biggest driver for every plan.
4. **Static page text against `model.js`.** These parts of the page used to be hand-copied with nothing to check them:
   - the PUE and grid options;
   - the energy boxes and their low/high hints;
   - every number in the assumptions tables (energies, mixes, plan tokens, PUE and grid);
   - the comparison factors;
   - the spread quoted in the uncertainty notice.
5. **Regressions for what this review fixed:**
   - no unsourced rename date;
   - no DESNZ 2025 link or factors;
   - the CSS rules behind the 320 px fix;
   - the "1 day" grammar.
6. **The known edge case** (open item 5), pinned so that any change to it is noticed.

`node --test tests/` result: **81 tests, 81 pass, 0 fail.**

## 7. What's still uncertain

These are listed as open, each with the reason it was left.

1. **The output-energy high double-counts PUE.** Jegham et al.'s ~3,000 Wh/MTok already includes PUE 1.14, but the model treats it as server energy and multiplies by up to 1.54. It also puts all of a short query's energy down to output. Dividing by 1.14 would make the high output figure about 2,630. That lowers the high Max week by about 1.6% (output is 13% of the high blend). *Left because* the high is meant to be pessimistic, Watershed reports that such benchmarks overstate by 4 to 20 times, and the effect is far smaller than the range. The page now says the figure includes PUE.
2. **Epoch-derived factors also include some facility overhead** (the ~1,500 W per GPU), so applying a PUE on top double-counts by a few per cent. This was already acknowledged in PLAN.md and on the page. *Left as is* for the same reason.
3. **The Max preset sits below a measured lower bound.** FinOps measured at least 1.3B tokens a week (at least $1,217 of API value) on Max 5x without hitting the cap. The page's central figure is 930M, from the official 5x versus 10x Pro ratio. The measurement predates the rename, is one user, and the cap was never reached, so it can't settle the matter. *Left because* no post-rename Max measurement exists; Wokey has 4 accounts and publishes at 5. The page already calls this "the weakest preset". Revisit when Wokey publishes Max.
4. **The Pro low pairs a chat-heavy token count with the most cache-heavy mix.** Wokey's 71.8M has 76% cache reads, but the low scenario applies the 97% low-energy mix to it. That double-counts towards low, which is consistent with "every parameter low" but is not a realistic Pro user. *Left because* low is defined as an extreme case. This is now noted here.
5. **Edge case in the per-million ordering.** If a user sets cache-read energy above the other token types (no source suggests this), the "low-energy" mix gives a higher blended Wh per million tokens than the central mix. The low column of that row then exceeds the central column. The weekly totals stay ordered because the plan token counts dominate. *Left because* a proper fix means re-ranking the mixes by energy at each level, which changes the model's definition of "low" for an unrealistic input. A test pins the behaviour.
6. **Price is a weak proxy for energy.** Opus 5.5's cache-read price (0.05x) is half the 0.1x central assumption. The model keeps 0.1x (Climate Brink, Couch), and 0.05x is inside the 0.02 to 0.25 range. Cache-read energy is still the biggest driver, and still unmeasured.
7. **The UK grid factor fell sharply** (177 → 131 g/kWh), partly because DESNZ changed method to use more recent data. Only the "same electricity on the UK grid" comparison and one grid preset use it. The page notes the change.
8. **Climate Brink's "eGRID 2024" 341 g/kWh** can't be traced to an EPA edition. It is quoted, not used.
9. **The IEA has newer publications** ("Key Questions on Energy and AI", April 2026; World Energy Outlook 2026, 19 November 2026), which may update the 415 TWh baseline. Not checked, because the figure is context only.
10. **Carried over from PLAN.md section 7, unchanged:**
    - the bounds are not probabilities (a Monte Carlo option is still a future idea; added after this review, see PLAN.md section 9);
    - inference location is unknown;
    - training, networking and water are excluded;
    - the model multipliers don't change the plan token counts.
11. **The footer has no repository link**, because no remote is configured (PLAN.md build note 12).

## Decisions made without the owner

- **DESNZ 2026 replaces 2025.** Brief: "flag any figure that is out of date". The 2026 values were read from the official flat file.
- **The rename date was removed rather than kept.** No source on the page gives it. If the owner has a source for 30 October 2026, add it as a citation and restore the date.
- **No parameter in the model was changed.** The Jegham PUE issue (open item 1) was documented rather than corrected, to keep PLAN.md's worked values and the published central figures stable. The effect is under 2% of the high value.
- **The uncertainty notice now gives the emissions spread (~830x)** as well as the electricity spread.
- **"Pro $20 a month" became "$20 a month billed monthly"** rather than quoting the $17 annual price as well.
- **PLAN.md was edited in place, with "(corrected in review)" notes,** rather than left as a historical record, because it is the page's cited method document.
