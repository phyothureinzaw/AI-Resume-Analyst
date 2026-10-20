import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

export const requestId: RequestHandler = (req, res, next) => {
  const id = req.header('x-request-id')?.trim() || randomUUID();
  res.setHeader('x-request-id', id);
  res.locals.requestId = id;
  next();
};
