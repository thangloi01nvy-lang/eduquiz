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
  let expressSuccess = false;

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

  // Cloud fallback sync (jsonblob.com) for cross-device compatibility
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
  // 1. Try local Express backend server first
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
    console.warn('Could not fetch Express server data, trying Cloud fallback:', e);
  }

  // 2. Try global Cloud URL (jsonblob.com) for cross-device fetching
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
