'use strict';

// Run with: npm test  (node --test, Node 18 or later, no dependencies)

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'foundrkit-lint.js');
const EXAMPLES = path.join(ROOT, 'examples');

function cli(args, cwd = ROOT) {
  const res = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', timeout: 20000 });
  if (res.error) throw res.error;
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}

function json(args, cwd) {
  const res = cli([...args, '--reporter=json'], cwd);
  let report = null;
  if (res.stdout.trim()) report = JSON.parse(res.stdout);
  return { ...res, report };
}

const tempDirs = [];
test.after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

// Make a temp project from a { 'relative/path': 'content' } map.
function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundrkit-lint-test-'));
  tempDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

function config(rules) {
  return `module.exports = { forbidden: ${JSON.stringify(rules)} };\n`;
}

function scannedFiles(report) {
  return report.results.map((r) => r.file.split(path.sep).join('/')).sort();
}

// ─── examples ───────────────────────────────────────────────────────────

test('examples/before.md fails with the example config', () => {
  const { code, report } = json(['examples/']);
  assert.equal(code, 1);
  assert.equal(report.config, path.join('examples', 'foundrkit.config.js'));
  assert.equal(report.summary.filesScanned, 2);
  assert.equal(report.summary.filesWithIssues, 1);
  assert.equal(report.summary.errors, 8);
  assert.equal(report.summary.warnings, 8);
  assert.deepEqual(scannedFiles(report), [path.join('examples', 'before.md')]);
});

test('examples/after.md passes with the example config', () => {
  const { code, report } = json(['examples/after.md']);
  assert.equal(code, 0);
  assert.equal(report.summary.filesScanned, 1);
  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.warnings, 0);
});

test('--strict fails on warnings only; default mode passes', () => {
  const dir = project({
    'foundrkit.config.js': config([['leverage', 'warn', 'Try "use".']]),
    'page.md': 'We leverage it.\n',
  });
  assert.equal(cli(['.'], dir).code, 0);
  assert.equal(cli(['.', '--strict'], dir).code, 1);
});

// ─── skip matching (regression: substring skip) ───────────────────────

test('files whose names contain skip words are still linted', () => {
  const dir = project({
    'foundrkit.config.js': config(['leverage']),
    'about.md': 'We leverage it.\n',
    'checkout.md': 'We leverage it.\n',
    'layout.tsx': 'const s = "we leverage it";\n',
    'distribution.md': 'We leverage it.\n',
    'output/page.md': 'We leverage it.\n',
    'rebuild-notes.md': 'We leverage it.\n',
    'dist/page.md': 'We leverage it.\n',
    'build/page.md': 'We leverage it.\n',
    'out/page.md': 'We leverage it.\n',
    'coverage/page.md': 'We leverage it.\n',
    'node_modules/pkg/page.md': 'We leverage it.\n',
    '.hidden/page.md': 'We leverage it.\n',
    '.dotfile.md': 'We leverage it.\n',
  });
  const { code, report } = json(['.'], dir);
  assert.equal(code, 1);
  assert.deepEqual(scannedFiles(report), [
    'about.md',
    'checkout.md',
    'distribution.md',
    'layout.tsx',
    'output/page.md',
    'rebuild-notes.md',
  ]);
  assert.equal(report.summary.filesScanned, 6);
});

test('about.md passed as a single file target is linted', () => {
  const dir = project({ 'foundrkit.config.js': config(['leverage']), 'about.md': 'We leverage it.\n' });
  const { code, report } = json(['about.md'], dir);
  assert.equal(code, 1);
  assert.equal(report.summary.errors, 1);
});

test('user skip entries match folders by exact name or path', () => {
  const dir = project({
    'foundrkit.config.js': `module.exports = { skip: ['legacy/', 'content/drafts', '*.generated.md'], forbidden: ['leverage'] };\n`,
    'legacy/a.md': 'leverage\n',
    'legacy-notes.md': 'leverage\n',
    'content/drafts/b.md': 'leverage\n',
    'content/live/c.md': 'leverage\n',
    'drafts/d.md': 'leverage\n',
    'api.generated.md': 'leverage\n',
  });
  const { report } = json(['.'], dir);
  assert.deepEqual(scannedFiles(report), ['content/live/c.md', 'drafts/d.md', 'legacy-notes.md']);
});

