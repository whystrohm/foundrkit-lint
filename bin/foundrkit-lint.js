#!/usr/bin/env node
'use strict';

const path = require('path');
const { run } = require('../src/lint');

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
foundrkit-lint — voice guardrails for founder-led brands

Usage:
  foundrkit-lint [path]              Scan a directory (defaults to current)
  foundrkit-lint --init              Drop a starter foundrkit.config.js into this repo

Flags:
  --strict          Exit 1 on warnings AND errors (block deploys)
  --warn-only       Always exit 0 (advisory mode)
  --reporter=NAME   Output format: terminal (default), json, github-action
  --config=PATH     Custom config file (default: foundrkit.config.js or forbidden.json)
  --help, -h        Show this help

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
  const src = path.join(__dirname, '..', 'templates', 'foundrkit.config.starter.js');
  const dest = path.join(process.cwd(), 'foundrkit.config.js');
  if (fs.existsSync(dest)) {
    console.error(`foundrkit.config.js already exists in ${process.cwd()}. Refusing to overwrite.`);
    process.exit(1);
  }
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
