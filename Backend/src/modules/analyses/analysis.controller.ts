import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createAnalysisRepository } from './analysis.repository.js';
import { PROMPT_VERSION, toDetail, validateCreate, validateId, validateList, validationError } from './analysis.service.js';
import { SCORING_VERSION } from './scoring.js';

function userId(res: Parameters<RequestHandler>[1]): string { return res.locals.authUser.id as string; }
export function analysesController(pool: Pool) {
  const repo = createAnalysisRepository(pool);
  return {
    create: (async (req, res, next) => { try { const input = validateCreate(req.body); const result = await repo.create(userId(res), input.resumeId, input.jobDescriptionId, input.requestId, env.GEMINI_MODEL, PROMPT_VERSION, SCORING_VERSION, env.ANALYSIS_MAX_ACTIVE_PER_USER); if (result.kind === 'conflict') return next(new AppError(409, 'Request ID was already used for a different selection', 'ANALYSIS_REQUEST_CONFLICT')); if (result.kind === 'limit') return next(new AppError(429, 'Too many analyses are already running', 'ANALYSIS_LIMIT_REACHED')); if (result.kind === 'missing') return next(new AppError(404, 'Resume or job description not found', 'SOURCE_NOT_FOUND')); res.status(result.kind === 'replay' ? 202 : 202).json({ analysisId: result.analysis!.id, status: result.analysis!.status, replayed: result.kind === 'replay' }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    list: (async (req, res, next) => { try { const query = validateList(req.query); const result = await repo.list(userId(res), query.page, query.pageSize, query.status); res.status(200).json({ items: result.items, pagination: { page: query.page, pageSize: query.pageSize, totalItems: result.total, totalPages: Math.ceil(result.total / query.pageSize) } }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    get: (async (req, res, next) => { try { const row = await repo.find(userId(res), validateId(req.params)); if (!row) return next(new AppError(404, 'Analysis not found', 'ANALYSIS_NOT_FOUND')); res.status(200).json({ analysis: toDetail(row) }); } catch (error) { next(validationError(error)); } }) as RequestHandler
  };
}
