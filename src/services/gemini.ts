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

  // Fallback hybrid grading logic
  let totalScore = 0;
  const maxScore = questions.length;
  const aiFeedbacks: Record<string, string> = {};

  questions.forEach((q) => {
    const userAns = (userAnswers[q.id] || '').trim().toLowerCase();
    const correctAns = (q.answer || '').trim().toLowerCase();

    if (userAns && correctAns && userAns === correctAns) {
      totalScore += 1;
      aiFeedbacks[q.id] = '✅ Hoàn toàn chính xác! Em làm rất tốt!';
    } else if (userAns) {
      // Partial or semantic check fallback
      if (correctAns.includes(userAns) || userAns.includes(correctAns)) {
        totalScore += 0.8;
        aiFeedbacks[q.id] = `⚠️ Rất gần đúng! Đáp án gợi ý: "${q.answer}".`;
      } else {
        aiFeedbacks[q.id] = `❌ Chưa chính xác. Đáp án đúng là: "${q.answer}".`;
      }
    } else {
      aiFeedbacks[q.id] = `⚪ Chưa trả lời. Đáp án đúng là: "${q.answer}".`;
    }
  });

  const scaledScore = Math.round((totalScore / (maxScore || 1)) * 10 * 10) / 10;
  const percentage = Math.round((totalScore / (maxScore || 1)) * 100);

  return {
    score: scaledScore,
    maxScore: 10,
    percentage,
    aiFeedbacks,
  };
}
