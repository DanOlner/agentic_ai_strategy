# Plan: Claude Code energy and carbon estimator

A static page (in `docs/`) that estimates the data-centre electricity (kWh) and emissions (kg CO2e) behind Claude Code use. The input is either a token count by type or "a full week of plan X". This document has the research, the model, the worked scenarios, the page spec and the test plan. The next task builds the page from it.

Research done on 20 November 2026. All figures were read from the sources listed below on that date unless marked otherwise.

## Read this first: how uncertain this is

- **Nobody outside Anthropic knows how much energy a Claude token takes.** Anthropic publishes no per-token, per-prompt or per-plan energy figures. Every per-token number here is inferred from other companies' disclosures (Google, Mistral), from independent estimates for other models (Epoch AI, Jegham et al.), or from Anthropic's API price ratios.
- **Nobody outside Anthropic knows how many tokens a plan allows.** Limits are published only as multiples of Pro ("5x", "10x"). The token counts come from two commercial sites' measurements, one of them a single user.
- **The low and high values are bounds, not a confidence interval.** The "low" scenario sets every parameter to its low value at once, and "high" sets every one high. For a full week of Max that gives roughly 2 kWh to 430 kWh, a spread of about 190 times. The central value is our best guess, but it could easily be wrong by a factor of 3 either way.
- **The biggest single unknown is the energy cost of a cache read** (see "What drives the range"). About 96% of Claude Code tokens are cache reads, and the evidence on their cost is a price ratio, not a measurement.

## Plan names have changed

On 30 October 2026 Anthropic renamed its plans. "Max 5x" is now **Max** ($100 a month, "5x Pro usage every 5 hours and every week") and "Max 20x" is now **Ultra** ($200 a month, "10x Pro usage every week", with no 5-hour limit for verified accounts). Ultra's weekly allowance is 10x Pro, not 20x. The page should use the current names, with the old names in brackets, e.g. "Max (formerly Max 5x)". In this plan, "Max 5x" and "Max 20x" mean the same plans as Max and Ultra.

## 1. Sources

Each row gives the figure as published. Derived figures (my arithmetic) are marked "derived".

### 1a. Energy per query or per token

