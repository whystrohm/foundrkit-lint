# Changelog

## 0.2.0 (Unreleased)

Fixes:

- Skip entries match whole file or folder names. Before, a file whose name contained "out", "build", "dist" or "coverage" was skipped, so `about.md`, `checkout.md`, `layout.tsx` and `distribution.md` were never linted.
- A bare string rule like `forbidden: ['leverage']` is an error rule. Before, it was dropped without a message.
- A rule with the wrong shape stops the run with exit code 2.
- A RegExp rule without the `g` flag no longer loops forever.
- A plain string only gets a `\b` word boundary on a side that starts or ends with a word character. A plain em dash string (`'\u2014'`) now matches.
- "No rules found", a bad config, an unknown flag and an unknown reporter exit 2, even with `--warn-only`.
- The config is also looked up in each scanned directory when the current directory has none. `--config PATH` works as well as `--config=PATH`.
- A CommonJS `.js` config in a `"type": "module"` package fails with a message that points to `.cjs`. `--init` writes `foundrkit.config.cjs` in those packages.
- The github-action reporter separates the match and the suggestion with a colon.
- The JSON report adds `targets` (an array) and `config` (the config file used).

Tests and CI:

- `npm test` runs a `node:test` suite. The old script used `--warn-only` and never loaded the example config, so it always passed.
- `npm run lint:self` checks this repo's docs and source for em dashes.
- CI runs both on Node 18, 20, 22 and 24.
- `engines` is now Node 18 or later.

Docs:

- Install from GitHub: `npm install --save-dev github:whystrohm/foundrkit-lint`. The package is not on the npm registry.
- Pre-commit steps use husky v9.
- `package.json` now ships `SKILL.md` and `CHANGELOG.md`.
- Removed client names, claims about a paid scan, and em dashes.

## 0.1.0 (2026-05-25)

Initial release.

- Engine: zero-dependency file scanner + regex matcher
- Reporters: terminal (default), JSON, GitHub Action annotations
- Config: `foundrkit.config.js`, `foundrkit.config.cjs`, `foundrkit.config.json`, `forbidden.json`, `.foundrkitrc.json`
- CLI: `--init`, `--strict`, `--warn-only`, `--reporter`, `--config`
- Templates: starter config, BRAND.md skeleton, GitHub Action workflow
- Skill: Claude Code SKILL.md for install/configure/operate
