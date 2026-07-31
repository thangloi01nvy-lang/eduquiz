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

    const prompt = `Bạn là giáo viên Tiếng Anh chuyên nghiệp. Hãy giải thích chi tiết, đầy đủ bằng Tiếng Việt cho học sinh lý do chọn đáp án đúng cho câu hỏi sau:
Câu hỏi: "${questionText}"
Đáp án đúng: "${answerKey}"
Bài làm của học sinh: "${studentAnswer || 'Chưa trả lời'}"

Yêu cầu trình bày gồm 4 phần rõ ràng:
1. 🌐 **Dịch nghĩa câu hỏi**: Dịch câu hỏi sang tiếng Việt hoàn chỉnh.
2. ✅ **Tại sao đáp án "${answerKey}" ĐÚNG**: Giải thích cấu trúc ngữ pháp và ý nghĩa tại sao từ/mệnh đề này đúng tuyệt đối.
3. ❌ **Tại sao các phương án khác SAI**: Nêu rõ lý do các phương án lựa chọn khác không phù hợp ngữ pháp hoặc sai nghĩa.
4. 💡 **Mẹo làm bài nhanh**: Đưa ra dấu hiệu nhận biết (dấu phẩy, liên từ, từ nhận biết...) giúp học sinh khoanh đúng trong 3 giây.`;

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
  let exp = `🌐 **Dịch nghĩa & Phân tích:** "${qText}"\n\n`;
  exp += `✅ **Đáp án đúng:** "${ansKey}"\n`;
  if (stAns && stAns.trim()) {
    exp += `👤 **Bài làm của em:** "${stAns}"\n\n`;
  } else {
    exp += `⚪ **Trạng thái:** Em chưa nhập câu trả lời cho câu này.\n\n`;
  }

  const lowerQ = (qText || '').toLowerCase();
  const lowerAns = (ansKey || '').toLowerCase();

  exp += `1. ✅ **Tại sao đáp án "${ansKey}" ĐÚNG:**\n`;
  if (lowerAns.includes('so') || lowerQ.includes('so')) {
    exp += `   - "So" (Vì vậy/Cho nên) nối 2 mệnh đề chỉ mối quan hệ Nguyên nhân ➔ Kết quả.\n`;
    exp += `2. ❌ **Tại sao các phương án khác SAI:**\n`;
    exp += `   - "Because" (Bởi vì) chỉ nguyên nhân, không đứng ở vế kết quả.\n`;
    exp += `   - "But" (Nhưng) chỉ sự đối lập, phản bác.\n`;
    exp += `3. 💡 **Mẹo làm bài nhanh:** "So" thường đứng sau dấu phẩy (,) ngăn cách vế nguyên nhân và vế kết quả.\n`;
  } else if (lowerAns.includes('because') || lowerQ.includes('because')) {
    exp += `   - "Because" (Bởi vì) nối mệnh đề chỉ nguyên nhân trực tiếp dẫn tới hành động.\n`;
    exp += `2. ❌ **Tại sao các phương án khác SAI:**\n`;
    exp += `   - "Although" chỉ sự nhượng bộ (Mặc dù).\n`;
    exp += `   - "So" đứng trước vế kết quả, không đứng trước nguyên nhân.\n`;
    exp += `3. 💡 **Mẹo làm bài nhanh:** Vế đằng sau giải thích lý do "Tại sao" thì luôn dùng "Because".\n`;
  } else if (lowerAns === 'dp' || lowerQ.includes('phụ thuộc')) {
    exp += `   - Đây là Mệnh Đề Phụ Thuộc (DP - Dependent Clause) bắt đầu bằng các liên từ phụ thuộc như *Although, Because, While, Since, Unless...*\n`;
    exp += `2. ❌ **Tại sao SAI nếu chọn ID:**\n`;
    exp += `   - Mệnh đề độc lập (ID) không bị ràng buộc bởi liên từ phụ thuộc và có thể đứng một mình làm câu hoàn chỉnh.\n`;
    exp += `3. 💡 **Mẹo làm bài nhanh:** Nhìn thấy liên từ phụ thuộc (Although, Because, When...) đứng đầu vế ➔ Chọn ngay DP!\n`;
  } else if (lowerAns === 'id' || lowerQ.includes('độc lập')) {
    exp += `   - Đây là Mệnh Đề Độc Lập (ID - Independent Clause) có đủ Chủ ngữ + Động từ và diễn đạt ý trọn vẹn.\n`;
    exp += `2. ❌ **Tại sao SAI nếu chọn DP:**\n`;
    exp += `   - Câu không có liên từ phụ thuộc ràng buộc nên không thể là DP.\n`;
    exp += `3. 💡 **Mẹo làm bài nhanh:** Câu trọn vẹn ý nghĩa, không chứa liên từ phụ thuộc ➔ Chọn ngay ID!\n`;
  } else {
    exp += `   - Đáp án phù hợp nhất với ngữ cảnh và quy tắc ngữ pháp tiếng Anh.\n`;
    exp += `2. ❌ **Tại sao các phương án khác SAI:**\n`;
    exp += `   - Các lựa chọn khác làm sai cấu trúc hoặc không hợp logic nghĩa của câu.\n`;
    exp += `3. 💡 **Mẹo làm bài nhanh:** Đọc kỹ nghĩa tiếng Việt của cả câu để xác định mối quan hệ giữa các từ/mệnh đề.\n`;
  }

  return exp;
}
