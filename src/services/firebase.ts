// Firebase Firestore & Real-Time Sync Service for EduQuiz Pro
import { AppData, GradeRecord, ClassAssignmentMap, AssignedQuizPayload } from '../types';

// Default Firebase Configuration template
// User can replace with their Firebase Project Config keys from Firebase Console
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSy_YOUR_FIREBASE_API_KEY",
  authDomain: "eduquiz-pro.firebaseapp.com",
  projectId: "eduquiz-pro",
  storageBucket: "eduquiz-pro.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

/**
 * Save an atomic student submission to eliminate Race Conditions.
 * Each student submission is saved as an independent document/record.
 */
export async function saveAtomicSubmission(gradeRecord: GradeRecord): Promise<boolean> {
  // 1. Send atomic submission to Express Server API
  try {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gradeRecord),
    });
    if (res.ok) {
      return true;
    }
  } catch (e) {
    console.warn('Atomic Express submission error, trying Firebase REST fallback:', e);
  }

  // 2. Firebase Firestore REST API fallback (Atomic document creation in 'submissions' collection)
  try {
    const firestoreRestUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/submissions`;
    const firestoreBody = {
      fields: {
        studentId: { stringValue: gradeRecord.studentId },
        studentName: { stringValue: gradeRecord.studentName },
        className: { stringValue: gradeRecord.className },
        quizTitle: { stringValue: gradeRecord.quizTitle },
        score: { doubleValue: gradeRecord.score },
        maxScore: { integerValue: gradeRecord.maxScore.toString() },
        percentage: { integerValue: gradeRecord.percentage.toString() },
        submittedAt: { stringValue: gradeRecord.submittedAt },
        userAnswers: { stringValue: JSON.stringify(gradeRecord.userAnswers || {}) }
      }
    };

    const resCloud = await fetch(firestoreRestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreBody),
    });

    if (resCloud.ok) {
      return true;
    }
  } catch (cloudErr) {
    console.warn('Firebase Firestore REST submission error:', cloudErr);
  }

  return false;
}

/**
 * Fetch all atomic student submissions for Teacher Gradebook.
 */
export async function fetchAtomicSubmissions(): Promise<GradeRecord[]> {
  try {
    const res = await fetch('/api/submissions');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.submissions)) {
        return data.submissions;
      }
    }
  } catch (e) {
    console.warn('Could not fetch atomic submissions:', e);
  }
  return [];
}
