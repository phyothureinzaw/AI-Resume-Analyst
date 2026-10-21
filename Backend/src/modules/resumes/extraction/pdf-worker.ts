import { spawn } from 'node:child_process';
import { AppError } from '../../../shared/errors/app-error.js';
import { MAX_PDF_EXTRACTED_TEXT_LENGTH } from '../../../shared/content-limits.js';

const MAX_TEXT_LENGTH = MAX_PDF_EXTRACTED_TEXT_LENGTH;
const PARSE_TIMEOUT_MS = 10_000;
const CHILD_MEMORY_MB = 64;
const CHILD_STACK_KB = 4096;
const childCode = `
  const chunks = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('end', async () => {
    let parser;
    try {
      const { PDFParse } = await import('pdf-parse');
      parser = new PDFParse({ data: Buffer.concat(chunks) });
      const result = await parser.getText();
      const text = result.text;
      if (text.length > ${MAX_TEXT_LENGTH}) {
        await parser.destroy();
        process.stdout.write(JSON.stringify({ error: 'TEXT_LIMIT' }));
        return;
      }
      await parser.destroy();
      process.stdout.write(JSON.stringify({ text }));
    } catch (error) {
      if (parser && typeof parser.destroy === 'function') {
        try { await parser.destroy(); } catch {}
      }
      process.stdout.write(JSON.stringify({ error: error?.message || 'PDF_PARSE_FAILED' }));
    }
  });
`;
type ChildResult = { text?: string; error?: string };

function parserError(code = 'PDF_INVALID'): AppError {
  if (code === 'TEXT_LIMIT') return new AppError(422, 'The extracted resume text exceeds 100,000 characters.', 'PDF_TEXT_TOO_LARGE');
  return new AppError(422, 'The PDF could not be read. If it is scanned or image-only, paste the resume text instead.', 'PDF_INVALID');
}

export async function extractPdfText(data: Buffer): Promise<string> {
  const child = spawn(process.execPath, [`--max-old-space-size=${CHILD_MEMORY_MB}`, `--stack-size=${CHILD_STACK_KB}`, '-e', childCode], { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  return new Promise((resolve, reject) => {
    const output: Buffer[] = [];
    let settled = false;
    const finish = (fn: () => void) => { if (settled) return; settled = true; clearTimeout(timeout); fn(); };
    const terminate = () => { if (!child.killed) child.kill(); };
    const timeout = setTimeout(() => { terminate(); finish(() => reject(new AppError(422, 'PDF extraction timed out. Try pasting the resume text instead.', 'PDF_EXTRACTION_TIMEOUT'))); }, PARSE_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    child.on('error', () => finish(() => reject(parserError())));
    child.on('close', (code) => finish(() => {
      if (code !== 0) { reject(parserError()); return; }
      let result: ChildResult;
      try { result = JSON.parse(Buffer.concat(output).toString('utf8')) as ChildResult; } catch { reject(parserError()); return; }
      if (result.error) { reject(parserError(result.error === 'TEXT_LIMIT' ? 'TEXT_LIMIT' : 'PDF_INVALID')); return; }
      if (!result.text?.trim()) { reject(new AppError(422, 'No selectable text was found. OCR is not supported yet; paste the resume text instead.', 'PDF_TEXT_EMPTY')); return; }
      resolve(result.text);
    }));
    child.stdin.end(data);
  });
}
