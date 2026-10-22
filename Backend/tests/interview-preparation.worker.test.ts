import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool, PoolClient } from 'pg';
import { processInterviewPreparationOne } from '../src/modules/interview-preparations/interview-preparation.worker.js';
import type { InterviewGeminiProvider } from '../src/modules/interview-preparations/interview-preparation.gemini.js';

function result() {
  const questions = [
    ...Array.from({ length: 5 }, (_, index) => ({ id: `q-${String(index + 1).padStart(3, '0')}`, category: 'technical', question: 'How would you approach this requirement?', jobSourceSegmentIds: ['job-001'], whyRelevant: 'It tests a stated requirement.', answerMode: 'general_example', sampleAnswer: 'A general answer would explain the approach.', keyPoints: ['Explain the approach'], followUpQuestion: 'What would you improve?', resumeSourceSegmentIds: [] })),
    ...Array.from({ length: 4 }, (_, index) => ({ id: `q-${String(index + 6).padStart(3, '0')}`, category: 'scenario', question: 'What would you do in this situation?', jobSourceSegmentIds: ['job-001'], whyRelevant: 'It tests practical judgment.', answerMode: 'star_template', sampleAnswer: 'Situation: [specific situation]. Action: [your action]. Result: [measurable result].', keyPoints: ['State the context'], followUpQuestion: 'What was the outcome?', resumeSourceSegmentIds: [] })),
    ...Array.from({ length: 3 }, (_, index) => ({ id: `q-${String(index + 10).padStart(3, '0')}`, category: 'behavioral', question: 'Tell me about a relevant example.', jobSourceSegmentIds: ['job-001'], whyRelevant: 'It tests collaboration.', answerMode: 'star_template', sampleAnswer: 'Situation: [specific situation]. Action: [your action]. Result: [measurable result].', keyPoints: ['Be specific'], followUpQuestion: 'What did you learn?', resumeSourceSegmentIds: [] }))
  ];
  return { summary: 'Synthetic preparation.', questions, studyTopics: [{ topic: 'Role requirement', questionIds: ['q-001'] }], interviewerQuestions: ['What does success look like?', 'How is the team structured?', 'What are the first priorities?', 'What are the next steps?'] };
}

function row(jobText: string) {
  return { id: '00000000-0000-0000-0000-000000000010', user_id: 'user-a', job_description_id: '00000000-0000-0000-0000-000000000001', resume_id: null, request_id: '00000000-0000-0000-0000-000000000011', status: 'processing', job_title_snapshot: 'Support specialist', company_name_snapshot: 'Synthetic Co', resume_title_snapshot: null, job_text_snapshot: jobText, resume_text_snapshot: null, result: null, model_name: null, prompt_version: 'interview-preparation-prompt-v1', result_schema_version: 'interview-preparation-result-v1', error_code: null, attempt_count: 1, next_attempt_at: new Date(), lease_expires_at: new Date(Date.now() + 60_000), claim_token: 'claim-token', created_at: new Date(), completed_at: null };
}

function fakePool(preparationRow: ReturnType<typeof row>, onComplete: () => void, onFail: () => void): Pool {
  const client = { query: async <T extends object>(sql: string) => { if (sql.includes('WITH candidate')) return { rows: [preparationRow] as T[] }; return { rows: [] as T[] }; }, release: () => undefined } as unknown as PoolClient;
  return { connect: async () => client, query: async (sql: string) => { if (sql.includes("SET status='completed'")) { onComplete(); return { rowCount: 1, rows: [] }; } if (sql.includes("SET status='failed'")) { onFail(); return { rowCount: 1, rows: [] }; } return { rowCount: 0, rows: [] }; } } as unknown as Pool;
}

const provider: InterviewGeminiProvider = { generate: async () => ({ text: JSON.stringify(result()), modelName: 'synthetic-model', diagnostics: { requestDurationMs: 1, inputChars: { job: 60, resume: 0 }, finishReason: 'STOP', outputTruncated: false, outputChars: 100, promptTokenCount: null, outputTokenCount: null } }) };

test('processes a valid job-only preparation through completion with a mocked provider', async () => {
  let completed = false;
  const worked = await processInterviewPreparationOne(fakePool(row('Required: customer support experience.'), () => { completed = true; }, () => undefined), provider);
  assert.equal(worked, true);
  assert.equal(completed, true);
});

test('persists a safe terminal failure for the confirmed insufficient-job case without calling the provider', async () => {
  let failed = false;
  let called = false;
  const noProvider: InterviewGeminiProvider = { generate: async () => { called = true; throw new Error('must not be called'); } };
  await processInterviewPreparationOne(fakePool(row('x'.repeat(60)), () => undefined, () => { failed = true; }), noProvider);
  assert.equal(called, false);
  assert.equal(failed, true);
});
