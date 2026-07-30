import React, { useState } from 'react';
import { Sparkles, Send, Download, Upload, Cloud, BookPlus, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import { AppData, Question, Section } from '../types';
import { parseMarkdownQuiz } from '../utils/parser';
import { safeParseMarkdown } from '../utils/normalize';
import { generateQuizWithGemini } from '../services/gemini';
import { exportJsonBackup, importJsonBackup, syncWithServer } from '../services/storage';

interface QuizEditorProps {
  appData: AppData;
  onUpdateAppData: (updater: (prev: AppData) => AppData) => void;
  onShowNotification: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

const SAMPLE_TEXT = `## Transferable skills

1 Complete these comments by interviewers using the words and phrases in the box.

can-do attitude communication skills critical thinking determination integrity set goals team player think outside the box

1 His ideas were creative and really innovative so he can obviously ___.

2 I liked the way she worked with the other candidates so she is clearly a(n) ___.

3 He has excellent ___. The presentation was first class and he answered the questions really clearly.

4 She used ___ brilliantly. I thought she evaluated the three options in the case study carefully before deciding which one to choose.

5 She has a lot of ___. This is the third time she's applied for a position in Marketing so she hasn't stopped trying.

6 I like the way she has monthly objectives for herself which shows she can ___.

7 I don't think he will complain about work. He seems prepared to try anything. He has a real ___.

8 He is completely honest and straightforward. He shows great ___.
Answer: 1. think outside the box | 2. team player | 3. communication skills | 4. critical thinking | 5. determination | 6. set goals | 7. can-do attitude | 8. integrity`;

export const QuizEditor: React.FC<QuizEditorProps> = ({ appData, onUpdateAppData, onShowNotification }) => {
  const [rawText, setRawText] = useState(SAMPLE_TEXT);
  const [selectedTargetClass, setSelectedTargetClass] = useState<string>(appData.quizTargetClass || 'all');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiTopic, setAiTopic] = useState('');

  const parsed = parseMarkdownQuiz(rawText);

  const handleParseAndPublish = async (targetClass: string) => {
    if (parsed.questions.length === 0) {
      onShowNotification('❌ Chưa phát hiện câu hỏi hợp lệ trong nội dung Markdown!', 'warning');
      return;
    }

    const title = appData.quizTitle || 'Bài Tập Tiếng Anh Online';
    const level = appData.quizLevel || 'B1';

    const payload = {
      quizTitle: title,
      quizLevel: level,
      quizCreatedDate: new Date().toISOString(),
      questions: parsed.questions,
      sections: parsed.sections,
      wordBank: parsed.wordBank,
    };

    const newAssignments = { ...appData.classAssignments };
    if (targetClass === 'all') {
      appData.classes.forEach((c) => {
        newAssignments[c.name] = payload;
      });
    } else {
      newAssignments[targetClass] = payload;
    }

    const updatedData: AppData = {
      ...appData,
      currentQuestions: parsed.questions,
      sections: parsed.sections,
      wordBank: parsed.wordBank,
      quizTargetClass: targetClass,
      classAssignments: newAssignments,
    };

    onUpdateAppData(() => updatedData);

    // REAL-TIME AUTOMATED CLOUD SYNC
    onShowNotification('☁️ Đang tự động đẩy bài tập lên Cloud Real-Time...', 'warning');
    const cloudSuccess = await syncWithServer(updatedData);

    if (cloudSuccess) {
      onShowNotification(
        `🚀 ĐÃ GIAO BÀI & ĐỒNG BỘ CLOUD THÀNH CÔNG cho ${targetClass === 'all' ? 'TẤT CẢ CÁC LỚP' : `lớp "${targetClass}"`}! Học sinh mở web sẽ thấy ngay bài mới.`,
        'success'
      );
    } else {
      onShowNotification(`🚀 Đã phát hành bài tập trên máy local!`, 'success');
    }
  };

  const handleSaveToLibrary = () => {
    if (parsed.questions.length === 0) {
      onShowNotification('❌ Nội dung chưa có câu hỏi để lưu vào Thư viện!', 'warning');
      return;
    }

    const newItem = {
      id: `lib_${Date.now()}`,
      title: appData.quizTitle || 'Bài Tập Mới',
      level: appData.quizLevel || 'B1',
      targetClass: selectedTargetClass,
      createdDate: new Date().toISOString(),
      rawText,
      questionsCount: parsed.questions.length,
      sectionsCount: parsed.sections.length,
      questions: parsed.questions,
      sections: parsed.sections,
      wordBank: parsed.wordBank,
    };

    onUpdateAppData((prev) => ({
      ...prev,
      quizLibrary: [newItem, ...(prev.quizLibrary || [])],
    }));

    onShowNotification(`📚 Đã lưu bài tập "${newItem.title}" vào Thư Viện!`, 'success');
  };

  const handleGenerateAi = async () => {
    if (!aiTopic.trim()) {
      onShowNotification('⚠️ Vui lòng nhập chủ đề bài tập cần AI soạn!', 'warning');
      return;
    }

    setIsGeneratingAi(true);
    try {
      const generatedMd = await generateQuizWithGemini(aiTopic, appData.quizLevel || 'B1', rawText);
      setRawText(generatedMd);
      onShowNotification('✨ AI Gemini Server đã soạn bài tập thành công!', 'success');
    } catch (e: any) {
      onShowNotification(`❌ Lỗi AI: ${e.message || 'Không thể gọi Gemini Server'}`, 'error');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleExportBackup = () => {
    exportJsonBackup(appData);
    onShowNotification('📥 Đã tải file backup toàn bộ dữ liệu (.json) về máy!', 'success');
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importJsonBackup(file);
      onUpdateAppData(() => imported);
      onShowNotification('📤 Đã nạp thành công toàn bộ dữ liệu từ file Backup!', 'success');
    } catch (err: any) {
      onShowNotification(`❌ Lỗi nạp file: ${err.message}`, 'error');
    }
  };

  const handleForceCloudSync = async () => {
    onShowNotification('☁️ Đang đồng bộ đề bài và danh sách lớp lên Server Cloud...', 'warning');
    const success = await syncWithServer(appData);
    if (success) {
      onShowNotification('☁️ ĐỒNG BỘ CLOUD THÀNH CÔNG! Học sinh trên thiết bị khác đã có thể nhận đề mới.', 'success');
    } else {
      onShowNotification('⚠️ Đồng bộ Cloud thất bại. Vui lòng thử lại!', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Action Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-indigo-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> SOẠN ĐỀ & PHÂN PHÁI TẬP TRUNG
          </div>
          <h2 className="text-xl sm:text-2xl font-heading font-black text-white mt-1">
            Trình Biên Soạn Bài Tập Tiếng Anh Smart Markdown
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleForceCloudSync}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5"
          >
            <Cloud className="w-4 h-4" />
            <span>Đồng Bộ Cloud (Server)</span>
          </button>

          <button
            onClick={handleExportBackup}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs shadow transition border border-white/20 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-amber-300" />
            <span>Tải Backup (.json)</span>
          </button>

          <label className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs shadow transition border border-white/20 flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-emerald-300" />
            <span>Nạp Backup (.json)</span>
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>

          <button
            onClick={() => setRawText(SAMPLE_TEXT)}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs shadow transition border border-white/20 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
            <span>Đề Mẫu</span>
          </button>

          <button
            onClick={handleSaveToLibrary}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5"
          >
            <BookPlus className="w-3.5 h-3.5" />
            <span>Lưu Vào Thư Viện</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Markdown Input & Gemini AI Helper */}
        <div className="space-y-4">
          {/* Gemini AI Server Generator Box */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-indigo-500/10 border border-amber-300/40 rounded-3xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600 animate-spin" /> Server Gemini AI Generator
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full">
                Bảo mật Server Side
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Nhập chủ đề (VD: Thì Hiện tại hoàn thành, Phrasal Verbs...)"
                className="flex-1 px-3 py-2 bg-white border border-amber-300/60 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <button
                onClick={handleGenerateAi}
                disabled={isGeneratingAi}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-amber-950 font-bold text-xs rounded-xl shadow transition flex items-center gap-1"
              >
                {isGeneratingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Soạn Bằng AI</span>
              </button>
            </div>
          </div>

          {/* Raw Textarea */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-brand-600" /> Soạn thảo nội dung Markdown
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">
                {parsed.questions.length} câu • {parsed.sections.length} trang
              </span>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={16}
              className="w-full font-mono text-xs p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none leading-relaxed resize-y"
              placeholder="Nhập đề bài Markdown tại đây..."
            />
          </div>
        </div>

        {/* Right Column: Target Class Selector & Live Question Previews */}
        <div className="space-y-4">
          {/* Target Class Assignment Panel */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="font-heading font-bold text-base text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-brand-600" /> Giao Bài Cho Lớp Học Target
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <select
                value={selectedTargetClass}
                onChange={(e) => setSelectedTargetClass(e.target.value)}
                className="w-full sm:w-auto flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="all">🌐 Tất Cả Các Lớp / Toàn Trường</option>
                {appData.classes?.map((c) => (
                  <option key={c.id} value={c.name}>
                    🏫 {c.name} ({c.students?.length || 0} học sinh)
                  </option>
                ))}
              </select>

              <button
                onClick={() => handleParseAndPublish(selectedTargetClass)}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-500/20 transition flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>PHÁT HÀNH LIVE</span>
              </button>
            </div>
          </div>

          {/* Live Preview Cards */}
          <div className="bg-slate-50 rounded-3xl border border-slate-200 p-5 shadow-inner space-y-4 max-h-[500px] overflow-y-auto">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-500">
              Xem Trước Giao Diện Học Sinh ({parsed.questions.length} câu)
            </h4>

            {parsed.questions.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-medium text-xs">
                Chưa có câu hỏi nào. Hãy nhập nội dung bên trái để xem trước!
              </div>
            ) : (
              parsed.questions.map((q) => (
                <div key={q.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Câu {q.id}</span>
                    <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded-md uppercase text-[10px]">
                      {q.type}
                    </span>
                  </div>

                  <div
                    className="text-sm font-semibold text-slate-900"
                    dangerouslySetInnerHTML={{ __html: safeParseMarkdown(q.title) }}
                  />

                  {q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {q.options.map((opt) => (
                        <div
                          key={opt.key}
                          className={`p-2 rounded-xl border text-xs font-medium ${
                            q.answer === opt.key
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                              : 'border-slate-100 bg-slate-50 text-slate-700'
                          }`}
                        >
                          <b>{opt.key}.</b> {opt.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.answer && (
                    <div className="text-xs font-bold text-emerald-600 flex items-center gap-1 pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đáp án: {q.answer}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
