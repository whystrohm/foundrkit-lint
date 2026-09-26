'use strict';

// foundrkit-lint --from-brand [dir]
// Builds dir/foundrkit.rules.json (contract foundrkit-rules, version "1")
// from dir/voice-profile.json and, if present, dir/brand-lock.md.
// Only text that names a quoted term or a known pattern becomes a rule.
// Everything else is listed as skipped, with a reason.

const fs = require('fs');
const path = require('path');
const { checkVoiceProfileContract, checkRulesContract } = require('./contract');

const EM_DASH = '/\\u2014/';
// "!" followed by a space or the end of the line. Skips "![", "!=" and "!important".
const EXCLAMATION = '/!(?=\\s|$)/';
// An exclamation point in a markdown heading or an HTML h1 to h6.
const HEADLINE_EXCLAMATION = '/^\\s*#{1,6}\\s.*!|<h[1-6][^>]*>[^<]*!/';
// Emoji pictographs. Leaves out symbols such as the trademark sign and arrows.
const EMOJI = '/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u';

// Double-quoted terms, straight or curly.
function quotedTerms(text) {
  const out = [];
  const re = /"([^"\n]+)"|\u201C([^\u201D\n]+)\u201D/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const term = (m[1] || m[2]).trim();
    if (term) out.push(term);
  }
  return out;
}

