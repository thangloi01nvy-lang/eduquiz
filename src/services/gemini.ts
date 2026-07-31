export async function generateQuizWithGemini(topic: string, level: string, rawText?: string): Promise<string> {
  try {
    const response = await fetch('/api/ai/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, level, rawText }),
    });

    const text = await response.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        if (data && data.markdown) return data.markdown;
      } catch (parseErr) {
        console.warn('Raw quiz generate response was not JSON:', text);
      }
    }
  } catch (e) {
    console.warn('API generate quiz fetch failed, using smart client fallback:', e);
  }

  // Client Fallback Quiz Generator
  if (rawText && rawText.trim().length > 20) {
    return rawText;
  }

  return `# Bài Tập Tiếng Anh: ${topic || 'Liên Từ & Mệnh Đề'}

📌 Bài 1: Chọn liên từ hoặc từ nối thích hợp trong ngoặc
1. She was tired, ___ she went to bed early. (so / because / but)
2. I didn't go to school ___ it was raining. (because / so / although)
3. He is very rich ___ he is not happy. (but / so / because)
4. We will wait here ___ you come back. (until / so / although)
5. She ___ her brother are studying abroad. (both / either / neither)

📌 Bài 2: Xác định loại mệnh đề (ID = Độc lập, DP = Phụ thuộc)
1. Although she was tired.
2. She went to bed early.
3. Because he didn't study for the test.
4. They are watching a movie.
5. While I was cooking dinner.

## Đáp án
Bài 1:
1. so
2. because
3. but
4. until
5. both

Bài 2:
1. DP
2. ID
3. DP
4. ID
5. DP`;
}

export async function explainQuestionWithGemini(
  questionText: string,
  answerKey: string,
  studentAnswer?: string
): Promise<string> {
  try {
    const response = await fetch('/api/ai/explain-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionText, answerKey, studentAnswer }),
    });

    const text = await response.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        if (data && data.explanation) return data.explanation;
      } catch (parseErr) {
        console.warn('Raw response was not JSON:', text);
      }
    }
  } catch (e) {
    console.warn('API Explain fetch failed, using smart client fallback:', e);
  }

  return generateClientFallbackExplanation(questionText, answerKey, studentAnswer);
}

