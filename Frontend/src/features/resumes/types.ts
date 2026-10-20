export type Resume = { id: string; userId: string; title: string; originalFileName: string | null; storageKey: string | null; fileSizeBytes: number | null; resumeText: string; createdAt: string; updatedAt: string };
export type ResumeSummary = Omit<Resume, 'resumeText'>;
export type ResumeList = { items: ResumeSummary[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } };
