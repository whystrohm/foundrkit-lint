'use strict';

const fs = require('fs');
const path = require('path');

function shouldSkip(name, skipList) {
  for (const pat of skipList) {
    if (name === pat) return true;
    if (name.includes(pat)) return true;
  }
  return false;
}

function collectFiles(target, config) {
  const { extensions, skip } = config;
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
    if (extensions.includes(ext) && !shouldSkip(path.basename(target), skip)) {
      results.push(target);
    }
    return results;
  }

  if (!stat.isDirectory()) return results;

  const entries = fs.readdirSync(target, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    if (shouldSkip(entry.name, skip)) continue;
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, config));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

module.exports = { collectFiles };