function generateClientFallbackExplanation(qText: string, ansKey: string, stAns?: string): string {
  const displayAns = (ansKey && ansKey.trim()) ? ansKey.trim() : 'Đáp án chuẩn theo quy tắc ngữ pháp';
  const cleanAns = displayAns.toLowerCase();
  const cleanQ = (qText || '').toLowerCase();

  // Detect Question Type
  let exerciseType = 'Điền từ / Hoàn thành câu';
  if (cleanAns.includes('->') || cleanAns.includes('→') || cleanAns.includes('thành') || /sửa lỗi|tìm lỗi|error/i.test(cleanQ)) {
    exerciseType = 'Tìm & Sửa Lỗi Sai (Error Correction / Word Form)';
  } else if (/viết lại|rewrite|transform/i.test(cleanQ) || cleanQ.includes('→')) {
    exerciseType = 'Viết lại câu (Sentence Transformation)';
  } else if (/chia động từ|verb form/i.test(cleanQ)) {
    exerciseType = 'Chia động từ trong ngoặc (Verb Tenses)';
  } else if (/trắc nghiệm|chia|chọn/i.test(cleanQ)) {
    exerciseType = 'Trắc nghiệm / Chọn đáp án đúng';
  }

  // Extract Keywords & Grammar Indicators
  let keywordHint = 'Phân tích các từ xung quanh chỗ trống trong câu để tìm manh mối ngữ pháp.';
  if (cleanQ.includes('yesterday') || cleanQ.includes('ago') || cleanQ.includes('last')) {
    keywordHint = 'Từ nhận biết Thì Quá khứ đơn: "yesterday", "ago", "last..." ➔ Động từ chia V2/ed.';
  } else if (cleanQ.includes('already') || cleanQ.includes('since') || cleanQ.includes('for ') || cleanQ.includes('just')) {
    keywordHint = 'Dấu hiệu Thì Hiện tại hoàn thành: "since", "for", "already", "just" ➔ Cấu trúc: Have/Has + V3/ed.';
  } else if (cleanQ.includes('enjoy') || cleanQ.includes('mind') || cleanQ.includes('avoid') || cleanQ.includes('finish') || cleanQ.includes('suggest')) {
    keywordHint = 'Động từ chỉ sở thích/hành động (enjoy, mind, avoid, finish...) ➔ Theo sau bởi V-ing.';
  } else if (cleanQ.includes('decide') || cleanQ.includes('want') || cleanQ.includes('hope') || cleanQ.includes('agree')) {
    keywordHint = 'Động từ chỉ ý định (want, decide, hope...) ➔ Theo sau bởi To + V-infinitive.';
  } else if (cleanQ.includes('so ')) {
    keywordHint = 'Từ nối "So" (Cho nên/Vì vậy) ➔ Đứng vế kết quả của hành động.';
  } else if (cleanQ.includes('because')) {
    keywordHint = 'Liên từ "Because" (Bởi vì) ➔ Thể hiện nguyên nhân trực tiếp.';
  } else if (cleanQ.includes('although') || cleanQ.includes('though')) {
    keywordHint = 'Liên từ "Although" (Mặc dù) ➔ Thể hiện sự nhượng bộ / đối lập.';
  }

  let exp = `📘 HƯỚNG DẪN GIẢI CHI TIẾT THEO 3 BƯỚC\n\n`;

  exp += `📌 BƯỚC 1: ĐỌC & NHẬN DIỆN YÊU CẦU ĐỀ BÀI\n`;
  exp += `• Câu hỏi: "${qText}"\n`;
  exp += `• Dạng bài nhận diện: ${exerciseType}\n\n`;

  exp += `🔑 BƯỚC 2: CHỈ RA TỪ KHÓA & DẤU HIỆU NGỮ PHÁP (KEYWORDS)\n`;
  exp += `• Dấu hiệu nhận biết: ${keywordHint}\n\n`;

  exp += `🎯 BƯỚC 3: PHÂN TÍCH LỖI SAI & ÁP DỤNG ĐÁP ÁN ĐÚNG\n`;
  exp += `• ✅ Đáp án chuẩn: "${displayAns}"\n`;

  if (stAns && stAns.trim()) {
    exp += `• 👤 Bài làm của em: "${stAns.trim()}"\n`;
  } else {
    exp += `• ⚪ Bài làm của em: (Chưa nhập đáp án)\n`;
  }

  if (cleanAns.includes('->') || cleanAns.includes('→') || cleanAns.includes('thành')) {
    const parts = displayAns.split(/->|→|thành/).map((p) => p.trim());
    const errWord = parts[0] || 'Từ sai';
    const corrWord = parts[1] || 'Từ đúng';
    exp += `• 💡 Phân tích sửa lỗi: Từ sai trong câu là "${errWord}", cần chuyển đổi sang dạng đúng là "${corrWord}".\n`;
  } else {
    exp += `• 💡 Phân tích quy tắc: Đáp án "${displayAns}" chính xác vì khớp với cấu trúc ngữ pháp và ngữ cảnh câu hỏi.\n`;
  }

  return exp.replace(/\*\*/g, '');
}

export async function gradeQuizWithAI(
  questions: any[],
  userAnswers: Record<string, string>
): Promise<{ score: number; maxScore: number; percentage: number; aiFeedbacks: Record<string, string> }> {
  try {
    const response = await fetch('/api/ai/grade-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions, userAnswers }),
    });
    if (response.ok) {
      const result = await response.json();
      if (result && result.success) {
        return result.data;
      }
    }
  } catch (e) {
    console.warn('AI Grading API fallback:', e);
  }

  // Fallback weighted grading logic (Default 1 point per question, customizable points)
  let totalEarned = 0;
  let totalMax = 0;
  const aiFeedbacks: Record<string, string> = {};

  questions.forEach((q) => {
    const qWeight = q.points || 1;
    totalMax += qWeight;

    const userAns = (userAnswers[`q_${q.id}`] || userAnswers[q.id] || '').trim().toLowerCase();
    const correctAns = (q.answer || '').trim().toLowerCase();

    if (userAns && correctAns && userAns === correctAns) {
      totalEarned += qWeight;
      aiFeedbacks[q.id] = `✅ Hoàn toàn chính xác! (+${qWeight} điểm)`;
    } else if (userAns) {
      // Partial semantic match
      if (correctAns.includes(userAns) || userAns.includes(correctAns)) {
        const partialEarned = qWeight * 0.8;
        totalEarned += partialEarned;
        aiFeedbacks[q.id] = `⚠️ Rất gần đúng! (+${partialEarned} điểm). Đáp án gợi ý: "${q.answer}".`;
      } else {
        aiFeedbacks[q.id] = `❌ Chưa chính xác (0 điểm). Đáp án đúng là: "${q.answer}".`;
      }
    } else {
      aiFeedbacks[q.id] = `⚪ Chưa trả lời (0 điểm). Đáp án đúng là: "${q.answer}".`;
    }
  });

  const percentage = Math.round((totalEarned / (totalMax || 1)) * 100);
  const scaledScore = Math.round((totalEarned / (totalMax || 1)) * 10 * 10) / 10;

  return {
    score: scaledScore,
    maxScore: 10,
    percentage,
    aiFeedbacks,
  };
}
