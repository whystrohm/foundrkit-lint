---
name: foundrkit-lint
description: Install, configure, and operate foundrkit-lint, the voice guardrail linter for founder-led brands. Use when the user wants to add brand-voice checks to a repo, draft a foundrkit.config.js, build lint rules from a brand/ folder (voice-profile.json, brand-lock.md), audit a directory for AI filler phrases, or wire voice checks into CI or a pre-commit hook.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# foundrkit-lint: Agent Skill

`foundrkit-lint` is a zero-dependency Node.js CLI that lints brand voice the way ESLint lints code. A repo holds a `foundrkit.config.js` (or `forbidden.json`). The linter flags AI filler and off-brand phrases on every PR, locally and in CI.

This skill tells you how to install the tool, turn the user's brand notes into rules, and add the linter to the user's build pipeline.

## When to invoke

Trigger this skill when the user says any of:

- "Add voice lint to this repo"
- "Catch AI filler in my marketing site / blog / docs"
- "Set up foundrkit-lint"
- "Run a voice check on this directory"
- "Write a foundrkit config from these brand notes"
- "Add voice checks to CI / pre-commit"
- "Generate a starter BRAND.md"
- "Turn my voice profile into lint rules" / "Lint against brand/"

This skill runs the linter. It does not extract a voice profile from a website or a body of writing. whystrohm-voice-extract does that, and this skill reads its output.

## What this skill does (and doesn't)

This skill DOES:
- Install the package in any repo
- Drop in a starter config and a BRAND.md template
- Turn a user's plain-language brand notes into lint rules
- Build `brand/foundrkit.rules.json` from `brand/voice-profile.json` and `brand/brand-lock.md` with `--from-brand`
- Add the GitHub Action workflow
- Add a pre-commit hook (husky or lefthook) when asked
- Run the linter and explain the output

This skill does NOT:
- Write rules from arbitrary URLs
- Reuse another company's `BRAND.md` content
- Write the founder's voice anchor. Only the user can supply that.

## Quick install (any repo)

The package is not on the npm registry. Install it from GitHub:

```bash
# In the root of the user's repo:
npm install --save-dev github:whystrohm/foundrkit-lint
npx foundrkit-lint --init
# Edit ./foundrkit.config.js (or .cjs, see below)
npx foundrkit-lint
```

If the user's `package.json` has `"type": "module"`, `--init` writes `foundrkit.config.cjs`. Keep that name. A `.js` config with `module.exports` fails to load in an ES module package.

For CI:
- Copy `templates/github-action.yml` from this package to `.github/workflows/voice-check.yml`.
- It runs `npx --yes github:whystrohm/foundrkit-lint --reporter=github-action`, so the repo does not need a Node install step of its own.

For pre-commit (husky v9):
```bash
npm install --save-dev husky
npx husky init
echo "npx foundrkit-lint --strict src/" > .husky/pre-commit
```

Do not use `npx husky add`. It was removed in husky v9.

## CLI reference

```
foundrkit-lint [path ...]          Scan files or directories (defaults to cwd)
foundrkit-lint --init              Write a starter config
foundrkit-lint --from-brand [dir]  Build dir/foundrkit.rules.json (dir defaults to ./brand)
foundrkit-lint --strict            Exit 1 on warnings AND errors
foundrkit-lint --warn-only         Exit 0 even when rules match (advisory)
foundrkit-lint --reporter=NAME     terminal (default) | json | github-action
foundrkit-lint --config=PATH       Config file, relative to cwd
foundrkit-lint --force             With --from-brand, replace an existing rules file
```

Exit codes:
- `0`: passed, or rules matched with `--warn-only`
- `1`: failed. An error rule matched, or any rule with `--strict`. Also when `--init` or `--from-brand` refuses to overwrite a file.
- `2`: setup problem. No rules found, bad config, a contract file that fails its check, a missing or invalid voice profile, unknown flag or reporter. `--warn-only` does not change this.

Config lookup, first match wins:
1. `--config=PATH`
2. `foundrkit.config.js`, `.cjs`, `.json`, `forbidden.json`, `.foundrkitrc.json` in the current directory
3. `brand/foundrkit.rules.json` in the current directory
4. the names in step 2 in each scanned directory

## The brand/ folder

The WhyStrohm skills hand work to each other through files in a `brand/` folder in the user's project. The formats are JSON schemas in this package's `contracts/` folder. The canonical copies live in whystrohm/shotkit.

The flow:

```
whystrohm-voice-extract  ->  brand/voice-profile.json
(optional, Shotkit)      ->  brand/brand-lock.md
foundrkit-lint --from-brand  ->  brand/foundrkit.rules.json
foundrkit-lint           ->  lints with brand/foundrkit.rules.json
```

Steps for the agent:

1. Check that `brand/voice-profile.json` exists. If not, ask the user to run whystrohm-voice-extract first. Do not write a voice profile by hand.
2. Run `npx foundrkit-lint --from-brand`. If `brand/foundrkit.rules.json` exists, it refuses. Ask the user before passing `--force`, since the file may hold hand-written rules.
3. Read the summary to the user: rules from voice-profile, rules from brand-lock, duplicates dropped, and each skipped line with its reason. Skipped lines are rules a person has to check, or rules to add by hand.
4. Run `npx foundrkit-lint`. It finds `brand/foundrkit.rules.json` when the current directory has no other config.

What becomes a rule:
- voice-profile: quoted terms in a `vocabulary` guardrail sentence that bans them (error). `vocabulary.absent_words` (warn). A `tone` guardrail that bans exclamation marks (a regex, warn).
- brand-lock: quoted terms in a `no ... (...)` or `never use ... (...)` line under `## Never list` or `## Voice rules` (error). A line that bans em dashes, emojis, or exclamation points in headlines (a regex).
- Anything else is skipped and listed. Rules are deduped by lowercase pattern.

A hand-written rule in `brand/foundrkit.rules.json` uses `"source": "manual"`. Each rule needs `pattern`, `severity` (`error` or `warn`) and `source`. The linter checks `contract` and `version` too, and exits 2 if the file fails.

## Categorized forbidden.json

A `forbidden.json` with no `forbidden`, `rules` or `patterns` key is read as categories, the shape sample-foundrkit uses: `{"$schema", "_comment", "<category>": ["phrase", ...]}`. Every array becomes error rules with that category. A single token matches as a whole word. A phrase with a space matches as a substring. Do not point the linter at sample-foundrkit's `foundrkit.rules.json`. Its rules are ids whose logic lives in that repo's own script, and it fails to load here.

## Config schema

`foundrkit.config.js` exports an object. The phrases below are examples of banned phrases.

```js
module.exports = {
  extensions: ['.md', '.tsx', '.jsx', '.js', '.ts', '.html', '.txt'],  // optional
  skip: ['legacy/', 'vendor/'],                                         // optional, whole names only
  forbidden: [
    'synergy',                                                          // bare string = error
    ['delve', 'error', 'Cut it.'],
    { pattern: 'leverage', severity: 'warn', suggestion: 'Try "use".' },
    { pattern: '/transformative\\s+journey/gi', severity: 'error', suggestion: 'Use "the work".' },
    ['\u2014', 'error', 'No em dashes. Use a comma, colon, or period.'],
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

Matching:
- Plain strings match case-insensitive. A side that starts or ends with a word character gets a `\b` word boundary, so `delve` does not match "delved".
- A plain string made of punctuation, like `'\u2014'` (the em dash) or `'--'`, matches anywhere.
- Strings starting with `/` are regex literals, for example `"/foo\\s+bar/gi"` or `"/\\u2014/g"`.
- A rule with the wrong shape stops the run with exit code 2. Rules are never dropped silently.

## Drafting rules from user notes

When the user describes their voice ("we never say synergy, we always say ship not deliver, we cut adverbs"), turn each note into rules with this checklist:

1. **Forbidden phrase** → `{pattern: 'synergy', severity: 'error', suggestion: 'Be specific about the collaboration.'}`
2. **Required replacement** (X → Y) → flag X as an error with suggestion `Use "Y" instead.`
3. **Character or pattern constraint** (no em dashes, no "very + adjective") → a plain punctuation string like `'\u2014'`, or a regex literal like `'/\\bvery\\s+\\w+/gi'`
4. **Tone preference** → too soft to lint. Put it in `BRAND.md` instead.

**Hard rule:** never copy phrases from another company's `BRAND.md` into the user's config. Each project's rules come from that project. The starter file in `templates/foundrkit.config.starter.js` is the only seed. Everything else is the user's input.

## Output interpretation

After running `foundrkit-lint`:
- Read the terminal output. Each hit lists file, line, matched phrase, and suggestion.
- For each ERROR, propose a specific rewrite to the user.
- For each WARN, ask whether to make it an error or remove it from the rules.
- If `--reporter=json` was used, parse the JSON and surface only files with hits.
- Exit code 2 means the setup is wrong, not the copy. Fix the config first.

## What is not in this package

The package is open source under MIT: the engine, the reporters, the starter config, and this skill.

It does not include:
- Rule extraction from a website or a body of writing. whystrohm-voice-extract writes the voice profile, and `--from-brand` turns it into rules.
- Voice scoring or drift trend analysis
- Any company's actual `BRAND.md` content

If the user asks "can you extract the rules from my website?", the answer is: this skill cannot read the site. Run whystrohm-voice-extract to write `brand/voice-profile.json`, then `foundrkit-lint --from-brand`. Or draft rules with the user from their own notes.

## Works with

- `frontend-design`: when adding the lint step to a Next.js or Astro repo
- `mcp-builder`: when wrapping the linter as an MCP tool for other editors
- `webapp-testing`: when adding lint to a CI pipeline next to Playwright tests

## Reference

- Repo: https://github.com/whystrohm/foundrkit-lint
- Issues: https://github.com/whystrohm/foundrkit-lint/issues
