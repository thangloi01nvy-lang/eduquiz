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

  let exp = `🌐 Phân tích câu hỏi: "${qText}"\n\n`;
  exp += `✅ Đáp án chuẩn: "${displayAns}"\n`;
  if (stAns && stAns.trim()) {
    exp += `👤 Bài làm của em: "${stAns}"\n\n`;
  } else {
    exp += `⚪ Trạng thái: Em chưa chọn / chưa điền câu trả lời.\n\n`;
  }

  const lowerQ = (qText || '').toLowerCase();
  const lowerAns = displayAns.toLowerCase();

  exp += `1. ✅ Phân tích chi tiết đáp án "${displayAns}":\n`;

  if (lowerAns.includes('->') || lowerAns.includes('→') || lowerAns.includes('thành')) {
    const parts = displayAns.split(/->|→|thành/).map((p) => p.trim());
    const errPart = parts[0] || 'từ bị sai';
    const corrPart = parts[1] || 'từ sửa đúng';
    exp += `   - Trong câu này, từ "${errPart}" bị dùng sai ngữ pháp hoặc sai dạng từ (Word form).\n`;
    exp += `   - Cần sửa lại thành "${corrPart}" để đúng cấu trúc từ vựng / thời thì và hợp logic câu.\n`;
  } else if (lowerAns.includes('so')) {
    exp += `   - "So" (Cho nên/Vì vậy) đứng ở vế kết quả, diễn đạt mối quan hệ Nguyên nhân ➔ Kết quả.\n`;
  } else if (lowerAns.includes('because')) {
    exp += `   - "Because" (Bởi vì) chỉ nguyên nhân trực tiếp dẫn tới sự việc.\n`;
  } else if (lowerAns.includes('but')) {
    exp += `   - "But" (Nhưng) thể hiện sự tương phản, đối lập giữa 2 vế câu.\n`;
  } else if (lowerAns.includes('although') || lowerAns.includes('though')) {
    exp += `   - "Although" (Mặc dù) dùng cho vế nhượng bộ.\n`;
  } else if (lowerAns === 'dp' || lowerQ.includes('phụ thuộc')) {
    exp += `   - Mệnh Đề Phụ Thuộc (DP - Dependent Clause) đi kèm liên từ (Although, Because, While...) không thể đứng tách rời.\n`;
  } else if (lowerAns === 'id' || lowerQ.includes('độc lập')) {
    exp += `   - Mệnh Đề Độc Lập (ID - Independent Clause) diễn đạt trọn vẹn 1 ý và đứng độc lập được.\n`;
  } else {
    exp += `   - Cụm từ "${displayAns}" phù hợp nhất với cấu trúc và ý nghĩa của câu hỏi.\n`;
  }

  exp += `\n2. 💡 Mẹo ghi nhớ:\n`;
  exp += `   - Xác định rõ loại từ (Danh từ / Động từ / Tính từ / Trạng từ / Liên từ) để chọn hoặc điền đáp án chính xác.\n`;

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
