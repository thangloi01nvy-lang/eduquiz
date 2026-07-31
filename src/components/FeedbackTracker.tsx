import React, { useState } from 'react';
import { MessageSquare, Trash2, Search, Filter, AlertCircle, Clock, User, School } from 'lucide-react';
import { AppData, FeedbackRecord } from '../types';
import { formatDateVN } from '../utils/normalize';
import { syncWithServer } from '../services/storage';

interface FeedbackTrackerProps {
  appData: AppData;
  onUpdateAppData: (updater: (prev: AppData) => AppData) => void;
  onShowNotification: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

export const FeedbackTracker: React.FC<FeedbackTrackerProps> = ({ appData, onUpdateAppData, onShowNotification }) => {
  const [filterClass, setFilterClass] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const feedbacks = appData.feedbacks || [];

  const filteredFeedbacks = feedbacks.filter((f) => {
    const matchClass = filterClass === 'all' || (f.className || '').trim().toLowerCase() === filterClass.trim().toLowerCase();
    const matchSearch =
      !searchTerm.trim() ||
      (f.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.message || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchClass && matchSearch;
  });

  const handleDeleteFeedback = async (id: string, studentName: string) => {
    if (!window.confirm(`Xóa ý kiến góp ý của học sinh "${studentName}"?`)) return;

    const newFeedbacks = (appData.feedbacks || []).filter((f) => f.id !== id);

    const updatedData: AppData = {
      ...appData,
      feedbacks: newFeedbacks,
    };

    onUpdateAppData(() => updatedData);
    onShowNotification('☁️ Đang đồng bộ xóa góp ý lên Cloud...', 'warning');
    await syncWithServer(updatedData);

    onShowNotification(`🗑️ Đã xóa góp ý của ${studentName}`, 'success');
  };

  const handleDeleteAllFeedbacks = async () => {
    if (!window.confirm(`⚠️ Bạn có chắc muốn XÓA VĨNH VIỄN TOÀN BỘ ${feedbacks.length} ý kiến góp ý?`)) return;

    const updatedData: AppData = {
      ...appData,
      feedbacks: [],
    };

    onUpdateAppData(() => updatedData);
    onShowNotification('☁️ Đang đồng bộ xóa toàn bộ góp ý lên Cloud...', 'warning');
    await syncWithServer(updatedData);

    onShowNotification('🗑️ Đã xóa sạch toàn bộ ý kiến góp ý từ Học sinh!', 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-indigo-900 text-white rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-black text-xl shadow-lg shrink-0">
            💬
          </div>
          <div>
            <h2 className="text-xl font-heading font-black text-white">
              Ý Kiến Góp Ý & Phản Hồi Từ Học Sinh ({feedbacks.length} phản hồi)
            </h2>
            <p className="text-xs text-amber-100 font-medium mt-0.5">
              Theo dõi và quản lý phản hồi, đề xuất của Học sinh gửi tới Thầy/Cô hoặc Trung tâm
            </p>
          </div>
        </div>

        {feedbacks.length > 0 && (
          <button
            onClick={handleDeleteAllFeedbacks}
            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            <span>Xóa Tất Cả Góp Ý ({feedbacks.length})</span>
          </button>
        )}
      </div>

      {/* Filter and Search controls */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Tìm kiếm theo tên học sinh hoặc nội dung góp ý..."
            className="w-full text-xs font-semibold text-slate-800 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl p-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            <option value="all">🌐 Tất Cả Các Lớp ({feedbacks.length})</option>
            {appData.classes?.map((c) => (
              <option key={c.id} value={c.name}>
                🏫 {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Feedbacks Grid */}
      {filteredFeedbacks.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 space-y-2 shadow-sm">
          <MessageSquare className="w-12 h-12 text-amber-400 mx-auto opacity-70" />
          <p className="font-bold text-base text-slate-700">Chưa có ý kiến góp ý nào từ Học sinh.</p>
          <p className="text-xs text-slate-400">
            {searchTerm || filterClass !== 'all'
              ? 'Không tìm thấy góp ý nào phù hợp với bộ lọc.'
              : 'Khi học sinh bấm nút "💬 Góp Ý" ở trang làm bài, phản hồi sẽ xuất hiện tại đây ngay lập tức!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFeedbacks.map((item, idx) => (
            <div
              key={item.id || idx}
              className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3 hover:shadow-md transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center">
                      {(item.studentName || 'H').charAt(0)}
                    </span>
                    <div>
                      <h4 className="font-heading font-black text-sm text-slate-900">{item.studentName || 'Học sinh'}</h4>
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-md">
                        {item.className || 'Chưa rõ lớp'}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDateVN(item.createdAt)}
                  </span>
                </div>

                <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-2xl text-xs font-medium text-slate-800 leading-relaxed space-y-1">
                  <p className="whitespace-pre-wrap">💬 "{item.message}"</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => handleDeleteFeedback(item.id, item.studentName)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa Góp Ý</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
