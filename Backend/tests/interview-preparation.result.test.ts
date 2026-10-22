import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInterviewJsonSchema, buildInterviewSourceSegments, InterviewInputValidationError, InterviewResultValidationError, validateInterviewPreparationResult, validateInterviewSnapshots } from '../src/modules/interview-preparations/interview-preparation.result.js';
import { classifyInterviewWorkerFailure } from '../src/modules/interview-preparations/interview-preparation.worker.js';

function result(jobIds: string[], resumeIds: string[] = []) {
  const questions = [
    ...Array.from({ length: 5 }, (_, index) => ({ id: `q-${String(index + 1).padStart(3, '0')}`, category: 'technical', question: `Technical question ${index + 1}`, jobSourceSegmentIds: jobIds, whyRelevant: 'It tests a stated role requirement.', answerMode: resumeIds.length ? 'resume_grounded' : 'general_example', sampleAnswer: resumeIds.length ? 'I would explain the relevant experience from the cited source.' : 'A general answer would explain the approach and tradeoffs.', keyPoints: ['Explain the approach'], followUpQuestion: 'What would you improve?', resumeSourceSegmentIds: resumeIds })),
    ...Array.from({ length: 4 }, (_, index) => ({ id: `q-${String(index + 6).padStart(3, '0')}`, category: 'scenario', question: `Scenario question ${index + 1}`, jobSourceSegmentIds: jobIds, whyRelevant: 'It tests practical judgment.', answerMode: 'star_template', sampleAnswer: 'Situation: [specific situation]. Task: [your task]. Action: [your action]. Result: [measurable result].', keyPoints: ['State the context'], followUpQuestion: 'What was the outcome?', resumeSourceSegmentIds: [] })),
    ...Array.from({ length: 3 }, (_, index) => ({ id: `q-${String(index + 10).padStart(3, '0')}`, category: 'behavioral', question: `Behavioral question ${index + 1}`, jobSourceSegmentIds: jobIds, whyRelevant: 'It tests collaboration.', answerMode: 'star_template', sampleAnswer: 'Situation: [specific situation]. Task: [your task]. Action: [your action]. Result: [measurable result].', keyPoints: ['Be specific'], followUpQuestion: 'What did you learn?', resumeSourceSegmentIds: [] }))
  ];
  return { summary: 'Prepare by connecting the role requirements to clear examples.', questions, studyTopics: [{ topic: 'Role requirements', questionIds: questions.slice(0, 3).map((question) => question.id) }], interviewerQuestions: ['What does success look like?', 'How is the team structured?', 'What are the first priorities?', 'What are the next steps?'] };
}

test('validates job-only output with exact category counts and STAR placeholders', () => {
  const segments = buildInterviewSourceSegments('Required: TypeScript experience. Responsibilities: build reliable services.', null);
  const parsed = validateInterviewPreparationResult(result(['job-001']), segments, false);
  assert.equal(parsed.questions.length, 12);
  assert.equal(parsed.questions.filter((question) => question.category === 'technical').length, 5);
});

test('validates resume-grounded output only when cited resume segments exist', () => {
  const segments = buildInterviewSourceSegments('Required: customer support experience.', 'Customer support specialist with ticketing experience.');
  const parsed = validateInterviewPreparationResult(result(['job-001'], ['resume-001']), segments, true);
  assert.equal(parsed.questions[0]?.answerMode, 'resume_grounded');
  assert.throws(() => validateInterviewPreparationResult(result(['job-001'], ['resume-999']), segments, true));
});

test('rejects unknown citations, wrong job-only citations, bad counts, and missing STAR placeholders', () => {
  const segments = buildInterviewSourceSegments('Required: project management experience.', null);
  const unknown = result(['job-999']);
  assert.throws(() => validateInterviewPreparationResult(unknown, segments, false));
  const wrongMode = result(['job-001'], ['resume-001']);
  assert.throws(() => validateInterviewPreparationResult(wrongMode, segments, false));
  const wrongCount = result(['job-001']);
  wrongCount.questions[0]!.category = 'scenario';
  assert.throws(() => validateInterviewPreparationResult(wrongCount, segments, false));
  const noPlaceholder = result(['job-001']);
  noPlaceholder.questions[5]!.sampleAnswer = 'A polished answer without placeholders.';
  assert.throws(() => validateInterviewPreparationResult(noPlaceholder, segments, false));
});

test('rejects malformed top-level output and preserves bounded question count', () => {
  const segments = buildInterviewSourceSegments('Required: design and deliver services.', null);
  assert.throws(() => validateInterviewPreparationResult({ questions: [] }, segments, false));
  assert.throws(() => validateInterviewPreparationResult({ ...result(['job-001']), questions: result(['job-001']).questions.slice(0, 11) }, segments, false));
});

test('accepts job-only snapshots with null resume fields and ordinary multiline descriptions', () => {
  const validated = validateInterviewSnapshots({ jobText: 'Responsibilities:\nSupport customers and coordinate resolution.\nRequired skills: communication.', resumeId: null, resumeText: null });
  assert.equal(validated.diagnostics.segmentCounts.resume, 0);
  assert.ok(validated.diagnostics.segmentCounts.job >= 1);
});

