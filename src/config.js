'use strict';

const fs = require('fs');
const path = require('path');
const { checkRulesContract } = require('./contract');

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
  'foundrkit.rules.json',
  'brand-lock.md',
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

// The shared rules file that "foundrkit-lint --from-brand" writes.
const BRAND_RULES = path.join('brand', 'foundrkit.rules.json');

// Lookup order, first match wins:
//   1. --config=PATH (relative to cwd)
//   2. a config file in cwd (CANDIDATES, in order)
//   3. brand/foundrkit.rules.json in cwd
//   4. a config file in each scanned directory (or the folder of a scanned file)
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
  for (const name of CANDIDATES) {
    const full = path.join(cwd, name);
    if (fs.existsSync(full)) return full;
  }
  const brandRules = path.join(cwd, BRAND_RULES);
  if (fs.existsSync(brandRules)) return brandRules;
  for (const dir of searchDirs) {
    for (const name of CANDIDATES) {
      const full = path.join(dir, name);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

// A single token matches as a whole word. A phrase with a space matches as a
// case-insensitive substring. This is how the categorized forbidden.json
// format is read by the linter it comes from.
function categoryPattern(phrase) {
  if (/\s/.test(phrase)) {
    return new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  }
  return compilePattern(phrase);
}

// {"$schema", "_comment", "<category>": ["phrase", ...], ...}
// Every array-valued key becomes error rules with category = key.
function categorizedRules(raw, filePath) {
  const rules = [];
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('_') || key.startsWith('$') || !Array.isArray(value)) continue;
    value.forEach((phrase, i) => {
      if (typeof phrase !== 'string' || !phrase.trim()) {
        throw new Error(
          `foundrkit-lint: "${key}" item #${i + 1} in ${filePath} must be a non-empty string`
        );
      }
      rules.push({ pattern: categoryPattern(phrase.trim()), severity: 'error', suggestion: '', category: key });
    });
  }
  return rules;
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

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`foundrkit-lint: ${filePath} must export an object`);
  }

  // A shared contract file. Check it before trusting it.
  if (raw.contract !== undefined) {
    const problems = raw.contract === 'foundrkit-rules'
      ? checkRulesContract(raw)
      : [`"contract" is ${JSON.stringify(raw.contract)}. Only "foundrkit-rules" files hold lint rules.`];
    if (problems.length) {
      throw new Error(
        `foundrkit-lint: ${filePath} is not a valid foundrkit-rules v1 file:\n` +
        problems.map((p) => `  - ${p}`).join('\n')
      );
    }
  }

  let rules;
  const rawRules = raw.forbidden || raw.rules || raw.patterns;
  if (rawRules !== undefined) {
    if (!Array.isArray(rawRules)) {
      throw new Error(`foundrkit-lint: "forbidden" in ${filePath} must be an array`);
    }
    rules = rawRules.map(normaliseRule);
  } else {
    rules = categorizedRules(raw, filePath);
  }

  const extensions = Array.isArray(raw.extensions) && raw.extensions.length
    ? raw.extensions
    : DEFAULT_EXTENSIONS;

  const skip = Array.isArray(raw.skip) && raw.skip.length
    ? DEFAULT_SKIP.concat(raw.skip)
    : DEFAULT_SKIP;

  return { rules, extensions, skip, source: filePath };
}

module.exports = { loadConfig, locateConfig, CANDIDATES, BRAND_RULES, DEFAULT_EXTENSIONS, DEFAULT_SKIP, normaliseRule, compilePattern };
