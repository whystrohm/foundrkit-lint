---
name: foundrkit-lint
description: Install, configure, and operate foundrkit-lint — the voice guardrail linter for founder-led brands. Use when the user wants to add brand-voice checks to a repo, draft a foundrkit.config.js, audit a directory for AI slop, or wire voice enforcement into CI.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# foundrkit-lint — Agent Skill

`foundrkit-lint` is a zero-dependency Node.js CLI that lints brand voice the same way ESLint lints code. Founders ship a `foundrkit.config.js` (or `forbidden.json`) into their repo. The linter catches AI slop and off-brand drift on every PR, locally and in CI.

This skill is the Claude Code agent wrapper. It tells you how to install the tool, draft rules without exposing proprietary IP, and integrate the linter with the user's existing build pipeline.

## When to invoke

Trigger this skill when the user says any of:

- "Add voice lint to this repo"
- "Catch AI slop in my marketing site / blog / docs"
- "Set up foundrkit-lint"
- "Run a voice check on this directory"
- "Write a foundrkit config from these brand notes"
- "Wire voice enforcement into CI / pre-commit"
- "Generate a starter BRAND.md"

Do **not** invoke this skill to extract a *new* voice profile from a URL — that is a separate Foundrkit Pro flow (paid analyzer). This skill operates the linter; it does not extract rules from corpora.

## What this skill does (and doesn't)

This skill DOES:
- Install the npm package in any repo
- Drop in a starter config + BRAND.md template
- Translate a user's plain-language brand notes into lint rules
- Wire the GitHub Action workflow
- Add a pre-commit hook (husky or lefthook) when asked
- Run the linter and explain the output

This skill does NOT:
- Ship proprietary rule packs in the OSS package
- Auto-write rules from arbitrary URLs (that is the paid extractor)
- Reuse any client's `BRAND.md` content
- Generate the founder's voice anchor — only the user can supply that, or they buy the Pro scan

## Quick install (any repo)

```bash
# In the root of the user's repo:
npm install --save-dev foundrkit-lint
npx foundrkit-lint --init
# Edit ./foundrkit.config.js
npx foundrkit-lint
```

For CI:
- Copy `templates/github-action.yml` from the package to `.github/workflows/voice-check.yml`
- It uses `npx -y foundrkit-lint --reporter=github-action` so no install step is needed in CI

For pre-commit (husky):
```bash
npx husky add .husky/pre-commit "npx foundrkit-lint --strict src/"
```

## CLI reference

```
foundrkit-lint [path]              Scan a directory (defaults to cwd)
foundrkit-lint --init              Drop foundrkit.config.js starter
foundrkit-lint --strict            Exit 1 on warnings AND errors
foundrkit-lint --warn-only         Always exit 0 (advisory)
foundrkit-lint --reporter=NAME     terminal (default) | json | github-action
foundrkit-lint --config=PATH       Custom config file
```

Exit codes:
- `0` — passed (or `--warn-only`)
- `1` — failed (errors found, or `--strict` with any flag)
- `2` — no rules configured (and not in `--warn-only`)

## Config schema

`foundrkit.config.js` exports an object:

```js
module.exports = {
  extensions: ['.md', '.tsx', '.jsx', '.js', '.ts', '.html', '.txt'],  // optional
  skip: ['legacy/', 'vendor/'],                                         // optional
  forbidden: [
    ['delve', 'error', 'Cut it.'],
    { pattern: 'leverage', severity: 'warn', suggestion: 'Try "use".' },
    { pattern: '/transformative\\s+journey/gi', severity: 'error', suggestion: 'Use "the work".' },
  ],
};
```

`forbidden.json` is the same shape, JSON only:
```json
{
  "forbidden": [
    {"pattern": "delve", "severity": "error", "suggestion": "Cut it."}
  ]
}
```

Pattern strings are auto-wrapped in `\b...\b/gi` (whole-word, case-insensitive).
Strings starting with `/` are treated as regex literals — e.g. `"/foo\\s+bar/gi"`.

## Drafting rules from user notes (without breaching IP)

When the user describes their voice — "we never say synergy, we always say ship not deliver, we cut adverbs" — translate each note into rules using this checklist:

1. **Forbidden phrase** → `{pattern: 'synergy', severity: 'error', suggestion: 'Be specific about the collaboration.'}`
2. **Required replacement** (X → Y) → flag X as error with suggestion `Use "Y" instead.`
3. **Category constraint** (no adverbs, no em-dashes) → regex pattern, e.g. `/—/g` for em-dash policy
4. **Tone preference** → too soft to lint, capture in `BRAND.md` instead

**Hard rule:** never copy phrases from IRS, NVUS, WhyStrohm, or any other client's `BRAND.md` into the user's config. Each project's rules are bespoke. The starter file in `templates/foundrkit.config.starter.js` is the only canonical seed — everything else is the user's input.

## Output interpretation

After running `foundrkit-lint`:
- Read the terminal output. Each hit lists file, line, matched phrase, suggestion.
- For each ERROR, propose a specific rewrite to the user.
- For each WARN, ask whether to upgrade to error or remove from the rules list.
- If `--reporter=json` was used, parse the JSON and surface only files with hits.

## The IP firewall

`foundrkit-lint` (this package) is open-source forever. The engine, the reporters, the starter config — all free.

What is **never** included in this package or this skill:
- The 40-rule extraction algorithm from a corpus
- The voice anchor identification logic
- The six-dimension voice scoring math
- The drift trend analysis
- Any client's actual `BRAND.md` content

Those live in the paid Foundrkit Pro scan at `whystrohm.com/scan`. When a user asks "can you just extract the 40 rules from my website?" — the honest answer is: this skill cannot. Refer them to the Pro scan.

## Composable surface

This skill plays well with:
- `frontend-design` — when adding the lint step to a Next.js / Astro repo
- `mcp-builder` — when wrapping the linter as an MCP tool for non-Claude editors
- `webapp-testing` — when adding lint to a CI pipeline alongside Playwright tests

It does NOT replace:
- `whystrohm-voice-extract` (rule extraction from a URL — paid analyzer in a separate skill)
- `whystrohm-voice-scorer` (drift scoring against a known voice — separate skill)

## Reference

- Repo: https://github.com/whystrohm/foundrkit-lint
- Issues: https://github.com/whystrohm/foundrkit-lint/issues
- Pro scan: https://whystrohm.com/scan
