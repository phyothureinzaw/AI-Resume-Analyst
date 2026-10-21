import type { AnalysisResult } from './analysis.types.js';

export type EvidenceFailureReason = 'no_exact_match' | 'blank' | 'wrong_source' | 'missing_required_evidence' | 'not_evidenced_has_resume_evidence' | 'duplicate_requirement_id';
export type EvidenceValidationIssue = { requirementIndex: number; requirementId: string; field: 'jobEvidenceExcerpt' | 'resumeEvidenceExcerpts' | 'requirement'; excerptIndex: number | null; source: 'resume' | 'job' | 'none'; reason: EvidenceFailureReason; excerptLength: number };
export class EvidenceValidationError extends Error {
  constructor(public readonly issues: EvidenceValidationIssue[]) {
    super('Analysis evidence did not match source snapshots');
    this.name = 'EvidenceValidationError';
  }
}

export function normalizeEvidence(value: string): string { return value.normalize('NFC').replace(/\s+/gu, ' ').trim(); }
function containsExcerpt(snapshot: string, excerpt: string): boolean { return normalizeEvidence(snapshot).includes(normalizeEvidence(excerpt)); }
function issue(requirementIndex: number, requirementId: string, field: EvidenceValidationIssue['field'], excerptIndex: number | null, source: EvidenceValidationIssue['source'], reason: EvidenceFailureReason, excerpt: string): EvidenceValidationIssue {
  return { requirementIndex, requirementId, field, excerptIndex, source, reason, excerptLength: excerpt.length };
}
function sourceMismatch(snapshot: string, otherSnapshot: string, excerpt: string): EvidenceFailureReason {
  if (!normalizeEvidence(excerpt)) return 'blank';
  return containsExcerpt(otherSnapshot, excerpt) ? 'wrong_source' : 'no_exact_match';
}

export function validateEvidence(result: AnalysisResult, resumeSnapshot: string, jobSnapshot: string): void {
  const ids = new Set<string>();
  const issues: EvidenceValidationIssue[] = [];
  for (const [requirementIndex, item] of result.requirements.entries()) {
    if (ids.has(item.id)) issues.push(issue(requirementIndex, item.id, 'requirement', null, 'none', 'duplicate_requirement_id', ''));
    ids.add(item.id);
    if (!containsExcerpt(jobSnapshot, item.jobEvidenceExcerpt)) issues.push(issue(requirementIndex, item.id, 'jobEvidenceExcerpt', null, 'job', sourceMismatch(jobSnapshot, resumeSnapshot, item.jobEvidenceExcerpt), item.jobEvidenceExcerpt));
    if (item.evidenceStatus === 'not_evidenced') {
      item.resumeEvidenceExcerpts.forEach((value, excerptIndex) => issues.push(issue(requirementIndex, item.id, 'resumeEvidenceExcerpts', excerptIndex, 'resume', 'not_evidenced_has_resume_evidence', value)));
    } else if (item.resumeEvidenceExcerpts.length === 0) {
      issues.push(issue(requirementIndex, item.id, 'resumeEvidenceExcerpts', null, 'resume', 'missing_required_evidence', ''));
    } else {
      item.resumeEvidenceExcerpts.forEach((value, excerptIndex) => {
        if (!containsExcerpt(resumeSnapshot, value)) issues.push(issue(requirementIndex, item.id, 'resumeEvidenceExcerpts', excerptIndex, 'resume', sourceMismatch(resumeSnapshot, jobSnapshot, value), value));
      });
    }
  }
  if (issues.length > 0) throw new EvidenceValidationError(issues);
}
