'use strict';

const fs = require('fs');
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
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--strict') opts.strict = true;
    else if (a === '--warn-only') opts.warnOnly = true;
    else if (a.startsWith('--reporter=')) opts.reporter = a.slice('--reporter='.length);
    else if (a === '--reporter') opts.reporter = args[++i];
    else if (a.startsWith('--config=')) opts.configPath = a.slice('--config='.length);
    else if (a === '--config') opts.configPath = args[++i];
    else if (a.startsWith('-')) opts.unknown = (opts.unknown || []).concat(a);
    else opts.targets.push(a);
  }
  if (!opts.targets.length) opts.targets.push('.');
  return opts;
}

function searchDirsFor(targets) {
  const dirs = [];
  for (const t of targets) {
    let dir = t;
    try {
      if (!fs.statSync(t).isDirectory()) dir = path.dirname(t);
    } catch (err) {
      continue;
    }
    if (!dirs.includes(dir)) dirs.push(dir);
  }
  return dirs;
}

// Exit codes: 0 passed, 1 failed, 2 setup problem (bad flag, bad config, no rules).
// Setup problems exit 2 even with --warn-only, so a broken setup never reads as a pass.
function run({ cwd, args }) {
  const opts = parseArgs(args);
  if (opts.unknown) {
    process.stderr.write(`foundrkit-lint: unknown flag ${opts.unknown.join(', ')}. See --help.\n`);
    return 2;
  }
  if (!reporters[opts.reporter]) {
    process.stderr.write(
      `foundrkit-lint: unknown reporter "${opts.reporter}". Use one of: ${Object.keys(reporters).join(', ')}.\n`
    );
    return 2;
  }
  const resolvedTargets = opts.targets.map((t) => path.resolve(cwd, t));

  let config;
  try {
    config = loadConfig({
      cwd,
      explicitPath: opts.configPath,
      searchDirs: searchDirsFor(resolvedTargets),
    });
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 2;
  }

  if (!config.rules.length) {
    process.stderr.write(
      'foundrkit-lint: no rules found.\n' +
      '  Run "foundrkit-lint --init" to create a starter config,\n' +
      '  or place a foundrkit.config.js / forbidden.json in your project root.\n'
    );
    return 2;
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

  const reporter = reporters[opts.reporter];
  reporter({
    targets: resolvedTargets,
    configPath: config.source,
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
