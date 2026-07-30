import React, { useState } from 'react';
import { School, Plus, Trash2, UserPlus, Send, Edit3, Users } from 'lucide-react';
import { AppData, ClassModel } from '../types';
import { normalizeClassName, sanitizeClassesData } from '../utils/normalize';

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

    const updatedClasses = sanitizeClassesData([newClass, ...(appData.classes || [])]);
    const updatedData: AppData = {
      ...appData,
      classes: updatedClasses,
    };

    onUpdateAppData(() => updatedData);
    syncWithServer(updatedData);

    setNewClassName('');
    setNewClassDesc('');
    onShowNotification(`🎉 Đã tạo lớp "${newClass.name}" & ĐỒNG BỘ CLOUD thành công! Học sinh ở bất cứ đâu mở web sẽ thấy ngay lớp này.`, 'success');
  };

  const handleDeleteClass = (classId: string, className: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp "${className}"?`)) return;

    onUpdateAppData((prev) => ({
      ...prev,
      classes: (prev.classes || []).filter((c) => c.id !== classId),
    }));

    onShowNotification(`🗑️ Đã xóa lớp "${className}"`, 'success');
  };

  const handleAddStudent = (classId: string) => {
    if (!studentNameInput.trim()) return;

    const updatedClasses = (appData.classes || []).map((c) => {
      if (c.id === classId) {
        const newStudent = {
          id: `st_${Date.now()}`,
          name: studentNameInput.trim(),
        };
        return { ...c, students: [...(c.students || []), newStudent] };
      }
      return c;
    });

    const updatedData: AppData = { ...appData, classes: updatedClasses };
    onUpdateAppData(() => updatedData);
    syncWithServer(updatedData);

    setStudentNameInput('');
    setAddingStudentClassId(null);
    onShowNotification('👤 Đã thêm học sinh mới & ĐỒNG BỘ CLOUD thành công!', 'success');
  };

  const handleDeleteStudent = (classId: string, studentId: string) => {
    onUpdateAppData((prev) => {
      const updatedClasses = (prev.classes || []).map((c) => {
        if (c.id === classId) {
          return { ...c, students: (c.students || []).filter((st) => st.id !== studentId) };
        }
        return c;
      });
      return { ...prev, classes: updatedClasses };
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-brand-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
            <School className="w-4 h-4" /> QUẢN LÝ DANH SÁCH LỚP HỌC & HỌC SINH
          </div>
          <h2 className="text-xl sm:text-2xl font-heading font-black text-white mt-1">
            Quản Lý Lớp Học Tập Trung ({appData.classes?.length || 0} lớp)
          </h2>
        </div>
      </div>

      {/* Quick Add Class Form */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="font-heading font-bold text-sm text-slate-900 flex items-center gap-2">
          <Plus className="w-4 h-4 text-brand-600" /> Tạo Lớp Học Mới Tức Thời
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="Tên lớp (VD: Teen 4, TOEIC Sáng...)"
            className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
          <input
            type="text"
            value={newClassDesc}
            onChange={(e) => setNewClassDesc(e.target.value)}
            placeholder="Ghi chú (tùy chọn)"
            className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
          <button
            onClick={handleCreateClass}
            className="py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Lớp Mới</span>
          </button>
        </div>
      </div>

      {/* Class Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {appData.classes?.map((c) => {
          const assignment = appData.classAssignments?.[c.name];

          return (
            <div key={c.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-heading font-bold text-base text-slate-900">{c.name}</h4>
                    <p className="text-xs text-slate-500">{c.desc || 'Chưa có ghi chú'} • {c.students?.length || 0} học sinh</p>
                  </div>
                  <button
                    onClick={() => handleDeleteClass(c.id, c.name)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Assignment Status Badge */}
                {assignment?.quizTitle ? (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                      <Send className="w-3.5 h-3.5" /> Đã phát hành đề:
                    </div>
                    <div className="font-semibold">{assignment.quizTitle} ({assignment.questions?.length || 0} câu)</div>
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
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={studentNameInput}
                        onChange={(e) => setStudentNameInput(e.target.value)}
                        placeholder="Tên học sinh mới..."
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                      />
                      <button
                        onClick={() => handleAddStudent(c.id)}
                        className="px-3 py-1.5 bg-brand-600 text-white rounded-lg font-bold text-xs"
                      >
                        Thêm
                      </button>
                    </div>
                  )}

                  <div className="max-h-36 overflow-y-auto space-y-1 pt-1">
                    {c.students?.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">Chưa có học sinh trong danh sách</p>
                    ) : (
                      c.students?.map((st) => (
                        <div key={st.id} className="flex items-center justify-between py-1 px-2 hover:bg-slate-50 rounded-lg text-xs">
                          <span className="font-medium text-slate-800">{st.name}</span>
                          <button
                            onClick={() => handleDeleteStudent(c.id, st.id)}
                            className="text-slate-400 hover:text-rose-600 text-xs"
                          >
                            ×
                          </button>
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
