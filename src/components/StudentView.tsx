import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, AlertCircle, RefreshCw, Send, Award, HelpCircle, Sparkles } from 'lucide-react';
import { AppData, ActiveStudentInfo, Question, AssignedQuizPayload } from '../types';
import { normalizeClassName, safeParseMarkdown } from '../utils/normalize';
import { saveStudentDraft, loadStudentDraft, clearStudentDraft, fetchServerData } from '../services/storage';
import { saveAtomicSubmission } from '../services/firebase';
import confetti from 'canvas-confetti';

interface StudentViewProps {
  appData: AppData;
  onUpdateAppData: (updater: (prev: AppData) => AppData) => void;
  onShowNotification: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

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
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualClassName, setManualClassName] = useState('Teen 4');
  const [manualStudentName, setManualStudentName] = useState('');
  const [interactionMode, setInteractionMode] = useState<'drag' | 'dropdown' | 'input'>('drag');

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ score: number; maxScore: number; percentage: number } | null>(null);

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

  // Save student session
  const handleStudentLogin = () => {
    if (!selectedClassObj || !selectedStudentId) {
      onShowNotification('⚠️ Vui lòng chọn Lớp học và tên Học sinh của em!', 'warning');
      return;
    }

    const stObj = selectedClassObj.students?.find((s) => s.id === selectedStudentId);
    if (!stObj) return;

    const info: ActiveStudentInfo = {
      classId: selectedClassObj.id,
      className: selectedClassObj.name,
      studentId: stObj.id,
      studentName: stObj.name,
    };

    setActiveStudent(info);
    localStorage.setItem('eduquiz_active_student', JSON.stringify(info));

    // Load auto-draft
    const draft = loadStudentDraft(stObj.id);
    setAnswers(draft);
    setIsSubmitted(false);
    setScoreResult(null);

    onShowNotification(`🎒 Xin chào ${stObj.name} (${selectedClassObj.name})!`, 'success');
  };

  const handleStudentLogout = () => {
    setActiveStudent(null);
    localStorage.removeItem('eduquiz_active_student');
    setAnswers({});
    setIsSubmitted(false);
    setScoreResult(null);
  };

  // Get Assigned Quiz for active student class
  const getAssignedQuiz = (): AssignedQuizPayload | null => {
    if (!activeStudent) return null;
    const studentClassName = activeStudent.className;

    // Check classAssignments
    if (appData.classAssignments) {
      // Level 1: Exact match
      if (appData.classAssignments[studentClassName]?.questions?.length > 0) {
        return appData.classAssignments[studentClassName];
      }

      // Level 2: Normalized match
      const normStudent = normalizeClassName(studentClassName);
      for (const key in appData.classAssignments) {
        if (normalizeClassName(key) === normStudent && appData.classAssignments[key]?.questions?.length > 0) {
          return appData.classAssignments[key];
        }
      }
    }

    // Fallback to currentQuestions if target is 'all'
    if ((appData.quizTargetClass === 'all' || !appData.quizTargetClass) && appData.currentQuestions?.length > 0) {
      return {
        quizTitle: appData.quizTitle || 'Bài Tập Tiếng Anh Online',
        quizLevel: appData.quizLevel || 'B1',
        questions: appData.currentQuestions,
        sections: appData.sections || [],
        wordBank: appData.wordBank || [],
      };
    }

    return null;
  };

  const assignedQuiz = getAssignedQuiz();

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

  // Submit Quiz & Grade
  const handleSubmitQuiz = () => {
    if (!assignedQuiz || !assignedQuiz.questions) return;

    let correctCount = 0;
    const totalCount = assignedQuiz.questions.length;

    assignedQuiz.questions.forEach((q) => {
      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        const userAns = answers[`q_${q.id}`];
        if (userAns && userAns.toUpperCase() === (q.answer || '').toUpperCase()) {
          correctCount++;
        }
      } else if (q.inlineBlanks && q.inlineBlanks.length > 0) {
        let qAllCorrect = true;
        q.inlineBlanks.forEach((b, bIdx) => {
          const userAns = (answers[`q_${q.id}_blank_${bIdx}`] || '').trim().toLowerCase();
          const expected = (b.answer || '').trim().toLowerCase();

          if (userAns !== expected && !expected.split('/').map((s) => s.trim()).includes(userAns)) {
            qAllCorrect = false;
          }
        });
        if (qAllCorrect) correctCount++;
      }
    });

    const percentage = Math.round((correctCount / totalCount) * 100);
    const scoreVal = parseFloat(((correctCount / totalCount) * 10).toFixed(1));

    setScoreResult({
      score: scoreVal,
      maxScore: 10,
      percentage,
    });

    setIsSubmitted(true);

    if (activeStudent) {
      clearStudentDraft(activeStudent.studentId);

      // Save grade to appData
      const newGrade = {
        id: `g_${Date.now()}`,
        studentId: activeStudent.studentId,
        studentName: activeStudent.studentName,
        className: activeStudent.className,
        quizTitle: assignedQuiz.quizTitle,
        score: scoreVal,
        maxScore: 10,
        percentage,
        submittedAt: new Date().toISOString(),
        userAnswers: answers,
      };

      // Atomic submission to eliminate Race Condition & Rate Limits
      saveAtomicSubmission(newGrade);

      onUpdateAppData((prev) => ({
        ...prev,
        grades: [newGrade, ...(prev.grades || [])],
      }));
    }

    if (percentage >= 80 && typeof confetti === 'function') {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }

    onShowNotification(`🎉 Đã nộp bài thành công! Kết quả: ${scoreVal}/10 điểm (${percentage}%)`, 'success');
  };

  if (!activeStudent) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-heading font-black text-slate-900">Đăng Nhập Học Sinh</h2>
            <p className="text-xs text-slate-500">Vui lòng chọn Lớp học và Tên của em để vào làm bài</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleFetchLatestFromCloud}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>🔄 Tải lại Lớp & Đề mới nhất từ Cloud</span>
            </button>

            {/* Mode Switcher */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 pt-1">
              <span>{isManualInput ? 'Chế độ: Tự Nhập Tên & Lớp' : 'Chế độ: Chọn Danh Sách'}</span>
              <button
                onClick={() => setIsManualInput(!isManualInput)}
                className="text-brand-600 hover:text-brand-700 underline"
              >
                {isManualInput ? 'Chuyển sang Chọn Danh Sách' : '✍️ Tự nhập Tên & Lớp'}
              </button>
            </div>

            {!isManualInput ? (
              <>
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
                    {appData.classes?.map((c) => (
                      <option key={c.id} value={c.id}>
                        🏫 {c.name} ({c.students?.length || 0} học sinh)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedClassObj && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">2. Chọn hoặc Nhập Tên Học Sinh:</label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    >
                      <option value="">-- Chọn Tên Em Trong Danh Sách --</option>
                      {selectedClassObj.students?.map((s) => (
                        <option key={s.id} value={s.id}>
                          👤 {s.name}
                        </option>
                      ))}
                      <option value="manual_st">➕ Tên em không có trong danh sách (Tự gõ tên bên dưới)</option>
                    </select>

                    {(selectedStudentId === 'manual_st' || !selectedClassObj.students || selectedClassObj.students.length === 0) && (
                      <input
                        type="text"
                        value={manualStudentName}
                        onChange={(e) => setManualStudentName(e.target.value)}
                        placeholder="✍️ Nhập họ và tên của em (Ví dụ: Nguyễn Văn A)..."
                        className="w-full mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">1. Nhập Tên Lớp Học:</label>
                  <input
                    type="text"
                    value={manualClassName}
                    onChange={(e) => setManualClassName(e.target.value)}
                    placeholder="Ví dụ: Teen 4, Teen 1, TOEIC..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">2. Nhập Tên Học Sinh:</label>
                  <input
                    type="text"
                    value={manualStudentName}
                    onChange={(e) => setManualStudentName(e.target.value)}
                    placeholder="Nhập tên của em..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </>
            )}

            <button
              onClick={handleStudentLogin}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
            >
              <span>Vào Làm Bài Tập</span>
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
      {!assignedQuiz ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 font-medium space-y-2">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
          <p className="font-bold text-base text-slate-700">Chưa có bài tập nào được giao cho {activeStudent.className}.</p>
          <p className="text-xs text-slate-400">Vui lòng báo Giáo viên phát hành bài tập cho lớp của em!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Quiz Title */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-2">
            <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-bold rounded-full">
              Trình độ: {assignedQuiz.quizLevel || 'B1'}
            </span>
            <h2 className="text-xl font-heading font-black text-slate-900">{assignedQuiz.quizTitle}</h2>
          </div>

          {/* Conditional Word Bank Box: Render ONLY for drag-and-drop / fill-in-blank exercises with a word bank */}
          {assignedQuiz.questions?.some((q) => q.type === 'fill_in_blank' || (q.inlineBlanks && q.inlineBlanks.length > 0)) &&
            assignedQuiz.wordBank &&
            assignedQuiz.wordBank.length > 0 && (
              <div className="bg-gradient-to-br from-amber-500/10 to-brand-500/10 border border-amber-300/60 rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" /> Ngân Hàng Từ Vựng Cho Sẵn (Dành cho bài Kéo Thả / Điền Từ)
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {assignedQuiz.wordBank.map((word, wIdx) => (
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
            {assignedQuiz.questions?.map((q, qIdx) => (
              <div key={q.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="font-heading font-bold text-sm text-brand-900">Câu {qIdx + 1}</span>
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

                {/* Inline Blanks */}
                {q.inlineBlanks && q.inlineBlanks.length > 0 && (
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
              </div>
            ))}
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
    </div>
  );
};
