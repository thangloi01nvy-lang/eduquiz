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
/**
 * Write Class Rosters & Published Quizzes directly to Firebase Firestore
 */
export async function syncToFirebaseFirestore(data: AppData): Promise<boolean> {
  try {
    const firestoreRestUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/appData/latest`;
    const firestoreBody = {
      fields: {
        payload: { stringValue: JSON.stringify(data) },
        updatedAt: { stringValue: new Date().toISOString() }
      }
    };

    const res = await fetch(firestoreRestUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreBody),
    });

    if (res.ok) {
      return true;
    }
  } catch (e) {
    console.warn('Firebase Firestore sync warning:', e);
  }
  return false;
}

/**
 * Read Class Rosters & Published Quizzes directly from Firebase Firestore in Real-Time
 */
export async function fetchFromFirebaseFirestore(): Promise<AppData | null> {
  try {
    const firestoreRestUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/appData/latest`;
    const res = await fetch(firestoreRestUrl);
    if (res.ok) {
      const doc = await res.json();
      if (doc && doc.fields && doc.fields.payload && doc.fields.payload.stringValue) {
        const parsed = JSON.parse(doc.fields.payload.stringValue);
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Firebase Firestore fetch warning:', e);
  }
  return null;
}
