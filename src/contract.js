'use strict';

// Plain checks for the shared contracts in contracts/.
// The JSON schemas are the reference. These checks cover what the linter
// needs to trust a file, with no dependencies.

const SEVERITIES = ['error', 'warn'];
const SOURCES = ['voice-profile', 'brand-lock', 'manual'];

// Returns a list of problems. Empty list = the file is usable.
function checkRulesContract(raw) {
  const problems = [];
  if (raw.contract !== 'foundrkit-rules') {
    problems.push(`"contract" must be "foundrkit-rules", got ${JSON.stringify(raw.contract)}`);
  }
  if (raw.version !== '1') {
    problems.push(`"version" must be the string "1", got ${JSON.stringify(raw.version)}`);
  }
  if (typeof raw.brand !== 'string' || !raw.brand.length) {
    problems.push('"brand" must be a non-empty string');
  }
  if (raw.generated_from !== undefined &&
      (!Array.isArray(raw.generated_from) || raw.generated_from.some((s) => typeof s !== 'string'))) {
    problems.push('"generated_from" must be an array of strings');
  }
  if (!Array.isArray(raw.rules) || !raw.rules.length) {
    problems.push('"rules" must be an array with at least one rule');
    return problems;
  }
  raw.rules.forEach((rule, i) => {
    const at = `rule #${i + 1}`;
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      problems.push(`${at} must be an object`);
      return;
    }
    if (typeof rule.pattern !== 'string' || !rule.pattern.length) {
      problems.push(`${at}: "pattern" must be a non-empty string`);
    }
    if (!SEVERITIES.includes(rule.severity)) {
      problems.push(`${at}: "severity" must be "error" or "warn", got ${JSON.stringify(rule.severity)}`);
    }
    if (!SOURCES.includes(rule.source)) {
      problems.push(`${at}: "source" must be one of ${SOURCES.join(', ')}, got ${JSON.stringify(rule.source)}`);
    }
    for (const key of ['suggestion', 'category']) {
      if (rule[key] !== undefined && typeof rule[key] !== 'string') {
        problems.push(`${at}: "${key}" must be a string`);
      }
    }
  });
  return problems;
}

function checkVoiceProfileContract(raw) {
  const problems = [];
  if (!raw || typeof raw !== 'object') return ['the file is not a JSON object'];
  if (raw.contract !== 'voice-profile') {
    problems.push(`"contract" must be "voice-profile", got ${JSON.stringify(raw.contract)}`);
  }
  if (raw.version !== '1') {
    problems.push(`"version" must be the string "1", got ${JSON.stringify(raw.version)}`);
  }
  if (typeof raw.url !== 'string' || !/^https?:\/\//.test(raw.url)) {
    problems.push('"url" must start with http:// or https://');
  }
  if (!raw.vocabulary || typeof raw.vocabulary !== 'object') {
    problems.push('"vocabulary" must be an object');
  } else if (!Array.isArray(raw.vocabulary.absent_words)) {
    problems.push('"vocabulary.absent_words" must be an array');
  }
  if (!Array.isArray(raw.guardrails)) {
    problems.push('"guardrails" must be an array');
  } else {
    raw.guardrails.forEach((g, i) => {
      if (!g || typeof g.category !== 'string' || typeof g.rule !== 'string') {
        problems.push(`guardrail #${i + 1} needs a string "category" and "rule"`);
      }
    });
  }
  return problems;
}

module.exports = { checkRulesContract, checkVoiceProfileContract, SEVERITIES, SOURCES };
