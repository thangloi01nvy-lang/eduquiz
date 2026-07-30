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
