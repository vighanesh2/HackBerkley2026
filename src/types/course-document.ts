export type ModuleStatus = "not_started" | "in_progress" | "mastered";

export type LearningObjective = {
  statement: string;
  bloomLevel: string;
};

export type CourseMaterial = {
  title: string;
  type: string;
  note?: string;
  url?: string;
};

export type RecommendedVideo = {
  title: string;
  url: string;
  reason: string;
  source?: string;
};

export type LessonVisual = {
  title: string;
  description: string;
  altText: string;
  type: "diagram" | "infographic" | "chart";
};

export type KnowledgeCheck = {
  type: "quiz" | "reflection";
  question: string;
  options?: string[];
  answer?: string;
  reflectionPrompt?: string;
};

export type DocumentModule = {
  title: string;
  objective: string;
  summary: string;
  paragraphs: string[];
  bulletPoints: string[];
  keyTerms: { term: string; definition: string }[];
  keyTakeaways: string[];
  practicalTask: string;
  knowledgeCheck: KnowledgeCheck;
  visual: LessonVisual;
  feynmanPrompt: string;
  recommendedVideo?: RecommendedVideo;
  status: ModuleStatus;
  gapNotes: string[];
};

export type CourseDocument = {
  title: string;
  emoji: string;
  welcomeMessage: string;
  overview: string;
  howToUse: string[];
  learningObjectives: LearningObjective[];
  modules: DocumentModule[];
  resources: CourseMaterial[];
  featuredVideo?: RecommendedVideo;
  agentVideos?: RecommendedVideo[];
  personalNotesUsed?: boolean;
  completed: boolean;
};
