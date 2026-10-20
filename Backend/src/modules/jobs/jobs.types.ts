export type JobRow = {
  id: string;
  user_id: string;
  job_title: string;
  company_name: string | null;
  description_text: string;
  created_at: Date;
  updated_at: Date;
};

export type JobSummary = Omit<JobRow, 'description_text' | 'user_id'>;
export type JobInput = { jobTitle: string; companyName: string | null; descriptionText: string };
export type JobPatch = Partial<JobInput>;
