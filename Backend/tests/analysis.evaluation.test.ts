import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisEvaluationFixtures } from './fixtures/analysis-evaluation.js';

test('synthetic evaluation set covers the hardening matrix without private data', () => {
  assert.equal(analysisEvaluationFixtures.length, 15);
  for (const fixture of analysisEvaluationFixtures) {
    assert.ok(fixture.intendedLanguage === 'en' || fixture.intendedLanguage === 'not-supported');
    assert.ok(fixture.resumeText.trim().length > 0);
    assert.ok(fixture.jobText.trim().length > 0);
  }
  const tags = new Set(analysisEvaluationFixtures.flatMap((fixture) => fixture.tags));
  for (const required of ['bullets', 'table-text', 'unicode-punctuation', 'repeated', 'ambiguous', 'irrelevant', 'no-requirements', 'prompt-injection', 'language-not-evaluated']) assert.ok(tags.has(required), `missing fixture tag: ${required}`);
});
