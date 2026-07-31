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
    const { topic, rawText } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const fallbackMd = generateFallbackQuizMarkdown(topic, rawText);
      return res.status(200).json({ success: true, markdown: fallbackMd });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Bạn là chuyên gia soạn đề Tiếng Anh. Hãy phân loại hoặc tạo mới bài tập theo định dạng Markdown chuẩn bên dưới:
Chủ đề / Yêu cầu: "${topic || 'Bài tập liên từ & mệnh đề'}"
${rawText ? `Nội dung thô cần phân loại lại:\n${rawText}` : ''}

Định dạng Markdown yêu cầu:
# [Tên bài tập]

📌 Bài 1: [Tiêu đề phần 1]
1. [Nội dung câu hỏi 1] (lựa chọn 1 / lựa chọn 2)
2. [Nội dung câu hỏi 2] (lựa chọn 1 / lựa chọn 2 / lựa chọn 3)

## Đáp án
Bài 1:
1. [Đáp án câu 1]
2. [Đáp án câu 2]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return res.status(200).json({ success: true, markdown: text });
  } catch (error) {
    console.error('Gemini Generate Quiz Error:', error);
    const { topic, rawText } = req.body || {};
    const fallbackMd = generateFallbackQuizMarkdown(topic, rawText);
    return res.status(200).json({ success: true, markdown: fallbackMd });
  }
}

function generateFallbackQuizMarkdown(topic, rawText) {
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
