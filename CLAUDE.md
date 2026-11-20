# agentic_ai_strategy

Notes, tools and small web pages about working with agentic AI (Claude Code especially): what it costs, how to use it well, and its environmental footprint.

## First project: carbon and energy estimator

A static page that estimates the electricity (kWh) and CO2 behind Claude Code use, from a token count or from "a full week of plan X" (Max 5x by default, with Pro and others as options). The plan, sources and assumptions are in `PLAN.md`.

## Layout

- `docs/`: the published site (GitHub Pages serves this folder). Plain HTML, CSS and JavaScript with no build step, framework or CDN dependencies.
  - The JavaScript is in classic `<script>` files, not ES modules, because browsers block module imports from `file://`. That way the page works when opened straight from disk.
  - `docs/.nojekyll` stops GitHub Pages running Jekyll.
- `docs/model.js`: the estimation maths as pure functions. Keep the arithmetic out of the UI code.
  - It exposes the functions as a browser global (`window.CarbonModel`) and, under Node, through `module.exports`, so the tests can `require` it.
- `tests/`: Node's built-in test runner, `node --test tests/` (Node 26 is installed). Every formula and every preset scenario needs a test.
- `PLAN.md`, `REVIEW.md`: the research plan and the review of the build.

## Conventions

- **Estimates are ranges.** Give low, central and high values, and say where each number comes from. Published figures vary a lot, so the page should show that spread rather than hide it.
- **Cite every source:** URL, author or organisation, date, and the figure taken from it, in `PLAN.md` and in a sources section on the page. Mark anything that's your own assumption as such.
- **Separate token types.** Input, cache-read, cache-write and output tokens cost very different amounts of compute. Claude Code use is mostly cache reads.
- **Units:** kWh for energy and kg CO2e for emissions (also grams where the values are small). State the grid carbon intensity and data-centre overhead (PUE) used.
- **Spelling:** British English in prose.
- **Git:** commit work with clear messages, and never push. The owner deals with GitHub.
