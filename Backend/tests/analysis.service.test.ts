import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProviderResult } from '../src/modules/analyses/analysis.service.js';
import { scoreAnalysis } from '../src/modules/analyses/scoring.js';
import { analysisJsonSchema, buildGeminiRequest, classifyGeminiError } from '../src/modules/analyses/gemini.provider.js';

const base = { summary: 'Summary', requirements: [{ id: 'backend', requirementText: 'Backend services', jobEvidenceExcerpt: 'Build backend services', category: 'required' as const, evidenceStatus: 'supported' as const, resumeEvidenceExcerpts: ['Built backend services'], explanation: 'Direct evidence', suggestions: [] }], scoreExplanation: 'Weighted coverage.' };
test('computes deterministic weighted coverage and validates evidence', () => { const result = parseProviderResult(JSON.stringify(base), 'Built backend services', 'Build backend services'); assert.equal(result.score, 100); assert.equal(scoreAnalysis({ ...base, requirements: [{ id: 'backend', requirementText: 'Backend services', jobEvidenceExcerpt: 'Build backend services', category: 'required', evidenceStatus: 'partial', resumeEvidenceExcerpts: ['Built backend services'], explanation: 'Partial evidence', suggestions: [] }] }), 50); });
test('rejects fabricated or missing evidence', () => { const invalid = { ...base, requirements: [{ ...base.requirements[0], evidenceStatus: 'not_evidenced' as const, resumeEvidenceExcerpts: ['Built backend services'] }] }; assert.throws(() => parseProviderResult(JSON.stringify(invalid), 'Built backend services', 'Build backend services'), /unsupported output/i); });
test('rejects duplicate requirement identifiers', () => { const invalid = { ...base, requirements: [base.requirements[0], base.requirements[0]] }; assert.throws(() => parseProviderResult(JSON.stringify(invalid), 'Built backend services', 'Build backend services'), /unsupported output/i); });
test('uses Gemini-compatible array schema keywords while retaining server-side limits', () => {
  const requirements = analysisJsonSchema.properties.requirements;
  const item = requirements.items;
  assert.equal('maxItems' in requirements, false);
  assert.equal('maxItems' in item.properties.resumeEvidenceExcerpts, false);
  assert.equal('maxItems' in item.properties.suggestions, false);
});
test('builds the supported structured-output request configuration', () => {
  const request = buildGeminiRequest('gemini-3.5-flash-lite', 'synthetic', new AbortController().signal);
  assert.equal(request.model, 'gemini-3.5-flash-lite');
  assert.equal(request.config.responseMimeType, 'application/json');
  assert.equal(request.config.temperature, 0.1);
  assert.equal(request.config.maxOutputTokens, 8000);
  assert.equal(request.config.responseJsonSchema, analysisJsonSchema);
  assert.match(request.config.systemInstruction, /structured resume-to-job evidence/);
});
test('classifies and sanitizes provider invalid-request details', () => {
  const error = classifyGeminiError(new Error(JSON.stringify({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Invalid JSON payload received. Unknown name "maxItems" in schema; apiKey=secret-value' } })));
  assert.equal(error.kind, 'invalid_request');
  assert.equal(error.details.httpStatus, 400);
  assert.equal(error.details.providerStatus, 'INVALID_ARGUMENT');
  assert.match(error.details.providerMessage ?? '', /maxItems/);
  assert.doesNotMatch(error.details.providerMessage ?? '', /secret-value/);
});