// ─── setup problems exit 2 ─────────────────────────────────────────────

test('no rules found exits 2, even with --warn-only', () => {
  const dir = project({ 'page.md': 'We leverage it.\n' });
  const plain = cli(['.'], dir);
  assert.equal(plain.code, 2);
  assert.match(plain.stderr, /no rules found/);
  const warnOnly = cli(['.', '--warn-only'], dir);
  assert.equal(warnOnly.code, 2);
  assert.match(warnOnly.stderr, /no rules found/);
});

test('an invalid rule shape is rejected loudly', () => {
  const dir = project({
    'foundrkit.config.js': 'module.exports = { forbidden: [{ phrase: "leverage" }] };\n',
    'page.md': 'We leverage it.\n',
  });
  const res = cli(['.'], dir);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /rule #1 is not valid/);
});

test('unknown reporter and unknown flag exit 2', () => {
  assert.equal(cli(['examples/', '--reporter=xml']).code, 2);
  assert.equal(cli(['examples/', '--stirct']).code, 2);
});

// ─── rule forms and matching ───────────────────────────────────────────

test('a bare string rule is treated as an error rule', () => {
  const dir = project({
    'foundrkit.config.js': config(['leverage', ['synergy', 'warn']]),
    'page.md': 'We leverage synergy.\n',
  });
  const { code, report } = json(['.'], dir);
  assert.equal(code, 1);
  const hits = report.results[0].hits;
  assert.deepEqual(hits.map((h) => [h.match, h.severity]), [['leverage', 'error'], ['synergy', 'warn']]);
});

test('plain word strings still match whole words only', () => {
  const dir = project({
    'foundrkit.config.js': config(['delve']),
    'page.md': 'He delved in. Delve here.\n',
  });
  const { report } = json(['.'], dir);
  assert.deepEqual(report.results[0].hits.map((h) => h.match), ['Delve']);
});

test('em dash: plain string and regex literal both match', () => {
  const text = 'One \u2014 two.\nthree\u2014four.\nfive - six -- seven.\n';
  for (const rule of ['\u2014', '/\\u2014/g', '/\u2014/']) {
    const dir = project({ 'foundrkit.config.js': config([[rule, 'error', 'Use a comma.']]), 'page.md': text });
    const { code, report } = json(['.'], dir);
    assert.equal(code, 1, `rule ${JSON.stringify(rule)}`);
    assert.deepEqual(report.results[0].hits.map((h) => h.line), [1, 2], `rule ${JSON.stringify(rule)}`);
  }
});

test('a punctuation-only plain string like "--" matches anywhere', () => {
  const dir = project({ 'foundrkit.config.js': config(['--']), 'page.md': 'a -- b\nc--d\ne - f\n' });
  const { report } = json(['.'], dir);
  assert.deepEqual(report.results[0].hits.map((h) => h.line), [1, 2]);
});

test('a RegExp object without the g flag does not hang', () => {
  const dir = project({
    'foundrkit.config.js': 'module.exports = { forbidden: [[/leverage/i, "error"]] };\n',
    'page.md': 'Leverage and leverage.\n',
  });
  const { code, report } = json(['.'], dir);
  assert.equal(code, 1);
  assert.equal(report.summary.errors, 2);
});

test('forbidden.json config works', () => {
  const dir = project({
    'forbidden.json': JSON.stringify({ forbidden: [{ pattern: 'leverage', severity: 'warn' }, 'synergy'] }),
    'page.md': 'leverage synergy\n',
  });
  const { report } = json(['.'], dir);
  assert.equal(report.summary.errors, 1);
  assert.equal(report.summary.warnings, 1);
});

// ─── config lookup ─────────────────────────────────────────────────────

test('config is found in the scanned directory when cwd has none', () => {
  const dir = project({ 'site/foundrkit.config.js': config(['leverage']), 'site/page.md': 'leverage\n' });
  const { code, report } = json(['site'], dir);
  assert.equal(code, 1);
  assert.equal(report.config, path.join('site', 'foundrkit.config.js'));
});

