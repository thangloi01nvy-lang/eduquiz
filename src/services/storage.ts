import { AppData, ActiveStudentInfo, ClassAssignmentMap, AssignedQuizPayload } from '../types';
import { sanitizeClassesData } from '../utils/normalize';
import { syncToFirebaseFirestore, fetchFromFirebaseFirestore } from './firebase';

const STORAGE_KEY = 'eduquiz_pro_data';
const DRAFT_PREFIX = 'eduquiz_student_draft_';

import { parseMarkdownQuiz } from '../utils/parser';

const SAMPLE_DEFAULT_QUIZ = parseMarkdownQuiz(`## Transferable skills

1 Complete these comments by interviewers using the words and phrases in the box.

can-do attitude communication skills critical thinking determination integrity set goals team player think outside the box

1 His ideas were creative and really innovative so he can obviously ___.

2 I liked the way she worked with the other candidates so she is clearly a(n) ___.

3 He has excellent ___. The presentation was first class and he answered the questions really clearly.

4 She used ___ brilliantly. I thought she evaluated the three options in the case study carefully before deciding which one to choose.

5 She has a lot of ___. This is the third time she's applied for a position in Marketing so she hasn't stopped trying.

6 I like the way she has monthly objectives for herself which shows she can ___.

7 I don't think he will complain about work. He seems prepared to try anything. He has a real ___.

8 He is completely honest and straightforward. He shows great ___.
Answer: 1. think outside the box | 2. team player | 3. communication skills | 4. critical thinking | 5. determination | 6. set goals | 7. can-do attitude | 8. integrity`);

const DEFAULT_ASSIGNMENT = {
  quizTitle: 'Bài Tập Tiếng Anh - Transferable Skills',
  quizLevel: 'B1',
  quizCreatedDate: new Date().toISOString(),
  questions: SAMPLE_DEFAULT_QUIZ.questions,
  sections: SAMPLE_DEFAULT_QUIZ.sections,
  wordBank: SAMPLE_DEFAULT_QUIZ.wordBank,
};

export const INITIAL_APP_DATA: AppData = {
  quizTitle: 'Bài Tập Tiếng Anh Online',
  quizLevel: 'B1',
  quizTargetClass: 'all',
  quizCreatedDate: new Date().toISOString(),
  currentQuestions: [],
  sections: [],
  wordBank: [],
  classes: [],
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
        parsed.classes = sanitizeClassesData(parsed.classes || [], parsed.deletedClasses || []);
        parsed.recalledAssignments = parsed.recalledAssignments || [];
        parsed.classAssignments = sanitizeClassAssignmentsMap(parsed.classAssignments || {}, parsed.recalledAssignments);
        return { ...INITIAL_APP_DATA, ...parsed, classes: parsed.classes, classAssignments: parsed.classAssignments, recalledAssignments: parsed.recalledAssignments };
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
    data.recalledAssignments = data.recalledAssignments || [];
    data.classAssignments = sanitizeClassAssignmentsMap(data.classAssignments || {}, data.recalledAssignments);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data to local storage:', e);
  }
}

export async function syncWithServer(data: AppData): Promise<boolean> {
  saveLocalData(data);
  let success = false;

  // 1. Same-Origin Cloud Sync (/api/data) - ZERO CORS blockage
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      success = true;
    }
  } catch (e) {
    console.warn('Same-origin Cloud sync failed, attempting Firebase Firestore fallback:', e);
  }

  // 2. Firebase Firestore Realtime Sync
  try {
    const fsSuccess = await syncToFirebaseFirestore(data);
    if (fsSuccess) success = true;
  } catch (fsErr) {
    console.warn('Firebase Firestore sync failed:', fsErr);
  }

  return success;
}

export function normalizeAssignmentList(payload: AssignedQuizPayload | AssignedQuizPayload[] | undefined): AssignedQuizPayload[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.filter((p) => p && p.questions && p.questions.length > 0);
  if (typeof payload === 'object' && (payload as any).questions && (payload as any).questions.length > 0) return [payload as AssignedQuizPayload];
  return [];
}

