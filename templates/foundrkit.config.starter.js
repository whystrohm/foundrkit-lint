/**
 * foundrkit.config.js
 *
 * This is the STARTER config — a minimal set of generic AI-slop phrases that
 * almost every founder-led brand wants to keep out of their copy.
 *
 * It is intentionally small. A real voice — the kind that turns your team's
 * output into something that sounds like the founder — is forty-plus rules
 * extracted from how *you* actually write.
 *
 *   Get that custom kit:  https://whystrohm.com/scan
 *
 * Until then, edit this file. Add phrases. Remove ones that fit your voice.
 * Anything in the file gets linted. Anything you delete is on you.
 */

module.exports = {
  // Files to scan
  extensions: ['.html', '.jsx', '.tsx', '.js', '.ts', '.md', '.mdx', '.txt'],

  // Extra paths to skip beyond the defaults (node_modules, .git, dist, etc.)
  skip: [],

  // Rules: [pattern, severity, suggestion]
  //  - pattern can be a string (auto-wrapped in \b...\b/gi) or a "/regex/flags" string
  //  - severity: 'error' (blocks --strict deploys) or 'warn' (advisory)
  //  - suggestion: shown to the writer; keep it short
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
