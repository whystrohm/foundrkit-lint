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

function collectFiles(dir, config) {
  const { extensions, skip } = config;
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return results;
    throw err;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    if (shouldSkip(entry.name, skip)) continue;
    const fullPath = path.join(dir, entry.name);
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