| # | Source | Date | Figure used | What it measures | Caveats |
|---|--------|------|-------------|------------------|---------|
| S1 | Zeke Hausfather, "The real energy use of agentic AI", The Climate Brink. <https://www.theclimatebrink.com/p/the-real-energy-use-of-agentic-ai> | 5 Aug 2026 | 3.2 billion tokens over 8 weeks of the author's Claude Code use, "around 170 kWh of data center electricity" (range "70 to 330 kWh"). "Some 96% of the tokens are cache reads"; output "only around 0.4% of total tokens". Cache reads costed at 10% of fresh input (bounds 1% and 25%). Average day 3.0 kWh (1.2 to 5.9). Grid 341 gCO2e/kWh (eGRID 2024 US average). Derived: 53 Wh per million tokens of the mix (22 to 103). | Claude Code specifically, per token by type, from local transcripts. Averages three published methods (Watershed, Couch, claude-carbon). | One heavy user. The per-token factors are borrowed, not measured. PUE is not mentioned. Location-based grid. |
| S2 | Simon P. Couch, "Claude Code's environmental impact". <https://simonpcouch.com/blog/2026-01-20-cc-impact/> | 20 Jan 2026 | Wh per million tokens: input ~390, output ~1,950, cache read ~39, cache write ~490. Median session 41 Wh, 24 requests, 592,439 tokens. Median day ~1,300 Wh. | Per token by type, for Claude Code. Factors derived from Epoch AI's GPT-4o long-context figure, split by Anthropic's price ratios (output 5x input, cache read 0.1x, cache write 1.25x). | The author's own words: "napkin math". GPT-4o is assumed to be in "a ballpark" of Opus 4.5. No PUE or grid factor. |
| S3 | Josh You, "How much energy does ChatGPT use?", Epoch AI. <https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use> | 7 Feb 2025 | "around 0.3 watt-hours per query" for GPT-4o, assuming 100B active parameters, 500 output tokens, H100 at 10% utilisation and ~1,500 W per GPU including server and data-centre overhead. 10k input tokens: "around 2.4 watt-hours"; 100k input tokens: "around 40 watt-hours". Derived: ~600 Wh per million output tokens. | Per query, mostly output. Per-token figure derived. | An estimate, not a measurement. The ~1,500 W per GPU already includes some data-centre overhead, so applying a PUE on top double-counts slightly. Hardware has improved since. |
| S4 | Cooper Elsworth et al. (Google), "Measuring the environmental impact of delivering AI at Google Scale", arXiv 2508.15734. <https://arxiv.org/abs/2508.15734> | 21 Aug 2025 | Median Gemini Apps text prompt (May 2025): 0.24 Wh, of which active accelerators 0.14, host CPU and DRAM 0.06, idle machines 0.02, data-centre overhead 0.02. 0.03 gCO2e per prompt (market-based Scope 2 0.023 g, plus embodied Scope 1+3 0.010 g). Active-chip-only method: 0.10 Wh. "a scaling of 1.72 would need to be applied to active AI accelerator energy". Google 2024 grid factor: location-based 345, market-based 94 gCO2e/kWh. "33x reduction in energy consumption" in a year. Derived: embodied ≈ 42 gCO2e per kWh of operational electricity. | Per prompt (median), measured in production, including idle capacity and PUE, with embodied emissions reported separately. | No token counts, so it can't be turned into a per-token figure. Median, not mean. Not independently verified. Market-based carbon. |
| S5 | Mistral AI, "Our contribution to a global environmental standard for AI". <https://mistral.ai/news/our-contribution-to-a-global-environmental-standard-for-ai> | 22 Jul 2025 | 1.14 gCO2e, 45 mL of water and 0.16 mg Sb eq for "a 400-token response" in Le Chat, "excluding users' terminals". Training Mistral Large 2: 20.4 ktCO2e. | Per response, lifecycle (includes manufacturing servers, "upstream emissions"). | No energy (kWh) figure and no stated grid, so it can only be used as a cross-check on CO2e. Peer-reviewed by consultancies, following the AFNOR Frugal AI method. Derived: 2.85 gCO2e per 1,000 output tokens. |
| S6 | Nidhal Jegham et al., "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference", arXiv 2505.09598 (v6). <https://arxiv.org/abs/2505.09598> | 14 May 2025, revised 24 Nov 2025 | Wh per query (input/output tokens 100/300, 1k/1k, 10k/1.5k): Claude 3.7 Sonnet 0.950, 2.989, 5.671; Claude 3.5 Haiku 0.975, 4.464, 8.010; GPT-4o 0.423, 1.215, 2.875. AWS PUE 1.14, carbon 0.287 kgCO2e/kWh. Derived: ~3,000 Wh per million output tokens for Claude 3.7 Sonnet at short prompts. | Per query, input and output, including PUE. Estimated from API latency and throughput with assumed DGX H100/H200 hardware. | Attributes whole-node power to a batch of 8, which probably overstates per-token energy. Watershed (S9) cites work suggesting such benchmarks can overstate inference electricity "by 4 to 20 times". Operational only, no embodied. |
| S7 | Alexandra Sasha Luccioni, Yacine Jernite, Emma Strubell, "Power Hungry Processing: Watts Driving the Cost of AI Deployment?", FAccT '24. <https://arxiv.org/abs/2311.16863> | Nov 2023 (v3 Oct 2024) | Text generation: mean 0.047 kWh per 1,000 queries (Table 2); body text says "around 0.05 kWh for 1,000 inferences". AWS us-west-2 grid 297.6 gCO2e/kWh. | Per query, measured with CodeCarbon on A100s, small open models (up to 11B parameters). | Models far smaller than Claude, and old hardware. Used only to show that measured small-model figures are about 0.05 Wh per query. No PUE. |
| S8 | metztim, claude-carbon METHODOLOGY.md. <https://github.com/metztim/claude-carbon/blob/main/METHODOLOGY.md> | v1.2, 18 Dec 2025 | Haiku 0.3, Sonnet 1.0, Opus 2.0 J per token (derived: 83, 278, 556 Wh per million tokens). Cache read 0.1x, cache write 1.25x of input. PUE 1.2. Grid 384 gCO2e/kWh (US 2024). | Per token, by model, for Claude Code. | Self-described as "based on Anthropic's pricing ratios, not direct energy measurements"; "accurate to within 2-4x". Used here for the model-size multipliers. |
| S9 | John Bistline (Watershed), "An open framework for AI emissions measurement". <https://watershed.com/en-GB/blog/ai-emissions-framework> | 22 Jul 2026 | Standardised benchmarks can overstate inference electricity "by 4 to 20 times"; training is 32% to 56% of a model's total footprint; reasoning models "roughly 30 times more energy than smaller variants". | Framework, kgCO2e per million tokens. Boundary includes training, inference, data-centre overhead and embodied hardware. | The blog itself gives no per-token factors (they are in a white paper not read here). Used for context only. |
| S10 | IEA, "Energy and AI". <https://www.iea.org/reports/energy-and-ai> | 10 Apr 2025 | Data centres used "around 415 terawatt-hours (TWh)", about 1.5% of world electricity in 2024; "around 945 TWh by 2030" in the Base Case. | Global data-centre electricity (all workloads, not just AI). | No per-query figure. Used for context on the page only. |

### 1b. Plans, token counts and prices

