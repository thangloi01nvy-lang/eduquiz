import { AppData, ActiveStudentInfo } from '../types';
import { sanitizeClassesData } from '../utils/normalize';

const STORAGE_KEY = 'eduquiz_pro_data';
const DRAFT_PREFIX = 'eduquiz_student_draft_';

export const INITIAL_APP_DATA: AppData = {
  quizTitle: 'Bài Tập Tiếng Anh Online',
  quizLevel: 'B1',
  quizTargetClass: 'all',
  quizCreatedDate: new Date().toISOString(),
  currentQuestions: [],
  sections: [],
  wordBank: [],
  classes: [
    {
      id: 'c_teen4',
      name: 'Teen 4',
      desc: 'Lớp học mới',
      students: [{ id: 's1', name: 'Nguyễn Văn A' }]
    }
  ],
  deletedClasses: [],
  classAssignments: {},
  quizLibrary: [],
  grades: [],
  feedbacks: []
};

export function loadLocalData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        parsed.classes = sanitizeClassesData(parsed.classes || []);
        return { ...INITIAL_APP_DATA, ...parsed };
      }
    }
  } catch (e) {
    console.warn('Failed to parse local storage data:', e);
  }
  return INITIAL_APP_DATA;
}

export function saveLocalData(data: AppData): void {
  try {
    data.classes = sanitizeClassesData(data.classes || []);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data to local storage:', e);
  }
}

export async function syncWithServer(data: AppData): Promise<boolean> {
  saveLocalData(data);
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      return true;
    }
  } catch (e) {
    console.warn('Server sync failed, retained in LocalStorage:', e);
  }
  return false;
}

export async function fetchServerData(): Promise<AppData | null> {
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      const result = await res.json();
      if (result && result.data) {
        result.data.classes = sanitizeClassesData(result.data.classes || []);
        saveLocalData(result.data);
        return result.data;
      }
    }
  } catch (e) {
    console.warn('Could not fetch server data, fallback to local:', e);
  }
  return null;
}

// Student Auto-Draft System
export function saveStudentDraft(studentId: string, answers: Record<string, string>): void {
  if (!studentId) return;
  try {
    localStorage.setItem(`${DRAFT_PREFIX}${studentId}`, JSON.stringify(answers));
  } catch (e) {
    console.warn('Draft save error:', e);
  }
}

export function loadStudentDraft(studentId: string): Record<string, string> {
  if (!studentId) return {};
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${studentId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Draft load error:', e);
  }
  return {};
}

export function clearStudentDraft(studentId: string): void {
  if (!studentId) return;
  localStorage.removeItem(`${DRAFT_PREFIX}${studentId}`);
}
