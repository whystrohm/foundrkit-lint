'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_EXTENSIONS = ['.html', '.jsx', '.tsx', '.js', '.ts', '.md', '.mdx', '.txt'];

const DEFAULT_SKIP = [
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.vercel',
  '.cache',
  'dist',
  'build',
  'out',
  'coverage',
  '_source',
  '_archive',
  'foundrkit.config.*',
  '.foundrkitrc.json',
  'forbidden.json',
  'BRAND.md',
  'CLAUDE.md',
];

function compilePattern(raw) {
  if (raw instanceof RegExp) {
    // The matcher loops with exec(), which needs the global flag.
    return raw.global ? raw : new RegExp(raw.source, raw.flags + 'g');
  }
  if (typeof raw !== 'string') {
    throw new TypeError(`foundrkit-lint: pattern must be string or RegExp, got ${typeof raw}`);
  }
  if (raw.startsWith('/') && raw.lastIndexOf('/') > 0) {
    const lastSlash = raw.lastIndexOf('/');
    const body = raw.slice(1, lastSlash);
    const flags = raw.slice(lastSlash + 1) || 'gi';
    return new RegExp(body, flags.includes('g') ? flags : flags + 'g');
  }
  if (!raw.length) {
    throw new Error('foundrkit-lint: empty pattern string in rules');
  }
  // Plain strings match as whole words, case-insensitive.
  // The \b word boundary is only added on a side that starts or ends with a
  // word character. So "delve" becomes /\bdelve\b/gi, while a plain em dash
  // string ("\u2014") or "--" matches anywhere.
  const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lead = /^\w/.test(raw) ? '\\b' : '';
  const tail = /\w$/.test(raw) ? '\\b' : '';
  return new RegExp(`${lead}${escaped}${tail}`, 'gi');
}

function normaliseRule(raw, index) {
  // A bare string or RegExp is shorthand for [pattern, 'error'].
  if (typeof raw === 'string' || raw instanceof RegExp) {
    return {
      pattern: compilePattern(raw),
      severity: 'error',
      suggestion: '',
      category: 'forbidden',
    };
  }
  if (Array.isArray(raw)) {
    if (!raw.length) throw new Error(`foundrkit-lint: rule #${index + 1} is an empty array`);
    const [pattern, severity, suggestion] = raw;
    return {
      pattern: compilePattern(pattern),
      severity: severity === 'warn' ? 'warn' : 'error',
      suggestion: suggestion || '',
      category: 'forbidden',
    };
  }
  if (!raw || typeof raw !== 'object' || !raw.pattern) {
    throw new Error(
      `foundrkit-lint: rule #${index + 1} is not valid: ${JSON.stringify(raw)}. ` +
      'Use a string, a [pattern, severity, suggestion] array, or {pattern, severity, suggestion}.'
    );
  }
  const pattern = raw.pattern;
  return {
    pattern: compilePattern(pattern),
    severity: raw.severity === 'warn' ? 'warn' : 'error',
    suggestion: raw.suggestion || '',
    category: raw.category || 'forbidden',
  };
}

function loadFromJs(filePath) {
  delete require.cache[require.resolve(filePath)];
  try {
    return require(filePath);
  } catch (err) {
    const esm = err && (
      err.code === 'ERR_REQUIRE_ESM' ||
      err.code === 'ERR_REQUIRE_ASYNC_MODULE' ||
      /module is not defined in ES module scope|Cannot use import statement|Unexpected token 'export'/.test(err.message)
    );
    if (esm) {
      throw new Error(
        `foundrkit-lint: could not load ${filePath} as CommonJS. ` +
        'This project looks like an ES module package ("type": "module"). ' +
        'Rename the config to foundrkit.config.cjs and keep module.exports = { ... }, ' +
        'or use foundrkit.config.json.'
      );
    }
    throw err;
  }
}

function loadFromJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const CANDIDATES = [
  'foundrkit.config.js',
  'foundrkit.config.cjs',
  'foundrkit.config.json',
  'forbidden.json',
  '.foundrkitrc.json',
];

// Lookup order:
//   1. --config=PATH (relative to cwd)
//   2. a config file in cwd
//   3. a config file in each scanned directory (or the folder of a scanned file)
function locateConfig({ cwd, explicitPath, searchDirs = [] }) {
  if (explicitPath) {
    const resolved = path.isAbsolute(explicitPath)
      ? explicitPath
      : path.join(cwd, explicitPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`foundrkit-lint: config not found at ${resolved}`);
    }
    return resolved;
  }
  for (const dir of [cwd, ...searchDirs]) {
    for (const name of CANDIDATES) {
      const full = path.join(dir, name);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

function loadConfig({ cwd, explicitPath, searchDirs }) {
  const filePath = locateConfig({ cwd, explicitPath, searchDirs });
  if (!filePath) {
    return {
      rules: [],
      extensions: DEFAULT_EXTENSIONS,
      skip: DEFAULT_SKIP,
      source: null,
    };
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mjs') {
    throw new Error(
      `foundrkit-lint: ${filePath} is an .mjs file. ESM configs are not supported. ` +
      'Use foundrkit.config.cjs with module.exports = { ... }, or foundrkit.config.json.'
    );
  }
  const raw = ext === '.js' || ext === '.cjs' ? loadFromJs(filePath) : loadFromJson(filePath);

  const rawRules = raw.forbidden || raw.rules || raw.patterns || [];
  if (!Array.isArray(rawRules)) {
    throw new Error(`foundrkit-lint: "forbidden" in ${filePath} must be an array`);
  }
  const rules = rawRules.map(normaliseRule);

  const extensions = Array.isArray(raw.extensions) && raw.extensions.length
    ? raw.extensions
    : DEFAULT_EXTENSIONS;

  const skip = Array.isArray(raw.skip) && raw.skip.length
    ? DEFAULT_SKIP.concat(raw.skip)
    : DEFAULT_SKIP;

  return { rules, extensions, skip, source: filePath };
}

module.exports = { loadConfig, locateConfig, CANDIDATES, DEFAULT_EXTENSIONS, DEFAULT_SKIP, normaliseRule, compilePattern };
