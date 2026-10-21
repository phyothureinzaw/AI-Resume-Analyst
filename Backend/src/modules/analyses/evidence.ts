import type { AnalysisResult } from './analysis.types.js';

function normalize(value: string): string { return value.replace(/\s+/g, ' ').trim(); }
function containsExcerpt(snapshot: string, excerpt: string): boolean { return normalize(snapshot).includes(normalize(excerpt)); }

export function validateEvidence(result: AnalysisResult, resumeSnapshot: string, jobSnapshot: string): void {
  const ids = new Set<string>();
  for (const item of result.requirements) {
    if (ids.has(item.id)) throw new Error('Duplicate requirement identifier');
    ids.add(item.id);
    if (!containsExcerpt(jobSnapshot, item.jobEvidenceExcerpt)) throw new Error('Unsupported job evidence');
    if (item.evidenceStatus === 'not_evidenced') {
      if (item.resumeEvidenceExcerpts.length !== 0) throw new Error('Not-evidenced requirement has resume evidence');
    } else if (item.resumeEvidenceExcerpts.length === 0 || item.resumeEvidenceExcerpts.some((value) => !containsExcerpt(resumeSnapshot, value))) {
      throw new Error('Unsupported resume evidence');
    }
  }
}