| # | Source | Date | Figure used | Caveats |
|---|--------|------|-------------|---------|
| S11 | Anthropic, Claude pricing page. <https://claude.com/pricing> | read 20 Nov 2026 (undated) | Pro $20/month. Max $100: "5x Pro usage every 5 hours and every week". Ultra $200: "10x Pro usage every week", "No 5-hour limit" for verified accounts. "How fast you reach a limit depends on the model you use, how long your chats are, and how large your files are." | No token figures. |
| S12 | Anthropic help centre, "What is the Ultra plan?" <https://support.claude.com/en/articles/17728952> and "Use Claude Code with your Pro, Max, or Ultra plan" <https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan> | read 20 Nov 2026 ("updated over a week ago" / "over 3 weeks ago") | "The Max 20x plan is now called the Ultra plan." "The Ultra plan includes 10 times the Pro plan's usage every week." Usage across Claude and Claude Code shares the same limits. | No token figures. |
| S13 | Wokey, "Claude Usage Limits (November 2026)". <https://wokey.ai/claude-usage-limits> | data updated 16 Nov 2026 | Pro: $163 a week of API-priced usage ($157 to $175), about 71.8M tokens a week, 17.2M of them not cache reads, 3.0M output (248 accounts). Ultra: $1,576 a week ($1,554 to $1,595), 1.78B tokens a week, 181M not cache reads, 14.5M output (18 accounts). Ultra measured at about 9.7x Pro. Max (5x): still collecting (4 accounts). | A commercial API gateway measuring its own accounts. Small samples. Values tokens at a fixed traffic split (~92% cache reads). The Pro mix includes chat use, so it has far fewer cache reads (75%). |
| S14 | FinOps LLM, "How many tokens do you get with Claude Pro and Max? We counted them". <https://finopsllm.com/research/claude-pro-max-tokens-limit> | 27 Sep 2026, updated 14 Nov 2026 | Max 20x/Ultra: "~1.9B" tokens a week, "about 1.8 to 2.3 billion tokens depending on the model mix" (weekly cap hit twice). Max 5x: "≥ 1.3B" tokens a week, "Lower bound (cap never hit)". Max 5x 5-hour session median 39M tokens. One user's Opus 5 mix: cache reads 7,021M of 7,307M (96%), 1-hour cache writes 243.7M (3.3%), output 41.5M (0.6%), fresh input 0.22M. | One user, one 60-day period, measured before the October 2026 rename. Pro not measured. |
| S15 | Anthropic, API pricing. <https://platform.claude.com/docs/en/about-claude/pricing> | read 20 Nov 2026 (undated) | Opus 5.5 per million tokens: input $4, 5-minute cache write $5, 1-hour cache write $8, cache read $0.20, output $20. Multipliers: 5-minute write "1.25x base input price", 1-hour write "2x", cache read "0.1x base input price on most models" (0.05x for Opus 5.5 and Sonnet 5.5). Sonnet 5.5: $2 input, $10 output. | Prices, not energy. Used only as evidence on the relative cost of token types. |

### 1c. Data centres, grids and comparisons

| # | Source | Date | Figure used | Caveats |
|---|--------|------|-------------|---------|
| S16 | Google, Data centre efficiency. <https://datacenters.google/efficiency/> | read 20 Nov 2026 (data to Q2 2026) | "In 2025, the average annual power usage effectiveness for our global fleet of data centers was 1.09." Campus range (TTM, Q4 2025) about 1.04 to 1.14. Footnote cites Uptime Institute 2025: "the global average PUE of respondents' data centers was 1.54." | Self-reported. The 1.54 figure is second-hand: Uptime's own report is gated. |
| S17 | Amazon, AWS Cloud sustainability. <https://sustainability.aboutamazon.com/products-services/aws-cloud> | read 20 Nov 2026 (2025 report) | "In 2025, our data centers reported an average global PUE of 1.14", down from 1.15 in 2024. Best region 1.06 (eu-south-2, Spain). | Self-reported. |
| S18 | Anthropic, "Anthropic and Amazon expand compute partnership" <https://www.anthropic.com/news/anthropic-amazon-compute> (20 Apr 2026) and "Google and Broadcom partnership" <https://www.anthropic.com/news/google-broadcom-partnership-compute> (6 Apr 2026) | Apr 2026 | "we currently use over one million Trainium2 chips to train and serve Claude" (Project Rainier). "We train and run Claude on a range of AI hardware—AWS Trainium, Google TPUs, and NVIDIA GPUs". | Shows that the relevant providers are AWS and Google Cloud. Neither page says where inference runs. |
| S19 | Epoch AI, data-centre directory: Anthropic–Amazon New Carlisle. <https://epoch.ai/data/ai-data-centers/directory/anthropic-amazon-new-carlisle> | updated 2 Aug 2026 | Project Rainier's main campus is in New Carlisle, Indiana. | Used only to choose the high grid value (eGRID RFCW). That the site falls in RFCW is my assumption. |
| S20 | US EPA, eGRID summary data (eGRID2023). <https://www.epa.gov/egrid/summary-data> | released 15 Jan 2025, rev. 12 Jun 2025 | Total output CO2e rate: US 770.884 lb/MWh (derived: 349.7 g/kWh). RFCW (RFC West, incl. most of Indiana) 916.054 lb/MWh (derived: 415.5 g/kWh). CAMX (California) 429.983 lb/MWh (195.0 g/kWh). | Location-based, generation only (no transmission losses). |
| S21 | UK DESNZ, Greenhouse gas reporting conversion factors 2025 (condensed set). <https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025> | 10 Jun 2025 | UK electricity generated: 0.17700 kgCO2e/kWh. T&D losses: 0.01853 kgCO2e/kWh. Average petrol car: 0.16272 kgCO2e/km (derived: 0.2619 kg per mile). | Read directly from the spreadsheet. |
| S22 | Ofgem, "Review of typical domestic consumption values: decision". <https://www.ofgem.gov.uk/sites/default/files/2026-05/Review%20of%20typical%20domestic%20consumption%20values%20decision.pdf> | 27 May 2026 (in force 1 Jul 2026) | Electricity, single-rate meters, 2026 TDCV: low 1,600, medium 2,500, high 3,800 kWh a year (down from 1,800 / 2,700 / 4,100). Derived: medium = 6.85 kWh a day. | Typical GB household. |
| — | Kettle (own calculation) | — | Heating 1 litre of water from 15 °C to 100 °C takes 4.186 kJ/kg·K × 85 K = 356 kJ = 0.099 kWh. Allowing ~90% efficiency: **0.11 kWh per boil of 1 litre**. | My own physics, not a published source. The Energy Saving Trust page refused automated access. |

