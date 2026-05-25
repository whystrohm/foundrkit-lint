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
    targets: [],
  };
  for (const a of args) {
    if (a === '--strict') opts.strict = true;
    else if (a === '--warn-only') opts.warnOnly = true;
    else if (a.startsWith('--reporter=')) opts.reporter = a.slice('--reporter='.length);
    else if (a.startsWith('--config=')) opts.configPath = a.slice('--config='.length);
    else if (!a.startsWith('--')) opts.targets.push(a);
  }
  if (!opts.targets.length) opts.targets.push('.');
  return opts;
}

function run({ cwd, args }) {
  const opts = parseArgs(args);
  const resolvedTargets = opts.targets.map((t) => path.resolve(cwd, t));
  const config = loadConfig({ cwd, explicitPath: opts.configPath });

  if (!config.rules.length) {
    process.stderr.write(
      'foundrkit-lint: no rules found.\n' +
      '  Run "foundrkit-lint --init" to create a starter config,\n' +
      '  or place a foundrkit.config.js / forbidden.json in your project root.\n'
    );
    return opts.warnOnly ? 0 : 2;
  }

  const seen = new Set();
  const files = [];
  for (const target of resolvedTargets) {
    for (const file of collectFiles(target, config)) {
      if (!seen.has(file)) {
        seen.add(file);
        files.push(file);
      }
    }
  }

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
    targetDir: resolvedTargets.length === 1 ? resolvedTargets[0] : resolvedTargets.join(', '),
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