test('a config in cwd wins over one in the scanned directory', () => {
  const dir = project({
    'foundrkit.config.js': config(['synergy']),
    'site/foundrkit.config.js': config(['leverage']),
    'site/page.md': 'leverage synergy\n',
  });
  const { report } = json(['site'], dir);
  assert.equal(report.config, 'foundrkit.config.js');
  assert.deepEqual(report.results[0].hits.map((h) => h.match), ['synergy']);
});

test('--config=PATH and --config PATH resolve relative to cwd', () => {
  const dir = project({ 'rules/voice.cjs': config(['leverage']), 'page.md': 'leverage\n' });
  for (const args of [['--config=rules/voice.cjs'], ['--config', 'rules/voice.cjs']]) {
    const { code, report } = json(['page.md', ...args], dir);
    assert.equal(code, 1);
    assert.equal(report.config, path.join('rules', 'voice.cjs'));
  }
  const missing = cli(['.', '--config=nope.js'], dir);
  assert.equal(missing.code, 2);
  assert.match(missing.stderr, /config not found/);
});

// ─── ES module packages ────────────────────────────────────────────────

test('ESM package: a CommonJS foundrkit.config.js fails with a clear message', () => {
  const dir = project({
    'package.json': JSON.stringify({ name: 'esm-site', type: 'module' }),
    'foundrkit.config.js': config(['leverage']),
    'page.md': 'leverage\n',
  });
  const res = cli(['.'], dir);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /foundrkit\.config\.cjs/);
});

test('ESM package: foundrkit.config.cjs works', () => {
  const dir = project({
    'package.json': JSON.stringify({ name: 'esm-site', type: 'module' }),
    'foundrkit.config.cjs': config(['leverage']),
    'page.md': 'leverage\n',
  });
  const { code, report } = json(['.'], dir);
  assert.equal(code, 1);
  assert.equal(report.config, 'foundrkit.config.cjs');
});

test('--init writes .cjs in an ESM package and .js otherwise', () => {
  const esm = project({ 'package.json': JSON.stringify({ name: 'esm-site', type: 'module' }) });
  assert.equal(cli(['--init'], esm).code, 0);
  assert.ok(fs.existsSync(path.join(esm, 'foundrkit.config.cjs')));
  assert.equal(cli(['--init'], esm).code, 1, 'refuses to overwrite');

  const cjs = project({ 'package.json': JSON.stringify({ name: 'cjs-site' }) });
  assert.equal(cli(['--init'], cjs).code, 0);
  assert.ok(fs.existsSync(path.join(cjs, 'foundrkit.config.js')));
  // The starter config loads and has rules.
  fs.writeFileSync(path.join(cjs, 'page.md'), 'We delve.\n');
  assert.equal(cli(['.'], cjs).code, 1);
});

// ─── reporters ─────────────────────────────────────────────────────────

test('json reporter shape', () => {
  const { report } = json(['examples/before.md']);
  assert.deepEqual(Object.keys(report), ['tool', 'version', 'target', 'targets', 'config', 'summary', 'results']);
  assert.equal(report.tool, 'foundrkit-lint');
  assert.equal(report.version, require('../package.json').version);
  assert.equal(report.target, path.join('examples', 'before.md'));
  assert.deepEqual(report.targets, [path.join('examples', 'before.md')]);
  assert.deepEqual(Object.keys(report.summary), ['filesScanned', 'filesWithIssues', 'errors', 'warnings']);
  const hit = report.results[0].hits[0];
  assert.deepEqual(Object.keys(hit), ['line', 'column', 'match', 'severity', 'suggestion', 'category', 'text']);
  assert.deepEqual([hit.line, hit.column, hit.match, hit.severity], [3, 1, 'In conclusion', 'error']);
});

test('github-action reporter prints annotations', () => {
  const res = cli(['examples/before.md', '--reporter=github-action']);
  assert.equal(res.code, 1);
  const lines = res.stdout.trim().split('\n');
  assert.equal(
    lines[0],
    '::error file=examples/before.md,line=3,col=1,title=Voice violation::Matched "In conclusion": Cut entirely. The conclusion is the last sentence.'
  );
  assert.match(lines[lines.length - 1], /^::notice title=foundrkit-lint::Scanned 1 files\. 8 errors, 8 warnings, 1 files flagged\.$/);
});