export function getQuizDedupeKey(quiz: AssignedQuizPayload): string {
  if (!quiz) return 'empty_quiz';
  const title = (quiz.quizTitle || '').trim().toLowerCase();
  const level = (quiz.quizLevel || 'B1').trim().toLowerCase();
  const qCount = quiz.questions?.length || 0;
  const firstQ = (quiz.questions?.[0]?.title || '').trim().toLowerCase().slice(0, 40);
  const lastQ = (quiz.questions?.[quiz.questions.length - 1]?.title || '').trim().toLowerCase().slice(0, 40);
  return `${title}_${level}_${qCount}_${firstQ}_${lastQ}`;
}

export function isQuizRecalled(quiz: AssignedQuizPayload, recalledIds: string[] = []): boolean {
  if (!quiz || !recalledIds || recalledIds.length === 0) return false;
  const key = getQuizDedupeKey(quiz);
  const id = quiz.id ? quiz.id.trim() : '';

  return recalledIds.some((r) => {
    if (!r) return false;
    const rTrim = r.trim();
    if (rTrim === key) return true;
    if (id && rTrim === id) return true;
    return false;
  });
}

export function deduplicateAssignmentList(
  payload: AssignedQuizPayload | AssignedQuizPayload[] | undefined,
  recalledIds: string[] = []
): AssignedQuizPayload[] {
  const normalized = normalizeAssignmentList(payload);
  const assignMap = new Map<string, AssignedQuizPayload>();

  normalized.forEach((item) => {
    if (isQuizRecalled(item, recalledIds)) return;
    const key = getQuizDedupeKey(item);
    if (!assignMap.has(key)) {
      assignMap.set(key, item);
    }
  });

  return Array.from(assignMap.values()).sort((a, b) => {
    const tA = new Date(a.quizCreatedDate || 0).getTime();
    const tB = new Date(b.quizCreatedDate || 0).getTime();
    return tB - tA;
  });
}

export function sanitizeClassAssignmentsMap(map: ClassAssignmentMap = {}, recalledIds: string[] = []): ClassAssignmentMap {
  const cleaned: ClassAssignmentMap = {};
  for (const className in map) {
    cleaned[className] = deduplicateAssignmentList(map[className], recalledIds);
  }
  return cleaned;
}

function mergeClassAssignments(
  localMap: ClassAssignmentMap = {},
  remoteMap: ClassAssignmentMap = {},
  recalledIds: string[] = []
): ClassAssignmentMap {
  const merged: ClassAssignmentMap = {};
  const allClassNames = new Set([...Object.keys(localMap || {}), ...Object.keys(remoteMap || {})]);

  allClassNames.forEach((className) => {
    const localList = deduplicateAssignmentList(localMap[className], recalledIds);
    const remoteList = deduplicateAssignmentList(remoteMap[className], recalledIds);

    const assignMap = new Map<string, AssignedQuizPayload>();

    remoteList.forEach((a) => {
      if (isQuizRecalled(a, recalledIds)) return;
      const key = getQuizDedupeKey(a);
      assignMap.set(key, a);
    });

    localList.forEach((a) => {
      if (isQuizRecalled(a, recalledIds)) return;
      const key = getQuizDedupeKey(a);
      assignMap.set(key, a);
    });

    merged[className] = Array.from(assignMap.values()).sort((a, b) => {
      const tA = new Date(a.quizCreatedDate || 0).getTime();
      const tB = new Date(b.quizCreatedDate || 0).getTime();
      return tB - tA;
    });
  });

  return merged;
}

function mergeQuizLibrary(localLib: any[] = [], remoteLib: any[] = []): any[] {
  const libMap = new Map<string, any>();

  // Add remote items
  (remoteLib || []).forEach((item) => {
    if (item && (item.id || item.title)) {
      libMap.set(item.id || item.title, item);
    }
  });

  // Local teacher items take top priority & NEVER get lost!
  (localLib || []).forEach((item) => {
    if (item && (item.id || item.title)) {
      libMap.set(item.id || item.title, item);
    }
  });

  return Array.from(libMap.values());
}

