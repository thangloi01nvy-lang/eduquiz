import React from 'react';
import { Sparkles, GraduationCap, School, BookOpen, BarChart3, Lock, ShieldCheck } from 'lucide-react';
import { AppData } from '../types';
import { normalizeAssignmentList, deduplicateAssignmentList } from '../services/storage';

interface HeaderProps {
  currentTab: 'teacher' | 'student';
  currentTeacherSubTab: 'editor' | 'classes' | 'library' | 'grades';
  onSwitchMainTab: (tab: 'teacher' | 'student') => void;
  onSwitchTeacherSubTab: (subTab: 'editor' | 'classes' | 'library' | 'grades') => void;
  isTeacherAuthenticated: boolean;
  activeTeacherName: string;
  onOpenTeacherAuth: () => void;
  appData: AppData;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  currentTeacherSubTab,
  onSwitchMainTab,
  onSwitchTeacherSubTab,
  isTeacherAuthenticated,
  activeTeacherName,
  onOpenTeacherAuth,
  appData,
}) => {
  const publishedClassesCount = Object.values(appData.classAssignments || {}).reduce(
    (acc, val) => acc + deduplicateAssignmentList(val).length,
    0
  );

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-brand-500/30 ring-2 ring-white">
            E
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-black text-xl bg-gradient-to-r from-brand-900 via-brand-700 to-indigo-900 bg-clip-text text-transparent tracking-tight">
                EduQuiz Pro
              </h1>
              <span className="px-2.5 py-0.5 bg-emerald-500 text-white text-[10px] font-black rounded-full border border-emerald-400 shadow-sm">
                v2.4.2
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 hidden sm:block">
              Hệ Thống Đề Thi & Chấm Điểm Tiếng Anh Đa Lớp Thông Minh
            </p>
          </div>
        </div>

        {/* Main Tab Toggle: Teacher / Student */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 shadow-inner">
          <button
            onClick={() => {
              if (!isTeacherAuthenticated) {
                onOpenTeacherAuth();
              }
              onSwitchMainTab('teacher');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-heading font-bold text-xs sm:text-sm transition duration-200 ${
              currentTab === 'teacher'
                ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Góc Giáo Viên 🔒</span>
            {publishedClassesCount > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-400 text-amber-950 text-[10px] font-black rounded-full shadow-sm">
                {publishedClassesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSwitchMainTab('student')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-heading font-bold text-xs sm:text-sm transition duration-200 ${
              currentTab === 'student'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Góc Học Sinh</span>
          </button>
        </div>

        {/* Teacher Authentication Badge */}
        {currentTab === 'teacher' && (
          <div className="flex items-center gap-2">
            {isTeacherAuthenticated ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{activeTeacherName || 'Giáo Viên'}</span>
              </div>
            ) : (
              <button
                onClick={onOpenTeacherAuth}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-xl font-bold text-xs shadow transition"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Đăng Nhập Mật Khẩu GV</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Teacher Sub-Navigation Bar - ONLY SHOWN WHEN AUTHENTICATED */}
      {currentTab === 'teacher' && isTeacherAuthenticated && (
        <div className="bg-slate-50 border-t border-slate-200/80 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => onSwitchTeacherSubTab('editor')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                currentTeacherSubTab === 'editor'
                  ? 'bg-white text-brand-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span> Soạn & Giao Đề</span>
            </button>

            <button
              onClick={() => onSwitchTeacherSubTab('classes')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                currentTeacherSubTab === 'classes'
                  ? 'bg-white text-brand-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <School className="w-3.5 h-3.5 text-indigo-500" />
              <span> Quản Lý Lớp Học ({appData.classes?.length || 0})</span>
            </button>

            <button
              onClick={() => onSwitchTeacherSubTab('library')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                currentTeacherSubTab === 'library'
                  ? 'bg-white text-brand-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
              <span> Thư Viện Đề ({appData.quizLibrary?.length || 0})</span>
            </button>

            <button
              onClick={() => onSwitchTeacherSubTab('grades')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                currentTeacherSubTab === 'grades'
                  ? 'bg-white text-brand-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-brand-500" />
              <span> Bảng Điểm & Bài Nộp ({appData.grades?.length || 0})</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
