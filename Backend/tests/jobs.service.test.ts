import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../src/shared/errors/app-error.js';
import { validateCreate, validateId, validateList, validatePatch } from '../src/modules/jobs/jobs.service.js';

describe('job validation', () => {
  it('normalizes optional company values and preserves description line breaks', () => {
    assert.deepEqual(validateCreate({ jobTitle: '  Engineer ', companyName: '   ', descriptionText: 'Line one\nLine two' }), { jobTitle: 'Engineer', companyName: null, descriptionText: 'Line one\nLine two' });
    assert.deepEqual(validatePatch({ companyName: null }), { companyName: null });
    assert.deepEqual(validatePatch({ companyName: '  Acme ' }), { companyName: 'Acme' });
  });

  it('rejects blank, over-limit, unknown, empty, and invalid inputs', () => {
    assert.throws(() => validateCreate({ jobTitle: ' ', descriptionText: 'text' }), (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR');
    assert.throws(() => validateCreate({ jobTitle: 'Job', descriptionText: ' ' }), (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR');
    assert.throws(() => validateCreate({ jobTitle: 'Job', descriptionText: 'text', user_id: 'unexpected' }), (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR');
    assert.throws(() => validatePatch({}), (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR');
    assert.throws(() => validateList({ page: '0', pageSize: '51' }), (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR');
    assert.throws(() => validateId({ id: 'not-a-uuid' }), (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR');
  });
});
