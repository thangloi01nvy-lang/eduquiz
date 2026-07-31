import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, AlertCircle, RefreshCw, Send, Award, HelpCircle, Sparkles } from 'lucide-react';
import { AppData, ActiveStudentInfo, Question, AssignedQuizPayload, FeedbackRecord, GradeRecord } from '../types';
import { normalizeClassName, isClassMatching, safeParseMarkdown, smartCompareAnswers, cleanAnswerText, formatDateVN } from '../utils/normalize';
import { saveStudentDraft, loadStudentDraft, clearStudentDraft, fetchServerData, syncWithServer, normalizeAssignmentList, deduplicateAssignmentList, getQuizDedupeKey, isQuizRecalled } from '../services/storage';
import { saveAtomicSubmission } from '../services/firebase';
import { explainQuestionWithGemini } from '../services/gemini';
import confetti from 'canvas-confetti';

interface StudentViewProps {
  appData: AppData;
  onUpdateAppData: (updater: (prev: AppData) => AppData) => void;
  onShowNotification: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

export function checkQuestionCorrectness(q: Question, answers: Record<string, string>): boolean {
  if (q.type === 'error_correction') {
    const errInput = answers[`q_${q.id}_blank_0`] || answers[`q_${q.id}_error`] || '';
    const corrInput = answers[`q_${q.id}_blank_1`] || answers[`q_${q.id}_correction`] || '';
    const expected = q.answer || '';

    if (expected.includes('->') || expected.includes('→') || expected.includes('/')) {
      const parts = expected.split(/->|→|\//).map((p) => p.trim());
      const expErr = parts[0] || '';
      const expCorr = parts[1] || '';

      const errOk = smartCompareAnswers(errInput, expErr);
      const corrOk = smartCompareAnswers(corrInput, expCorr);
      return errOk && corrOk;
    }

    if (corrInput && smartCompareAnswers(corrInput, expected)) return true;
    if (errInput && corrInput && (expected.includes(cleanAnswerText(errInput)) || expected.includes(cleanAnswerText(corrInput)))) return true;
  }

  if (q.inlineBlanks && q.inlineBlanks.length > 0 && q.type !== 'multiple_choice') {
    let qAllCorrect = true;
    q.inlineBlanks.forEach((b, bIdx) => {
      const uAns = answers[`q_${q.id}_blank_${bIdx}`] || '';
      const exp = b.answer || q.answer || '';
      if (!smartCompareAnswers(uAns, exp)) {
        qAllCorrect = false;
      }
    });
    return qAllCorrect;
  }

  const userAns = answers[`q_${q.id}`] || '';
  const expected = q.answer || '';

  if (!expected || !userAns) return false;

  let selectedOptText = userAns;
  let selectedOptKey = userAns;

  if (q.options && q.options.length > 0) {
    const matchedOpt = q.options.find(
      (o) => o.key.toUpperCase() === userAns.toUpperCase() || cleanAnswerText(o.text) === cleanAnswerText(userAns)
    );
    if (matchedOpt) {
      selectedOptText = matchedOpt.text;
      selectedOptKey = matchedOpt.key;
    }
  }

  // 1. Smart Compare Check
  if (smartCompareAnswers(userAns, expected)) return true;
  if (smartCompareAnswers(selectedOptText, expected)) return true;
  if (smartCompareAnswers(selectedOptKey, expected)) return true;
  if (smartCompareAnswers(`${selectedOptKey}. ${selectedOptText}`, expected)) return true;
  if (smartCompareAnswers(`${selectedOptKey}) ${selectedOptText}`, expected)) return true;

  // 2. Direct key or text match
  const cleanExp = cleanAnswerText(expected);
  const cleanKey = cleanAnswerText(selectedOptKey);
  const cleanText = cleanAnswerText(selectedOptText);

  if (cleanExp === cleanKey || cleanExp === cleanText) return true;

  // 3. Option key matching e.g. expected is "B" or "b" and student selected "B"
  if (cleanExp.length <= 2 && cleanExp === cleanKey) return true;

  return false;
}

/**
 * StudentView Component - EduQuiz Pro v2.0
 * Handles student login, class selection, live cloud sync, feedback modal, and interactive quiz submissions.
 */
export const StudentView: React.FC<StudentViewProps> = ({ appData, onUpdateAppData, onShowNotification }) => {
  const [activeStudent, setActiveStudent] = useState<ActiveStudentInfo | null>(() => {
    try {
      const raw = localStorage.getItem('eduquiz_active_student');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentCodeInput, setStudentCodeInput] = useState<string>('');
  const [interactionMode, setInteractionMode] = useState<'drag' | 'dropdown' | 'input'>('drag');

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ score: number; maxScore: number; percentage: number; aiFeedbacks?: Record<string, string> } | null>(null);
  const [aiExplanations, setAiExplanations] = useState<Record<number, string>>({});
  const [loadingAiExplainId, setLoadingAiExplainId] = useState<number | null>(null);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackContent, setFeedbackContent] = useState('');

  const handleSubmitFeedback = async () => {
    if (!feedbackContent.trim()) {
      onShowNotification('⚠️ Vui lòng nhập nội dung góp ý!', 'warning');
      return;
    }

    const newFeedback: FeedbackRecord = {
      id: `fb_${Date.now()}`,
      studentName: feedbackName.trim() || activeStudent?.studentName || 'Học sinh',
      className: activeStudent?.className || 'Chưa rõ',
      message: feedbackContent.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedData: AppData = {
      ...appData,
      feedbacks: [newFeedback, ...(appData.feedbacks || [])],
    };

    onUpdateAppData(() => updatedData);
    await syncWithServer(updatedData);

    setFeedbackContent('');
    setShowFeedbackModal(false);
    onShowNotification('💬 Đã gửi góp ý / phản hồi thành công! Cảm ơn ý kiến của em.', 'success');
  };

  // Selected class & student objects
  const selectedClassObj = appData.classes?.find((c) => c.id === selectedClassId);

  const handleFetchLatestFromCloud = async () => {
    onShowNotification('⏳ Đang tải dữ liệu mới nhất từ Cloud...', 'warning');
    const latest = await fetchServerData();
    if (latest) {
      onUpdateAppData(() => latest);
      onShowNotification('⚡ Đã cập nhật xong dữ liệu từ Cloud!', 'success');
    } else {
      onShowNotification('⚠️ Không thể tải dữ liệu từ Cloud, đang dùng dữ liệu bộ nhớ.', 'warning');
    }
  };

  // Real-time Cloud Auto-Sync Polling for Students
  useEffect(() => {
    fetchServerData().then((latest) => {
      if (latest) onUpdateAppData(() => latest);
    });

    const intervalId = setInterval(() => {
      fetchServerData().then((latest) => {
        if (latest) {
          onUpdateAppData(() => latest);
        }
      });
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  // Save student session with REAL-TIME CLOUD FETCH & STRICT STUDENT CODE VERIFICATION
  const handleStudentLogin = async () => {
    if (!selectedClassObj) {
      onShowNotification('⚠️ Vui lòng chọn Lớp học của em!', 'warning');
      return;
    }

    const inputClean = studentCodeInput.trim().toLowerCase();
    if (!inputClean) {
      onShowNotification('⚠️ Vui lòng nhập đúng Mã Số Học Viên do Giáo viên cấp!', 'warning');
      return;
    }

    // REAL-TIME CLOUD SYNC ON LOGIN
    onShowNotification('☁️ Đang đồng bộ đề bài mới nhất từ Giáo Viên...', 'warning');
    const latestCloudData = await fetchServerData();
    if (latestCloudData) {
      onUpdateAppData(() => latestCloudData);
    }

    // Verify if studentCodeInput matches a student in the class roster
    const roster = selectedClassObj.students || [];
    const matchedStudent = roster.find((s) => {
      const sCode = (s.code || '').trim().toLowerCase();
      const sId = (s.id || '').trim().toLowerCase();
      const sName = (s.name || '').trim().toLowerCase();
      return (sCode && sCode === inputClean) || (sId && sId === inputClean) || (sName && sName === inputClean);
    });

    // IF ROSTER HAS STUDENTS: REQUIRE EXACT CODE MATCH!
    if (roster.length > 0 && !matchedStudent) {
      onShowNotification(
        `❌ MÃ SỐ HỌC VIÊN KHÔNG CHÍNH XÁC! Lớp "${selectedClassObj.name}" không có mã học viên này. Vui lòng kiểm tra mã số do Giáo viên cấp.`,
        'error'
      );
      return;
    }

    const finalStudentName = matchedStudent ? matchedStudent.name : studentCodeInput.trim();
    const finalStudentId = matchedStudent ? matchedStudent.id : `st_${Date.now()}`;

    const info: ActiveStudentInfo = {
      classId: selectedClassObj.id,
      className: selectedClassObj.name,
      studentId: finalStudentId,
      studentName: finalStudentName,
    };

    setActiveStudent(info);
    localStorage.setItem('eduquiz_active_student', JSON.stringify(info));

    // Load auto-draft
    const draft = loadStudentDraft(finalStudentId);
    setAnswers(draft);
    setIsSubmitted(false);
    setScoreResult(null);

    onShowNotification(`🎒 Xin chào ${finalStudentName} (${selectedClassObj.name})! Đăng nhập thành công.`, 'success');
  };

  const handleStudentLogout = () => {
    setActiveStudent(null);
    localStorage.removeItem('eduquiz_active_student');
    setAnswers({});
    setIsSubmitted(false);
    setScoreResult(null);
  };

  const [selectedAssignment, setSelectedAssignment] = useState<AssignedQuizPayload | null>(null);

  // Get ALL Assigned Quizzes for active student class (EXACTLY what teacher published)
  const getAllAssignedQuizzes = (): AssignedQuizPayload[] => {
    if (!activeStudent) return [];
    const studentClassName = activeStudent.className;

    const assignMap = new Map<string, AssignedQuizPayload>();

    // 1. Load ONLY assigned quizzes from classAssignments matching student class
    if (appData.classAssignments) {
      for (const key in appData.classAssignments) {
        if (isClassMatching(studentClassName, key)) {
          const list = deduplicateAssignmentList(appData.classAssignments[key], appData.recalledAssignments);
          list.forEach((item) => {
            if (item && item.questions && item.questions.length > 0 && !isQuizRecalled(item, appData.recalledAssignments)) {
              const mapKey = getQuizDedupeKey(item);
              assignMap.set(mapKey, item);
            }
          });
        }
      }
    }

    // 2. Fallback to active currentQuestions ONLY IF no class assignment exists at all
    if (assignMap.size === 0 && appData.currentQuestions?.length > 0) {
      if (isClassMatching(studentClassName, appData.quizTargetClass || 'all')) {
        assignMap.set('default_active_quiz', {
          id: 'default_active_quiz',
          quizTitle: appData.quizTitle || 'Bài Tập Tiếng Anh Online',
          quizLevel: appData.quizLevel || 'B1',
          quizCreatedDate: appData.quizCreatedDate || new Date().toISOString(),
          questions: appData.currentQuestions,
          sections: appData.sections || [],
          wordBank: appData.wordBank || [],
        });
      }
    }

    return Array.from(assignMap.values()).sort((a, b) => {
      const tA = new Date(a.quizCreatedDate || 0).getTime();
      const tB = new Date(b.quizCreatedDate || 0).getTime();
      return tB - tA;
    });
  };

  const allAssignedQuizzes = getAllAssignedQuizzes();

  // Dynamic activeQuiz: Always derive the LATEST updated quiz from allAssignedQuizzes
  const activeQuiz = React.useMemo(() => {
    if (!selectedAssignment) return null;
    const updated = allAssignedQuizzes.find(
      (q) =>
        (q.id && q.id === selectedAssignment.id) ||
        (getQuizDedupeKey(q) === getQuizDedupeKey(selectedAssignment)) ||
        (q.quizTitle && q.quizTitle.trim().toLowerCase() === (selectedAssignment.quizTitle || '').trim().toLowerCase())
    );
    return updated || selectedAssignment;
  }, [selectedAssignment, allAssignedQuizzes]);

  // Auto-Drafting per answer change
  const handleAnswerChange = (questionKey: string, value: string) => {
    if (isSubmitted) return;

    setAnswers((prev) => {
      const updated = { ...prev, [questionKey]: value };
      if (activeStudent) {
        saveStudentDraft(activeStudent.studentId, updated);
      }
      return updated;
    });
  };

  // Submit Quiz & Grade ALL question types accurately
  const handleSubmitQuiz = () => {
    if (!activeQuiz || !activeQuiz.questions) return;

    let totalEarnedPoints = 0;
    let totalMaxPoints = 0;
    let correctCount = 0;

    activeQuiz.questions.forEach((q) => {
      const points = q.points || 1;
      totalMaxPoints += points;

      const isCorrect = checkQuestionCorrectness(q, answers);

      if (isCorrect) {
        correctCount++;
        totalEarnedPoints += points;
      }
    });

    const percentage = totalMaxPoints > 0 ? Math.round((totalEarnedPoints / totalMaxPoints) * 100) : 0;
    const scoreVal = totalMaxPoints > 0 ? parseFloat(((totalEarnedPoints / totalMaxPoints) * 10).toFixed(1)) : 0;

    setScoreResult({
      score: scoreVal,
      maxScore: 10,
      percentage,
    });

    setIsSubmitted(true);

    if (activeStudent) {
      clearStudentDraft(activeStudent.studentId);

      const newGrade: GradeRecord = {
        id: `g_${Date.now()}`,
        studentId: activeStudent.studentId,
        studentName: activeStudent.studentName,
        className: activeStudent.className,
        quizTitle: activeQuiz.quizTitle,
        score: scoreVal,
        maxScore: 10,
        percentage,
        submittedAt: new Date().toISOString(),
        userAnswers: answers,
        answers: answers,
      };

      onUpdateAppData((prev) => ({
        ...prev,
        grades: [newGrade, ...(prev.grades || [])],
      }));

      // Atomic Firebase Submission
      saveAtomicSubmission(newGrade);
    }

    if (percentage >= 80 && typeof confetti === 'function') {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }

    onShowNotification(`🎉 ĐÃ NỘP BÀI THÀNH CÔNG! Kết quả: ${scoreVal}/10 điểm.`, 'success');
  };

  const handleExplainAi = async (q: Question) => {
    setLoadingAiExplainId(q.id);
    try {
      let studentAns = answers[`q_${q.id}`] || answers[`q_${q.id}_blank_0`] || '';
      if (q.options && q.options.length > 0) {
        const matchedOpt = q.options.find((o) => o.key === studentAns || o.text === studentAns);
        if (matchedOpt) {
          studentAns = `${matchedOpt.text}`;
        }
      }

      let targetAnswer = (q.answer || '').trim();
      if (!targetAnswer && q.inlineBlanks && q.inlineBlanks.length > 0) {
        targetAnswer = q.inlineBlanks.map((b) => b.answer).filter(Boolean).join(' -> ');
      }
      if (!targetAnswer && q.options && q.options.length > 0) {
        targetAnswer = q.options.map((o) => `${o.key}. ${o.text}`).join(' / ');
      }

      const rawExplanation = await explainQuestionWithGemini(q.title, targetAnswer, studentAns);
      const cleanExplanation = (rawExplanation || '').replace(/\*\*/g, '');
      setAiExplanations((prev) => ({ ...prev, [q.id]: cleanExplanation }));
    } catch (e: any) {
      onShowNotification('❌ Lỗi AI Giải Thích: ' + (e.message || 'Không thể kết nối Server AI'), 'error');
    } finally {
      setLoadingAiExplainId(null);
    }
  };

  if (!activeStudent) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl font-heading font-black text-slate-900">Đăng Nhập Học Sinh</h2>
              <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-black rounded-full shadow-sm">
                v3.4.1
              </span>
            </div>
            <p className="text-xs text-slate-500">Vui lòng chọn Lớp học và nhập Mã Học Viên của em</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleFetchLatestFromCloud}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>🔄 Tải lại Lớp & Đề mới nhất từ Cloud</span>
            </button>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">1. Chọn Lớp Học:</label>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedStudentId('');
                }}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">-- Chọn Lớp Học --</option>
                {appData.classes
                  ?.filter((c) => {
                    const norm = normalizeClassName(c.name);
                    const normId = normalizeClassName(c.id);
                    const deletedSet = new Set((appData.deletedClasses || []).map((d) => normalizeClassName(d)));
                    return !deletedSet.has(norm) && !deletedSet.has(normId);
                  })
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      🏫 {c.name} ({c.students?.length || 0} học sinh)
                    </option>
                  ))}
              </select>
            </div>

            {selectedClassObj && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. Nhập Mã Số Học Viên do Giáo Viên cấp:
                  </label>
                  <input
                    type="text"
                    value={studentCodeInput}
                    onChange={(e) => setStudentCodeInput(e.target.value)}
                    placeholder="🏷️ Nhập Mã Số Học Viên (Ví dụ: HV001, HV02)..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                {/* Recognized Student Badge */}
                {studentCodeInput.trim() && (
                  <div>
                    {selectedClassObj.students?.find((s) => {
                      const inputClean = studentCodeInput.trim().toLowerCase();
                      const sCode = (s.code || '').trim().toLowerCase();
                      const sId = (s.id || '').trim().toLowerCase();
                      const sName = (s.name || '').trim().toLowerCase();
                      return (sCode && sCode === inputClean) || (sId && sId === inputClean) || (sName && sName === inputClean);
                    }) ? (
                      (() => {
                        const s = selectedClassObj.students.find((st) => {
                          const inputClean = studentCodeInput.trim().toLowerCase();
                          const sCode = (st.code || '').trim().toLowerCase();
                          const sId = (st.id || '').trim().toLowerCase();
                          const sName = (st.name || '').trim().toLowerCase();
                          return (sCode && sCode === inputClean) || (sId && sId === inputClean) || (sName && sName === inputClean);
                        })!;
                        return (
                          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2 shadow-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                            <span>✅ ĐÃ NHẬN DIỆN HỌC VIÊN: <b>[{s.code || s.id}] - {s.name}</b></span>
                          </div>
                        );
                      })()
                    ) : (
                      selectedClassObj.students && selectedClassObj.students.length > 0 && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                          <span>❌ Mã học viên "{studentCodeInput}" chưa có trong danh sách lớp {selectedClassObj.name}.</span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleStudentLogin}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
            >
              <span>🚀 XÁC NHẬN MÃ & VÀO LÀM BÀI TẬP</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Student Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-indigo-950 text-white rounded-3xl p-5 shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold text-lg">
            {activeStudent.studentName.charAt(0)}
          </div>
          <div>
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              {activeStudent.className}
            </div>
            <h2 className="text-lg font-heading font-black text-white">{activeStudent.studentName}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleFetchLatestFromCloud}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>🔄 LẤY BÀI MỚI TỪ GIÁO VIÊN</span>
          </button>

          <button
            onClick={handleStudentLogout}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl transition border border-white/20"
          >
            Đổi Học Sinh
          </button>
        </div>
      </div>

      {/* Quiz Content Container */}
      {!activeQuiz ? (
        allAssignedQuizzes.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 font-medium space-y-2">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
            <p className="font-bold text-base text-slate-700">Chưa có bài tập nào được giao cho lớp {activeStudent.className}.</p>
            <p className="text-xs text-slate-400">Vui lòng báo Giáo viên phát hành bài tập cho lớp của em!</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-black text-base text-slate-900 flex items-center gap-2">
                📚 Danh Sách Bài Tập Về Nhà Của Lớp ({allAssignedQuizzes.length} bài)
              </h3>
              <span className="text-xs font-bold text-emerald-600">✨ Chọn bài để làm hoặc xem lời giải</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allAssignedQuizzes.map((quiz, qIdx) => {
                const existingGrade = (appData.grades || []).find(
                  (g) => (g.studentId === activeStudent.studentId || g.studentName === activeStudent.studentName) && g.quizTitle === quiz.quizTitle
                );

                return (
                  <div key={quiz.id || qIdx} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 hover:shadow-md transition flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-[11px] font-bold rounded-full">
                          Bài #{allAssignedQuizzes.length - qIdx}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          Giao ngày {formatDateVN(quiz.quizCreatedDate)}
                        </span>
                      </div>

                      <h4 className="font-heading font-black text-base text-slate-900">{quiz.quizTitle}</h4>
                      <p className="text-xs text-slate-500 font-medium">{quiz.questions?.length || 0} câu hỏi • Có sẵn lời giải AI</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      {existingGrade ? (
                        <div className="space-y-2">
                          {existingGrade.retakeRequested && (
                            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-2 animate-pulse">
                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>⚠️ Giáo viên yêu cầu em làm lại bài tập này!</span>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2 justify-between">
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-xl">
                              ✅ Đã nộp ({existingGrade.score}/10)
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedAssignment(quiz);
                                  const draft = loadStudentDraft(`${activeStudent.studentId}_${quiz.quizTitle}`);
                                  setAnswers(draft);
                                  setIsSubmitted(true);
                                }}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                              >
                                💡 Xem Lời Giải
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedAssignment(quiz);
                                  setAnswers({});
                                  setIsSubmitted(false);
                                  setScoreResult(null);
                                  clearStudentDraft(`${activeStudent.studentId}_${quiz.quizTitle}`);
                                }}
                                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Làm Lại</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-full justify-between">
                          <span className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-black rounded-xl">
                            ⌛ Chưa làm
                          </span>
                          <button
                            onClick={() => {
                              setSelectedAssignment(quiz);
                              const draft = loadStudentDraft(`${activeStudent.studentId}_${quiz.quizTitle}`);
                              setAnswers(draft);
                              setIsSubmitted(false);
                              setScoreResult(null);
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                          >
                            🚀 Vào Làm Bài
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <div className="space-y-6">
          {/* Header Quiz Title & Back Button */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl font-heading font-black text-slate-900">{activeQuiz.quizTitle}</h2>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {isSubmitted && (
                <button
                  onClick={() => {
                    setAnswers({});
                    setIsSubmitted(false);
                    setScoreResult(null);
                    if (activeStudent && activeQuiz) {
                      clearStudentDraft(`${activeStudent.studentId}_${activeQuiz.quizTitle}`);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>🔄 Làm Lại Bài Này</span>
                </button>
              )}
              <button
                onClick={() => setSelectedAssignment(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                ⬅️ Danh sách bài tập ({allAssignedQuizzes.length} bài)
              </button>
            </div>
          </div>

          {/* Conditional Word Bank Box: Render ONLY for drag-and-drop / fill-in-blank exercises with a word bank */}
          {activeQuiz.questions?.some((q) => q.type === 'fill_in_blank' || (q.inlineBlanks && q.inlineBlanks.length > 0)) &&
            activeQuiz.wordBank &&
            activeQuiz.wordBank.length > 0 && (
              <div className="bg-gradient-to-br from-amber-500/10 to-brand-500/10 border border-amber-300/60 rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" /> Ngân Hàng Từ Vựng Cho Sẵn (Dành cho bài Kéo Thả / Điền Từ)
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {activeQuiz.wordBank.map((word, wIdx) => (
                    <span
                      key={wIdx}
                      className="px-3 py-1.5 bg-white border border-amber-300/80 text-amber-950 font-bold text-xs rounded-xl shadow-sm hover:scale-105 transition cursor-pointer"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}

          {/* Result Banner if Submitted */}
          {isSubmitted && scoreResult && (
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-3xl p-6 shadow-lg space-y-2 text-center animate-bounce-short">
              <Award className="w-12 h-12 mx-auto text-amber-300" />
              <h3 className="text-2xl font-heading font-black">Kết Quả Bài Làm: {scoreResult.score}/10 Điểm</h3>
              <p className="text-xs font-bold opacity-90">Tỷ lệ chính xác: {scoreResult.percentage}%</p>
            </div>
          )}

          {/* Question List */}
          <div className="space-y-4">
            {activeQuiz.questions?.map((q, qIdx) => {
              const prevQ = activeQuiz.questions[qIdx - 1];
              const showSectionBanner =
                q.sectionTitle &&
                q.sectionTitle !== 'Bài tập chung' &&
                (!prevQ || prevQ.sectionTitle !== q.sectionTitle);

              const isCorrect = isSubmitted ? checkQuestionCorrectness(q, answers) : false;
              const isWrong = isSubmitted && !isCorrect;

              return (
                <React.Fragment key={q.id}>
                  {showSectionBanner && (
                    <div className="bg-gradient-to-r from-brand-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-5 shadow-md mt-6 mb-2 border border-brand-700">
                      <h3 className="font-heading font-black text-sm sm:text-base flex items-center gap-2 text-amber-300">
                        📌 {q.sectionTitle}
                      </h3>
                    </div>
                  )}

                  <div
                    className={`rounded-3xl p-6 shadow-sm space-y-4 border transition duration-300 ${
                      isSubmitted
                        ? isWrong
                          ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-400/50 shadow-rose-100'
                          : 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/50 shadow-emerald-100'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-sm text-brand-900">Câu {qIdx + 1}</span>
                        {isSubmitted && (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase flex items-center gap-1 shadow-sm ${
                              isWrong ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {isWrong ? '❌ SAI (0 điểm)' : `✅ ĐÚNG (+${q.points || 1} điểm)`}
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md uppercase">
                        {q.type}
                      </span>
                    </div>

                    <div
                      className="text-sm font-semibold text-slate-900 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: safeParseMarkdown(q.title) }}
                    />

                    {/* Multiple Choice Options */}
                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {q.options.map((opt) => {
                          const isSelected = answers[`q_${q.id}`] === opt.key;
                          return (
                            <button
                              key={opt.key}
                              disabled={isSubmitted}
                              onClick={() => handleAnswerChange(`q_${q.id}`, opt.key)}
                              className={`p-3.5 rounded-2xl border text-left text-xs font-semibold transition ${
                                isSelected
                                  ? 'border-brand-500 bg-brand-50 text-brand-900 ring-2 ring-brand-200'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <b>{opt.key}.</b> {opt.text}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Error Correction & Word Form 2-Box Dedicated Layout */}
                    {(() => {
                      const isTwoBoxExercise =
                        q.type === 'error_correction' ||
                        (q.answer && (q.answer.includes('->') || q.answer.includes('→') || q.answer.includes('thành') || q.answer.includes(':'))) ||
                        (q.sectionTitle && /sửa lỗi|tìm lỗi|lỗi sai|word form|error/i.test(q.sectionTitle)) ||
                        (q.title && /sửa lỗi|tìm lỗi|lỗi sai|word form|error/i.test(q.title));

                      if (isTwoBoxExercise) {
                        return (
                          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-rose-50/50 via-amber-50/50 to-emerald-50/50 border border-slate-200 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                              <span>🔍 Bài tập Tìm & Sửa Lỗi Sai / Word Form - Vui lòng nhập thông tin vào 2 ô bên dưới:</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Box 1: Error */}
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                                  ❌ Ô 1: Từ / Cụm từ bị sai (Từ gốc)
                                </label>
                                <input
                                  type="text"
                                  disabled={isSubmitted}
                                  value={answers[`q_${q.id}_blank_0`] || answers[`q_${q.id}_error`] || ''}
                                  onChange={(e) => {
                                    handleAnswerChange(`q_${q.id}_blank_0`, e.target.value);
                                    handleAnswerChange(`q_${q.id}_error`, e.target.value);
                                  }}
                                  placeholder="Nhập từ bị sai (Ví dụ: to go)..."
                                  className="w-full p-3 bg-white border border-rose-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none shadow-sm"
                                />
                              </div>

                              {/* Box 2: Correction */}
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                  ✅ Ô 2: Từ / Cụm từ sửa lại đúng (Dạng đúng)
                                </label>
                                <input
                                  type="text"
                                  disabled={isSubmitted}
                                  value={answers[`q_${q.id}_blank_1`] || answers[`q_${q.id}_correction`] || ''}
                                  onChange={(e) => {
                                    handleAnswerChange(`q_${q.id}_blank_1`, e.target.value);
                                    handleAnswerChange(`q_${q.id}_correction`, e.target.value);
                                  }}
                                  placeholder="Nhập từ sửa lại (Ví dụ: going)..."
                                  className="w-full p-3 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Inline Blanks (for non error_correction fill-in-blank) */}
                    {q.type !== 'multiple_choice' && q.type !== 'error_correction' && q.inlineBlanks && q.inlineBlanks.length > 0 && (
                      <div className="space-y-3 pt-2">
                        {q.inlineBlanks.map((b, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">Ô trống {bIdx + 1}:</span>
                            <input
                              type="text"
                              disabled={isSubmitted}
                              value={answers[`q_${q.id}_blank_${bIdx}`] || ''}
                              onChange={(e) => handleAnswerChange(`q_${q.id}_blank_${bIdx}`, e.target.value)}
                              placeholder="Nhập đáp án..."
                              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-brand-900 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Essay / Short Answer Input Field */}
                    {(() => {
                      const isTwoBoxExercise =
                        q.type === 'error_correction' ||
                        (q.answer && (q.answer.includes('->') || q.answer.includes('→') || q.answer.includes('thành') || q.answer.includes(':'))) ||
                        (q.sectionTitle && /sửa lỗi|tìm lỗi|lỗi sai|word form|error/i.test(q.sectionTitle)) ||
                        (q.title && /sửa lỗi|tìm lỗi|lỗi sai|word form|error/i.test(q.title));

                      if (isTwoBoxExercise) return null;

                      if ((!q.options || q.options.length === 0) && (!q.inlineBlanks || q.inlineBlanks.length === 0)) {
                        return (
                          <div className="space-y-2 pt-2">
                            <label className="block text-xs font-bold text-slate-700">✍️ Nhập câu trả lời / Bài làm tự luận của em:</label>
                            <textarea
                              rows={3}
                              disabled={isSubmitted}
                              value={answers[`q_${q.id}`] || ''}
                              onChange={(e) => handleAnswerChange(`q_${q.id}`, e.target.value)}
                              placeholder="Gõ câu trả lời của em tại đây..."
                              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none shadow-inner"
                            />
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Explanation & Feedback Section after Submission */}
                    {isSubmitted && (
                      <div className="pt-3 border-t border-slate-100 space-y-3">
                        {q.answer && (
                          <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between">
                            <span>✅ Đáp án chuẩn: <b>{q.answer}</b></span>
                            <span className="text-[10px] font-mono opacity-80">{q.points || 1} điểm</span>
                          </div>
                        )}

                        {!aiExplanations[q.id] ? (
                          <button
                            onClick={() => handleExplainAi(q)}
                            disabled={loadingAiExplainId === q.id}
                            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-indigo-200 shadow-sm"
                          >
                            {loadingAiExplainId === q.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            )}
                            <span>💡 Xem Giải Thích Chi Tiết</span>
                          </button>
                        ) : (
                          <div className="p-4 bg-gradient-to-br from-indigo-50/90 to-purple-50/90 border border-indigo-200 rounded-2xl text-xs space-y-1.5 text-indigo-950 shadow-sm">
                            <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                              <Sparkles className="w-4 h-4 text-indigo-600 animate-bounce-short" /> 💡 Lời Giải Thích Chi Tiết:
                            </div>
                            <p className="leading-relaxed font-medium whitespace-pre-wrap">{aiExplanations[q.id]}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Submit Button */}
          {!isSubmitted && (
            <button
              onClick={handleSubmitQuiz}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-heading font-black text-base rounded-2xl shadow-xl shadow-emerald-500/20 transition flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              <span>NỘP BÀI TẬP</span>
            </button>
          )}
        </div>
      )}

      {/* Floating Feedback Button */}
      <button
        onClick={() => setShowFeedbackModal(true)}
        className="fixed bottom-6 right-6 z-30 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-amber-950 font-bold text-xs rounded-full shadow-2xl flex items-center gap-2 border border-amber-300 transition hover:scale-105"
      >
        <span>💬 Góp Ý & Phản Hồi</span>
      </button>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-heading font-black text-base text-slate-900 flex items-center gap-2">
                💬 Gửi Ý Kiến Góp Ý / Phản Hồi
              </h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên của em (hoặc Mã số):</label>
                <input
                  type="text"
                  value={feedbackName}
                  onChange={(e) => setFeedbackName(e.target.value)}
                  placeholder={activeStudent?.studentName || 'Họ và tên của em...'}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung góp ý / phản hồi:</label>
                <textarea
                  rows={4}
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  placeholder="Gõ ý kiến góp ý của em cho Giáo viên hoặc Trung tâm tại đây..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmitFeedback}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-xl font-bold text-xs shadow"
              >
                Gửi Góp Ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
