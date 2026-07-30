// EduQuiz Pro - Production Version 2.0.1 (Vercel Build Verified)
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { QuizEditor } from './components/QuizEditor';
import { ClassManager } from './components/ClassManager';
import { LibraryManager } from './components/LibraryManager';
import { StudentView } from './components/StudentView';
import { GradesTracker } from './components/GradesTracker';
import { AppData } from './types';
import { loadLocalData, syncWithServer, fetchServerData } from './services/storage';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'teacher' | 'student'>('teacher');
  const [currentTeacherSubTab, setCurrentTeacherSubTab] = useState<'editor' | 'classes' | 'library' | 'grades'>('editor');

  const [appData, setAppData] = useState<AppData>(() => loadLocalData());

  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('eduquiz_teacher_auth') === 'true';
  });
  const [activeTeacherName, setActiveTeacherName] = useState<string>(() => {
    return sessionStorage.getItem('eduquiz_teacher_name') || 'Giáo Viên';
  });

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authNameInput, setAuthNameInput] = useState<string>('');
  const [authPassInput, setAuthPassInput] = useState<string>('');

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // Initial load from Express server if available
  useEffect(() => {
    fetchServerData().then((serverData) => {
      if (serverData) {
        setAppData(serverData);
      }
    });
  }, []);

  const handleShowNotification = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const handleUpdateAppData = (updater: (prev: AppData) => AppData) => {
    setAppData((prev) => {
      const updated = updater(prev);
      syncWithServer(updated);
      return updated;
    });
  };

  const handleVerifyPassword = () => {
    const storedPass = localStorage.getItem('eduquiz_teacher_password') || '123456';
    const inputPass = authPassInput.trim();

    if (storedPass !== '123456' && inputPass !== storedPass) {
      handleShowNotification('❌ Mật khẩu Giáo viên không chính xác!', 'error');
      return;
    }

    if (inputPass && storedPass === '123456') {
      localStorage.setItem('eduquiz_teacher_password', inputPass);
    }

    const name = authNameInput.trim() || 'Giáo Viên';
    setIsTeacherAuthenticated(true);
    setActiveTeacherName(name);

    sessionStorage.setItem('eduquiz_teacher_auth', 'true');
    sessionStorage.setItem('eduquiz_teacher_name', name);
    localStorage.setItem('eduquiz_teacher_auth', 'true');
    localStorage.setItem('eduquiz_teacher_name', name);

    setShowAuthModal(false);
    handleShowNotification(`🔓 Xin chào ${name}! Đã đăng nhập Góc Giáo Viên.`, 'success');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl font-bold text-xs shadow-2xl transition duration-300 flex items-center gap-2 border ${
            notification.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
              : notification.type === 'warning'
              ? 'bg-amber-500 text-amber-950 border-amber-400 shadow-amber-500/30'
              : 'bg-rose-600 text-white border-rose-500 shadow-rose-600/30'
          }`}
        >
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <Header
        currentTab={currentTab}
        currentTeacherSubTab={currentTeacherSubTab}
        onSwitchMainTab={setCurrentTab}
        onSwitchTeacherSubTab={setCurrentTeacherSubTab}
        isTeacherAuthenticated={isTeacherAuthenticated}
        activeTeacherName={activeTeacherName}
        onOpenTeacherAuth={() => setShowAuthModal(true)}
        appData={appData}
      />

      {/* Main View Area */}
      <main className="flex-1">
        {currentTab === 'teacher' ? (
          <>
            {currentTeacherSubTab === 'editor' && (
              <QuizEditor
                appData={appData}
                onUpdateAppData={handleUpdateAppData}
                onShowNotification={handleShowNotification}
              />
            )}
            {currentTeacherSubTab === 'classes' && (
              <ClassManager
                appData={appData}
                onUpdateAppData={handleUpdateAppData}
                onShowNotification={handleShowNotification}
              />
            )}
            {currentTeacherSubTab === 'library' && (
              <LibraryManager
                appData={appData}
                onUpdateAppData={handleUpdateAppData}
                onShowNotification={handleShowNotification}
              />
            )}
            {currentTeacherSubTab === 'grades' && (
              <GradesTracker
                appData={appData}
                onUpdateAppData={handleUpdateAppData}
                onShowNotification={handleShowNotification}
              />
            )}
          </>
        ) : (
          <StudentView
            appData={appData}
            onUpdateAppData={handleUpdateAppData}
            onShowNotification={handleShowNotification}
          />
        )}
      </main>

      {/* Teacher Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-heading font-black text-slate-900 text-center">Xác Thực Giáo Viên</h3>
            <p className="text-xs text-slate-500 text-center">Vui lòng nhập tên và mật khẩu (Mặc định: 123456)</p>

            <div className="space-y-3">
              <input
                type="text"
                value={authNameInput}
                onChange={(e) => setAuthNameInput(e.target.value)}
                placeholder="Tên Giáo Viên..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
              <input
                type="password"
                value={authPassInput}
                onChange={(e) => setAuthPassInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                placeholder="Mật khẩu (Mặc định: 123456)..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowAuthModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Hủy
              </button>
              <button
                onClick={handleVerifyPassword}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow"
              >
                Đăng Nhập
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
