'use strict';
// Entry point so that `node --test tests/` works: Node 26 resolves a directory
// argument as a module (tests/index.js) rather than searching it, so this file
// loads every *.test.js file here. `node --test` with no arguments finds the
// *.test.js files directly and does not load this file, so nothing runs twice.
const fs = require('node:fs');
const path = require('node:path');

fs.readdirSync(__dirname)
  .filter((f) => f.endsWith('.test.js'))
  .sort()
  .forEach((f) => require(path.join(__dirname, f)));
