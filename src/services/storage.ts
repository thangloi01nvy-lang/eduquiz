import { AppData, ActiveStudentInfo } from '../types';
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
  quizTitle: 'Bài Tập Tiếng Anh - Transferable Skills',
  quizLevel: 'B1',
  quizTargetClass: 'all',
  quizCreatedDate: new Date().toISOString(),
  currentQuestions: SAMPLE_DEFAULT_QUIZ.questions,
  sections: SAMPLE_DEFAULT_QUIZ.sections,
  wordBank: SAMPLE_DEFAULT_QUIZ.wordBank,
  classes: [
    {
      id: 'c_teen4',
      name: 'Teen 4',
      desc: 'Lớp Teen 4',
      students: [
        { id: 's1', name: 'Nguyễn Văn A' },
        { id: 's2', name: 'Trần Thị B' },
        { id: 's3', name: 'Lê Văn C' }
      ]
    },
    {
      id: 'c_teen1',
      name: 'Teen 1',
      desc: 'Lớp Teen 1',
      students: [{ id: 's4', name: 'Học sinh 1' }]
    }
  ],
  deletedClasses: [],
  classAssignments: {
    'Teen 4': DEFAULT_ASSIGNMENT,
    'Teen 1': DEFAULT_ASSIGNMENT,
    'all': DEFAULT_ASSIGNMENT,
  },
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
        if (!parsed.classAssignments || Object.keys(parsed.classAssignments).length === 0) {
          parsed.classAssignments = { 'Teen 4': DEFAULT_ASSIGNMENT, 'all': DEFAULT_ASSIGNMENT };
        }
        if (!parsed.classAssignments['Teen 4']) {
          parsed.classAssignments['Teen 4'] = DEFAULT_ASSIGNMENT;
        }
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
  let expressSuccess = false;

  // 1. Sync to local/Vercel serverless Express endpoint
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      expressSuccess = true;
    }
  } catch (e) {
    console.warn('Express server sync failed, attempting Cloud fallback:', e);
  }

  // 2. Firebase Firestore Database Cloud Sync
  syncToFirebaseFirestore(data);

  // 3. Global Cloud Sync Backup Endpoint
  try {
    const cloudUrl = 'https://jsonblob.com/api/jsonBlob/019fadc3-e614-7360-a446-7d3d3c3b2c61';
    await fetch(cloudUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data),
    });
    return true;
  } catch (cloudErr) {
    console.warn('Cloud sync fallback failed:', cloudErr);
  }

  return expressSuccess;
}

export async function fetchServerData(): Promise<AppData | null> {
  // 1. Try local/Vercel Express backend server first
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
    console.warn('Could not fetch Express server data, trying Firebase Firestore fallback:', e);
  }

  // 2. Try Firebase Firestore Database
  try {
    const firestoreData = await fetchFromFirebaseFirestore();
    if (firestoreData) {
      firestoreData.classes = sanitizeClassesData(firestoreData.classes || []);
      saveLocalData(firestoreData);
      return firestoreData;
    }
  } catch (fsErr) {
    console.warn('Firebase Firestore fetch failed, trying Cloud fallback:', fsErr);
  }

  // 3. Try global Cloud URL fallback for cross-device fetching
  try {
    const cloudUrl = 'https://jsonblob.com/api/jsonBlob/019fadc3-e614-7360-a446-7d3d3c3b2c61';
    const resCloud = await fetch(cloudUrl, { headers: { 'Accept': 'application/json' } });
    if (resCloud.ok) {
      const cloudData = await resCloud.json();
      if (cloudData && typeof cloudData === 'object') {
        cloudData.classes = sanitizeClassesData(cloudData.classes || []);
        saveLocalData(cloudData);
        return cloudData;
      }
    }
  } catch (cloudErr) {
    console.warn('Cloud URL fetch failed:', cloudErr);
  }

  return null;
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
          parsed.classes = sanitizeClassesData(parsed.classes || []);
          const merged = { ...INITIAL_APP_DATA, ...parsed };
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
