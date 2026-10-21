import type { AnalysisStatus } from '../analyses/analysis.types.js';

export type DashboardLatestAnalysis = {
  id: string;
  resumeId: string;
  resumeTitle: string;
  jobDescriptionId: string;
  jobTitle: string;
  companyName: string | null;
  status: AnalysisStatus;
  score: number | null;
  createdAt: string;
  completedAt: string | null;
};

export type DashboardData = {
  counts: { resumes: number; jobs: number; analyses: number };
  analysisStatuses: Record<AnalysisStatus, number>;
  latestAnalyses: DashboardLatestAnalysis[];
};
