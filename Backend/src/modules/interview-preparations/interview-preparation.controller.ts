import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { ZodError } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createInterviewPreparationRepository } from './interview-preparation.repository.js';
import { INTERVIEW_PROMPT_VERSION, INTERVIEW_RESULT_SCHEMA_VERSION, toDetail, toSummary, validateCreate, validateId, validateList } from './interview-preparation.service.js';

function userId(res: Parameters<RequestHandler>[1]): string { return res.locals.authUser.id as string; }
function validationError(error: unknown): AppError { return error instanceof ZodError ? new AppError(400, 'Invalid interview preparation request', 'VALIDATION_ERROR') : error instanceof AppError ? error : new AppError(500, 'Internal server error', 'INTERNAL_ERROR'); }

export function interviewPreparationController(pool: Pool) {
  const repo = createInterviewPreparationRepository(pool);
  return {
    create: (async (req, res, next) => { try { const input = validateCreate(req.body); const result = await repo.create(userId(res), input, INTERVIEW_PROMPT_VERSION, INTERVIEW_RESULT_SCHEMA_VERSION, env.INTERVIEW_PREPARATION_MAX_ACTIVE_PER_USER); if (result.kind === 'conflict') return next(new AppError(409, 'Request ID was already used for a different selection', 'INTERVIEW_PREPARATION_REQUEST_CONFLICT')); if (result.kind === 'limit') return next(new AppError(429, 'Too many interview preparations are already running', 'INTERVIEW_PREPARATION_LIMIT_REACHED')); if (result.kind === 'missing') return next(new AppError(404, 'Job description or resume not found', 'SOURCE_NOT_FOUND')); if (result.kind === 'too_large') return next(new AppError(400, 'The selected source text exceeds the supported limit', 'INTERVIEW_INPUT_TOO_LARGE')); if (result.kind === 'invalid_input') return next(new AppError(400, 'The selected job description does not contain enough meaningful content for interview preparation', 'INTERVIEW_JOB_CONTENT_INSUFFICIENT')); res.status(202).json({ preparationId: result.preparation!.id, status: result.preparation!.status, replayed: result.kind === 'replay' }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    list: (async (req, res, next) => { try { const query = validateList(req.query); const result = await repo.list(userId(res), query.page, query.pageSize, query.status); res.status(200).json({ items: result.items.map(toSummary), pagination: { page: query.page, pageSize: query.pageSize, totalItems: result.total, totalPages: Math.ceil(result.total / query.pageSize) } }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    get: (async (req, res, next) => { try { const row = await repo.find(userId(res), validateId(req.params)); if (!row) return next(new AppError(404, 'Interview preparation not found', 'INTERVIEW_PREPARATION_NOT_FOUND')); res.status(200).json({ preparation: toDetail(row) }); } catch (error) { next(validationError(error)); } }) as RequestHandler
  };
}
