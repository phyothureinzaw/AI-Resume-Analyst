import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import type { Pool } from 'pg';
import { createApp } from '../src/app.js';
import { hashSessionToken } from '../src/modules/auth/auth.service.js';

const user = { id: '00000000-0000-0000-0000-000000000001', full_name: 'Test User', email: 'test@example.com', password_hash: 'not-returned', created_at: new Date('2026-01-01T00:00:00.000Z') };

function validPdfFixture(): Buffer {
  const stream = 'BT /F1 12 Tf 72 720 Td (Hello Resume) Tj ET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

function pool(): Pick<Pool, 'query'> {
  return { query: async (sql: string, values?: unknown[]) => {
    if (sql.includes('FROM auth_sessions')) {
      assert.equal(values?.[0], hashSessionToken('synthetic-session'));
      return { rows: [user] };
    }
    if (sql === 'SELECT 1') return { rows: [] };
    throw new Error(`Unexpected test query: ${sql}`);
  } } as unknown as Pick<Pool, 'query'>;
}

describe('resume extraction failure isolation', () => {
  it('rejects extraction before reading a file when unauthenticated', async () => {
    const response = await request(createApp(pool()))
      .post('/api/resumes/extract')
      .attach('file', Buffer.from('%PDF-1.4\nsynthetic'), { filename: 'synthetic.pdf', contentType: 'application/pdf' });
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
  });

  it('extracts selectable text from a valid PDF without creating a row', async () => {
    const app = createApp(pool());
    const response = await request(app)
      .post('/api/resumes/extract')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', ['resume_match_session=synthetic-session', 'resume_match_csrf=synthetic-csrf'])
      .set('X-CSRF-Token', 'synthetic-csrf')
      .attach('file', validPdfFixture(), { filename: 'synthetic.pdf', contentType: 'application/pdf' });

    assert.equal(response.status, 200);
    assert.match(response.body.resumeText, /Hello Resume/);
  });

  it('returns a sanitized parser error and keeps health available', async () => {
    const app = createApp(pool());
    const response = await request(app)
      .post('/api/resumes/extract')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', ['resume_match_session=synthetic-session', 'resume_match_csrf=synthetic-csrf'])
      .set('X-CSRF-Token', 'synthetic-csrf')
      .attach('file', Buffer.from('%PDF-1.4\nmalformed synthetic fixture'), { filename: 'synthetic.pdf', contentType: 'application/pdf' });

    assert.equal(response.status, 422);
    assert.equal(response.body.error.code, 'PDF_INVALID');
    assert.equal(response.body.error.message.includes('malformed synthetic fixture'), false);
    assert.ok(response.body.error.requestId);

    const health = await request(app).get('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');
  });

  it('keeps both concurrent failed extractions isolated', async () => {
    const app = createApp(pool());
    const requestWithFixture = () => request(app)
      .post('/api/resumes/extract')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', ['resume_match_session=synthetic-session', 'resume_match_csrf=synthetic-csrf'])
      .set('X-CSRF-Token', 'synthetic-csrf')
      .attach('file', Buffer.from('%PDF-1.4\nmalformed concurrent fixture'), { filename: 'synthetic.pdf', contentType: 'application/pdf' });
    const responses = await Promise.all([requestWithFixture(), requestWithFixture()]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [422, 429]);
    assert.equal((await request(app).get('/api/health')).status, 200);
  });
});
