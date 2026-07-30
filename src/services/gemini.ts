export async function generateQuizWithGemini(topic: string, level: string, rawText?: string): Promise<string> {
  const response = await fetch('/api/ai/generate-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, level, rawText }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Lỗi khi kết nối với Gemini AI Server');
  }

  return data.markdown || '';
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
  let exp = `💡 Phân tích chi tiết câu hỏi: "${qText}"\n\n`;
  exp += `✅ Đáp án chuẩn: "${ansKey}"\n`;
  if (stAns && stAns.trim()) {
    exp += `👤 Bài làm của em: "${stAns}"\n\n`;
  } else {
    exp += `⚪ Trạng thái: Em chưa nhập câu trả lời cho câu này.\n\n`;
  }

  const lowerQ = (qText || '').toLowerCase();
  const lowerAns = (ansKey || '').toLowerCase();

  if (lowerQ.includes('because')) {
    exp += `📌 Quy tắc: "Because" được dùng để chỉ nguyên nhân, lý do (Bởi vì... nên...).`;
  } else if (lowerQ.includes('so')) {
    exp += `📌 Quy tắc: "So" được dùng để chỉ kết quả (Vì vậy, cho nên...).`;
  } else if (lowerQ.includes('although') || lowerQ.includes('though')) {
    exp += `📌 Quy tắc: "Although" dùng để chỉ sự nhượng bộ, tương phản (Mặc dù... nhưng...).`;
  } else if (lowerQ.includes('until')) {
    exp += `📌 Quy tắc: "Until" chỉ mốc thời gian (Cho đến khi...).`;
  } else if (lowerAns === 'dp' || lowerQ.includes('phụ thuộc')) {
    exp += `📌 Quy tắc Mệnh Đề: Mệnh đề phụ thuộc (DP) bắt đầu bằng các liên từ phụ thuộc như Although, Because, While, Since, Unless... và không thể đứng độc lập làm câu hoàn chỉnh.`;
  } else if (lowerAns === 'id' || lowerQ.includes('độc lập')) {
    exp += `📌 Quy tắc Mệnh Đề: Mệnh đề độc lập (ID) có đủ Chủ ngữ + Động từ và diễn đạt một ý trọn vẹn.`;
  } else {
    exp += `📌 Lời khuyên: Em hãy chú ý đến ý nghĩa của câu và ngữ cảnh để chọn từ hoặc liên từ phù hợp nhé! Cố gắng lên!`;
  }

  return exp;
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
