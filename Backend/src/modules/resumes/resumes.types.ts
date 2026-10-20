export type ResumeRow = {
  id: string;
  user_id: string;
  title: string;
  original_file_name: string | null;
  storage_key: string | null;
  file_size_bytes: number | null;
  resume_text: string;
  created_at: Date;
  updated_at: Date;
};

export type ResumeSummary = Omit<ResumeRow, 'resume_text'>;
export type ResumeInput = { title: string; resumeText: string };
export type ResumePatch = Partial<ResumeInput>;
