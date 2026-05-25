'use strict';

const path = require('path');

const RESET  = '\x1b[0m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const GREEN  = '\x1b[32m';

module.exports = function terminalReporter(report) {
  const { targetDir, filesScanned, filesWithIssues, totalErrors, totalWarns, results, cwd } = report;

  const relTarget = path.relative(cwd, targetDir) || '.';
  process.stdout.write(`\n${BOLD}${CYAN}foundrkit-lint${RESET}  ·  scanning ${filesScanned} files in ${relTarget}\n\n`);

  for (const { file, hits } of results) {
    const relPath = path.relative(cwd, file);
    process.stdout.write(`${BOLD}${relPath}${RESET}\n`);
    for (const hit of hits) {
      const icon  = hit.severity === 'error' ? `${RED}✕` : `${YELLOW}⚠`;
      const label = hit.severity === 'error' ? `${RED}ERROR` : `${YELLOW}WARN `;
      process.stdout.write(`  ${icon} ${label}${RESET}  line ${DIM}${hit.line}${RESET}  matched: ${BOLD}"${hit.match}"${RESET}\n`);
      process.stdout.write(`  ${DIM}${hit.text}${RESET}\n`);
      if (hit.suggestion) {
        process.stdout.write(`  ${CYAN}→ ${hit.suggestion}${RESET}\n`);
      }
      process.stdout.write('\n');
    }
  }

  if (filesWithIssues === 0) {
    process.stdout.write(`${GREEN}${BOLD}✓ Voice lint passed.${RESET} No flagged phrases found.\n\n`);
    return;
  }

  process.stdout.write(`${BOLD}──────────────────────────${RESET}\n`);
  process.stdout.write(`${BOLD}foundrkit-lint summary${RESET}\n`);
  process.stdout.write(`  Files scanned:       ${filesScanned}\n`);
  process.stdout.write(`  Files with issues:   ${filesWithIssues}\n`);
  process.stdout.write(`  ${RED}Errors (must fix):   ${totalErrors}${RESET}\n`);
  process.stdout.write(`  ${YELLOW}Warnings (review):   ${totalWarns}${RESET}\n\n`);

  if (totalErrors > 0) {
    process.stdout.write(`${RED}${BOLD}✕ Voice lint failed.${RESET} Fix errors before deploying.\n\n`);
  } else {
    process.stdout.write(`${YELLOW}${BOLD}⚠ Warnings only — review before deploying.${RESET}\n\n`);
  }
};
