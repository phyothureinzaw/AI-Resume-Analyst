import Busboy from 'busboy';
import type { Request } from 'express';
import { AppError } from '../../../shared/errors/app-error.js';
import { extractPdfText } from './pdf-worker.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
let activeExtractions = 0;

export async function extractUploadedPdf(req: Request): Promise<string> {
  if (activeExtractions >= 1) throw new AppError(429, 'PDF extraction is busy. Try again shortly.', 'PDF_EXTRACTION_BUSY');
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) throw new AppError(400, 'Upload a PDF as multipart/form-data.', 'INVALID_UPLOAD');
  activeExtractions += 1;
  try {
    const data = await readPdfPart(req, contentType);
    if (!data.filename.toLowerCase().endsWith('.pdf') || data.mimeType.toLowerCase() !== 'application/pdf') throw new AppError(415, 'Upload a file with a .pdf extension and application/pdf content type.', 'UNSUPPORTED_FILE_TYPE');
    if (data.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new AppError(415, 'The uploaded file is not a valid PDF.', 'INVALID_PDF_SIGNATURE');
    return await extractPdfText(data.buffer);
  } finally { activeExtractions -= 1; }
}

function readPdfPart(req: Request, contentType: string): Promise<{ filename: string; mimeType: string; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    let fileSeen = false;
    let rejected = false;
    let filename = '';
    let mimeType = '';
    const chunks: Buffer[] = [];
    let total = 0;
    const fail = (error: Error) => { if (rejected) return; rejected = true; reject(error); };
    let parser: ReturnType<typeof Busboy>;
    try { parser = Busboy({ headers: { 'content-type': contentType }, limits: { files: 2, fileSize: MAX_FILE_SIZE } }); } catch { reject(new AppError(400, 'Invalid multipart upload.', 'INVALID_UPLOAD')); return; }
    parser.on('file', (fieldName, stream, info) => {
      if (fileSeen || fieldName !== 'file') { stream.resume(); fail(new AppError(400, 'Upload exactly one PDF in the file field.', 'INVALID_UPLOAD')); return; }
      fileSeen = true;
      filename = info.filename ?? '';
      mimeType = info.mimeType;
      stream.on('limit', () => fail(new AppError(413, 'PDF files must be 5 MiB or smaller.', 'PDF_TOO_LARGE')));
      stream.on('error', () => fail(new AppError(400, 'The uploaded file could not be read.', 'INVALID_UPLOAD')));
      stream.on('data', (chunk: Buffer) => { total += chunk.length; if (total <= MAX_FILE_SIZE && !rejected) chunks.push(chunk); });
    });
    parser.on('field', () => fail(new AppError(400, 'Upload exactly one PDF file without extra fields.', 'INVALID_UPLOAD')));
    parser.on('filesLimit', () => fail(new AppError(400, 'Upload exactly one PDF file.', 'INVALID_UPLOAD')));
    parser.on('partsLimit', () => fail(new AppError(400, 'Upload exactly one PDF file.', 'INVALID_UPLOAD')));
    parser.on('error', () => fail(new AppError(400, 'The multipart upload could not be read.', 'INVALID_UPLOAD')));
    parser.on('finish', () => { if (rejected) return; if (!fileSeen) { fail(new AppError(400, 'Choose one PDF file to upload.', 'PDF_REQUIRED')); return; } resolve({ filename, mimeType, buffer: Buffer.concat(chunks) }); });
    req.on('aborted', () => fail(new AppError(400, 'The upload was cancelled.', 'UPLOAD_CANCELLED')));
    req.pipe(parser);
  });
}
