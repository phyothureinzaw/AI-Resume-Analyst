import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisProcessingError, hasIdentifiableRequirements, parseProviderResult } from '../src/modules/analyses/analysis.service.js';
import { scoreAnalysis } from '../src/modules/analyses/scoring.js';
import { analysisJsonSchema, buildGeminiRequest, classifyGeminiError } from '../src/modules/analyses/gemini.provider.js';
import { EvidenceValidationError, normalizeEvidence, validateEvidence } from '../src/modules/analyses/evidence.js';
import type { AnalysisResult } from '../src/modules/analyses/analysis.types.js';

const base = { summary: 'Summary', requirements: [{ id: 'backend', requirementText: 'Backend services', jobEvidenceExcerpt: 'Build backend services', category: 'required' as const, evidenceStatus: 'supported' as const, resumeEvidenceExcerpts: ['Built backend services'], explanation: 'Direct evidence', suggestions: [] }], scoreExplanation: 'Weighted coverage.' };
test('computes deterministic weighted coverage and validates evidence', () => { const result = parseProviderResult(JSON.stringify(base), 'Built backend services', 'Build backend services'); assert.equal(result.score, 100); assert.equal(scoreAnalysis({ ...base, requirements: [{ id: 'backend', requirementText: 'Backend services', jobEvidenceExcerpt: 'Build backend services', category: 'required', evidenceStatus: 'partial', resumeEvidenceExcerpts: ['Built backend services'], explanation: 'Partial evidence', suggestions: [] }] }), 50); });
test('rejects fabricated or missing evidence', () => { const invalid = { ...base, requirements: [{ ...base.requirements[0], evidenceStatus: 'not_evidenced' as const, resumeEvidenceExcerpts: ['Built backend services'] }] }; assert.throws(() => parseProviderResult(JSON.stringify(invalid), 'Built backend services', 'Build backend services'), (error: unknown) => error instanceof AnalysisProcessingError && error.code === 'ANALYSIS_EVIDENCE_INVALID'); });
test('rejects duplicate requirement identifiers', () => { const invalid = { ...base, requirements: [base.requirements[0], base.requirements[0]] }; assert.throws(() => parseProviderResult(JSON.stringify(invalid), 'Built backend services', 'Build backend services'), (error: unknown) => error instanceof AnalysisProcessingError && error.code === 'ANALYSIS_EVIDENCE_INVALID'); });
test('preserves safe stage details for invalid provider output', () => {
  assert.throws(() => parseProviderResult('{', 'synthetic resume', 'synthetic job'), (error: unknown) => error instanceof AnalysisProcessingError && error.stage === 'json_parse' && error.code === 'ANALYSIS_INVALID_JSON');
  const invalidSchema = { ...base, requirements: [{ ...base.requirements[0], evidenceStatus: 'unsupported' }] };
  assert.throws(() => parseProviderResult(JSON.stringify(invalidSchema), 'synthetic resume', 'synthetic job'), (error: unknown) => error instanceof AnalysisProcessingError && error.stage === 'schema_validation' && error.fieldPaths.includes('requirements.0.evidenceStatus'));
  assert.throws(() => parseProviderResult(JSON.stringify(base), 'synthetic resume', 'synthetic job'), (error: unknown) => error instanceof AnalysisProcessingError && error.stage === 'evidence_validation' && error.code === 'ANALYSIS_EVIDENCE_INVALID');
});
test('returns a clear failure for a report with no identifiable requirements', () => {
  const emptyReport = { summary: 'No requirements found.', requirements: [], scoreExplanation: 'No score.' };
  assert.throws(() => parseProviderResult(JSON.stringify(emptyReport), 'Synthetic resume', 'A general opportunity.'), (error: unknown) => error instanceof AnalysisProcessingError && error.code === 'ANALYSIS_NO_REQUIREMENTS' && error.stage === 'schema_validation');
});
test('uses a conservative requirement preflight without pretending to detect every language', () => {
  assert.equal(hasIdentifiableRequirements('A great opportunity on a collaborative team.'), false);
  assert.equal(hasIdentifiableRequirements('Required: backend development and testing.'), true);
  assert.equal(hasIdentifiableRequirements('Expérience en gestion de comptes.'), false);
});
test('normalizes documented whitespace but rejects fabricated evidence', () => {
  validateEvidence(base, 'Built\nbackend services', 'Build\nbackend\tservices');
  assert.throws(() => validateEvidence(base, 'Built backend services', 'Build GraphQL services'), (error: unknown) => error instanceof EvidenceValidationError && error.issues[0]?.reason === 'no_exact_match');
});
test('uses conservative NFC and whitespace normalization for exact contiguous evidence', () => {
  const unicode = { ...base, requirements: [{ ...base.requirements[0]!, jobEvidenceExcerpt: 'Cafe\u0301 services', resumeEvidenceExcerpts: ['Built\u0301 backend services'] }] } as AnalysisResult;
  assert.equal(normalizeEvidence('Cafe\u0301\u00a0services'), 'Café services');
  assert.throws(() => validateEvidence(unicode, 'Built backend services', 'Cafe\u0301\u00a0services'), (error: unknown) => error instanceof EvidenceValidationError && error.issues[0]?.reason === 'no_exact_match');
  validateEvidence(base, 'Built\r\nbackend\u00a0services', 'Build\nbackend\tservices');
});
test('reports safe evidence diagnostics and rejects paraphrased, fabricated, and wrong-source excerpts', () => {
  const invalid = { ...base, requirements: [{ ...base.requirements[0]!, resumeEvidenceExcerpts: ['Build backend services'] }] } as AnalysisResult;
  assert.throws(() => validateEvidence(invalid, 'Built backend services', 'Build backend services'), (error: unknown) => {
    if (!(error instanceof EvidenceValidationError)) return false;
    assert.deepEqual(error.issues[0], { requirementIndex: 0, requirementId: 'backend', field: 'resumeEvidenceExcerpts', excerptIndex: 0, source: 'resume', reason: 'wrong_source', excerptLength: 22 });
    assert.doesNotMatch(JSON.stringify(error.issues), /Built|backend services/);
    return true;
  });
});
test('validates against the queued snapshots rather than later source edits', () => {
  const laterResume = 'Changed resume text';
  validateEvidence(base, 'Built backend services', 'Build backend services');
  assert.throws(() => validateEvidence(base, laterResume, 'Build backend services'), (error: unknown) => error instanceof EvidenceValidationError && error.issues[0]?.source === 'resume');
});
test('enforces conditional evidence rules for supported, partial, and not-evidenced requirements', () => {
  const supported = parseProviderResult(JSON.stringify(base), 'Built backend services', 'Build backend services');
  assert.equal(supported.result.requirements[0]?.evidenceStatus, 'supported');
  const partial = { ...base, requirements: [{ ...base.requirements[0], evidenceStatus: 'partial' as const }] };
  assert.equal(parseProviderResult(JSON.stringify(partial), 'Built backend services', 'Build backend services').result.requirements[0]?.evidenceStatus, 'partial');
  const notEvidenced = { ...base, requirements: [{ ...base.requirements[0], evidenceStatus: 'not_evidenced' as const, resumeEvidenceExcerpts: [] }] };
  assert.equal(parseProviderResult(JSON.stringify(notEvidenced), 'No matching experience', 'Build backend services').result.requirements[0]?.evidenceStatus, 'not_evidenced');
});
test('reduces verified evidence overflow deterministically and records safe counts', () => {
  const resume = 'Built backend services. Designed APIs. Tested services. Led teams.';
  const requirement = { ...base.requirements[0], resumeEvidenceExcerpts: ['Built backend services', 'Designed APIs', 'Tested services', 'Led teams'] };
  const parsed = parseProviderResult(JSON.stringify({ ...base, requirements: [requirement] }), resume, 'Build backend services');
  assert.deepEqual(parsed.result.requirements[0]?.resumeEvidenceExcerpts, ['Built backend services', 'Designed APIs', 'Tested services']);
  assert.deepEqual(parsed.normalization, { overflowRequirementCount: 1, inputExcerptCount: 4, deduplicatedExcerptCount: 0, truncatedExcerptCount: 1 });
});
test('deduplicates verified evidence before applying the three-excerpt limit', () => {
  const resume = 'Built backend services. Designed APIs. Tested services.';
  const requirement = { ...base.requirements[0], resumeEvidenceExcerpts: ['Built backend services', 'Designed APIs', 'Built\nbackend services', 'Tested services'] };
  const parsed = parseProviderResult(JSON.stringify({ ...base, requirements: [requirement] }), resume, 'Build backend services');
  assert.deepEqual(parsed.result.requirements[0]?.resumeEvidenceExcerpts, ['Built backend services', 'Designed APIs', 'Tested services']);
  assert.equal(parsed.normalization.deduplicatedExcerptCount, 1);
  assert.equal(parsed.normalization.truncatedExcerptCount, 0);
});
test('rejects an invalid excerpt anywhere in an overflow array', () => {
  const requirement = { ...base.requirements[0], resumeEvidenceExcerpts: ['Built backend services', 'Fabricated experience', 'Built backend services', 'Built backend services'] };
  assert.throws(() => parseProviderResult(JSON.stringify({ ...base, requirements: [requirement] }), 'Built backend services', 'Build backend services'), (error: unknown) => error instanceof AnalysisProcessingError && error.stage === 'evidence_validation' && error.code === 'ANALYSIS_EVIDENCE_INVALID');
});
test('reports safe evidence-field validation metadata for malformed provider output', () => {
  const cases = [
    { label: 'empty', value: [] },
    { label: 'missing', value: undefined },
    { label: 'null', value: null },
    { label: 'wrong-type', value: 'Built backend services' }
  ];
  for (const item of cases) {
    const requirement = item.label === 'missing'
      ? (() => { const { resumeEvidenceExcerpts, ...withoutEvidence } = base.requirements[0]!; void resumeEvidenceExcerpts; return { ...withoutEvidence, evidenceStatus: 'supported' as const }; })()
      : { ...base.requirements[0], evidenceStatus: 'supported' as const, resumeEvidenceExcerpts: item.value };
    const expectedStage = item.label === 'empty' ? 'evidence_validation' : 'schema_validation';
    assert.throws(() => parseProviderResult(JSON.stringify({ ...base, requirements: [requirement] }), 'Built backend services', 'Build backend services'), (error: unknown) => {
      if (!(error instanceof AnalysisProcessingError) || error.stage !== expectedStage) return false;
      if (expectedStage === 'evidence_validation') return error.code === 'ANALYSIS_EVIDENCE_INVALID';
      const issue = error.validationIssues.find((candidate) => candidate.path === 'requirements.0.resumeEvidenceExcerpts');
      return Boolean(issue && issue.code && issue.evidenceStatus === 'supported');
    });
  }
  const blank = { ...base, requirements: [{ ...base.requirements[0], resumeEvidenceExcerpts: ['   '] }] };
  assert.throws(() => parseProviderResult(JSON.stringify(blank), 'Built backend services', 'Build backend services'), (error: unknown) => error instanceof AnalysisProcessingError && error.stage === 'schema_validation' && error.validationIssues[0]?.path === 'requirements.0.resumeEvidenceExcerpts.0');
});
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
