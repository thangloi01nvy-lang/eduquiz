import React, { useState } from 'react';
import { BarChart3, Trash2, Award, Users, Search } from 'lucide-react';
import { AppData } from '../types';
import { formatDateVN } from '../utils/normalize';

interface GradesTrackerProps {
  appData: AppData;
  onUpdateAppData: (updater: (prev: AppData) => AppData) => void;
  onShowNotification: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

export const GradesTracker: React.FC<GradesTrackerProps> = ({ appData, onUpdateAppData, onShowNotification }) => {
  const [filterClass, setFilterClass] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const grades = appData.grades || [];

  const filteredGrades = grades.filter((g) => {
    const matchClass = filterClass === 'all' || g.className === filterClass;
    const matchSearch =
      !searchTerm.trim() ||
      g.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.quizTitle.toLowerCase().includes(searchTerm.toLowerCase());
    return matchClass && matchSearch;
  });

  const handleDeleteGrade = (gradeId: string, studentName: string) => {
    if (!window.confirm(`Xóa kết quả nộp bài của học sinh "${studentName}"?`)) return;

    onUpdateAppData((prev) => ({
      ...prev,
      grades: (prev.grades || []).filter((g) => g.id !== gradeId),
    }));

    onShowNotification(`🗑️ Đã xóa kết quả bài làm của ${studentName}`, 'success');
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
                <th className="py-3.5 px-4 text-right">Thao Tác</th>
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
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
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
                      <button
                        onClick={() => handleDeleteGrade(g.id, g.studentName)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
