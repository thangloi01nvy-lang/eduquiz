import React from 'react';
import { BookOpen, Send, Trash2, Download, Layers, HelpCircle } from 'lucide-react';
import { AppData, LibraryItem } from '../types';
import { formatDateVN } from '../utils/normalize';

interface LibraryManagerProps {
  appData: AppData;
  onUpdateAppData: (updater: (prev: AppData) => AppData) => void;
  onShowNotification: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

export const LibraryManager: React.FC<LibraryManagerProps> = ({ appData, onUpdateAppData, onShowNotification }) => {
  const handleDeleteItem = (itemId: string, title: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa đề bài "${title}" khỏi thư viện?`)) return;

    onUpdateAppData((prev) => ({
      ...prev,
      quizLibrary: (prev.quizLibrary || []).filter((item) => item.id !== itemId),
    }));

    onShowNotification(`🗑️ Đã xóa đề bài "${title}"`, 'success');
  };

  const handleAssignLibraryQuiz = (item: LibraryItem, targetClass: string) => {
    onUpdateAppData((prev) => {
      const payload = {
        quizTitle: item.title,
        quizLevel: item.level || 'B1',
        quizCreatedDate: item.createdDate || new Date().toISOString(),
        questions: item.questions || [],
        sections: item.sections || [],
        wordBank: item.wordBank || [],
      };

      const newAssignments = { ...prev.classAssignments };
      if (targetClass === 'all') {
        prev.classes.forEach((c) => {
          newAssignments[c.name] = payload;
        });
      } else {
        newAssignments[targetClass] = payload;
      }

      return {
        ...prev,
        classAssignments: newAssignments,
      };
    });

    onShowNotification(`🚀 Đã giao bài "${item.title}" cho lớp ${targetClass === 'all' ? 'TẤT CẢ' : targetClass}!`, 'success');
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
                  <button
                    onClick={() => handleDeleteItem(item.id, item.title)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
                    Giao nhanh đề này cho:
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      id={`select-lib-${item.id}`}
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
                      onClick={() => {
                        const sel = document.getElementById(`select-lib-${item.id}`) as HTMLSelectElement;
                        handleAssignLibraryQuiz(item, sel?.value || 'all');
                      }}
                      className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs shadow transition flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
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
