export type InterviewPreparationStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type InterviewAnswerMode = 'general_example' | 'resume_grounded' | 'star_template';
export type InterviewQuestionCategory = 'technical' | 'scenario' | 'behavioral';

export type InterviewQuestion = {
  id: string;
  category: InterviewQuestionCategory;
  question: string;
  jobSourceSegmentIds: string[];
  whyRelevant: string;
  answerMode: InterviewAnswerMode;
  sampleAnswer: string;
  keyPoints: string[];
  followUpQuestion: string;
  resumeSourceSegmentIds: string[];
};

export type InterviewPreparationResult = {
  summary: string;
  questions: InterviewQuestion[];
  studyTopics: Array<{ topic: string; questionIds: string[] }>;
  interviewerQuestions: string[];
};

export type InterviewPreparationSummary = {
  id: string;
  jobDescriptionId: string;
  resumeId: string | null;
  jobTitle: string;
  companyName: string | null;
  resumeTitle: string | null;
  status: InterviewPreparationStatus;
  createdAt: string;
  completedAt: string | null;
};

export type InterviewPreparation = InterviewPreparationSummary & {
  result: InterviewPreparationResult | null;
  error: { code: string; message: string } | null;
};

export type InterviewPreparationList = {
  items: InterviewPreparationSummary[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};
