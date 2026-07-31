import React, { useState } from 'react';
import { BarChart3, Trash2, Award, Users, Search, Eye, X, CheckCircle, XCircle, FileText, HelpCircle, Sparkles, RotateCcw, AlertCircle } from 'lucide-react';
import { AppData, GradeRecord, Question, AssignedQuizPayload } from '../types';
import { formatDateVN } from '../utils/normalize';
import { normalizeAssignmentList, isQuizRecalled, syncWithServer } from '../services/storage';
import { checkQuestionCorrectness } from './StudentView';

interface GradesTrackerProps {
  appData: AppData;
  onUpdateAppData: (updater: (prev: AppData) => AppData) => void;
  onShowNotification: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

export const GradesTracker: React.FC<GradesTrackerProps> = ({ appData, onUpdateAppData, onShowNotification }) => {
  const [filterClass, setFilterClass] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<GradeRecord | null>(null);

  const grades = (appData.grades || []).filter((g) => {
    if (!g || !g.quizTitle) return false;
    const recalledList = appData.recalledAssignments || [];
    const deletedGradeList = appData.deletedGradeIds || [];
    if (g.id && deletedGradeList.includes(g.id)) return false;
    if (isQuizRecalled(g, recalledList)) return false;
    return true;
  });

  const filteredGrades = grades.filter((g) => {
    const matchClass = filterClass === 'all' || g.className === filterClass;
    const matchSearch =
      !searchTerm.trim() ||
      g.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.quizTitle.toLowerCase().includes(searchTerm.toLowerCase());
    return matchClass && matchSearch;
  });

  const handleDeleteGrade = async (gradeId: string, studentName: string) => {
    if (!window.confirm(`Xóa VĨNH VIỄN kết quả nộp bài của học sinh "${studentName}"?`)) return;

    const newGrades = (appData.grades || []).filter((g) => g.id !== gradeId);
    const newDeletedGradeIds = Array.from(new Set([...(appData.deletedGradeIds || []), gradeId]));

    const updatedData: AppData = {
      ...appData,
      grades: newGrades,
      deletedGradeIds: newDeletedGradeIds,
    };

    onUpdateAppData(() => updatedData);

    if (selectedGrade?.id === gradeId) {
      setSelectedGrade(null);
    }

    onShowNotification(`☁️ Đang đồng bộ xóa vĩnh viễn kết quả điểm khỏi Cloud...`, 'warning');
    await syncWithServer(updatedData);

    onShowNotification(`🗑️ Đã xóa vĩnh viễn kết quả bài làm của ${studentName}`, 'success');
  };

  const handleDeleteAllGradesForQuiz = async (quizTitle: string) => {
    if (!window.confirm(`⚠️ Bạn có chắc chắn muốn XÓA VĨNH VIỄN TOÀN BỘ ĐIỂM của bài tập "${quizTitle}"?\nThao tác này không thể hoàn tác.`)) return;

    const targetGrades = (appData.grades || []).filter((g) => (g.quizTitle || '').trim().toLowerCase() === quizTitle.trim().toLowerCase());
    const targetIds = targetGrades.map((g) => g.id).filter(Boolean);

    const newGrades = (appData.grades || []).filter((g) => (g.quizTitle || '').trim().toLowerCase() !== quizTitle.trim().toLowerCase());
    const newDeletedGradeIds = Array.from(new Set([...(appData.deletedGradeIds || []), ...targetIds]));

    const updatedData: AppData = {
      ...appData,
      grades: newGrades,
      deletedGradeIds: newDeletedGradeIds,
    };

    onUpdateAppData(() => updatedData);
    setSelectedGrade(null);

    onShowNotification(`☁️ Đang đồng bộ xóa vĩnh viễn toàn bộ điểm bài "${quizTitle}" lên Cloud...`, 'warning');
    await syncWithServer(updatedData);

    onShowNotification(`🗑️ Đã xóa vĩnh viễn toàn bộ điểm của bài "${quizTitle}"!`, 'success');
  };

  const handleRequestRetake = async (gradeId: string, studentName: string, quizTitle: string) => {
    if (!window.confirm(`📢 Yêu cầu học sinh "${studentName}" LÀM LẠI bài tập "${quizTitle}"?\n\nHọc sinh sẽ nhận được thông báo yêu cầu làm lại bài khi truy cập ứng dụng.`)) return;

    const updatedGrades = (appData.grades || []).map((g) => {
      if (g.id === gradeId) {
        return { ...g, retakeRequested: true };
      }
      return g;
    });

    const updatedData: AppData = {
      ...appData,
      grades: updatedGrades,
    };

    onUpdateAppData(() => updatedData);

    if (selectedGrade?.id === gradeId) {
      setSelectedGrade({ ...selectedGrade, retakeRequested: true });
    }

    onShowNotification(`📢 Đã gửi yêu cầu làm lại bài "${quizTitle}" cho học sinh ${studentName}!`, 'success');
  };

  // Find target quiz questions for a grade record
  const getQuestionsForGrade = (g: GradeRecord): Question[] => {
    if (!g) return [];

    // 1. Search in classAssignments
    if (appData.classAssignments) {
      for (const className in appData.classAssignments) {
        const list = normalizeAssignmentList(appData.classAssignments[className]);
        const match = list.find((q: AssignedQuizPayload) => q.quizTitle === g.quizTitle || q.id === g.id);
        if (match && match.questions && match.questions.length > 0) {
          return match.questions;
        }
      }
    }

    // 2. Search in quizLibrary
    if (appData.quizLibrary) {
      const matchLib = appData.quizLibrary.find((item) => item.title === g.quizTitle);
      if (matchLib && matchLib.questions && matchLib.questions.length > 0) {
        return matchLib.questions;
      }
    }

    // 3. Fallback to currentQuestions
    if (appData.currentQuestions && appData.currentQuestions.length > 0) {
      return appData.currentQuestions;
    }

    return [];
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-brand-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-brand-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-300 font-bold text-xs uppercase tracking-wider">
            <BarChart3 className="w-4 h-4" /> BẢNG ĐIỂM & THEO DÕI NỘP BÀI LIVE
          </div>
          <h2 className="text-xl sm:text-2xl font-heading font-black text-white mt-1">
            Bảng Điểm Học Sinh ({grades.length} lượt nộp)
          </h2>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm tên học sinh hoặc bài tập..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>
        </div>

        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
        >
          <option value="all">🌐 Tất Cả Các Lớp ({grades.length})</option>
          {appData.classes?.map((c) => (
            <option key={c.id} value={c.name}>
              🏫 {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Grades Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Học Sinh</th>
                <th className="py-3.5 px-4">Lớp Học</th>
                <th className="py-3.5 px-4">Tên Bài Tập</th>
                <th className="py-3.5 px-4 text-center">Điểm Số</th>
                <th className="py-3.5 px-4 text-center">Tỷ Lệ</th>
                <th className="py-3.5 px-4">Thời Gian Nộp</th>
                <th className="py-3.5 px-4 text-right">Báo Cáo Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredGrades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    Chưa có lượt nộp bài nào được ghi nhận.
                  </td>
                </tr>
              ) : (
                filteredGrades.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{g.studentName}</td>
                    <td className="py-3.5 px-4 font-semibold text-brand-700">{g.className}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{g.quizTitle}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600 text-sm">
                      {g.score}/10
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          g.percentage >= 80
                            ? 'bg-emerald-100 text-emerald-800'
                            : g.percentage >= 50
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {g.percentage}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{formatDateVN(g.submittedAt)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {g.retakeRequested ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-bold text-[10px] rounded-xl border border-amber-300">
                            ⚠️ Đã báo làm lại
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRequestRetake(g.id, g.studentName, g.quizTitle)}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl transition border border-amber-200 flex items-center gap-1 shadow-sm"
                            title="Yêu cầu học sinh làm lại bài này"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                            <span>Yêu Cầu Làm Lại</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedGrade(g)}
                          className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs rounded-xl transition border border-brand-200 flex items-center gap-1.5 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem Câu Đúng / Sai</span>
                        </button>
                        <button
                          onClick={() => handleDeleteGrade(g.id, g.studentName)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                          title="Xóa bài nộp"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED STUDENT SUBMISSION REPORT MODAL */}
      {selectedGrade && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-indigo-950 text-white p-6 flex items-center justify-between border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-emerald-500 text-white text-[10px] font-black rounded-full shadow-sm">
                    BÁO CÁO BÀI LÀM CHI TIẾT
                  </span>
                  <span className="text-xs text-amber-300 font-bold uppercase tracking-wider">{selectedGrade.className}</span>
                </div>
                <h3 className="text-xl font-heading font-black text-white">{selectedGrade.studentName}</h3>
                <p className="text-xs text-slate-300 font-medium">Đề bài: {selectedGrade.quizTitle} • Nộp ngày {formatDateVN(selectedGrade.submittedAt)}</p>
              </div>

              <button
                onClick={() => setSelectedGrade(null)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition border border-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
              {/* Score Summary Box */}
              {(() => {
                const questions = getQuestionsForGrade(selectedGrade);
                const userAnsMap = selectedGrade.userAnswers || selectedGrade.answers || {};

                let correctCount = 0;
                let wrongCount = 0;

                questions.forEach((q) => {
                  if (checkQuestionCorrectness(q, userAnsMap)) {
                    correctCount++;
                  } else {
                    wrongCount++;
                  }
                });

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-lg">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase">Điểm Tổng Kết</div>
                        <div className="text-lg font-black text-brand-700">{selectedGrade.score} / 10 ({selectedGrade.percentage}%)</div>
                      </div>
                    </div>

                    <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-lg">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-emerald-800 uppercase">Số Câu Làm Đúng</div>
                        <div className="text-lg font-black text-emerald-900">{correctCount} câu</div>
                      </div>
                    </div>

                    <div className="bg-rose-50/80 p-4 rounded-2xl border border-rose-200 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black text-lg">
                        <XCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-rose-800 uppercase">Số Câu Làm Sai</div>
                        <div className="text-lg font-black text-rose-900">{wrongCount} câu</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Detailed Questions Inspection List */}
              <div className="space-y-4">
                <h4 className="font-heading font-black text-sm text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-600" />
                  <span>Chi Tiết Từng Câu Hỏi & Đáp Án Học Sinh</span>
                </h4>

                {(() => {
                  const questions = getQuestionsForGrade(selectedGrade);
                  const userAnsMap = selectedGrade.userAnswers || selectedGrade.answers || {};

                  if (questions.length === 0) {
                    return (
                      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 text-xs font-medium space-y-1">
                        <HelpCircle className="w-8 h-8 text-amber-400 mx-auto" />
                        <p className="font-bold text-slate-700">Đã chấm điểm thành công ({selectedGrade.score}/10)</p>
                        <p className="text-slate-400">Nội dung chi tiết từng câu hỏi đề bài cũ đã được thu hồi hoặc gộp lưu trữ.</p>
                      </div>
                    );
                  }

                  return questions.map((q, idx) => {
                    const isCorrect = checkQuestionCorrectness(q, userAnsMap);
                    const studentAnsRaw = userAnsMap[`q_${q.id}`] || userAnsMap[`q_${q.id}_blank_0`] || 'Chưa trả lời';

                    return (
                      <div
                        key={q.id || idx}
                        className={`p-5 rounded-2xl border transition shadow-sm bg-white space-y-3 ${
                          isCorrect ? 'border-emerald-200 hover:border-emerald-300' : 'border-rose-200 hover:border-rose-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Câu #{idx + 1} • {q.sectionTitle || (q.sectionId ? `Phần ${q.sectionId}` : 'Phần bài tập')}
                            </span>
                            <h5 className="font-heading font-bold text-sm text-slate-900">{q.title}</h5>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm shrink-0 ${
                              isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                            }`}
                          >
                            {isCorrect ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>ĐÚNG</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                <span>SAI</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Student Answer vs Expected Answer Comparison */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div className={`p-3 rounded-xl border text-xs space-y-1 ${isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'}`}>
                            <div className="font-bold text-slate-500 text-[10px] uppercase">Lựa chọn của Học sinh:</div>
                            <div className={`font-bold ${isCorrect ? 'text-emerald-900' : 'text-rose-900'}`}>
                              👉 {studentAnsRaw}
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-brand-50/50 border border-brand-200 text-xs space-y-1">
                            <div className="font-bold text-brand-700 text-[10px] uppercase">Đáp án chuẩn của bài:</div>
                            <div className="font-bold text-brand-950">
                              ✅ {q.answer || 'Theo yêu cầu câu hỏi'}
                            </div>
                          </div>
                        </div>

                        {/* Question Explanation if available */}
                        {q.explanation && (
                          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs font-medium text-amber-900 space-y-1">
                            <div className="font-bold text-amber-800 text-[10px] uppercase flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              <span>Giải thích chi tiết:</span>
                            </div>
                            <p className="text-slate-700 leading-relaxed">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
              {selectedGrade.retakeRequested ? (
                <div className="px-3 py-1.5 bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Đã gửi yêu cầu làm lại cho học sinh</span>
                </div>
              ) : (
                <button
                  onClick={() => handleRequestRetake(selectedGrade.id, selectedGrade.studentName, selectedGrade.quizTitle)}
                  className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl transition border border-amber-200 flex items-center gap-1.5 shadow-sm"
                >
                  <RotateCcw className="w-4 h-4 text-amber-700" />
                  <span>📢 Yêu Cầu Học Sinh Làm Lại Bài Này</span>
                </button>
              )}

              <button
                onClick={() => setSelectedGrade(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition"
              >
                Đóng Báo Cáo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
