import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../src/shared/errors/app-error.js';
import { validateCreate, validateId, validateList, validatePatch } from '../src/modules/resumes/resumes.service.js';

describe('resume validation', () => {
  it('normalizes valid create and list input', () => {
    assert.deepEqual(validateCreate({ title: '  Product Resume ', resumeText: '  Experience  ' }), { title: 'Product Resume', resumeText: '  Experience  ' });
    assert.deepEqual(validateList({ page: '2', pageSize: '25', search: ' engineer ' }), { page: 2, pageSize: 25, search: 'engineer' });
  });

  it('rejects blank text, unknown fields, and empty patches', () => {
    assert.throws(() => validateCreate({ title: 'Resume', resumeText: '   ' }), (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR');
    assert.throws(() => validateCreate({ title: 'Resume', resumeText: 'text', userId: 'wrong' }), (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR');
    assert.throws(() => validatePatch({}), (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR');
  });

  it('accepts only UUID route identifiers and bounds pagination', () => {
    assert.equal(validateId({ id: '00000000-0000-0000-0000-000000000001' }), '00000000-0000-0000-0000-000000000001');
    assert.throws(() => validateId({ id: 'not-a-uuid' }), (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR');
    assert.throws(() => validateList({ pageSize: '51' }), (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR');
  });
});
