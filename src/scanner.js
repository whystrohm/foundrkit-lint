'use strict';

const fs = require('fs');
const path = require('path');

// Turn a skip entry into a matcher.
// Entries are matched against whole path segments, never substrings.
//   'dist'                matches a file or folder named exactly "dist"
//   'legacy/'             same as 'legacy' (trailing slash is ignored)
//   'content/drafts'      matches that folder sequence anywhere in the path
//   'foundrkit.config.*'  "*" matches any run of characters inside one name
function compileSkip(raw) {
  const pat = String(raw).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (!pat) return null;
  const parts = pat.split('/').filter(Boolean).map((part) => {
    if (!part.includes('*')) return (seg) => seg === part;
    const re = new RegExp('^' + part.split('*').map(escapeRe).join('.*') + '$');
    return (seg) => re.test(seg);
  });
  return function matches(segments) {
    // True if the parts appear as a consecutive run that ends at the last segment.
    const n = parts.length;
    if (segments.length < n) return false;
    const start = segments.length - n;
    for (let i = 0; i < n; i++) {
      if (!parts[i](segments[start + i])) return false;
    }
    return true;
  };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeSkipper(skipList) {
  const matchers = (skipList || []).map(compileSkip).filter(Boolean);
  return function shouldSkip(fullPath) {
    const segments = path.resolve(fullPath).split(path.sep).filter(Boolean);
    return matchers.some((m) => m(segments));
  };
}

function collectFiles(target, config) {
  const { extensions } = config;
  const shouldSkip = makeSkipper(config.skip);
  const results = [];
  let stat;
  try {
    stat = fs.statSync(target);
  } catch (err) {
    if (err.code === 'ENOENT') return results;
    throw err;
  }

  if (stat.isFile()) {
    const ext = path.extname(target).toLowerCase();
    if (extensions.includes(ext) && !shouldSkip(target)) {
      results.push(target);
    }
    return results;
  }

  if (!stat.isDirectory()) return results;
  walk(target, extensions, shouldSkip, results);
  return results;
}

function walk(dir, extensions, shouldSkip, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    // Dotfiles and dot-folders are never scanned.
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (shouldSkip(fullPath)) continue;
    if (entry.isDirectory()) {
      walk(fullPath, extensions, shouldSkip, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) results.push(fullPath);
    }
  }
}

module.exports = { collectFiles, makeSkipper };
