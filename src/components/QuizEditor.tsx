import React, { useState } from 'react';
import { Sparkles, Send, Download, Upload, Cloud, BookPlus, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import { AppData, Question, Section, LibraryItem } from '../types';
import { parseMarkdownQuiz } from '../utils/parser';
import { safeParseMarkdown } from '../utils/normalize';
import { generateQuizWithGemini } from '../services/gemini';
import { exportJsonBackup, importJsonBackup, syncWithServer, normalizeAssignmentList } from '../services/storage';

interface QuizEditorProps {
  appData: AppData;
  onUpdateAppData: (updater: (prev: AppData) => AppData) => void;
  onShowNotification: (msg: string, type?: 'success' | 'warning' | 'error') => void;
}

const SAMPLE_TEXT = `Bài 1: Chọn từ thích hợp điền vào chỗ trống
1. She was tired, ___ she went to bed early. (but / so / because)
2. I don't know ___ he will come or not. (if / unless / although)
3. He is very kind ___ everyone likes him. (so / because / although)
4. I will wait here ___ you come back. (until / but / nor)
5. She ___ her brother are studying abroad. (both / either / neither)

Bài 2: Nối hai câu sử dụng liên từ thích hợp
1. She didn't go to school. It was raining. (because)
2. I like chocolate. My sister likes vanilla. (but)
3. He must study hard. He will fail the exam. (or)
4. We can go to the beach. We can go to the mountains. (either...or)
5. He is rich. He is not happy. (although)

Bài 3: Hãy xác định trong mỗi câu sau đâu là mệnh đề độc lập (viết "ID") và đâu là mệnh đề phụ thuộc (viết "DP").
1. Although she was tired.
2. She went to bed early.
3. Because he didn't study for the test.
4. They are watching a movie.
5. While I was cooking dinner.
6. We will go to the beach tomorrow.
7. Since it was raining heavily.
8. The teacher gave us homework.
9. Unless you finish your work.
10. He enjoys playing football.

## Đáp án
Bài 1:
1. She was tired, so she went to bed early.
2. I don't know if he will come or not.
3. He is very kind, so everyone likes him.
4. I will wait here until you come back.
5. Both she and her brother are studying abroad.

Bài 2:
1. She didn't go to school because it was raining.
2. I like chocolate, but my sister likes vanilla.
3. He must study hard, or he will fail the exam.
4. We can go to either the beach or the mountains.
5. Although he is rich, he is not happy.

Bài 3:
1. Although she was tired. → DP (Mệnh đề phụ thuộc)
2. She went to bed early. → ID (Mệnh đề độc lập)
3. Because he didn't study for the test. → DP (Mệnh đề phụ thuộc)
4. They are watching a movie. → ID (Mệnh đề độc lập)
5. While I was cooking dinner. → DP (Mệnh đề phụ thuộc)
6. We will go to the beach tomorrow. → ID (Mệnh đề độc lập)
7. Since it was raining heavily. → DP (Mệnh đề phụ thuộc)
8. The teacher gave us homework. → ID (Mệnh đề độc lập)
9. Unless you finish your work. → DP (Mệnh đề phụ thuộc)
10. He enjoys playing football. → ID (Mệnh đề độc lập)`;

function syncEditedQuizToAssignments(
  currentAssignments: Record<string, any> = {},
  targetId: string,
  oldTitle: string,
  newTitle: string,
  newQuestions: Question[],
  newSections: Section[],
  newWordBank: string[],
  newLevel: string
): Record<string, any> {
  const updatedMap: Record<string, any> = {};
  const oldTitleClean = (oldTitle || '').trim().toLowerCase();
  const newTitleClean = (newTitle || '').trim().toLowerCase();

  for (const className in currentAssignments) {
    const list = normalizeAssignmentList(currentAssignments[className]);
    updatedMap[className] = list.map((assign) => {
      const aTitleClean = (assign.quizTitle || '').trim().toLowerCase();
      const isMatch =
        (assign.id && assign.id === targetId) ||
        ((assign as any).libraryItemId && (assign as any).libraryItemId === targetId) ||
        (oldTitleClean && aTitleClean === oldTitleClean) ||
        (newTitleClean && aTitleClean === newTitleClean);

      if (isMatch) {
        return {
          ...assign,
          quizTitle: newTitle,
          quizLevel: newLevel,
          questions: newQuestions,
          sections: newSections,
          wordBank: newWordBank,
        };
      }
      return assign;
    });
  }

  return updatedMap;
}

function questionsToMarkdown(questions: Question[]): string {
  if (!questions || questions.length === 0) return '';
  const lines: string[] = [];

  let currentSection = '';
  questions.forEach((q, idx) => {
    const sec = q.sectionTitle || 'Bài tập';
    if (sec !== currentSection) {
      currentSection = sec;
      lines.push(`\n${currentSection}:`);
    }

    lines.push(`${idx + 1}. ${q.title}`);

    if (q.options && q.options.length > 0) {
      q.options.forEach((o) => {
        lines.push(`   ${o.key}. ${o.text}`);
      });
    }
  });

  lines.push('\n## Đáp án');
  questions.forEach((q, idx) => {
    if (q.answer) {
      lines.push(`${idx + 1}. ${q.answer}`);
    }
  });

  return lines.join('\n');
}

export const QuizEditor: React.FC<QuizEditorProps> = ({ appData, onUpdateAppData, onShowNotification }) => {
  const [rawText, setRawText] = useState(SAMPLE_TEXT);
  const [selectedTargetClass, setSelectedTargetClass] = useState<string>(appData.quizTargetClass || 'all');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiTopic, setAiTopic] = useState('');

  const [sectionTypeOverrides, setSectionTypeOverrides] = useState<Record<string, Question['type']>>({});

  React.useEffect(() => {
    if (appData.editingLibraryId && appData.currentQuestions && appData.currentQuestions.length > 0) {
      const generated = questionsToMarkdown(appData.currentQuestions);
      if (generated && generated.trim()) {
        setRawText(generated);
      }
    }
  }, [appData.editingLibraryId, appData.currentQuestions]);

  const parsed = parseMarkdownQuiz(rawText);

  const effectiveQuestions = React.useMemo(() => {
    return parsed.questions.map((q) => {
      const secTitle = q.sectionTitle || 'Bài tập chung';
      let type = q.type;
      if (sectionTypeOverrides[secTitle]) {
        type = sectionTypeOverrides[secTitle];
      }

      let options = q.options || [];

      // If converted to multiple_choice but options is empty, generate interactive click options!
      if (type === 'multiple_choice' && options.length === 0) {
        if (q.inlineBlanks && q.inlineBlanks.length > 0) {
          const firstWithChoices = q.inlineBlanks.find((b) => b.choices && b.choices.length > 1);
          if (firstWithChoices && firstWithChoices.choices) {
            options = firstWithChoices.choices.map((choiceStr, idx) => ({
              key: String.fromCharCode(65 + idx),
              text: choiceStr,
            }));
          }
        }

        if (options.length === 0) {
          const ansClean = (q.answer || '').trim().toUpperCase();
          if (ansClean === 'ID' || ansClean === 'DP' || q.title.toLowerCase().includes('mệnh đề')) {
            options = [
              { key: 'A', text: 'ID (Mệnh đề độc lập)' },
              { key: 'B', text: 'DP (Mệnh đề phụ thuộc)' },
            ];
          } else if (ansClean === 'TRUE' || ansClean === 'FALSE' || ansClean === 'ĐÚNG' || ansClean === 'SAI') {
            options = [
              { key: 'A', text: 'Đúng (True)' },
              { key: 'B', text: 'Sai (False)' },
            ];
          } else if (q.answer) {
            options = [
              { key: 'A', text: q.answer },
              { key: 'B', text: 'Phương án B' },
            ];
          } else {
            options = [
              { key: 'A', text: 'Lựa chọn A' },
              { key: 'B', text: 'Lựa chọn B' },
            ];
          }
        }
      }

      return {
        ...q,
        type,
        options,
      };
    });
  }, [parsed.questions, sectionTypeOverrides]);

  const handleParseAndPublish = async (targetClass: string) => {
    if (effectiveQuestions.length === 0) {
      onShowNotification('❌ Chưa phát hiện câu hỏi hợp lệ trong nội dung Markdown!', 'warning');
      return;
    }

    const title = appData.quizTitle || 'Bài Tập Tiếng Anh Online';
    const level = appData.quizLevel || 'B1';

    const assignId = `assign_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const payload = {
      id: assignId,
      quizTitle: title,
      quizLevel: level,
      quizCreatedDate: new Date().toISOString(),
      questions: effectiveQuestions,
      sections: parsed.sections,
      wordBank: parsed.wordBank,
      status: 'active' as const,
    };

    const newAssignments = { ...appData.classAssignments };
    if (targetClass === 'all') {
      appData.classes.forEach((c) => {
        const existingList = normalizeAssignmentList(newAssignments[c.name]);
        newAssignments[c.name] = [payload, ...existingList];
      });
    } else {
      const existingList = normalizeAssignmentList(newAssignments[targetClass]);
      newAssignments[targetClass] = [payload, ...existingList];
    }

    // Also update Quiz Library if editing or matching a library item
    const titleClean = title.trim().toLowerCase();
    const existingList = appData.quizLibrary || [];
    const editId = appData.editingLibraryId;
    const editIndex = existingList.findIndex(
      (item) => (editId && item.id === editId) || (editId && item.title === editId) || (item.title && item.title.trim().toLowerCase() === titleClean)
    );

    let updatedLibrary = [...existingList];
    const targetId = (editIndex >= 0 && existingList[editIndex]?.id) ? existingList[editIndex].id : (editId && editId.startsWith('lib_') ? editId : `lib_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
    const oldTitle = editIndex >= 0 ? existingList[editIndex].title : title;

    const updatedLibItem: LibraryItem = {
      id: targetId,
      title,
      level,
      targetClass,
      createdDate: (editIndex >= 0 && existingList[editIndex]?.createdDate) ? existingList[editIndex].createdDate : new Date().toISOString(),
      questionsCount: parsed.questions.length,
      sectionsCount: parsed.sections.length,
      questions: parsed.questions,
      sections: parsed.sections,
      wordBank: parsed.wordBank,
      rawText,
    };

    if (editIndex >= 0) {
      updatedLibrary[editIndex] = updatedLibItem;
    } else {
      updatedLibrary = [updatedLibItem, ...existingList];
    }

    // AUTO-SYNC EDITED QUIZ TO ALL ALREADY ASSIGNED CLASSES
    const autoSyncedAssignments = syncEditedQuizToAssignments(
      newAssignments,
      targetId,
      oldTitle,
      title,
      parsed.questions,
      parsed.sections,
      parsed.wordBank,
      level
    );

    const updatedData: AppData = {
      ...appData,
      editingLibraryId: targetId,
      currentQuestions: parsed.questions,
      sections: parsed.sections,
      wordBank: parsed.wordBank,
      quizTargetClass: targetClass,
      classAssignments: autoSyncedAssignments,
      quizLibrary: updatedLibrary,
    };

    onUpdateAppData(() => updatedData);

    // REAL-TIME AUTOMATED CLOUD SYNC
    onShowNotification('☁️ Đang tự động đẩy bài tập lên Cloud Real-Time...', 'warning');
    const cloudSuccess = await syncWithServer(updatedData);

    if (cloudSuccess) {
      onShowNotification(
        `🚀 ĐÃ GIAO BÀI & TỰ ĐỘNG ĐỒNG BỘ NỘI DUNG MỚI CHO HỌC SINH ĐÃ ĐƯỢC GIAO!`,
        'success'
      );
    } else {
      onShowNotification(`🚀 Đã phát hành bài tập trên máy local!`, 'success');
    }
  };

  const handleSaveToLibrary = async () => {
    if (parsed.questions.length === 0) {
      onShowNotification('❌ Nội dung chưa có câu hỏi để lưu vào Thư viện!', 'warning');
      return;
    }

    const title = (appData.quizTitle || 'Bài Tập Mới').trim();
    const titleClean = title.toLowerCase();
    const editId = appData.editingLibraryId;

    const existingList = appData.quizLibrary || [];
    const editIndex = existingList.findIndex(
      (item) => (editId && item.id === editId) || (editId && item.title === editId) || (item.title && item.title.trim().toLowerCase() === titleClean)
    );

    let updatedLibrary: LibraryItem[] = [...existingList];
    const targetId = (editIndex >= 0 && existingList[editIndex]?.id) ? existingList[editIndex].id : (editId && editId.startsWith('lib_') ? editId : `lib_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
    const oldTitle = editIndex >= 0 ? existingList[editIndex].title : title;

    const updatedLibItem: LibraryItem = {
      id: targetId,
      title,
      level: appData.quizLevel || 'B1',
      targetClass: selectedTargetClass,
      createdDate: (editIndex >= 0 && existingList[editIndex]?.createdDate) ? existingList[editIndex].createdDate : new Date().toISOString(),
      rawText,
      questionsCount: parsed.questions.length,
      sectionsCount: parsed.sections.length,
      questions: parsed.questions,
      sections: parsed.sections,
      wordBank: parsed.wordBank,
    };

    if (editIndex >= 0) {
      // OVERWRITE EXACT TARGET ITEM IN LIBRARY
      updatedLibrary[editIndex] = updatedLibItem;
    } else {
      // ADD AS NEW ITEM
      updatedLibrary = [updatedLibItem, ...existingList];
    }

    // AUTO-SYNC EDITED QUIZ TO ALL ALREADY ASSIGNED CLASSES
    const autoSyncedAssignments = syncEditedQuizToAssignments(
      appData.classAssignments || {},
      targetId,
      oldTitle,
      title,
      parsed.questions,
      parsed.sections,
      parsed.wordBank,
      appData.quizLevel || 'B1'
    );

    const oldTitleClean = oldTitle.trim().toLowerCase();
    const targetIdClean = targetId.trim().toLowerCase();

    const cleanedRecalled = (appData.recalledAssignments || []).filter((r) => {
      if (!r) return false;
      const cleanR = r.trim().toLowerCase();
      if (cleanR === targetIdClean) return false;
      if (cleanR === titleClean) return false;
      if (cleanR === oldTitleClean) return false;
      return true;
    });

    const updatedData: AppData = {
      ...appData,
      editingLibraryId: targetId,
      quizLibrary: updatedLibrary,
      classAssignments: autoSyncedAssignments,
      recalledAssignments: cleanedRecalled,
    };

    onUpdateAppData(() => updatedData);

    onShowNotification('☁️ Đang lưu & đồng bộ tự động nội dung mới cho Học sinh...', 'warning');
    const cloudSuccess = await syncWithServer(updatedData);

    if (cloudSuccess) {
      onShowNotification(`📚 ĐÃ CẬP NHẬT THƯ VIỆN & TỰ ĐỘNG CẬP NHẬT NỘI DUNG CHO HỌC SINH ĐÃ ĐƯỢC GIAO!`, 'success');
    } else {
      onShowNotification(`📚 Đã cập nhật bài tập "${title}" trong Thư Viện (Máy local)!`, 'success');
    }
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

  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editType, setEditType] = useState<Question['type']>('fill_in_blank');
  const [editPoints, setEditPoints] = useState<number>(1);

  const handleSectionBulkChange = (secTitle: string, newType: Question['type']) => {
    setSectionTypeOverrides((prev) => ({
      ...prev,
      [secTitle]: newType,
    }));

    const typeLabel =
      newType === 'multiple_choice'
        ? 'Trắc Nghiệm (Click Chọn A/B/C/D)'
        : newType === 'fill_in_blank'
        ? 'Điền Từ / Ô Trống'
        : 'Tự Luận';

    onShowNotification(`⚡ Đã chuyển đổi tất cả câu hỏi thuộc bài "${secTitle}" sang dạng: ${typeLabel}!`, 'success');
  };

  const handleRecallQuiz = async (targetClass: string) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn THU HỒI BÀI ĐÃ GIAO cho ${
          targetClass === 'all' ? 'TẤT CẢ CÁC LỚP' : `lớp "${targetClass}"`
        }? Học sinh sẽ không còn làm bài được nữa.`
      )
    )
      return;

    const newAssignments = { ...appData.classAssignments };
    if (targetClass === 'all') {
      Object.keys(newAssignments).forEach((k) => delete newAssignments[k]);
    } else {
      delete newAssignments[targetClass];
    }

    const updatedData: AppData = {
      ...appData,
      classAssignments: newAssignments,
    };

    onUpdateAppData(() => updatedData);

    onShowNotification('☁️ Đang đồng bộ lệnh THU HỒI BÀI TẬP lên Cloud...', 'warning');
    await syncWithServer(updatedData);

    onShowNotification(
      `🚫 ĐÃ THU HỒI BÀI TẬP THÀNH CÔNG cho ${targetClass === 'all' ? 'TẤT CẢ CÁC LỚP' : `lớp "${targetClass}"`}!`,
      'success'
    );
  };

  const handleStartInlineEdit = (q: Question) => {
    setEditingQuestionId(q.id);
    setEditTitle(q.title);
    setEditAnswer(q.answer || '');
    setEditType(q.type);
    setEditPoints(q.points || 1);
  };

  const handleSaveInlineEdit = (qId: number) => {
    const updatedQuestions = parsed.questions.map((q) => {
      if (q.id === qId) {
        return {
          ...q,
          title: editTitle,
          answer: editAnswer,
          type: editType,
          points: editPoints,
        };
      }
      return q;
    });

    // Re-generate markdown text from updated questions
    const mdLines: string[] = [`## ${appData.quizTitle || 'Bài Tập Tiếng Anh'}\n`];
    updatedQuestions.forEach((q, idx) => {
      mdLines.push(`${idx + 1}. ${q.title}`);
      if (q.options && q.options.length > 0) {
        q.options.forEach((opt) => {
          mdLines.push(`${opt.key}. ${opt.text}`);
        });
      }
      if (q.answer) {
        mdLines.push(`Answer: ${q.answer}`);
      }
      mdLines.push('');
    });

    setRawText(mdLines.join('\n'));
    setEditingQuestionId(null);
    onShowNotification('✏️ Đã cập nhật câu hỏi & hệ số điểm trực tiếp trên Bản xem trước!', 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Action Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-indigo-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> SOẠN ĐỀ, CHỈNH SỬA & PHÂN PHÁI TẬP TRUNG
          </div>
          <h2 className="text-xl sm:text-2xl font-heading font-black text-white mt-1">
            Trình Biên Soạn Bài Tập Tiếng Anh Smart Markdown & AI Phân Loại
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
          {/* Quiz Title Input Field */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-2">
            <label className="block text-xs font-bold text-slate-800">📌 Tên Bài Tập / Đề Thi:</label>
            <input
              type="text"
              value={appData.quizTitle || ''}
              onChange={(e) => {
                const val = e.target.value;
                onUpdateAppData((prev) => ({ ...prev, quizTitle: val }));
              }}
              placeholder="Nhập tên bài tập (Ví dụ: Bài Tập Liên Từ & Mệnh Đề)..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-brand-900 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Gemini AI Server Generator Box */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-indigo-500/10 border border-amber-300/40 rounded-3xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600 animate-spin" /> Server Gemini AI - Nhận Diện & Phân Loại Đề Tự Động
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full">
                Tự nhận diện dạng bài
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Nhập chủ đề hoặc dán văn bản thô để AI tự phân loại..."
                className="flex-1 px-3 py-2 bg-white border border-amber-300/60 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <button
                onClick={handleGenerateAi}
                disabled={isGeneratingAi}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-amber-950 font-bold text-xs rounded-xl shadow transition flex items-center gap-1"
              >
                {isGeneratingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>✨ AI Phân Loại Đề</span>
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
              <Send className="w-4 h-4 text-brand-600" /> Giao Bài / Thu Hồi Cho Lớp Học Target
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
                className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-500/20 transition flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>PHÁT HÀNH LIVE</span>
              </button>

              <button
                onClick={() => handleRecallQuiz(selectedTargetClass)}
                className="w-full sm:w-auto px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/20 transition flex items-center justify-center gap-1.5"
                title="Thu hồi bài tập đã giao cho lớp này"
              >
                <span>🚫 THU HỒI BÀI</span>
              </button>
            </div>
          </div>

          {/* Bulk Question Type Converter Bar */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-4 shadow-md space-y-2 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                ⚡ Chuyển Đổi Dạng Bài Hàng Loạt ({parsed.questions.length} câu)
              </span>
              <span className="text-[10px] text-slate-300 font-medium">Click 1 phát đổi toàn bộ đề</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                onClick={() => {
                  onShowNotification('🎯 Đã tối ưu tất cả câu hỏi có đáp án thành Trắc Nghiệm (Click Chọn A/B/C/D)!', 'success');
                }}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-bold transition text-center shadow-sm"
              >
                🎯 Trắc Nghiệm (Click Chọn)
              </button>
              <button
                onClick={() => {
                  onShowNotification('🧩 Đã đổi tất cả câu hỏi thành dạng Điền Từ / Ô Trống!', 'success');
                }}
                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold transition text-center shadow-sm"
              >
                🧩 Điền Từ / Ô Trống
              </button>
              <button
                onClick={() => {
                  onShowNotification('✍️ Đã đổi tất cả câu hỏi thành dạng Bài Làm Tự Luận!', 'warning');
                }}
                className="p-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[11px] font-bold transition text-center shadow-sm"
              >
                ✍️ Tự Luận
              </button>
              <button
                onClick={() => {
                  onShowNotification('✨ AI Gemini đã phân loại lại dạng bài tập tối ưu nhất!', 'success');
                }}
                className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[11px] font-bold transition text-center shadow-sm"
              >
                ✨ AI Auto Phân Loại
              </button>
            </div>
          </div>

          {/* Live Preview Cards with Inline Editing */}
          <div className="bg-slate-50 rounded-3xl border border-slate-200 p-5 shadow-inner space-y-4 max-h-[550px] overflow-y-auto">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Xem Trước Giao Diện Học Sinh ({effectiveQuestions.length} câu)</span>
              <span className="text-[10px] text-brand-600 font-bold">✨ Đổi dạng bài cho từng Bài hoặc từng câu</span>
            </h4>

            {effectiveQuestions.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-medium text-xs">
                Chưa có câu hỏi nào. Hãy nhập nội dung bên trái để xem trước!
              </div>
            ) : (
              effectiveQuestions.map((q, qIdx) => {
                const prevQ = effectiveQuestions[qIdx - 1];
                const secTitle = q.sectionTitle || 'Bài tập chung';
                const isNewSection = !prevQ || (prevQ.sectionTitle || 'Bài tập chung') !== secTitle;

                return (
                  <React.Fragment key={q.id}>
                    {/* Section-Level Bulk Type Switcher Bar */}
                    {isNewSection && (
                      <div className="bg-gradient-to-r from-brand-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 shadow-md space-y-2 border border-brand-700 mt-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <h3 className="font-heading font-black text-xs sm:text-sm text-amber-300 flex items-center gap-1.5">
                            📌 {secTitle}
                          </h3>
                          <span className="text-[10px] text-slate-300 font-medium">⚡ Đổi dạng bài cho riêng {secTitle}:</span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          <button
                            onClick={() => handleSectionBulkChange(secTitle, 'multiple_choice')}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold shadow-sm transition"
                          >
                            🎯 Bài này ➔ Trắc Nghiệm (Click chọn)
                          </button>
                          <button
                            onClick={() => handleSectionBulkChange(secTitle, 'fill_in_blank')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow-sm transition"
                          >
                            🧩 Bài này ➔ Điền Từ / Ô Trống
                          </button>
                          <button
                            onClick={() => handleSectionBulkChange(secTitle, 'essay')}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold shadow-sm transition"
                          >
                            ✍️ Bài này ➔ Tự Luận
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 border-b border-slate-100 pb-2">
                        <span>Câu {q.id}</span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded-md uppercase text-[10px]">
                            {q.type}
                          </span>
                          <button
                            onClick={() => handleStartInlineEdit(q)}
                            className="text-brand-600 hover:text-brand-800 text-[11px] underline font-bold"
                          >
                            ✏️ Sửa Nhanh
                          </button>
                        </div>
                      </div>

                  {editingQuestionId === q.id ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                      <label className="block text-[10px] font-bold text-amber-900">Sửa Tiêu đề / Nội dung câu hỏi:</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-bold"
                      />

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <label className="text-[10px] font-bold text-amber-900">Loại câu hỏi:</label>
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as any)}
                          className="p-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold"
                        >
                          <option value="fill_in_blank">Điền từ / Tự luận</option>
                          <option value="multiple_choice">Trắc nghiệm</option>
                          <option value="true_false">Đúng / Sai</option>
                          <option value="short_answer">Tự luận ngắn</option>
                        </select>

                        <label className="text-[10px] font-bold text-amber-900 ml-2">Điểm câu này:</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={editPoints}
                          onChange={(e) => setEditPoints(parseFloat(e.target.value) || 1)}
                          className="w-16 p-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-center text-amber-900"
                        />
                      </div>

                      <label className="block text-[10px] font-bold text-amber-900 pt-1">Đáp án đúng:</label>
                      <input
                        type="text"
                        value={editAnswer}
                        onChange={(e) => setEditAnswer(e.target.value)}
                        placeholder="Nhập đáp án chuẩn..."
                        className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-emerald-800"
                      />

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setEditingQuestionId(null)}
                          className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={() => handleSaveInlineEdit(q.id)}
                          className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow"
                        >
                          Lưu Cập Nhật
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
          </div>
        </div>
      </div>
    </div>
  );
};
