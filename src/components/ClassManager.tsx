import React, { useState } from 'react';
import { School, Plus, Trash2, UserPlus, Send, Edit3, Users } from 'lucide-react';
import { AppData, ClassModel } from '../types';
import { normalizeClassName, sanitizeClassesData } from '../utils/normalize';
import { syncWithServer } from '../services/storage';

interface ClassManagerProps {
  appData: AppData;
  onUpdateAppData: (updater: (prev: AppData) => AppData) => void;
  onShowNotification: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

export const ClassManager: React.FC<ClassManagerProps> = ({ appData, onUpdateAppData, onShowNotification }) => {
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [addingStudentClassId, setAddingStudentClassId] = useState<string | null>(null);
  const [studentNameInput, setStudentNameInput] = useState('');
  const [studentCodeInput, setStudentCodeInput] = useState('');

  const handleCreateClass = () => {
    if (!newClassName.trim()) {
      onShowNotification('⚠️ Vui lòng nhập tên lớp học!', 'warning');
      return;
    }

    const normInput = normalizeClassName(newClassName);
    const existing = appData.classes?.find((c) => normalizeClassName(c.name) === normInput);
    if (existing) {
      onShowNotification(`🏫 Lớp "${existing.name}" đã tồn tại trong danh sách!`, 'warning');
      return;
    }

    const newClass: ClassModel = {
      id: `class_${Date.now()}`,
      name: newClassName.trim(),
      desc: newClassDesc.trim() || 'Lớp học mới',
      students: [],
    };

    const updatedClasses = sanitizeClassesData([newClass, ...(appData.classes || [])], appData.deletedClasses || []);
    const updatedData: AppData = {
      ...appData,
      classes: updatedClasses,
    };

    onUpdateAppData(() => updatedData);
    syncWithServer(updatedData);

    setNewClassName('');
    setNewClassDesc('');
    onShowNotification(`🎉 Đã tạo lớp "${newClass.name}" & ĐỒNG BỘ CLOUD thành công!`, 'success');
  };

  const handleDeleteClass = (classId: string, className: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp "${className}"?`)) return;

    const normName = normalizeClassName(className);
    const updatedDeleted = Array.from(new Set([...(appData.deletedClasses || []), classId, className, normName]));
    const updatedClasses = (appData.classes || []).filter((c) => c.id !== classId && normalizeClassName(c.name) !== normName);

    const updatedData: AppData = {
      ...appData,
      classes: updatedClasses,
      deletedClasses: updatedDeleted,
    };

    onUpdateAppData(() => updatedData);
    syncWithServer(updatedData);

    onShowNotification(`🗑️ Đã xóa lớp "${className}" & ĐỒNG BỘ CLOUD thành công!`, 'success');
  };

  const handleAddStudent = (classId: string) => {
    if (!studentNameInput.trim()) return;

    const autoCode = `HV${Math.floor(100 + Math.random() * 900)}`;
    const finalCode = studentCodeInput.trim() || autoCode;

    const updatedClasses = (appData.classes || []).map((c) => {
      if (c.id === classId) {
        const newStudent = {
          id: `st_${Date.now()}`,
          name: studentNameInput.trim(),
          code: finalCode,
        };
        return { ...c, students: [...(c.students || []), newStudent] };
      }
      return c;
    });

    const updatedData: AppData = { ...appData, classes: updatedClasses };
    onUpdateAppData(() => updatedData);
    syncWithServer(updatedData);

    setStudentNameInput('');
    setStudentCodeInput('');
    setAddingStudentClassId(null);
    onShowNotification(`👤 Đã thêm học sinh (${finalCode}) & ĐỒNG BỘ CLOUD thành công!`, 'success');
  };

  const handleDeleteStudent = (classId: string, studentId: string) => {
    const updatedClasses = (appData.classes || []).map((c) => {
      if (c.id === classId) {
        return { ...c, students: (c.students || []).filter((st) => st.id !== studentId) };
      }
      return c;
    });
    const updatedData: AppData = { ...appData, classes: updatedClasses };
    onUpdateAppData(() => updatedData);
    syncWithServer(updatedData);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-brand-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-black flex items-center gap-2">
            <School className="w-7 h-7 text-amber-400" /> Quản Lý Danh Sách Lớp Học
          </h1>
          <p className="text-xs text-indigo-200 mt-1">
            Tạo lớp, cấp Mã Học Viên và phân bổ đề thi. Dữ liệu được đồng bộ Cloud thời gian thực.
          </p>
        </div>
      </div>

      {/* Class Creation Form */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-heading font-bold text-slate-800 flex items-center gap-2">
          <Plus className="w-4 h-4 text-brand-600" /> Thêm Lớp Học Mới
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="Tên lớp (Ví dụ: Teen 4, TOEIC)..."
            className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
          <input
            type="text"
            value={newClassDesc}
            onChange={(e) => setNewClassDesc(e.target.value)}
            placeholder="Mô tả ngắn về lớp..."
            className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
          <button
            onClick={handleCreateClass}
            className="py-3 px-5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Lớp & Đồng Bộ Cloud</span>
          </button>
        </div>
      </div>

      {/* Class List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {appData.classes?.map((c) => {
          const assignedQuiz = appData.classAssignments?.[c.name];

          return (
            <div key={c.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-heading font-bold text-slate-900 flex items-center gap-1.5">
                      🏫 {c.name}
                    </h3>
                    <p className="text-xs text-slate-500">{c.desc || 'Lớp học'}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteClass(c.id, c.name)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                    title="Xóa lớp học"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Assigned Quiz Badge */}
                {assignedQuiz ? (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                    <div className="font-bold flex items-center justify-between">
                      <span>🟢 Đã Giao Bài Tập:</span>
                      <span className="px-2 py-0.5 bg-emerald-200 text-emerald-800 text-[10px] rounded-full font-bold">
                        {assignedQuiz.quizLevel || 'B1'}
                      </span>
                    </div>
                    <p className="font-medium truncate">{assignedQuiz.quizTitle}</p>
                    <p className="text-[10px] text-emerald-600">{assignedQuiz.questions?.length || 0} câu hỏi</p>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-xs">
                    ⚪ Chưa giao bài tập riêng
                  </div>
                )}

                {/* Student Roster Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-brand-600" /> Danh sách ({c.students?.length || 0})
                    </span>
                    <button
                      onClick={() => setAddingStudentClassId(addingStudentClassId === c.id ? null : c.id)}
                      className="text-brand-600 hover:text-brand-700 font-bold text-xs flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Thêm HS
                    </button>
                  </div>

                  {addingStudentClassId === c.id && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <input
                        type="text"
                        value={studentNameInput}
                        onChange={(e) => setStudentNameInput(e.target.value)}
                        placeholder="Họ và tên học sinh..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={studentCodeInput}
                          onChange={(e) => setStudentCodeInput(e.target.value)}
                          placeholder="Mã HV (Ví dụ: HV001)..."
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                        />
                        <button
                          onClick={() => handleAddStudent(c.id)}
                          className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-xs shadow"
                        >
                          Thêm
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="max-h-36 overflow-y-auto space-y-1 pt-1">
                    {c.students?.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">Chưa có học sinh trong danh sách</p>
                    ) : (
                      c.students?.map((st) => (
                        <div key={st.id} className="flex items-center justify-between py-1.5 px-2.5 hover:bg-slate-50 rounded-xl text-xs border border-slate-100">
                          <span className="font-bold text-slate-800">{st.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full font-bold">
                              {st.code || `HV${st.id.slice(-3)}`}
                            </span>
                            <button
                              onClick={() => handleDeleteStudent(c.id, st.id)}
                              className="text-slate-400 hover:text-rose-600 text-xs font-bold"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
