export type DashboardStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type DashboardData = {
  counts: { resumes: number; jobs: number; analyses: number };
  analysisStatuses: Record<DashboardStatus, number>;
  latestAnalyses: Array<{
    id: string;
    resumeId: string;
    resumeTitle: string;
    jobDescriptionId: string;
    jobTitle: string;
    companyName: string | null;
    status: DashboardStatus;
    score: number | null;
    createdAt: string;
    completedAt: string | null;
  }>;
};
