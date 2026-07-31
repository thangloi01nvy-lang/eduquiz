import React, { useState } from 'react';
import { BookOpen, Send, Trash2, Download, Layers, HelpCircle, Edit3, Loader2 } from 'lucide-react';
import { AppData, LibraryItem, AssignedQuizPayload } from '../types';
import { formatDateVN } from '../utils/normalize';
import { syncWithServer, normalizeAssignmentList, getQuizDedupeKey } from '../services/storage';

interface LibraryManagerProps {
  appData: AppData;
  onUpdateAppData: (updater: (prev: AppData) => AppData) => void;
  onShowNotification: (msg: string, type?: 'success' | 'warning' | 'error') => void;
  onLoadQuizToEdit: (item: LibraryItem) => void;
}

export const LibraryManager: React.FC<LibraryManagerProps> = ({ appData, onUpdateAppData, onShowNotification, onLoadQuizToEdit }) => {
  const [targetClassMap, setTargetClassMap] = useState<Record<string, string>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const handleDeleteItem = async (itemId: string, title: string) => {
    if (!window.confirm(`XÓA VĨNH VIỄN đề bài "${title}" khỏi Thư viện và toàn bộ kết quả điểm của đề này?`)) return;

    const titleClean = (title || '').trim().toLowerCase();
    const newLibrary = (appData.quizLibrary || []).filter((item) => item.id !== itemId && (item.title || '').trim().toLowerCase() !== titleClean);
    const newDeletedIds = Array.from(new Set([...(appData.deletedLibraryIds || []), itemId]));

    // Purge all grades associated with this deleted quiz
    const targetGrades = (appData.grades || []).filter((g) => (g.quizTitle || '').trim().toLowerCase() === titleClean || g.quizId === itemId);
    const targetGradeIds = targetGrades.map((g) => g.id).filter(Boolean);

    const newGrades = (appData.grades || []).filter((g) => (g.quizTitle || '').trim().toLowerCase() !== titleClean && g.quizId !== itemId);
    const newDeletedGradeIds = Array.from(new Set([...(appData.deletedGradeIds || []), ...targetGradeIds]));

    const updatedData: AppData = {
      ...appData,
      quizLibrary: newLibrary,
      deletedLibraryIds: newDeletedIds,
      grades: newGrades,
      deletedGradeIds: newDeletedGradeIds,
    };

    onUpdateAppData(() => updatedData);
    await syncWithServer(updatedData);

    onShowNotification(`🗑️ Đã xóa VĨNH VIỄN đề bài "${title}" và toàn bộ điểm liên quan khỏi Server Cloud!`, 'success');
  };

  const handleAssignLibraryQuiz = async (item: LibraryItem) => {
    const targetClass = targetClassMap[item.id] || item.targetClass || 'all';
    setAssigningId(item.id);

    try {
      const assignId = `assign_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const payload: AssignedQuizPayload = {
        id: assignId,
        quizTitle: item.title,
        quizLevel: item.level || 'B1',
        quizCreatedDate: new Date().toISOString(),
        questions: item.questions || [],
        sections: item.sections || [],
        wordBank: item.wordBank || [],
        status: 'active',
      };

      const newAssignments = { ...(appData.classAssignments || {}) };

      if (targetClass === 'all') {
        (appData.classes || []).forEach((c) => {
          const existingList = normalizeAssignmentList(newAssignments[c.name]);
          newAssignments[c.name] = [payload, ...existingList];
        });
      } else {
        const existingList = normalizeAssignmentList(newAssignments[targetClass]);
        newAssignments[targetClass] = [payload, ...existingList];
      }

      // Clean tombstones that might conflict with this new payload
      const dedupeKey = getQuizDedupeKey(payload);
      const titleClean = (item.title || '').trim().toLowerCase();
      const itemIdClean = (item.id || '').trim().toLowerCase();

      const cleanedRecalled = (appData.recalledAssignments || []).filter((r) => {
        if (!r) return false;
        const cleanR = r.trim().toLowerCase();
        if (cleanR === itemIdClean) return false;
        if (cleanR === assignId.trim().toLowerCase()) return false;
        if (cleanR === dedupeKey.trim().toLowerCase()) return false;
        if (cleanR === titleClean) return false;
        return true;
      });

      const updatedData: AppData = {
        ...appData,
        classAssignments: newAssignments,
        recalledAssignments: cleanedRecalled,
      };

      onUpdateAppData(() => updatedData);

      onShowNotification(`☁️ Đang lưu & đồng bộ bài tập "${item.title}" lên Cloud...`, 'warning');
      const cloudSuccess = await syncWithServer(updatedData);

      if (cloudSuccess) {
        onShowNotification(
          `🚀 ĐÃ GIAO BÀI & ĐỒNG BỘ CLOUD THÀNH CÔNG cho ${
            targetClass === 'all' ? 'TẤT CẢ CÁC LỚP' : `lớp "${targetClass}"`
          }!\nHọc sinh mở web sẽ thấy bài ngay lập tức.`,
          'success'
        );
      } else {
        onShowNotification(`🚀 Đã giao bài tập trên máy local!`, 'success');
      }
    } catch (err: any) {
      onShowNotification(`❌ Lỗi khi giao bài: ${err.message || 'Không thể đồng bộ'}`, 'error');
    } finally {
      setAssigningId(null);
    }
  };

  const handleDownloadTxt = (item: LibraryItem) => {
    const header = `Tên bài tập: ${item.title}\nLớp giao: ${item.targetClass}\nTrình độ: ${item.level}\nNgày tạo: ${formatDateVN(item.createdDate)}\n----------------------------------------\n\n`;
    const fullContent = header + (item.rawText || '');

    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${item.title.replace(/\s+/g, '_')}_Backup.txt`;
    link.click();
    onShowNotification('📥 Đã tải file dự phòng bài tập (.txt) về máy!', 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-emerald-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
            <BookOpen className="w-4 h-4" /> KHO LƯU TRỮ ĐỀ THI
          </div>
          <h2 className="text-xl sm:text-2xl font-heading font-black text-white mt-1">
            Thư Viện Bài Tập Đã Lưu ({appData.quizLibrary?.length || 0} đề)
          </h2>
        </div>
      </div>

      {/* Library Grid */}
      {appData.quizLibrary?.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 font-medium space-y-2">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <p>Chưa có đề bài nào được lưu trong Thư Viện.</p>
          <p className="text-xs text-slate-400">Hãy chuyển sang tab "Soạn & Giao Đề" và nhấn "Lưu Vào Thư Viện".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appData.quizLibrary?.map((item) => (
            <div key={item.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-heading font-bold text-base text-slate-900">{item.title}</h4>
                    <p className="text-xs text-slate-500">Tạo ngày: {formatDateVN(item.createdDate)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onLoadQuizToEdit(item)}
                      className="text-brand-600 hover:text-brand-800 hover:bg-brand-50 p-1.5 rounded-lg transition flex items-center gap-1 font-bold text-xs"
                      title="Chỉnh sửa bài tập này"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span className="hidden sm:inline">Sửa</span>
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id, item.title)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                      title="Xóa khỏi thư viện"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                  <span className="flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-brand-600" /> {item.questionsCount || 0} câu
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" /> {item.sectionsCount || 1} trang
                  </span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-bold text-[10px]">
                    {item.level || 'B1'}
                  </span>
                </div>

                {/* Quick Reassign Dropdown */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Giao bài tập này cho:
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={targetClassMap[item.id] || item.targetClass || 'all'}
                      onChange={(e) => setTargetClassMap({ ...targetClassMap, [item.id]: e.target.value })}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    >
                      <option value="all">🌐 Tất Cả Các Lớp</option>
                      {appData.classes?.map((c) => (
                        <option key={c.id} value={c.name}>
                          🏫 {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAssignLibraryQuiz(item)}
                      disabled={assigningId === item.id}
                      className="px-3.5 py-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 shrink-0"
                    >
                      {assigningId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{assigningId === item.id ? 'Đang giao...' : '🚀 Giao Bài'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handleDownloadTxt(item)}
                  className="text-xs font-bold text-slate-600 hover:text-brand-600 flex items-center gap-1 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Tải file backup (.txt)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
