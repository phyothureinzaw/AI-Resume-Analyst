export type JobSummary = { id: string; jobTitle: string; companyName: string | null; createdAt: string; updatedAt: string };
export type Job = JobSummary & { descriptionText: string };
export type JobList = { items: JobSummary[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } };
