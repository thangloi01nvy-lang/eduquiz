export interface Option {
  key: string;
  text: string;
}

export interface InlineBlank {
  placeholder?: string;
  choices?: string[];
  answer: string;
}

export interface AIData {
  grammar?: string;
  trans?: string;
  vocab?: string[];
}

export interface Question {
  id: number;
  title: string;
  type: 'multiple_choice' | 'true_false' | 'fill_in_blank' | 'short_answer' | 'essay' | 'error_correction';
  options?: Option[];
  answer?: string;
  explanation?: string;
  inlineBlanks?: InlineBlank[];
  sectionId?: number;
  sectionIndex?: number;
  sectionTitle?: string;
  aiData?: AIData;
  points?: number;
}

export interface Section {
  id: number;
  title: string;
  questions: Question[];
  wordBank?: string[];
}

export interface Student {
  id: string;
  name: string;
  code?: string;
}

export interface ClassModel {
  id: string;
  name: string;
  desc?: string;
  students: Student[];
}

export interface AssignedQuizPayload {
  id?: string;
  quizTitle: string;
  quizLevel?: string;
  quizCreatedDate?: string;
  quizDeadline?: string | null;
  questions: Question[];
  sections: Section[];
  wordBank?: string[];
  status?: 'active' | 'archived';
}

export interface ClassAssignmentMap {
  [className: string]: AssignedQuizPayload | AssignedQuizPayload[];
}

export interface LibraryItem {
  id: string;
  title: string;
  level: string;
  targetClass: string;
  createdDate: string;
  rawText: string;
  questionsCount: number;
  sectionsCount: number;
  questions?: Question[];
  sections?: Section[];
  wordBank?: string[];
}

export interface GradeRecord {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  quizTitle: string;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
  userAnswers?: Record<string, string>;
  answers?: Record<string, string>;
}

export interface FeedbackRecord {
  id: string;
  studentName: string;
  className: string;
  message: string;
  createdAt: string;
}

export interface AppData {
  quizTitle: string;
  quizLevel: string;
  quizTargetClass: string;
  quizCreatedDate?: string;
  currentQuestions: Question[];
  sections: Section[];
  wordBank: string[];
  classes: ClassModel[];
  deletedClasses?: string[];
  classAssignments: ClassAssignmentMap;
  quizLibrary: LibraryItem[];
  grades: GradeRecord[];
  feedbacks: FeedbackRecord[];
}

export interface ActiveStudentInfo {
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
}
