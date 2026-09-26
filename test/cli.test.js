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
