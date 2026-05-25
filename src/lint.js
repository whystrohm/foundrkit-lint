'use strict';

const path = require('path');
const { loadConfig } = require('./config');
const { collectFiles } = require('./scanner');
const { scanFile } = require('./matcher');
const reporters = {
  terminal: require('./reporters/terminal'),
  json: require('./reporters/json'),
  'github-action': require('./reporters/github-action'),
};

function parseArgs(args) {
  const opts = {
    strict: false,
    warnOnly: false,
    reporter: 'terminal',
    configPath: null,
    targetDir: '.',
  };
  for (const a of args) {
    if (a === '--strict') opts.strict = true;
    else if (a === '--warn-only') opts.warnOnly = true;
    else if (a.startsWith('--reporter=')) opts.reporter = a.slice('--reporter='.length);
    else if (a.startsWith('--config=')) opts.configPath = a.slice('--config='.length);
    else if (!a.startsWith('--')) opts.targetDir = a;
  }
  return opts;
}

function run({ cwd, args }) {
  const opts = parseArgs(args);
  const targetDir = path.resolve(cwd, opts.targetDir);
  const config = loadConfig({ cwd, explicitPath: opts.configPath });

  if (!config.rules.length) {
    process.stderr.write(
      'foundrkit-lint: no rules found.\n' +
      '  Run "foundrkit-lint --init" to create a starter config,\n' +
      '  or place a foundrkit.config.js / forbidden.json in your project root.\n'
    );
    return opts.warnOnly ? 0 : 2;
  }

  const files = collectFiles(targetDir, config);

  const results = [];
  let totalErrors = 0;
  let totalWarns = 0;

  for (const file of files) {
    const hits = scanFile(file, config.rules);
    if (hits.length === 0) continue;
    results.push({ file, hits });
    for (const hit of hits) {
      if (hit.severity === 'error') totalErrors++;
      else totalWarns++;
    }
  }

  const reporter = reporters[opts.reporter] || reporters.terminal;
  reporter({
    targetDir,
    filesScanned: files.length,
    filesWithIssues: results.length,
    totalErrors,
    totalWarns,
    results,
    cwd,
  });

  if (opts.warnOnly) return 0;
  if (opts.strict) return totalErrors + totalWarns > 0 ? 1 : 0;
  return totalErrors > 0 ? 1 : 0;
}

module.exports = { run, parseArgs };
