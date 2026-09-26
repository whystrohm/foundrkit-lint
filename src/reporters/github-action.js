'use strict';

const path = require('path');

function escape(value) {
  return String(value)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

module.exports = function githubActionReporter(report) {
  const { filesScanned, filesWithIssues, totalErrors, totalWarns, results, cwd } = report;

  for (const { file, hits } of results) {
    const relPath = path.relative(cwd, file);
    for (const hit of hits) {
      const level = hit.severity === 'error' ? 'error' : 'warning';
      const title = hit.severity === 'error' ? 'Voice violation' : 'Voice drift';
      const message = `Matched "${hit.match}"` + (hit.suggestion ? `: ${hit.suggestion}` : '');
      process.stdout.write(
        `::${level} file=${relPath},line=${hit.line},col=${hit.column},title=${escape(title)}::${escape(message)}\n`
      );
    }
  }

  process.stdout.write(
    `::notice title=foundrkit-lint::Scanned ${filesScanned} files. ${totalErrors} errors, ${totalWarns} warnings, ${filesWithIssues} files flagged.\n`
  );
};