The table cites 22 sources with URLs. Ten are about energy per token or query (S1 to S10), so the brief's "at least five more than Climate Brink" is met.

## 2. What the evidence says about each token type

Claude Code sends the whole conversation (system prompt, tool definitions, files read so far) back to the model on each turn. Anthropic's prompt cache stores the model's internal state (the "KV cache") for the earlier part, so most tokens on each call are **cache reads**. Measured mixes:

| Source | Cache read | Cache write | Fresh input | Output |
|--------|-----------:|------------:|------------:|-------:|
| S1 Climate Brink (3.2B tokens) | 96% | ~3.6% (input and writes together) | (incl. in previous) | 0.4% |
| S14 FinOps LLM (7.3B tokens, Opus 5) | 96.1% | 3.3% | 0.003% | 0.57% |
| S13 Wokey Ultra (1.78B a week) | ~90% | ~9% (input and writes together) | (incl. in previous) | 0.8% |
| S13 Wokey Pro (72M a week; includes chat) | 75% | ~20% (together) | (incl. in previous) | 4.2% |

What each type costs physically:

- **Output (decode).** Each token is a full pass through the model that has to read the weights and the whole KV cache from memory. This is memory-bandwidth-bound and the most expensive per token. Every source puts output highest.
- **Fresh input (prefill).** All input tokens are processed in parallel, which is compute-bound and uses the hardware much more efficiently than decode. The cost per token rises with context length because attention is quadratic (Epoch, S3: 10k tokens ~2.4 Wh, 100k tokens ~40 Wh).
- **Cache write.** This is a prefill (same compute as fresh input) plus storing the KV cache. Anthropic charges 1.25x input for 5-minute writes and 2x for 1-hour writes (S15). Physically it should cost about the same as fresh input plus a little for storage. **Assumption:** 1.0x to 2.0x input, central 1.25x.
- **Cache read.** This skips the prefill compute. The stored KV cache is loaded and used for attention while generating the new tokens. Anthropic charges 0.1x input (0.05x on Opus 5.5 and Sonnet 5.5). Climate Brink (S1) uses 10% of input as central, with 1% and 25% as bounds, and Couch (S2) uses 10%. Watershed "flags cache handling as a known gap" (quoted in S1). No source measures it. **Assumption:** 1% to 25% of fresh input, central 10%, following S1. Price is a weak proxy for energy: the cache read discount partly reflects that Anthropic wants to encourage caching, and the memory needed to hold KV caches between calls has an energy cost that the price ratio may not show.

**Relative costs used in the model (per token, relative to fresh input = 1).** These are my assumptions, anchored as described:

| Token type | Low | Central | High | Basis |
|-----------|----:|--------:|-----:|-------|
| Fresh input | 1 | 1 | 1 | reference |
| Cache write | 1.0 | 1.25 | 2.0 | S15 price ratios; physics says ~1.0 |
| Cache read | 0.02 | 0.1 | 0.25 | S1 bounds and central; S2; S15 |
| Output | 6 | 5 | 7.5 | S15 price ratio 5x; S2 uses 5x. Physics suggests the ratio could be higher still, because prefill is much more efficient than decode |

The model below sets absolute Wh per million tokens for each type at low, central and high, rather than ratios. The ratios above are what those absolute values imply.

## 3. The model

### 3a. Formulas

For each token type *t* in {input, cacheWrite, cacheRead, output}:

1. Tokens by type, when a total and a mix are given: `tokens_t = totalTokens × share_t × planShareUsed`, where the shares sum to 1. If the user enters token counts by type directly, use them as they are (and `planShareUsed` doesn't apply).
2. Server energy (Wh): `serverWh = Σ_t (tokens_t / 1,000,000) × whPerMTok_t × modelMultiplier`.
3. Data-centre energy (kWh): `kWh = serverWh × PUE / 1000`.
4. Operational emissions (kg CO2e): `kgCO2e = kWh × gridIntensity_gPerKWh / 1000`.
5. Optional embodied emissions (off by default): `embodiedKg = kWh × embodied_gPerKWh / 1000`, with `embodied_gPerKWh` = 42 (derived from Google, S4: 0.010 g embodied per 0.24 Wh prompt). The total is `kgCO2e + embodiedKg`.
6. Per million tokens (blended for the chosen mix): `whPerMTokBlended = Σ_t share_t × whPerMTok_t × modelMultiplier × PUE` and `gCO2ePerMTok = whPerMTokBlended × gridIntensity / 1000`.

`whPerMTok_t` is server-level energy. It includes accelerators, host CPU and memory and a share of idle capacity, and excludes facility overhead, which the PUE adds. This follows Google's breakdown (S4). Epoch's ~1,500 W per GPU (S3), which the Couch factors inherit, already includes some facility overhead, so using it with a PUE double-counts by a few per cent. I accept that and note it.

**Low, central and high results** each set every parameter to its own low, central or high value, as bounds (see "Read this first"). "Low" means the value that gives lower energy: for the token mix, the low-energy mix has the most cache reads.

### 3b. Parameters

**Energy per million tokens by type** (Wh/MTok, server level, for a frontier "Opus-class" model):

| Type | Low | Central | High | Where it comes from |
|------|----:|--------:|-----:|---------------------|
| Output | 300 | 1,000 | 3,000 | Low: Epoch's ~600 Wh/MTok for GPT-4o on H100 (S3), halved for 2025–26 hardware (Climate Brink, S1, says B300 uses "about a quarter of the energy per operation" of the H100). Central: between Epoch (600) and Couch (1,950, S2), since Claude Opus is probably larger than GPT-4o. High: Jegham et al. (S6), Claude 3.7 Sonnet, short prompts (~3,000 including PUE). Low and central are my judgement. |
| Fresh input | 50 | 200 | 400 | Central: output ÷ 5 (S15 price ratio, as in S2). High: Epoch's 100k-token prefill, 40 Wh per 100k (S3), and Couch's 390 (S2). Low: output-low ÷ 6. |
| Cache write | 50 | 250 | 800 | Input × 1.0 / 1.25 / 2.0 (S15 ratios; see section 2). |
| Cache read | 1 | 20 | 100 | Input × ~0.02 / 0.1 / 0.25 (S1's bounds and central, S2). **The weakest parameter and the biggest driver of the result.** |

**Model size multiplier** (applied to all four types). Relative to Opus = 1.0: Sonnet 0.5, Haiku 0.15, from claude-carbon's J/token ratios (S8: Opus 2.0, Sonnet 1.0, Haiku 0.3). There is a single value for each, not a range. The default is Opus, because the measured plans (S13, S14) are mostly Opus. Climate Brink (S1) says smaller models use "perhaps 5 to 7 times less energy per token", which fits Haiku at 0.15.

**Token mix** (shares of all tokens):

| Mix | Cache read | Cache write | Input | Output | Basis |
|-----|-----------:|------------:|------:|-------:|-------|
| Low-energy | 0.970 | 0.025 | 0.001 | 0.004 | S1 output share 0.4%, slightly more cache reads |
| Central | 0.960 | 0.032 | 0.002 | 0.006 | S14 (and S1's 96% cache reads) |
| High-energy | 0.900 | 0.084 | 0.008 | 0.008 | S13 Ultra: ~90% cache reads, 0.8% output |

**PUE:**

| Low | Central | High | Where it comes from |
|----:|--------:|-----:|---------------------|
| 1.09 | 1.14 | 1.54 | Low: Google fleet 2025 (S16). Central: AWS global 2025 (S17). Claude runs mostly on AWS Trainium and Google TPUs (S18). High: Uptime Institute 2025 industry average, quoted by Google (S16). This covers capacity bought from smaller or older facilities, and is pessimistic for hyperscalers. |

**Grid carbon intensity** (gCO2e/kWh):

| Low | Central | High | Where it comes from |
|----:|--------:|-----:|---------------------|
| 94 | 350 | 416 | Low: Google 2024 **market-based** factor (S4), i.e. after clean-energy purchases. Central: US average, eGRID2023, **location-based** (S20). Climate Brink used 341 (eGRID2024) and claude-carbon 384. High: eGRID RFCW (RFC West, which covers most of Indiana, where Project Rainier is) (S19, S20). |

The page also offers these as named presets: UK grid 2025, 177 (S21); California (CAMX), 195 (S20); Jegham et al.'s AWS factor, 287 (S6); the Luccioni et al. AWS us-west-2 factor, 297.6 (S7).

**Location-based versus market-based accounting.** Location-based emissions use the average intensity of the grid where the electricity is consumed. Market-based emissions subtract renewable energy the company has contracted for (power purchase agreements, certificates). Google's 2024 factors show the gap: 345 location-based against 94 market-based (S4). Google's published 0.03 g per prompt is market-based. Market-based figures show what the company has paid for. Location-based figures are closer to the physical effect of extra demand on today's grid. **Default to location-based (central 350)**, show market-based as the low end, and explain the difference on the page. Climate Brink (S1) also uses location-based and notes that market-based "would probably be lower, potentially much lower."

**Weekly tokens for a full week of each plan** (all token types together, Opus-heavy Claude Code use):

| Plan | Low | Central | High | Basis |
|------|----:|--------:|-----:|-------|
| Pro | 70M | 185M | 280M | Central: one-tenth of Ultra central (the official ratio, S11, S12). Wokey's $163 a week (S13) × Ultra's ~1.13 tokens per API dollar gives ~184M. Low: Wokey's measured 71.8M (S13), which reflects Pro's chat-heavy mix with fewer cache reads. High: one-tenth of Ultra high. |
| **Max (formerly Max 5x)** | 600M | 930M | 1,500M | Central: half of Ultra (official 5x versus 10x Pro, S11). High: above FinOps' "≥ 1.3B" lower bound for Max 5x (S14), which was measured before the October 2026 rename and may reflect older or temporarily raised limits. Low: 5 × Pro low on a Claude Code mix (my assumption). **The weakest preset:** the two lines of evidence disagree. |
| Ultra (formerly Max 20x) | 1,500M | 1,850M | 2,800M | Central: Wokey's 1.78B (S13) and FinOps' ~1.9B (S14). Low: allows for a less cache-heavy mix, which gives fewer tokens per dollar of allowance. High: if the limit tracks API prices, Opus 5.5's cheaper cache reads (0.05x rather than 0.1x, S15) would fit more tokens into a week: $1,576 at the central mix and Opus 5.5 prices ≈ 2.7B tokens (my calculation). |

**Share of plan used:** 0 to 100%, default 100% ("full use"). Most subscribers never reach their weekly limit, so the page should say that the default is a ceiling for heavy users, not a typical user.

### 3c. Blended figures per million tokens

Using the mix, energies, PUE and grid at the same level:

| | Low | Central | High |
|-|----:|--------:|-----:|
| Server Wh per million tokens | 3.47 | 33.60 | 184.40 |
| Data-centre Wh per million tokens (× PUE) | 3.782 | 38.304 | 283.976 |
| g CO2e per million tokens | 0.356 | 13.406 | 118.134 |

Cross-check: Climate Brink's result works out to 53 Wh per million tokens (22 to 103). Applying Couch's factors to Climate Brink's mix gives ~62. Our central 38 is a little lower, because we assume newer hardware than Epoch's 2025 GPT-4o case. Both fall inside our range.

## 4. Scenarios

All weekly, at 100% of the plan used, Opus-class model, no embodied emissions. Low, central and high each use every parameter at that level.

### 4a. Results

| Scenario | Tokens a week (L / C / H) | kWh a week (L / C / H) | kg CO2e a week (L / C / H) |
|----------|---------------------------|------------------------|----------------------------|
| **Max (formerly Max 5x), full week (default)** | 600M / 930M / 1,500M | **2.27 / 35.6 / 426** | **0.213 / 12.5 / 177** |
| Pro, full week | 70M / 185M / 280M | 0.265 / 7.09 / 79.5 | 0.0249 / 2.48 / 33.1 |
| Ultra (formerly Max 20x), full week | 1,500M / 1,850M / 2,800M | 5.67 / 70.9 / 795 | 0.533 / 24.8 / 331 |

Precise values (kWh, kg CO2e), for the tests:

| Plan | Low | Central | High |
|------|-----|---------|------|
| Pro | 0.2648, 0.0249 | 7.0862, 2.4802 | 79.5133, 33.0775 |
| Max | 2.2694, 0.2133 | 35.6227, 12.4680 | 425.9640, 177.2010 |
| Ultra | 5.6735, 0.5333 | 70.8624, 24.8018 | 795.1328, 330.7752 |

Where the central Max week's energy goes, by token type (kWh): cache reads 20.36, cache writes 8.48, output 6.36, fresh input 0.42. **Cache reads are 96% of tokens and 57% of the energy.**

Sanity check against Climate Brink: their 8 weeks were 3.2B tokens (400M a week) and about 21 kWh a week. At our central rate 400M tokens comes to 15 kWh. Their heavy use is about 43% of a full Max week by our central token estimate.

### 4b. What drives the range

The central Max week (35.6 kWh, 12.5 kg) with **one** parameter moved to its low or high value at a time:

| Parameter | kWh (low – high) | kg CO2e (low – high) |
|-----------|------------------|----------------------|
| Cache-read energy | 16.3 – 117.0 | 5.70 – 41.0 |
| Weekly tokens | 23.0 – 57.5 | 8.04 – 20.1 |
| Cache-write energy | 28.8 – 54.3 | 10.1 – 19.0 |
| Token mix | 31.6 – 51.5 | 11.1 – 18.0 |
| Output energy | 31.2 – 48.3 | 10.9 – 16.9 |
| PUE | 34.1 – 48.1 | 11.9 – 16.8 |
| Grid intensity | (no change) | 3.35 – 14.8 |
| Fresh-input energy | 35.3 – 36.0 | 12.4 – 12.6 |

Switching from Opus to Sonnet halves the energy (17.8 kWh).

The page should show this table (or a simple bar version of it), so users can see that the cache-read assumption matters most.

### 4c. Comparisons

Conversion factors:

| Comparison | Factor | Source |
|-----------|--------|--------|
| Kettle boils (1 litre) | 0.11 kWh per boil | own physics calculation (section 1c) |
| Days of a typical GB home's electricity | 2,500 kWh a year ÷ 365 = 6.85 kWh a day | Ofgem 2026 medium TDCV (S22) |
| Miles in an average petrol car | 0.2619 kg CO2e per mile (0.16272 per km) | DESNZ 2025 (S21) |
| Same electricity on the UK grid | 0.177 kg CO2e per kWh | DESNZ 2025 (S21) |
| Median Gemini prompts | 0.24 Wh each | Google (S4) |

Applied to the scenarios (low / central / high):

| Scenario | Kettle boils | Days of a GB home's electricity | Petrol-car miles |
|----------|-------------|-------------------------------|------------------|
| Max, full week | 21 / 324 / 3,872 | 0.33 / 5.2 / 62 | 0.8 / 48 / 677 |
| Pro, full week | 2.4 / 64 / 723 | 0.04 / 1.0 / 11.6 | 0.1 / 9.5 / 126 |
| Ultra, full week | 52 / 644 / 7,229 | 0.83 / 10.3 / 116 | 2.0 / 95 / 1,263 |

Central Max week in words: about 36 kWh, roughly five days of a typical GB home's electricity or 320 one-litre kettle boils, and about 12.5 kg CO2e, which is like driving an average petrol car about 48 miles. At UK grid intensity the same electricity would be about 6.3 kg CO2e.

## 5. Page spec

### 5a. Inputs

1. **What to estimate:**
   - plan preset: Pro, **Max (formerly Max 5x), the default**, Ultra (formerly Max 20x);
   - or custom tokens: four number boxes (input, cache write, cache read, output), with a "fill from total + mix" helper.
2. **Share of the plan used:** a slider from 0 to 100%, default 100%. Hidden when custom tokens are used.
3. **Token mix** (for presets): low-energy, central (default) or high-energy, or custom shares (must add up to 100%; show an error otherwise).
4. **Model size:** Opus (default, 1.0), Sonnet (0.5), Haiku (0.15).
5. **Advanced (collapsed by default):**
   - Wh per million tokens for each of the four types, pre-filled with central, with the low and high shown next to each;
   - PUE, with presets: Google 1.09, AWS 1.14, industry average 1.54;
   - grid intensity, with presets: market-based Google 94, UK 177, California 195, US average 350 (default), RFC West/Indiana 416, plus a custom box;
   - "include embodied hardware emissions" checkbox (off), 42 g per kWh.
6. A "reset to defaults" button.

When the user edits a parameter, the central result uses the edited value. The low and high results keep their own low and high values for every parameter the user hasn't edited, and use the user's value for those they have. Show which parameters have been overridden.

### 5b. Outputs

- **Headline:** weekly kWh and kg CO2e as "central (low – high)", e.g. "36 kWh (2 – 430)". Round to 2 significant figures in the headline, and show more in the detail table.
- **Detail table:** low, central and high for tokens, kWh and kg CO2e, plus embodied CO2e when it's switched on.
- **Per million tokens:** Wh and g CO2e for the blended mix, plus Wh per million tokens for each token type (with PUE and model applied).
- **Breakdown by token type:** kWh for each type (central), as a horizontal bar or a simple table. Highlight the cache-read share.
- **Comparisons:** kettle boils, days of a GB home's electricity, petrol-car miles, and the same kWh on the UK grid, each for low, central and high.
- **"What drives the range"** (section 4b), recalculated for the current inputs.
- An uncertainty notice above the results, in plain words (adapted from "Read this first").

### 5c. Layout

A single page, in order:

1. Title and a one-paragraph summary, with the uncertainty notice.
2. Inputs (plan or custom tokens, share used, mix, model; then the collapsed advanced section).
3. Results: headline, detail table, per-million-token figures, breakdown, comparisons, drivers.
4. "How this works": the formulas in section 3a in plain language, and the location-based versus market-based note.
5. "Assumptions": the parameter tables from section 3b, marking own assumptions as such.
6. **Sources:** every source from section 1 with its URL, author or organisation, date and the figure used.
7. Footer: the date of the research (20 November 2026) and a link to the repository.

The page updates as inputs change (no submit button). Without JavaScript, the page should still show the sources and the static central figures for Max. Keep it accessible: labelled inputs, sufficient contrast, tables with headers.

### 5d. File layout (from CLAUDE.md)

```
docs/
  index.html      the page
  style.css       styles
  model.js        the maths as pure functions; window.CarbonModel in the browser, module.exports in Node
  app.js          UI wiring only: reads inputs, calls CarbonModel, writes outputs
  .nojekyll       stops GitHub Pages running Jekyll
tests/
  model.test.js   node --test tests/
PLAN.md
REVIEW.md         (written in a later task)
```

Classic `<script>` tags (`model.js` then `app.js`), not ES modules, so that the page works from `file://`. No build step, framework or CDN. All parameter values and sources live in `model.js` (as data), so the page and the tests use the same numbers.

## 6. Test plan (`tests/model.test.js`, `node --test tests/`)

`docs/model.js` should export:

| Function or constant | Purpose |
|----------------------|---------|
| `TOKEN_TYPES` | `['input', 'cacheWrite', 'cacheRead', 'output']` |
| `PARAMS` | low/central/high for `whPerMTok` (by type), `mix`, `pue`, `gridIntensity`, plus `embodiedGPerKWh` (42), `modelMultipliers` |
| `PLANS` | `pro`, `max`, `ultra`, each `{ label, formerly, tokens: { low, central, high } }` |
| `COMPARISONS` | `kettleKWh: 0.11`, `ukHomeKWhPerDay: 2500/365`, `petrolCarKgPerMile: 0.16272 * 1.609344`, `ukGridKgPerKWh: 0.177` |
| `SOURCES` | the array of sources (id, title, organisation, date, url, figure) |
| `splitTokens(total, mix, shareUsed = 1)` | tokens by type |
| `validateMix(mix)` | true when the shares are all ≥ 0 and sum to 1 (within 1e-9) |
| `serverEnergyWh(tokensByType, whPerMTok, modelMultiplier = 1)` | |
| `dataCentreKWh(serverWh, pue)` | |
| `emissionsKg(kWh, gridGPerKWh)` | |
| `embodiedKg(kWh, gPerKWh)` | |
| `perMillionTokens(mix, whPerMTok, modelMultiplier, pue, grid)` | `{ wh, gCO2e, byType }` |
| `estimate(inputs)` | single estimate: `{ tokensByType, serverWh, kWh, kgCO2e, embodiedKg, byTypeKWh }` |
| `estimateRange(inputs)` | `{ low, central, high }`, each from `estimate`, using overrides where given |
| `planScenario(planId, options)` | `estimateRange` for a preset |
| `comparisons(kWh, kgCO2e)` | `{ kettleBoils, homeDays, carMiles, ukGridKg }` |
| `sensitivity(inputs)` | one-at-a-time low/high table (section 4b) |

Tests (compare floats with a tolerance, e.g. a relative error of 1e-6 for exact arithmetic and 1e-3 for the rounded expected values below):

1. **Constants:** each mix in `PARAMS.mix` passes `validateMix`; every `low ≤ central ≤ high` for whPerMTok, PUE, grid and plan tokens; every source has a URL.
2. **`splitTokens`:** `splitTokens(1e6, central mix)` gives `{ input: 2000, cacheWrite: 32000, cacheRead: 960000, output: 6000 }`; with `shareUsed = 0.5` everything halves; with `shareUsed = 0` it gives zeros.
3. **`validateMix`:** rejects shares summing to 0.99 or 1.01, and negative shares.
4. **`serverEnergyWh`:** 1M tokens of each type alone at central gives 200, 250, 20 and 1000 Wh. A model multiplier of 0.5 halves the result. Zero tokens gives 0.
5. **`dataCentreKWh`:** `dataCentreKWh(1000, 1.14)` = 1.14.
6. **`emissionsKg`:** `emissionsKg(10, 350)` = 3.5; `emissionsKg(1, 0)` = 0.
7. **`embodiedKg`:** `embodiedKg(100, 42)` = 4.2.
8. **`perMillionTokens`:** at low, central and high: Wh 3.782, 38.304, 283.976; g CO2e 0.356, 13.406, 118.134 (tolerance 1e-3).
9. **Preset scenarios via `planScenario`** (kWh, kg CO2e; relative tolerance 1e-3):
   - Pro: low 0.2648, 0.0249; central 7.0862, 2.4802; high 79.5133, 33.0775.
   - Max: low 2.2694, 0.2133; central 35.6227, 12.4680; high 425.9640, 177.2010.
   - Ultra: low 5.6735, 0.5333; central 70.8624, 24.8018; high 795.1328, 330.7752.
10. **Share used:** Max at 50% gives exactly half of each value in test 9.
11. **Model size:** Max central with Sonnet gives 17.8114 kWh.
12. **Breakdown:** Max central by type gives cacheRead 20.356, cacheWrite 8.482, output 6.361, input 0.424 kWh (sum 35.623).
13. **Overrides:** `estimateRange` with `pue: 1.0` applied to all three levels makes central = 35.6227 / 1.14 = 31.2480 kWh, and leaves the other parameters at their own levels.
14. **Embodied:** Max central with embodied switched on adds 35.6227 × 0.042 = 1.4962 kg.
15. **`comparisons`:** `comparisons(35.6227, 12.4680)` gives kettle boils 323.8, home days 5.201, car miles 47.61, UK-grid kg 6.305.
16. **`sensitivity`** for Max central: the cache-read row gives 16.3 and 117.0 kWh (tolerance 0.05), and grid leaves kWh unchanged.
17. **Custom tokens:** `estimate` with custom token counts ignores `shareUsed` and the mix.
18. **Browser export:** loading `model.js` in a fake global (`vm` with a `window` object) defines `window.CarbonModel`.

## 7. Open questions and the weakest assumptions

The weakest assumptions, most important first:

1. **Cache-read energy (central 20 Wh/MTok, range 1 to 100).** This is a price ratio, not a measurement, and it drives the result more than anything else. A real figure for the energy of serving a cached prefix, including the memory or storage that holds KV caches between calls, would narrow the range most.
2. **Absolute per-token energy for Claude.** Anthropic publishes nothing. The central output figure (1,000 Wh/MTok) is a judgement between Epoch (GPT-4o on H100) and Jegham et al. (latency-based, probably too high). Hardware (Trainium2, TPUs, B300), batching and speculative decoding could all push it lower. Larger models and long contexts push it higher.
3. **Tokens per plan.** The Max (5x) preset in particular rests on the official 5x/10x ratio rather than a measurement, and conflicts with FinOps' ≥ 1.3B lower bound. Limits have changed several times in 2025–26 and may change again. Whether the limits are set in API dollars, compute, or something else is unknown, which matters when prices per token type change (Opus 5.5 halved the cache-read price ratio).
4. **Whether energy tracks price.** Several factors (output 5x, cache write 1.25x, cache read 0.1x, model multipliers) are price ratios. Prices reflect commercial choices as well as cost.
5. **Model multipliers.** Sonnet 0.5 and Haiku 0.15 are claude-carbon's price-derived guesses. They also interact with the plan presets: a cheaper model probably fits more tokens into the same weekly limit, which the model does not capture.
6. **Bounds rather than probabilities.** The low and high values combine every extreme, so the range is very wide. A later version could add a Monte Carlo option (e.g. log-normal parameters) to show a 90% interval instead.
7. **Where Claude Code is served from.** We don't know the split between AWS (Indiana, Mississippi, Pennsylvania, other regions) and Google Cloud, so the grid intensity is a range across the US with a market-based low.
8. **What is excluded:** training (which Watershed, S9, puts at 32% to 56% of a model's lifetime footprint), networking, the user's own computer (Climate Brink, S1: "~50 W is negligible"), water, and embodied emissions unless switched on.
9. **Double-counting overhead.** The Epoch-derived factors include some data-centre overhead and the model also applies a PUE. The effect is a few per cent, within the range.

Open questions for later work:

- Should the page also take a ccusage export (JSON) so that users can paste their own token counts by type? This is probably the best way to replace plan presets with real data.
- Should "full use" assume the 5-hour limits bind before the weekly one on Pro and Max? (The model only uses weekly totals.)
- Update the Max preset when Wokey publishes Max figures (it needs five accounts; four so far).