test('--help exits 0', () => {
  const res = cli(['--help']);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /Usage:/);
});

// ─── brand/ folder and the foundrkit-rules contract ────────────────────

const FIXTURES = path.join(__dirname, 'fixtures');
const RULES_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'contracts', 'foundrkit-rules.v1.schema.json'), 'utf8')
);

// A small JSON Schema check for the keywords the vendored schemas use:
// type, const, enum, required, properties, additionalProperties: false,
// items, minItems, minLength. Returns a list of problems.
function schemaErrors(schema, value, at = '(root)') {
  const errors = [];
  const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
  if (schema.type && typeOf(value) !== schema.type) return [`${at}: expected ${schema.type}`];
  if ('const' in schema && value !== schema.const) errors.push(`${at}: expected ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: not one of ${schema.enum.join(', ')}`);
  if (typeof value === 'string' && schema.minLength && value.length < schema.minLength) errors.push(`${at}: too short`);
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${at}: too few items`);
    if (schema.items) value.forEach((v, i) => errors.push(...schemaErrors(schema.items, v, `${at}/${i}`)));
  }
  if (typeOf(value) === 'object') {
    for (const key of schema.required || []) if (!(key in value)) errors.push(`${at}: missing ${key}`);
    for (const [key, v] of Object.entries(value)) {
      const sub = (schema.properties || {})[key];
      if (sub) errors.push(...schemaErrors(sub, v, `${at}/${key}`));
      else if (schema.additionalProperties === false) errors.push(`${at}: unexpected ${key}`);
    }
  }
  return errors;
}

function rulesFile(rules, extra = {}) {
  return JSON.stringify({ contract: 'foundrkit-rules', version: '1', brand: 'Example', rules, ...extra });
}

test('the schema check catches a bad rules file', () => {
  assert.deepEqual(schemaErrors(RULES_SCHEMA, JSON.parse(rulesFile([{ pattern: 'x', severity: 'error', source: 'manual' }]))), []);
  const bad = schemaErrors(RULES_SCHEMA, { contract: 'foundrkit-rules', version: 1, brand: 'x', rules: [{ pattern: 'x', severity: 'block' }] });
  assert.ok(bad.some((e) => /version/.test(e)));
  assert.ok(bad.some((e) => /severity/.test(e)));
  assert.ok(bad.some((e) => /missing source/.test(e)));
});

test('the vendored example passes the vendored schema', () => {
  const example = JSON.parse(fs.readFileSync(path.join(EXAMPLES, 'foundrkit-rules.example.json'), 'utf8'));
  assert.deepEqual(schemaErrors(RULES_SCHEMA, example), []);
});

test('brand/foundrkit.rules.json is found when cwd has no other config', () => {
  const dir = project({
    'brand/foundrkit.rules.json': rulesFile([{ pattern: 'leverage', severity: 'error', source: 'manual' }]),
    'page.md': 'We leverage it.\n',
  });
  const { code, report } = json(['page.md'], dir);
  assert.equal(code, 1);
  assert.equal(report.config, path.join('brand', 'foundrkit.rules.json'));
});

test('a config file in cwd wins over brand/foundrkit.rules.json', () => {
  const dir = project({
    'foundrkit.config.js': config(['synergy']),
    'brand/foundrkit.rules.json': rulesFile([{ pattern: 'leverage', severity: 'error', source: 'manual' }]),
    'page.md': 'leverage synergy\n',
  });
  const { report } = json(['page.md'], dir);
  assert.equal(report.config, 'foundrkit.config.js');
});

test('brand/foundrkit.rules.json wins over a config in a scanned directory', () => {
  const dir = project({
    'brand/foundrkit.rules.json': rulesFile([{ pattern: 'leverage', severity: 'error', source: 'manual' }]),
    'site/foundrkit.config.js': config(['synergy']),
    'site/page.md': 'leverage synergy\n',
  });
  const { report } = json(['site'], dir);
  assert.equal(report.config, path.join('brand', 'foundrkit.rules.json'));
});

test('a foundrkit-rules file that breaks the contract exits 2', () => {
  const cases = [
    [rulesFile([{ pattern: 'leverage', severity: 'error', source: 'manual' }], { version: '2' }), /"version" must be the string "1"/],
    [rulesFile([{ pattern: 'leverage', severity: 'block', source: 'manual' }]), /"severity" must be "error" or "warn"/],
    [rulesFile([{ pattern: 'leverage', severity: 'error' }]), /"source" must be one of/],
    [rulesFile([{ severity: 'error', source: 'manual' }]), /"pattern" must be a non-empty string/],
    [JSON.stringify({ contract: 'voice-profile', version: '1' }), /Only "foundrkit-rules" files hold lint rules/],
  ];
  for (const [content, message] of cases) {
    const dir = project({ 'brand/foundrkit.rules.json': content, 'page.md': 'leverage\n' });
    const res = cli(['page.md', '--warn-only'], dir);
    assert.equal(res.code, 2, content);
    assert.match(res.stderr, /not a valid foundrkit-rules v1 file/);
    assert.match(res.stderr, message);
  }
});

// The categorized format: {"$schema", "_comment", "<category>": [phrases]}.
// Shaped like sample-foundrkit's forbidden.json. The phrases are examples of banned phrases.
test('categorized forbidden.json: each array key becomes error rules in that category', () => {
  const dir = project({
    'forbidden.json': JSON.stringify({
      $schema: './foundrkit.rules.json',
      _comment: 'Categories are organizational only.',
      globally_banned_words: ['leverage', 'game-changing'],
      ai_era_clutter: ['In today\'s fast-paced', 'harness the power of'],
      filler_modifiers: ['very'],
    }),
    'page.md': [
      'Every step, very clear.',
      'We leverage it. Leveraging is fine here.',
      'A game-changing idea.',
      'in today\'s fast-paced world, harness the power of.',
      'We harness the power ofsome thing.',
    ].join('\n') + '\n',
  });
  const { code, report } = json(['page.md'], dir);
  assert.equal(code, 1);
  const hits = report.results[0].hits.map((h) => [h.line, h.match, h.category, h.severity]);
  assert.deepEqual(hits, [
    [1, 'very', 'filler_modifiers', 'error'],
    [2, 'leverage', 'globally_banned_words', 'error'],
    [3, 'game-changing', 'globally_banned_words', 'error'],
    [4, 'in today\'s fast-paced', 'ai_era_clutter', 'error'],
    [4, 'harness the power of', 'ai_era_clutter', 'error'],
    [5, 'harness the power of', 'ai_era_clutter', 'error'],
  ]);
});

// ─── --from-brand ──────────────────────────────────────────────────────

function brandProject(extra = {}) {
  return project({
    'brand/voice-profile.json': fs.readFileSync(path.join(FIXTURES, 'brand', 'voice-profile.json'), 'utf8'),
    'brand/brand-lock.md': fs.readFileSync(path.join(FIXTURES, 'brand', 'brand-lock.md'), 'utf8'),
    ...extra,
  });
}

function readRules(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'brand', 'foundrkit.rules.json'), 'utf8'));
}

test('--from-brand builds a valid foundrkit-rules file', () => {
  const dir = brandProject();
  const res = cli(['--from-brand'], dir);
  assert.equal(res.code, 0, res.stderr);
  const doc = readRules(dir);
  assert.deepEqual(schemaErrors(RULES_SCHEMA, doc), []);
  assert.equal(doc.brand, 'WhyStrohm');
  assert.deepEqual(doc.generated_from, ['brand/voice-profile.json', 'brand/brand-lock.md']);

  const find = (p) => doc.rules.find((r) => r.pattern === p);
  // Quoted terms in the vocabulary guardrail. Examples of banned words from the fixture.
  for (const word of ['solutions', 'synergy', 'world-class']) {
    assert.equal(find(word).severity, 'error', word);
    assert.equal(find(word).source, 'voice-profile', word);
  }
  // The tone guardrail on exclamation marks.
  assert.equal(find('/!(?=\\s|$)/').source, 'voice-profile');
  // brand-lock: em dash, and quoted hype words.
  assert.equal(find('/\\u2014/').source, 'brand-lock');
  assert.equal(find('game-changing').source, 'brand-lock');
  assert.equal(find('kind of').severity, 'error');
  // Dedupe is by lowercase pattern.
  const keys = doc.rules.map((r) => r.pattern.toLowerCase());
  assert.equal(new Set(keys).size, keys.length);
  // Nothing is dropped silently.
  assert.match(res.stdout, /rules from voice-profile/);
  assert.match(res.stdout, /rules from brand-lock/);
  assert.match(res.stdout, /skipped/);
  assert.match(res.stdout, /Keep sentences under 14 words/);
  assert.match(res.stdout, /never show an empty frame/);
});

test('--from-brand reads absent_words as warn rules', () => {
  const profile = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'brand', 'voice-profile.json'), 'utf8'));
  profile.guardrails = profile.guardrails.filter((g) => g.category !== 'vocabulary');
  const dir = project({ 'brand/voice-profile.json': JSON.stringify(profile) });
  assert.equal(cli(['--from-brand'], dir).code, 0);
  const doc = readRules(dir);
  assert.equal(doc.brand, 'northwind.example');
  assert.deepEqual(doc.generated_from, ['brand/voice-profile.json']);
  const solutions = doc.rules.find((r) => r.pattern === 'solutions');
  assert.equal(solutions.severity, 'warn');
});

test('--from-brand refuses to overwrite without --force', () => {
  const dir = brandProject({ 'brand/foundrkit.rules.json': '{"keep": true}\n' });
  const res = cli(['--from-brand'], dir);
  assert.equal(res.code, 1);
  assert.match(res.stderr, /Refusing to overwrite/);
  assert.equal(fs.readFileSync(path.join(dir, 'brand', 'foundrkit.rules.json'), 'utf8'), '{"keep": true}\n');
  assert.equal(cli(['--from-brand', '--force'], dir).code, 0);
  assert.equal(readRules(dir).contract, 'foundrkit-rules');
});

test('--from-brand takes a folder argument', () => {
  const dir = project({
    'voice/voice-profile.json': fs.readFileSync(path.join(FIXTURES, 'brand', 'voice-profile.json'), 'utf8'),
  });
  const res = cli(['--from-brand', 'voice'], dir);
  assert.equal(res.code, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'voice', 'foundrkit.rules.json')));
  assert.match(res.stdout, /--config=voice\/foundrkit\.rules\.json/);
});

test('--from-brand exits 2 on a missing or wrong voice profile', () => {
  const missing = cli(['--from-brand'], project({ 'page.md': 'x\n' }));
  assert.equal(missing.code, 2);
  assert.match(missing.stderr, /voice-profile\.json not found/);

  const wrong = project({ 'brand/voice-profile.json': JSON.stringify({ contract: 'voice-profile', version: '2' }) });
  const res = cli(['--from-brand'], wrong);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /not a valid voice-profile v1 file/);
  assert.ok(!fs.existsSync(path.join(wrong, 'brand', 'foundrkit.rules.json')));
});

test('linting with the generated rules catches a banned word and an em dash', () => {
  const dir = brandProject({
    'page.md': [
      'We sell solutions.',
      'One step \u2014 then the next.',
      'We plan every shoot before we book it.',
    ].join('\n') + '\n',
  });
  assert.equal(cli(['--from-brand'], dir).code, 0);
  const { code, report } = json(['page.md'], dir);
  assert.equal(code, 1);
  assert.equal(report.config, path.join('brand', 'foundrkit.rules.json'));
  const hits = report.results[0].hits.map((h) => [h.line, h.match, h.severity]);
  assert.deepEqual(hits, [[1, 'solutions', 'error'], [2, '\u2014', 'error']]);
});

test('brand-lock.md is skipped when a brand folder is scanned', () => {
  const dir = brandProject();
  assert.equal(cli(['--from-brand'], dir).code, 0);
  const { code, report } = json(['.'], dir);
  assert.equal(code, 0);
  assert.equal(report.summary.filesScanned, 0);
});
