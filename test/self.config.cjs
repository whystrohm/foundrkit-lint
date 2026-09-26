// Rules this repo applies to its own docs and code (npm run lint:self).
module.exports = {
  forbidden: [
    ['\u2014', 'error', 'No em dashes. Use a comma, colon, or period.'],
    ['/automat/gi', 'error', 'Say what the tool does instead.'],
  ],
};
