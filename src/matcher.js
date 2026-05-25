'use strict';

const fs = require('fs');

function scanFile(filePath, rules) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return [];
  }
  const lines = content.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(line)) !== null) {
        hits.push({
          line: i + 1,
          column: match.index + 1,
          text: line.trim().slice(0, 160),
          match: match[0],
          severity: rule.severity,
          suggestion: rule.suggestion,
          category: rule.category,
        });
        if (match.index === rule.pattern.lastIndex) rule.pattern.lastIndex++;
      }
    }
  }
  return hits;
}

module.exports = { scanFile };