function sentences(text) {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

const BANS = /\b(never|no|avoid|don't|do not|cut)\b/i;

function shortSuggestion(rule) {
  const first = sentences(rule)[0] || '';
  return first.length <= 100 ? first : '';
}

function fromVoiceProfile(profile) {
  const rules = [];
  const skipped = [];
  (profile.guardrails || []).forEach((g) => {
    const text = g.rule;
    if (g.category === 'vocabulary') {
      // Take quoted terms only from sentences that ban something.
      const terms = [];
      for (const s of sentences(text)) {
        if (BANS.test(s)) terms.push(...quotedTerms(s));
      }
      if (!terms.length) {
        skipped.push({ from: 'voice-profile', text, reason: 'no quoted term in a sentence that bans it' });
        return;
      }
      const suggestion = shortSuggestion(text);
      for (const term of terms) {
        rules.push({ pattern: term, severity: 'error', ...(suggestion && { suggestion }), category: 'vocabulary', source: 'voice-profile' });
      }
      return;
    }
    if (g.category === 'tone' && /exclamation/i.test(text) && /\b(no|zero|never|avoid)\b/i.test(text)) {
      rules.push({ pattern: EXCLAMATION, severity: 'warn', suggestion: 'No exclamation marks.', category: 'tone', source: 'voice-profile' });
      return;
    }
    skipped.push({ from: 'voice-profile', text, reason: `a ${g.category} guardrail with no checkable pattern` });
  });
  for (const word of profile.vocabulary.absent_words || []) {
    if (typeof word !== 'string' || !word.trim()) continue;
    rules.push({
      pattern: word.trim(),
      severity: 'warn',
      suggestion: 'The site does not use this word.',
      category: 'vocabulary',
      source: 'voice-profile',
    });
  }
  return { rules, skipped };
}

// Lines under "## <heading>" until the next "## ".
function section(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inside = line.replace(/^##\s+/, '').trim().toLowerCase() === heading.toLowerCase();
      continue;
    }
    if (inside && /^\s*[-*]\s+/.test(line)) out.push(line.replace(/^\s*[-*]\s+/, '').trim());
  }
  return out;
}

function fromBrandLock(markdown) {
  const rules = [];
  const skipped = [];
  const lines = [
    ...section(markdown, 'Never list'),
    ...section(markdown, 'Voice rules'),
  ];
  for (const line of lines) {
    const found = [];
    // Only quoted terms inside the brackets of a "no X (...)" or "never use X (...)" line.
    const list = line.match(/^(?:no|never use)\b[^(]*\(([^)]*)\)/i);
    if (list) {
      for (const term of quotedTerms(list[1])) {
        found.push({ pattern: term, severity: 'error', category: 'vocabulary', source: 'brand-lock' });
      }
    }
    if (/^(no|never)\b/i.test(line)) {
      if (/em dash/i.test(line)) {
        found.push({ pattern: EM_DASH, severity: 'error', suggestion: 'Use a period, comma or colon.', category: 'punctuation', source: 'brand-lock' });
      }
      if (/emoji/i.test(line)) {
        found.push({ pattern: EMOJI, severity: 'error', suggestion: 'No emojis.', category: 'punctuation', source: 'brand-lock' });
      }
      if (/exclamation points? in headlines?/i.test(line)) {
        found.push({ pattern: HEADLINE_EXCLAMATION, severity: 'warn', suggestion: 'No exclamation points in headlines.', category: 'punctuation', source: 'brand-lock' });
      }
    }
    if (found.length) rules.push(...found);
    else skipped.push({ from: 'brand-lock', text: line, reason: 'not checkable in text' });
  }
  return { rules, skipped };
}

function brandLockTitle(markdown) {
  const m = markdown.match(/^#\s+(?:Brand Lock:\s*)?(.+)$/m);
  return m ? m[1].trim() : '';
}

function dedupe(rules) {
  const seen = new Set();
  return rules.filter((r) => {
    const key = r.pattern.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Returns an exit code. Writes the summary to stdout and problems to stderr.
function fromBrand({ cwd, dir = 'brand', force = false, out = process.stdout, err = process.stderr }) {
  const brandDir = path.resolve(cwd, dir);
  const profilePath = path.join(brandDir, 'voice-profile.json');
  const lockPath = path.join(brandDir, 'brand-lock.md');
  const outPath = path.join(brandDir, 'foundrkit.rules.json');
  const rel = (p) => path.relative(cwd, p).split(path.sep).join('/') || '.';

  if (!fs.existsSync(profilePath)) {
    err.write(`foundrkit-lint: ${rel(profilePath)} not found. Run whystrohm-voice-extract first, or pass the brand folder.\n`);
    return 2;
  }
  let profile;
  try {
    profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  } catch (e) {
    err.write(`foundrkit-lint: ${rel(profilePath)} is not valid JSON: ${e.message}\n`);
    return 2;
  }
  const problems = checkVoiceProfileContract(profile);
  if (problems.length) {
    err.write(`foundrkit-lint: ${rel(profilePath)} is not a valid voice-profile v1 file:\n` +
      problems.map((p) => `  - ${p}\n`).join(''));
    return 2;
  }
  if (fs.existsSync(outPath) && !force) {
    err.write(`foundrkit-lint: ${rel(outPath)} already exists. Refusing to overwrite. Use --force to replace it.\n`);
    return 1;
  }

  const fromProfile = fromVoiceProfile(profile);
  let fromLock = { rules: [], skipped: [] };
  let title = '';
  const generatedFrom = [rel(profilePath)];
  if (fs.existsSync(lockPath)) {
    const markdown = fs.readFileSync(lockPath, 'utf8');
    fromLock = fromBrandLock(markdown);
    title = brandLockTitle(markdown);
    generatedFrom.push(rel(lockPath));
  }

  const profileRules = dedupe(fromProfile.rules);
  const seen = new Set(profileRules.map((r) => r.pattern.toLowerCase()));
  const lockRules = dedupe(fromLock.rules).filter((r) => !seen.has(r.pattern.toLowerCase()));
  const rules = [...profileRules, ...lockRules];
  const duplicates = fromProfile.rules.length + fromLock.rules.length - rules.length;

  let host = '';
  try {
    host = new URL(profile.url).host.replace(/^www\./, '');
  } catch (e) {
    host = profile.url;
  }
  const doc = {
    contract: 'foundrkit-rules',
    version: '1',
    brand: title || host,
    generated_from: generatedFrom,
    rules,
  };
  const check = checkRulesContract(doc);
  if (check.length) {
    err.write('foundrkit-lint: could not build a valid rules file:\n' + check.map((p) => `  - ${p}\n`).join(''));
    return 2;
  }
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n');

  const skipped = [...fromProfile.skipped, ...fromLock.skipped];
  const lines = [
    `Wrote ${rel(outPath)} for ${doc.brand}.`,
    `  ${profileRules.length} rules from voice-profile`,
    `  ${lockRules.length} rules from brand-lock${fs.existsSync(lockPath) ? '' : ' (no brand-lock.md)'}`,
    `  ${duplicates} duplicates dropped (same pattern, first one kept)`,
    `  ${skipped.length} skipped`,
  ];
  for (const s of skipped) {
    lines.push(`    [${s.from}] ${s.reason}: ${s.text}`);
  }
  lines.push(rel(outPath) === 'brand/foundrkit.rules.json'
    ? 'Next: run "foundrkit-lint". It reads brand/foundrkit.rules.json when the current directory has no other config.'
    : `Next: run "foundrkit-lint --config=${rel(outPath)}".`);
  out.write(lines.join('\n') + '\n');
  return 0;
}

module.exports = { fromBrand, fromVoiceProfile, fromBrandLock, quotedTerms };
