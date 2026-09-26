'use strict';

const path = require('path');

module.exports = function jsonReporter(report) {
  const { targets, configPath, filesScanned, filesWithIssues, totalErrors, totalWarns, results, cwd } = report;
  const out = {
    tool: 'foundrkit-lint',
    version: require('../../package.json').version,
    target: targets.map((t) => path.relative(cwd, t) || '.').join(', '),
    targets: targets.map((t) => path.relative(cwd, t) || '.'),
    config: configPath ? path.relative(cwd, configPath) : null,
    summary: {
      filesScanned,
      filesWithIssues,
      errors: totalErrors,
      warnings: totalWarns,
    },
    results: results.map(({ file, hits }) => ({
      file: path.relative(cwd, file),
      hits: hits.map((h) => ({
        line: h.line,
        column: h.column,
        match: h.match,
        severity: h.severity,
        suggestion: h.suggestion,
        category: h.category,
        text: h.text,
      })),
    })),
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
};
