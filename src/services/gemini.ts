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
  let exp = `🌐 Dịch nghĩa & Phân tích câu hỏi: "${qText}"\n\n`;
  exp += `✅ Đáp án chuẩn: "${ansKey}"\n`;
  if (stAns && stAns.trim()) {
    exp += `👤 Câu lựa chọn / Bài làm của em: "${stAns}"\n\n`;
  } else {
    exp += `⚪ Trạng thái: Em chưa chọn câu trả lời cho câu hỏi này.\n\n`;
  }

  const lowerQ = (qText || '').toLowerCase();
  const lowerAns = (ansKey || '').toLowerCase();

  exp += `1. ✅ Tại sao đáp án "${ansKey}" ĐÚNG:\n`;
  if (lowerAns.includes('so') || lowerQ.includes('so')) {
    exp += `   - "So" (Vì vậy/Cho nên) nối 2 mệnh đề chỉ mối quan hệ Nguyên nhân ➔ Kết quả.\n`;
    exp += `2. ❌ Tại sao các phương án khác SAI:\n`;
    exp += `   - "Because" (Bởi vì) chỉ nguyên nhân, không đứng ở vế kết quả.\n`;
    exp += `   - "But" (Nhưng) chỉ sự đối lập, phản bác.\n`;
    exp += `3. 💡 Mẹo làm bài nhanh: "So" thường đứng sau dấu phẩy (,) ngăn cách vế nguyên nhân và vế kết quả.\n`;
  } else if (lowerAns.includes('because') || lowerQ.includes('because')) {
    exp += `   - "Because" (Bởi vì) nối mệnh đề chỉ nguyên nhân trực tiếp dẫn tới hành động.\n`;
    exp += `2. ❌ Tại sao các phương án khác SAI:\n`;
    exp += `   - "Although" chỉ sự nhượng bộ (Mặc dù).\n`;
    exp += `   - "So" đứng trước vế kết quả, không đứng trước nguyên nhân.\n`;
    exp += `3. 💡 Mẹo làm bài nhanh: Vế đằng sau giải thích lý do "Tại sao" thì luôn dùng "Because".\n`;
  } else if (lowerAns === 'dp' || lowerQ.includes('phụ thuộc')) {
    exp += `   - Đây là Mệnh Đề Phụ Thuộc (DP - Dependent Clause) bắt đầu bằng các liên từ phụ thuộc như Although, Because, While, Since, Unless...\n`;
    exp += `2. ❌ Tại sao SAI nếu chọn Mệnh đề độc lập (ID):\n`;
    exp += `   - Mệnh đề độc lập (ID) không bị ràng buộc bởi liên từ phụ thuộc và có thể đứng một mình làm câu hoàn chỉnh.\n`;
    exp += `3. 💡 Mẹo làm bài nhanh: Nhìn thấy liên từ phụ thuộc (Although, Because, When...) đứng đầu vế ➔ Chọn ngay DP!\n`;
  } else if (lowerAns === 'id' || lowerQ.includes('độc lập')) {
    exp += `   - Đây là Mệnh Đề Độc Lập (ID - Independent Clause) có đủ Chủ ngữ + Động từ và diễn đạt ý trọn vẹn.\n`;
    exp += `2. ❌ Tại sao SAI nếu chọn Mệnh đề phụ thuộc (DP):\n`;
    exp += `   - Câu không có liên từ phụ thuộc ràng buộc nên không thể là DP.\n`;
    exp += `3. 💡 Mẹo làm bài nhanh: Câu trọn vẹn ý nghĩa, không chứa liên từ phụ thuộc ➔ Chọn ngay ID!\n`;
  } else {
    exp += `   - Đáp án phù hợp nhất với ngữ cảnh và quy tắc ngữ pháp tiếng Anh.\n`;
    exp += `2. ❌ Tại sao các phương án khác SAI:\n`;
    exp += `   - Các lựa chọn khác làm sai cấu trúc hoặc không hợp logic nghĩa của câu.\n`;
    exp += `3. 💡 Mẹo làm bài nhanh: Đọc kỹ nghĩa tiếng Việt của cả câu để xác định mối quan hệ giữa các từ/mệnh đề.\n`;
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
