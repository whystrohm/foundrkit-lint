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
  'foundrkit.config.js',
  'forbidden.json',
  'BRAND.md',
  'CLAUDE.md',
];

function compilePattern(raw) {
  if (raw instanceof RegExp) return raw;
  if (typeof raw !== 'string') {
    throw new TypeError(`foundrkit-lint: pattern must be string or RegExp, got ${typeof raw}`);
  }
  if (raw.startsWith('/') && raw.lastIndexOf('/') > 0) {
    const lastSlash = raw.lastIndexOf('/');
    const body = raw.slice(1, lastSlash);
    const flags = raw.slice(lastSlash + 1) || 'gi';
    return new RegExp(body, flags.includes('g') ? flags : flags + 'g');
  }
  const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'gi');
}

function normaliseRule(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const [pattern, severity, suggestion] = raw;
    return {
      pattern: compilePattern(pattern),
      severity: severity === 'warn' ? 'warn' : 'error',
      suggestion: suggestion || '',
      category: 'forbidden',
    };
  }
  const pattern = raw.pattern;
  if (!pattern) return null;
  return {
    pattern: compilePattern(pattern),
    severity: raw.severity === 'warn' ? 'warn' : 'error',
    suggestion: raw.suggestion || '',
    category: raw.category || 'forbidden',
  };
}

function loadFromJs(filePath) {
  delete require.cache[require.resolve(filePath)];
  return require(filePath);
}

function loadFromJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function locateConfig({ cwd, explicitPath }) {
  if (explicitPath) {
    const resolved = path.isAbsolute(explicitPath)
      ? explicitPath
      : path.join(cwd, explicitPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`foundrkit-lint: config not found at ${resolved}`);
    }
    return resolved;
  }
  const candidates = [
    'foundrkit.config.js',
    'foundrkit.config.cjs',
    'foundrkit.config.json',
    'forbidden.json',
    '.foundrkitrc.json',
  ];
  for (const name of candidates) {
    const full = path.join(cwd, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function loadConfig({ cwd, explicitPath }) {
  const filePath = locateConfig({ cwd, explicitPath });
  if (!filePath) {
    return {
      rules: [],
      extensions: DEFAULT_EXTENSIONS,
      skip: DEFAULT_SKIP,
      source: null,
    };
  }
  const ext = path.extname(filePath).toLowerCase();
  const raw = ext === '.js' || ext === '.cjs' ? loadFromJs(filePath) : loadFromJson(filePath);

  const rawRules = raw.forbidden || raw.rules || raw.patterns || [];
  const rules = rawRules.map(normaliseRule).filter(Boolean);

  const extensions = Array.isArray(raw.extensions) && raw.extensions.length
    ? raw.extensions
    : DEFAULT_EXTENSIONS;

  const skip = Array.isArray(raw.skip) && raw.skip.length
    ? DEFAULT_SKIP.concat(raw.skip)
    : DEFAULT_SKIP;

  return { rules, extensions, skip, source: filePath };
}

module.exports = { loadConfig, DEFAULT_EXTENSIONS, DEFAULT_SKIP, normaliseRule, compilePattern };
