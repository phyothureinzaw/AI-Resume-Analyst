export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type EvidenceStatus = 'supported' | 'partial' | 'not_evidenced';
export type RequirementCategory = 'required' | 'preferred';

export type AnalysisResult = {
  summary: string;
  requirements: Array<{
    id: string;
    requirementText: string;
    jobEvidenceExcerpt: string;
    category: RequirementCategory;
    evidenceStatus: EvidenceStatus;
    resumeEvidenceExcerpts: string[];
    explanation: string;
    suggestions: string[];
  }>;
  scoreExplanation: string;
};

export type AnalysisRow = {
  id: string;
  user_id: string;
  resume_id: string;
  job_description_id: string;
  status: AnalysisStatus;
  resume_text_snapshot: string;
  job_text_snapshot: string;
  match_score: string | null;
  result: AnalysisResult | null;
  model_name: string | null;
  prompt_version: string | null;
  scoring_version: string | null;
  error_code: string | null;
  created_at: Date;
  completed_at: Date | null;
  request_id: string | null;
  attempt_count: number;
  next_attempt_at: Date;
  lease_expires_at: Date | null;
  claim_token: string | null;
};

export type AnalysisSummary = {
  id: string;
  resumeId: string;
  jobDescriptionId: string;
  resumeTitle: string;
  jobTitle: string;
  companyName: string | null;
  status: AnalysisStatus;
  matchScore: number | null;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
};
