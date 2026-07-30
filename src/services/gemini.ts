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
  const response = await fetch('/api/ai/explain-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionText, answerKey, studentAnswer }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Lỗi giải thích câu hỏi bằng AI');
  }

  return data.explanation || '';
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