function mergeGradesList(localGrades: any[] = [], remoteGrades: any[] = []): any[] {
  const gradeMap = new Map<string, any>();

  (remoteGrades || []).forEach((g) => {
    if (g && (g.id || g.studentId)) {
      gradeMap.set(g.id || `${g.studentId}_${g.quizTitle}`, g);
    }
  });

  (localGrades || []).forEach((g) => {
    if (g && (g.id || g.studentId)) {
      gradeMap.set(g.id || `${g.studentId}_${g.quizTitle}`, g);
    }
  });

  return Array.from(gradeMap.values());
}

function mergeAppData(local: AppData, remote: AppData): AppData {
  const deletedSet = new Set([...(local.deletedClasses || []), ...(remote.deletedClasses || [])].map((d) => d.toLowerCase()));

  const classMap = new Map<string, any>();

  // Remote classes
  (remote.classes || []).forEach((c) => {
    const key = (c.name || '').toLowerCase();
    if (key && !deletedSet.has(key) && !deletedSet.has((c.id || '').toLowerCase())) {
      classMap.set(key, c);
    }
  });

  // Local teacher classes - local data takes top priority!
  (local.classes || []).forEach((c) => {
    const key = (c.name || '').toLowerCase();
    if (key && !deletedSet.has(key) && !deletedSet.has((c.id || '').toLowerCase())) {
      const existing = classMap.get(key);
      if (existing) {
        const studentMap = new Map<string, any>();
        (existing.students || []).forEach((s: any) => studentMap.set(s.id || s.name, s));
        (c.students || []).forEach((s: any) => studentMap.set(s.id || s.name, s));
        classMap.set(key, { ...existing, ...c, students: Array.from(studentMap.values()) });
      } else {
        classMap.set(key, c);
      }
    }
  });

  const mergedClasses = Array.from(classMap.values());
  const recalledSet = new Set([
    ...(local.recalledAssignments || []),
    ...(remote.recalledAssignments || [])
  ]);
  const recalledList = Array.from(recalledSet);

  const mergedAssignments = mergeClassAssignments(
    local.classAssignments,
    remote.classAssignments,
    recalledList
  );

  return {
    ...INITIAL_APP_DATA,
    ...remote,
    ...local,
    classes: mergedClasses,
    deletedClasses: Array.from(deletedSet),
    classAssignments: mergedAssignments,
    recalledAssignments: recalledList,
    quizLibrary: mergeQuizLibrary(local.quizLibrary, remote.quizLibrary),
    grades: mergeGradesList(local.grades, remote.grades),
  };
}

export async function fetchServerData(): Promise<AppData | null> {
  const localData = loadLocalData();

  // 1. Same-Origin Cloud Fetch (/api/data)
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      const result = await res.json();
      if (result && result.data) {
        const merged = mergeAppData(localData, result.data);
        saveLocalData(merged);
        return merged;
      }
    }
  } catch (e) {
    console.warn('Same-origin Cloud fetch failed, attempting Firebase Firestore fallback:', e);
  }

  // 2. Try Firebase Firestore Database
  try {
    const firestoreData = await fetchFromFirebaseFirestore();
    if (firestoreData) {
      const merged = mergeAppData(localData, firestoreData);
      saveLocalData(merged);
      return merged;
    }
  } catch (fsErr) {
    console.warn('Firebase Firestore fetch failed:', fsErr);
  }

  return localData;
}

export function exportJsonBackup(data: AppData): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `EduQuiz_Full_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
}

export function importJsonBackup(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed && typeof parsed === 'object') {
          parsed.classes = sanitizeClassesData(parsed.classes || [], parsed.deletedClasses || []);
          const merged = { ...INITIAL_APP_DATA, ...parsed, classes: parsed.classes };
          saveLocalData(merged);
          resolve(merged);
        } else {
          reject(new Error('File backup JSON không đúng định dạng!'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
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
