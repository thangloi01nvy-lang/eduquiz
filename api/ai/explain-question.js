import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { questionText, answerKey, studentAnswer } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const fallbackExplanation = generateFallbackExplanation(questionText, answerKey, studentAnswer);
      return res.status(200).json({ success: true, explanation: fallbackExplanation });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Bạn là giáo viên tiếng Anh tận tâm. Hãy giải thích ngắn gọn, dễ hiểu bằng tiếng Việt cho học sinh lý do tại sao đáp án đúng là "${answerKey}" cho câu hỏi sau:
Câu hỏi: "${questionText}"
Bài làm của học sinh: "${studentAnswer || 'Chưa trả lời'}"

Yêu cầu:
- Nêu rõ cấu trúc ngữ pháp / quy tắc liên từ / mệnh đề liên quan.
- Dịch nghĩa câu hỏi sang tiếng Việt.
- Giữ giọng văn khuyến khích, khen ngợi học sinh.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return res.status(200).json({ success: true, explanation: text });
  } catch (error) {
    console.error('Gemini Explain Error:', error);
    const { questionText, answerKey, studentAnswer } = req.body || {};
    const fallbackExplanation = generateFallbackExplanation(questionText, answerKey, studentAnswer);
    return res.status(200).json({ success: true, explanation: fallbackExplanation });
  }
}

function generateFallbackExplanation(qText, ansKey, stAns) {
  let explanation = `💡 Phân tích ngữ pháp câu hỏi: "${qText}"\n\n`;
  explanation += `✅ Đáp án chuẩn: "${ansKey}"\n`;
  if (stAns) {
    explanation += `👤 Bài làm của em: "${stAns}"\n\n`;
  } else {
    explanation += `⚪ Trạng thái: Em chưa nhập câu trả lời cho câu này.\n\n`;
  }

  const lowerQ = (qText || '').toLowerCase();
  const lowerAns = (ansKey || '').toLowerCase();

  if (lowerQ.includes('because')) {
    explanation += `📌 Quy tắc: "Because" được dùng để chỉ nguyên nhân, lý do (Bởi vì... nên...).`;
  } else if (lowerQ.includes('so')) {
    explanation += `📌 Quy tắc: "So" được dùng để chỉ kết quả (Vì vậy, cho nên...).`;
  } else if (lowerQ.includes('although') || lowerQ.includes('though')) {
    explanation += `📌 Quy tắc: "Although" dùng để chỉ sự nhượng bộ, tương phản (Mặc dù... nhưng...).`;
  } else if (lowerQ.includes('until')) {
    explanation += `📌 Quy tắc: "Until" chỉ mốc thời gian (Cho đến khi...).`;
  } else if (lowerAns === 'dp' || lowerQ.includes('phụ thuộc')) {
    explanation += `📌 Quy tắc Mệnh Đề: Mệnh đề phụ thuộc (DP) thường bắt đầu bằng các liên từ phụ thuộc như Although, Because, While, Since, Unless... và không thể đứng độc lập làm một câu hoàn chỉnh.`;
  } else if (lowerAns === 'id' || lowerQ.includes('độc lập')) {
    explanation += `📌 Quy tắc Mệnh Đề: Mệnh đề độc lập (ID) có đầy đủ Chủ ngữ + Động từ và diễn đạt một ý trọn vẹn, có thể đứng độc lập thành câu hoàn chỉnh.`;
  } else {
    explanation += `📌 Lời khuyên: Em hãy chú ý đến ý nghĩa của câu và từ nối (liên từ) phù hợp để chọn đúng đáp án nhé! Cố gắng lên!`;
  }

  return explanation;
}
