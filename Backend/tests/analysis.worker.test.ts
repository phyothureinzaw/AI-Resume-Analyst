import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisProcessingError } from '../src/modules/analyses/analysis.service.js';
import { classifyWorkerFailure } from '../src/modules/analyses/analysis.worker.js';

test('maps unexpected worker exceptions to a safe stage-specific failure', () => {
  const result = classifyWorkerFailure(new TypeError('database completion failed for "private resume text that must not be logged"'), 'database_completion');
  assert.deepEqual(result, {
    stage: 'database_completion',
    exceptionName: 'TypeError',
    safeErrorCode: 'ANALYSIS_DATABASE_COMPLETION_FAILED',
    exceptionMessage: 'database completion failed for "[content redacted]"'
  });
});

test('preserves structured processing diagnostics without document values', () => {
  const error = new AnalysisProcessingError('schema_validation', 'ANALYSIS_SCHEMA_INVALID', ['requirements.0.resumeEvidenceExcerpts'], [{ code: 'too_big', path: 'requirements.0.resumeEvidenceExcerpts', maximum: 3, evidenceStatus: 'supported' }]);
  const result = classifyWorkerFailure(error, 'schema_validation');
  assert.equal(result.safeErrorCode, 'ANALYSIS_SCHEMA_INVALID');
  assert.deepEqual(result.validationFieldPaths, ['requirements.0.resumeEvidenceExcerpts']);
  const issues = result.validationIssues as Array<{ maximum?: number }> | undefined;
  assert.equal(issues?.[0]?.maximum, 3);
  assert.doesNotMatch(JSON.stringify(result), /resume text|document contents/);
});
