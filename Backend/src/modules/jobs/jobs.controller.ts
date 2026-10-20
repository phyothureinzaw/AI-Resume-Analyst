import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import { createJobsRepository } from './jobs.repository.js';
import { notFound, toJob, toJobSummary, validateCreate, validateId, validateList, validatePatch } from './jobs.service.js';

function validationError(error: unknown): AppError { return error instanceof ZodError ? new AppError(400, 'Invalid job request', 'VALIDATION_ERROR') : error instanceof AppError ? error : new AppError(500, 'Internal server error', 'INTERNAL_ERROR'); }
function userId(res: Parameters<RequestHandler>[1]): string { return res.locals.authUser.id as string; }

export function jobsController(pool: Pool) {
  const repo = createJobsRepository(pool);
  return {
    create: (async (req, res, next) => { try { const saved = await repo.create(userId(res), validateCreate(req.body)); res.status(201).json({ job: toJob(saved) }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    list: (async (req, res, next) => { try { const query = validateList(req.query); const result = await repo.list(userId(res), query.page, query.pageSize, query.search); res.status(200).json({ items: result.items.map(toJobSummary), pagination: { page: query.page, pageSize: query.pageSize, totalItems: result.total, totalPages: Math.ceil(result.total / query.pageSize) } }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    get: (async (req, res, next) => { try { const job = await repo.findById(userId(res), validateId(req.params)); if (!job) return next(notFound()); res.status(200).json({ job: toJob(job) }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    update: (async (req, res, next) => { try { const job = await repo.update(userId(res), validateId(req.params), validatePatch(req.body)); if (!job) return next(notFound()); res.status(200).json({ job: toJob(job) }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    remove: (async (req, res, next) => { try { const deleted = await repo.remove(userId(res), validateId(req.params)); if (!deleted) return next(notFound()); res.status(204).send(); } catch (error) { next(validationError(error)); } }) as RequestHandler
  };
}
