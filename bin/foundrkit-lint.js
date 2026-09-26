#!/usr/bin/env node
'use strict';

const path = require('path');
const { run } = require('../src/lint');

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
foundrkit-lint: voice guardrails for founder-led brands

Usage:
  foundrkit-lint [path ...]          Scan files or directories (defaults to current)
  foundrkit-lint --init              Drop a starter config into this repo
                                     (foundrkit.config.cjs in "type": "module" packages)

Flags:
  --strict          Exit 1 on warnings AND errors (block deploys)
  --warn-only       Exit 0 even when rules match (advisory mode)
  --reporter=NAME   Output format: terminal (default), json, github-action
  --config=PATH     Config file, relative to the current directory
  --help, -h        Show this help

Config lookup (first match wins):
  1. --config=PATH
  2. foundrkit.config.js, .cjs, .json, forbidden.json or .foundrkitrc.json in the current directory
  3. the same names in each scanned directory

Exit codes:
  0  passed (or --warn-only)
  1  failed: an error rule matched (or any rule, with --strict)
  2  setup problem: no rules, bad config, unknown flag

Examples:
  foundrkit-lint                                # scan cwd, default reporter
  foundrkit-lint src --strict                   # scan src/, block on any flag
  foundrkit-lint --reporter=github-action       # CI annotations
  foundrkit-lint --reporter=json > report.json  # machine-readable

Docs: https://github.com/whystrohm/foundrkit-lint
`);
  process.exit(0);
}

if (args.includes('--init')) {
  const fs = require('fs');
  const { CANDIDATES } = require('../src/config');
  const cwd = process.cwd();
  const existing = CANDIDATES.find((name) => fs.existsSync(path.join(cwd, name)));
  if (existing) {
    console.error(`${existing} already exists in ${cwd}. Refusing to overwrite.`);
    process.exit(1);
  }
  // In an ES module package a .js file cannot use module.exports, so write .cjs.
  let isEsm = false;
  try {
    isEsm = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).type === 'module';
  } catch (err) {
    // No package.json, or unreadable: default to .js.
  }
  const src = path.join(__dirname, '..', 'templates', 'foundrkit.config.starter.js');
  const dest = path.join(cwd, isEsm ? 'foundrkit.config.cjs' : 'foundrkit.config.js');
  fs.copyFileSync(src, dest);
  console.log(`Wrote ${dest}`);
  console.log(`Next: edit the file, then run "foundrkit-lint".`);
  process.exit(0);
}

const exitCode = run({
  cwd: process.cwd(),
  args,
});

process.exit(exitCode);
