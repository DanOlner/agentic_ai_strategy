# agentic_ai_strategy

Notes, tools and small web pages about working with agentic AI (Claude Code especially): what it costs, how to use it well, and its environmental footprint.

## Claude Code energy and carbon estimator

`docs/index.html` is a single static page that estimates the data-centre electricity (kWh) and greenhouse gas emissions (kg CO2e) behind Claude Code use. It starts from either a full week of a subscription plan (Pro, Max or Ultra) or your own token counts by type.

- The default view is a full week of the **Max plan (formerly Max 5x)** used to its limit. That comes to about 36 kWh and 12 kg CO2e a week, with a range of roughly 2 to 430 kWh.
- Every result is shown as low, central and high values. Low and high are extreme cases, with every parameter at its low or high value together. They are not a confidence interval, and not guaranteed limits either.
- You can change the plan, the share of the plan used, the token mix and the model size. You can also change the energy per token for each token type (fresh input, cache write, cache read, output), the data-centre overhead (PUE) and the grid carbon intensity, and you can switch embodied hardware emissions on. A reset button restores the defaults.
- The page shows every assumption, cites every source with a link, and explains the method and how uncertain it is in plain English.

The research, sources, formulas, worked scenarios and test plan are in [`PLAN.md`](PLAN.md).

### Open it locally

There is no build step and nothing to install. Open `docs/index.html` in a browser, for example:

```sh
open docs/index.html        # macOS
xdg-open docs/index.html    # Linux
```

The page works straight from disk (`file://`), because its JavaScript uses classic `<script>` tags rather than ES modules. Without JavaScript it still shows the default figures, the assumptions and the sources.

### Publish it on GitHub Pages

In the repository's settings on GitHub, under **Pages**, choose **Deploy from a branch**, branch **main**, folder **/docs**. `docs/.nojekyll` stops GitHub Pages running Jekyll, so the files are served as they are.

### Files

| File | What it does |
|------|--------------|
| `docs/index.html` | The page, including the static fallback figures, assumptions and sources |
| `docs/style.css` | Styles: light and dark mode, and readable on a phone |
| `docs/model.js` | The estimation maths as pure functions, with every parameter, preset and source as data. Sets `window.CarbonModel` in the browser and `module.exports` under Node |
| `docs/app.js` | UI wiring only: reads the controls, calls `CarbonModel`, writes the results |
| `docs/.nojekyll` | Stops GitHub Pages running Jekyll |
| `tests/model.test.js` | Tests for every function in `model.js`, each plan preset and the edge cases |
| `tests/page.test.js` | Checks that every element id `app.js` uses exists in `index.html`, that the static figures match what `app.js` renders, and drives the controls through a minimal fake DOM |
| `tests/review.test.js` | Tests added in the review: hand-worked weeks, units, low ≤ central ≤ high, static page text against `model.js`, CSS regressions at phone width |
| `tests/index.js` | Lets `node --test tests/` find the test files (see below) |

### Run the tests

The tests need Node only (version 26 here) and no packages:

```sh
node --test tests/
```

`node --test` with no arguments also works. Node 26 treats a directory argument as a module to load rather than a folder to search, so `tests/index.js` loads every `*.test.js` file in the folder.

### Changing a number

All parameter values and sources live in `docs/model.js`. The static fallback tables in `docs/index.html` (and the assumptions tables) repeat the default values. If you change a default, update those as well. `tests/page.test.js` fails if the static results no longer match what the script renders, and `tests/review.test.js` fails if the assumptions tables, preset options or uncertainty notice no longer match `model.js`.

`REVIEW.md` records the review of the page: what was checked against the sources, what was fixed, and what is still open.
