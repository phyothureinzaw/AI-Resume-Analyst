import type { RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import { extractUploadedPdf } from './extraction/pdf-extraction.js';
import { createResumesRepository } from './resumes.repository.js';
import { notFound, toResume, toResumeSummary, validateCreate, validateId, validateList, validatePatch } from './resumes.service.js';
import type { Pool } from 'pg';

function validationError(error: unknown): AppError { return error instanceof ZodError ? new AppError(400, 'Invalid resume request', 'VALIDATION_ERROR') : error instanceof AppError ? error : new AppError(500, 'Internal server error', 'INTERNAL_ERROR'); }
function userId(res: Parameters<RequestHandler>[1]): string { return res.locals.authUser.id as string; }

export function resumeController(pool: Pool) {
  const repo = createResumesRepository(pool);
  return {
    extract: (async (req, res, next) => { try { res.setHeader('Cache-Control', 'no-store'); const text = await extractUploadedPdf(req); res.status(200).json({ resumeText: text }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    create: (async (req, res, next) => { try { const saved = await repo.create(userId(res), validateCreate(req.body)); res.status(201).json({ resume: toResume(saved) }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    list: (async (req, res, next) => { try { const query = validateList(req.query); const result = await repo.list(userId(res), query.page, query.pageSize, query.search); res.status(200).json({ items: result.items.map(toResumeSummary), pagination: { page: query.page, pageSize: query.pageSize, totalItems: result.total, totalPages: Math.ceil(result.total / query.pageSize) } }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    get: (async (req, res, next) => { try { const resume = await repo.findById(userId(res), validateId(req.params)); if (!resume) return next(notFound()); res.status(200).json({ resume: toResume(resume) }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    update: (async (req, res, next) => { try { const resume = await repo.update(userId(res), validateId(req.params), validatePatch(req.body)); if (!resume) return next(notFound()); res.status(200).json({ resume: toResume(resume) }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    remove: (async (req, res, next) => { try { const deleted = await repo.remove(userId(res), validateId(req.params)); if (!deleted) return next(notFound()); res.status(204).send(); } catch (error) { next(validationError(error)); } }) as RequestHandler
  };
}