test('accepts job-plus-resume snapshots and exact boundary-length text', () => {
  const boundaryJob = `Required: ${'x'.repeat(100_000 - 'Required: '.length)}`;
  const validated = validateInterviewSnapshots({ jobText: boundaryJob, resumeId: 'resume-1', resumeText: 'Experience: customer support.' });
  assert.equal(validated.diagnostics.inputChars.job, 100_000);
  assert.equal(validated.diagnostics.segmentCounts.resume, 1);
});

test('reports specific safe failures for invalid snapshots, including the confirmed one-word case', () => {
  const cases: Array<{ input: { jobText: unknown; resumeId: unknown; resumeText: unknown }; reasonCode: string; fieldPath: string }> = [
    { input: { jobText: 'x'.repeat(60), resumeId: 'resume-1', resumeText: 'Experience: support.' }, reasonCode: 'JOB_CONTENT_INSUFFICIENT', fieldPath: 'job_text_snapshot' },
    { input: { jobText: 'Required: support.', resumeId: null, resumeText: 'orphan' }, reasonCode: 'RESUME_SNAPSHOT_ORPHANED', fieldPath: 'resume_text_snapshot' },
    { input: { jobText: 'Required: support.', resumeId: 'resume-1', resumeText: '   ' }, reasonCode: 'RESUME_SNAPSHOT_BLANK', fieldPath: 'resume_text_snapshot' },
    { input: { jobText: 'Required: support.', resumeId: 'resume-1', resumeText: 'x'.repeat(100_001) }, reasonCode: 'RESUME_SNAPSHOT_TOO_LARGE', fieldPath: 'resume_text_snapshot' }
  ];
  for (const item of cases) {
    assert.throws(() => validateInterviewSnapshots(item.input), (error: unknown) => error instanceof InterviewInputValidationError && error.diagnostics.reasonCode === item.reasonCode && error.diagnostics.fieldPath === item.fieldPath);
  }
});

test('does not label unrelated worker exceptions as input validation', () => {
  const generic = classifyInterviewWorkerFailure(new Error('database connection failed'), 'input_validation');
  assert.equal(generic.safeErrorCode, 'INTERVIEW_PREPARATION_FAILED');
  const invalid = new InterviewInputValidationError({ reasonCode: 'JOB_CONTENT_INSUFFICIENT', fieldPath: 'job_text_snapshot', inputChars: { job: 60, resume: 20 }, segmentCounts: { job: 1, resume: 1 } });
  const safe = classifyInterviewWorkerFailure(invalid, 'input_validation');
  assert.equal(safe.safeErrorCode, 'INTERVIEW_INPUT_INVALID');
  assert.equal(safe.validationReasonCode, 'JOB_CONTENT_INSUFFICIENT');
  assert.equal(safe.validationFieldPath, 'job_text_snapshot');
  assert.deepEqual(safe.inputChars, { job: 60, resume: 20 });
});

test('reports the exact safe metadata for job source citation shape failures', () => {
  const segments = [{ id: 'job-001', source: 'job' as const, text: 'Required: support customers.' }];
  const cases: Array<{ name: string; mutate: (value: ReturnType<typeof result>) => void; code: string; count?: number; invalid?: number }> = [
    { name: 'missing', mutate: (value) => { delete (value.questions[2] as Record<string, unknown>).jobSourceSegmentIds; }, code: 'invalid_type' },
    { name: 'null', mutate: (value) => { value.questions[2]!.jobSourceSegmentIds = null as unknown as string[]; }, code: 'invalid_type' },
    { name: 'wrong type', mutate: (value) => { (value.questions[2] as unknown as Record<string, unknown>).jobSourceSegmentIds = 'job-001'; }, code: 'invalid_type' },
    { name: 'empty', mutate: (value) => { value.questions[2]!.jobSourceSegmentIds = []; }, code: 'too_small', count: 0, invalid: 0 },
    { name: 'overflow', mutate: (value) => { value.questions[2]!.jobSourceSegmentIds = ['job-001', 'job-001', 'job-001', 'job-001']; }, code: 'too_big', count: 4, invalid: 0 },
    { name: 'unknown', mutate: (value) => { value.questions[2]!.jobSourceSegmentIds = ['job-999']; }, code: 'unknown_source_id', count: 1, invalid: 1 },
    { name: 'duplicate', mutate: (value) => { value.questions[2]!.jobSourceSegmentIds = ['job-001', 'job-001']; }, code: 'duplicate_source_id', count: 2, invalid: 0 }
  ];
  for (const item of cases) {
    const candidate = result(['job-001']);
    item.mutate(candidate);
    assert.throws(() => validateInterviewPreparationResult(candidate, segments, false), (error: unknown) => {
      if (!(error instanceof InterviewResultValidationError)) return false;
      const issue = error.issues.find((entry) => entry.path === 'questions.2.jobSourceSegmentIds');
      return issue?.code === item.code && issue.receivedArrayCount === item.count && issue.invalidIdCount === item.invalid;
    }, item.name);
  }
});

test('passes exact job segment IDs to the structured-output schema and prompt contract', () => {
  const segments = [
    { id: 'job-001', source: 'job' as const, text: 'Required: support.' },
    { id: 'job-002', source: 'job' as const, text: 'Responsibilities: coordinate.' }
  ];
  const schema = buildInterviewJsonSchema(segments) as { properties: { questions: { items: { properties: { jobSourceSegmentIds: { items: { enum?: string[] } } } } } } };
  assert.deepEqual(schema.properties.questions.items.properties.jobSourceSegmentIds.items.enum, ['job-001', 'job-002']);
});
