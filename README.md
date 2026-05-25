# foundrkit-lint

**Voice guardrails for founder-led brands.** ESLint, but for how your company writes.

```bash
npm install --save-dev foundrkit-lint
npx foundrkit-lint --init
npx foundrkit-lint
```

Drop a `foundrkit.config.js` in your repo. The linter scans your markdown, JSX, and HTML for off-brand phrases and AI slop on every commit. Local. CI. Pre-commit hook. Zero dependencies.

---

## Why this exists

Every founder-led brand starts with the founder's voice. It's the moat. It's why the company grew.

Then the team grows. Contractors write blog posts. The marketing hire ships landing pages. An AI tool drafts the newsletter. By Series A, the homepage still sounds like the founder — and nothing else does.

`foundrkit-lint` turns the founder's voice into an artifact: a config file. Rules-as-code. Enforced on every PR.

## What it does

- Scans `.md, .mdx, .tsx, .jsx, .ts, .js, .html, .txt`
- Flags forbidden phrases (configured by you)
- Reports as terminal output, JSON, or GitHub Action annotations
- Exits 1 on errors (or warnings, with `--strict`) — blocks deploys
- Pre-commit hook friendly (`husky`, `lefthook`, `pre-commit`)

## What it doesn't

This package is the **engine**. It runs the rules you give it.

It does *not* extract those rules from your existing writing. That's a separate job — analyzing thousands of words you've published, identifying your unique patterns, generating a 40-rule kit. That lives at [whystrohm.com/scan](https://whystrohm.com/scan).

Run the scan once. Drop the kit into your repo. This linter enforces it forever.

## Quick start

### 1. Install

```bash
npm install --save-dev foundrkit-lint
```

### 2. Initialize

```bash
npx foundrkit-lint --init
```

Drops a `foundrkit.config.js` in your repo. Generic starter rules — about 20 phrases every founder wants to keep out of their copy.

### 3. Run

```bash
npx foundrkit-lint              # scan cwd
npx foundrkit-lint src          # scan src/
npx foundrkit-lint --strict     # exit 1 on any flag
```

### 4. CI

Copy [`templates/github-action.yml`](./templates/github-action.yml) to `.github/workflows/voice-check.yml`.

### 5. Pre-commit (optional)

```bash
npx husky add .husky/pre-commit "npx foundrkit-lint --strict"
```

## Configuration

`foundrkit.config.js`:

```js
module.exports = {
  // Files to scan (defaults shown)
  extensions: ['.html', '.jsx', '.tsx', '.js', '.ts', '.md', '.mdx', '.txt'],

  // Extra paths to skip (node_modules, .git, dist, build are skipped by default)
  skip: ['legacy/', 'vendor/'],

  // Rules
  forbidden: [
    // Array form
    ['delve', 'error', 'Cut it or say "get into".'],

    // Object form
    { pattern: 'leverage', severity: 'warn', suggestion: 'Try "use" or "build on".' },

    // Regex literal (must be a string starting with /)
    { pattern: '/transformative\\s+journey/gi', severity: 'error', suggestion: 'Use "the work".' },
  ],
};
```

Pattern strings are auto-wrapped in `\b...\b` (whole word) and matched case-insensitively. Use the regex literal form when you need fuzzy matches or punctuation.

### JSON-only repos

If you don't want a `.js` config, use `forbidden.json` with the same shape:

```json
{
  "forbidden": [
    {"pattern": "delve", "severity": "error", "suggestion": "Cut it."}
  ]
}
```

## CLI reference

```
foundrkit-lint [path]              Scan a directory (defaults to cwd)
foundrkit-lint --init              Drop foundrkit.config.js starter
foundrkit-lint --strict            Exit 1 on warnings AND errors
foundrkit-lint --warn-only         Always exit 0 (advisory)
foundrkit-lint --reporter=NAME     terminal | json | github-action
foundrkit-lint --config=PATH       Custom config path
foundrkit-lint --help              Show this help
```

Exit codes:

| Code | Meaning |
|------|---------|
| `0` | Passed (or `--warn-only`) |
| `1` | Failed |
| `2` | No rules configured (and not `--warn-only`) |

## Reporters

| Reporter | Use case |
|----------|----------|
| `terminal` (default) | Local dev, pre-commit |
| `json` | CI integrations, dashboards |
| `github-action` | GitHub Actions annotations (`::error file=...,line=...`) |

## Editor integration

- VS Code: pair with the [Code Spell Checker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) pattern — run on save via a task
- Cursor / Claude Code: load the bundled `SKILL.md` and ask the agent to fix flagged phrases
- pre-commit: any framework (husky, lefthook, pre-commit, simple-git-hooks)

## Philosophy

1. **Voice is a system, not an art.** Anything you can describe, you can lint.
2. **The rules belong in the repo.** Not a Google Doc. Not a Notion page. The same source of truth your code lives in.
3. **Lint, don't generate.** This package never writes copy for you. It catches what's wrong. You write what's right.
4. **No vendor lock-in.** Plain JSON config. Plain Node.js. Plain GitHub Actions. Run it forever, with or without the company that made it.

## The paid version

If you want the rules themselves — extracted from your founder's actual writing, not a generic starter:

→ [whystrohm.com/scan](https://whystrohm.com/scan) (60-second free scan, full kit available)

The free linter runs your rules. The paid scan writes them.

## License

[MIT](./LICENSE) © Yuri Strohm / WhyStrohm
