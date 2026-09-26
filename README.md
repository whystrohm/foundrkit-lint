# foundrkit-lint

**Voice guardrails for founder-led brands.** ESLint, but for how your company writes.

```bash
npm install --save-dev github:whystrohm/foundrkit-lint
npx foundrkit-lint --init
npx foundrkit-lint
```

Drop a `foundrkit.config.js` in your repo. The linter scans your markdown, JSX, and HTML for off-brand phrases and AI filler. Run it locally, in CI, or in a pre-commit hook. Zero dependencies.

The package is not on the npm registry. Install it from GitHub as shown above.

---

## Why this exists

A founder-led brand starts with the founder's voice.

Then the team grows. Contractors write blog posts. A marketing hire ships landing pages. An AI tool drafts the newsletter. The homepage may still sound like the founder while the rest drifts.

`foundrkit-lint` puts the founder's rules in a config file in the repo. The rules run on every PR.

## What it does

- Scans `.md, .mdx, .tsx, .jsx, .ts, .js, .html, .txt`
- Flags forbidden phrases that you configure
- Reports as terminal output, JSON, or GitHub Action annotations
- Exits 1 on errors (or on warnings too, with `--strict`), so it can block a deploy
- Works in pre-commit hooks (`husky`, `lefthook`, `pre-commit`)

## What it doesn't

This package runs the rules you give it. It does not write rules from your existing writing. You write the rules, or start from the bundled starter config.

## Quick start

### 1. Install

```bash
npm install --save-dev github:whystrohm/foundrkit-lint
```

To pin a version, add a commit SHA: `github:whystrohm/foundrkit-lint#<commit-sha>`.

### 2. Initialize

```bash
npx foundrkit-lint --init
```

Writes a starter config to your repo: `foundrkit.config.js`, or `foundrkit.config.cjs` if your `package.json` has `"type": "module"`. The starter has about 20 generic filler phrases to start from.

### 3. Run

```bash
npx foundrkit-lint              # scan cwd
npx foundrkit-lint src          # scan src/
npx foundrkit-lint --strict     # exit 1 on any flag
```

### 4. CI

Copy [`templates/github-action.yml`](./templates/github-action.yml) to `.github/workflows/voice-check.yml`.

### 5. Pre-commit (optional, husky v9)

```bash
npm install --save-dev husky
npx husky init
echo "npx foundrkit-lint --strict" > .husky/pre-commit
```

`npx husky init` creates `.husky/pre-commit` and adds a `prepare` script. The `echo` line replaces the hook's default command.

## Configuration

`foundrkit.config.js`:

```js
module.exports = {
  // Files to scan (defaults shown)
  extensions: ['.html', '.jsx', '.tsx', '.js', '.ts', '.md', '.mdx', '.txt'],

  // Extra paths to skip. Each entry matches a whole file or folder name,
  // never part of a name. "legacy/" skips a folder named legacy, not legacy-notes.md.
  // "content/drafts" matches that folder path. "*" matches inside one name.
  skip: ['legacy/', 'content/drafts', '*.generated.md'],

  // Rules. The phrases below are examples of banned phrases.
  forbidden: [
    // Bare string: an error rule with no suggestion
    'synergy',

    // Array form: [pattern, severity, suggestion]
    ['delve', 'error', 'Cut it or say "get into".'],

    // Object form
    { pattern: 'leverage', severity: 'warn', suggestion: 'Try "use" or "build on".' },

    // Regex literal (a string starting with /)
    { pattern: '/transformative\\s+journey/gi', severity: 'error', suggestion: 'Use "the work".' },

    // Em dash. \u2014 in a JS or JSON string is the em dash character.
    ['\u2014', 'error', 'Use a comma, colon, or period.'],
  ],
};
```

How patterns match:

- A plain string matches case-insensitive. If it starts or ends with a letter, digit, or underscore, that side must be a word boundary. So `'delve'` matches "Delve" but not "delved".
- A plain string that starts and ends with punctuation, like `'\u2014'` or `'--'`, matches anywhere.
- A string that starts with `/` is a regex literal: `'/\\u2014/g'` also matches an em dash.
- In a JS config you can also pass a RegExp: `[/leverag(e|ing)/i, 'warn']`.
- A rule that is not a string, array, or object with `pattern` stops the run with exit code 2.

Default skips: `node_modules`, `.git`, `.next`, `.nuxt`, `.svelte-kit`, `.turbo`, `.vercel`, `.cache`, `dist`, `build`, `out`, `coverage`, `_source`, `_archive`, the config files, `BRAND.md`, and `CLAUDE.md`. Files and folders that start with `.` are never scanned.

### ES module packages

If your `package.json` has `"type": "module"`, a `.js` config is loaded as ESM and `module.exports` fails. Name the file `foundrkit.config.cjs` and keep `module.exports = { ... }`. The linter prints this advice if it hits the problem. `.mjs` configs are not supported.

### JSON-only repos

If you don't want a JS config, use `foundrkit.config.json`, `forbidden.json`, or `.foundrkitrc.json` with the same shape:

```json
{
  "forbidden": [
    "synergy",
    {"pattern": "delve", "severity": "error", "suggestion": "Cut it."}
  ]
}
```

### Where the config is found

First match wins:

1. `--config=PATH` (or `--config PATH`), relative to the current directory
2. `foundrkit.config.js`, `foundrkit.config.cjs`, `foundrkit.config.json`, `forbidden.json`, or `.foundrkitrc.json` in the current directory
3. The same names in each scanned directory, or the folder of a scanned file

## CLI reference

```
foundrkit-lint [path ...]          Scan files or directories (defaults to cwd)
foundrkit-lint --init              Write a starter config
foundrkit-lint --strict            Exit 1 on warnings AND errors
foundrkit-lint --warn-only         Exit 0 even when rules match (advisory)
foundrkit-lint --reporter=NAME     terminal | json | github-action
foundrkit-lint --config=PATH       Config file, relative to cwd
foundrkit-lint --help              Show this help
```

Exit codes:

| Code | Meaning |
|------|---------|
| `0` | Passed, or rules matched with `--warn-only` |
| `1` | Failed: an error rule matched, or any rule with `--strict` |
| `2` | Setup problem: no rules found, bad config, unknown flag or reporter. `--warn-only` does not change this. |

## Reporters

| Reporter | Use case |
|----------|----------|
| `terminal` (default) | Local dev, pre-commit |
| `json` | CI integrations, dashboards |
| `github-action` | GitHub Actions annotations (`::error file=...,line=...`) |

## Editor integration

- VS Code: run it on save with a task.
- Cursor / Claude Code: load the bundled `SKILL.md` and ask the agent to fix flagged phrases.
- Pre-commit: any framework (husky, lefthook, pre-commit, simple-git-hooks).

## Development

```bash
npm test            # node:test suite, no dependencies
npm run lint:self   # lint this repo's docs and source for em dashes
```

## Philosophy

1. **Voice is a system.** Anything you can describe, you can lint.
2. **The rules belong in the repo.** Not a Google Doc. Not a Notion page. The same place your code lives.
3. **Lint, don't generate.** This package never writes copy for you. It catches what is wrong. You write what is right.
4. **No vendor lock-in.** Plain config. Plain Node.js. Plain GitHub Actions.

## License

[MIT](./LICENSE) © Yuri Strohm / WhyStrohm
