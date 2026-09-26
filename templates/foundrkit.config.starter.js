/**
 * foundrkit.config.js
 *
 * Starter config. A short list of generic AI filler phrases that most
 * founder-led brands keep out of their copy. The phrases below are listed
 * here on purpose, as examples of what to ban.
 *
 * Edit this file. Add the phrases your founder never says. Remove the ones
 * that fit your voice. Anything in the list gets linted.
 *
 * In a package with "type": "module", name this file foundrkit.config.cjs.
 */

module.exports = {
  // Files to scan
  extensions: ['.html', '.jsx', '.tsx', '.js', '.ts', '.md', '.mdx', '.txt'],

  // Extra paths to skip beyond the defaults (node_modules, .git, dist, etc.)
  skip: [],

  // Rules: [pattern, severity, suggestion], or a bare 'pattern' string (severity 'error')
  //  - pattern: a plain string, matched case-insensitive as a whole word,
  //    or a "/regex/flags" string, or a RegExp
  //  - severity: 'error' (exit 1) or 'warn' (exit 1 only with --strict)
  //  - suggestion: shown to the writer; keep it short
  //
  // Example: ban the em dash. A plain string that starts and ends with
  // punctuation matches anywhere, so either line works:
  //    ['\u2014', 'error', 'Use a comma, colon, or period.'],
  //    ['/\\u2014/g', 'error', 'Use a comma, colon, or period.'],
  forbidden: [
    // ─── AI slop ──────────────────────────────────────────────────────────
    ['delve',                  'error', 'Cut it or say "get into".'],
    ['in conclusion',          'error', 'Cut entirely. The conclusion is the last sentence.'],
    ['it is important to note','error', 'Cut entirely. Just make the point.'],
    ['it\'s important to note','error', 'Cut entirely. Just make the point.'],
    ['moving forward',         'error', 'Cut or rewrite. State what happens next.'],
    ['at the end of the day',  'error', 'Cut or rewrite. Say the actual point.'],
    ['game-changer',           'error', 'Be specific about what changes.'],
    ['game changer',           'error', 'Be specific about what changes.'],
    ['paradigm shift',         'error', 'Describe the shift in plain language.'],
    ['synergy',                'error', 'Name the actual collaboration.'],
    ['synergize',              'error', 'Name the actual collaboration.'],

    // ─── Overused softeners and filler ───────────────────────────────────
    ['robust',                 'warn',  'Be specific about what it includes.'],
    ['comprehensive',          'warn',  'Be specific about what it covers.'],
    ['seamless',               'warn',  'Describe the experience, not the marketing word.'],
    ['leverage',               'warn',  'Try "use", "build on", or "draw from".'],
    ['unlock',                 'warn',  'Try "get", "earn", or "open".'],
    ['holistic',               'warn',  'Name the parts being combined.'],
    ['cutting-edge',           'warn',  'Be specific about the technology.'],
    ['best-in-class',          'warn',  'Show, don\'t tell. Cite a benchmark.'],
  ],
};
