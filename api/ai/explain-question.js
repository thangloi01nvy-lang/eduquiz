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

    const prompt = `Bạn là giáo viên Tiếng Anh xuất sắc. Hãy giải thích chi tiết câu hỏi sau cho học sinh theo đúng 3 bước sư phạm:

Câu hỏi: "${questionText}"
Đáp án đúng chuẩn: "${answerKey}"
Bài làm của học sinh: "${studentAnswer || 'Chưa chọn/chưa điền'}"

Yêu cầu BẮT BUỘC trình bày theo đúng 3 bước:
📌 BƯỚC 1: ĐỌC & NHẬN DIỆN YÊU CẦU ĐỀ BÀI
- Chỉ rõ dạng bài (Chia động từ, Trắc nghiệm từ vựng, Sửa lỗi sai, Viết lại câu, Mệnh đề...).

🔑 BƯỚC 2: CHỈ RA TỪ KHÓA & DẤU HIỆU NGỮ PHÁP (KEYWORDS)
- Chỉ rõ dấu hiệu nhận biết trong câu (như yesterday, enjoy, She has, decide, so, because...).
- Nêu rõ QUY TẮC NGỮ PHÁP CỤ THỂ (Ví dụ: Động từ decide/want + To-V, Động từ enjoy/mind + V-ing, Thì quá khứ đơn V2/ed...).

🎯 BƯỚC 3: PHÂN TÍCH LỖI SAI & LÝ DO CHỌN ĐÁP ÁN ĐÚNG
- Nêu rõ lý do đáp án "${answerKey}" là ĐÚNG 100%.
- Phân tích chi tiết tại sao các phương án khác SAI (Ví dụ: vì sao "buy" sai do thiếu "to", vì sao "buying" sai cấu trúc).

LƯU Ý: TUYỆT ĐỐI KHÔNG DÙNG KÝ TỰ ** (dấu hai dấu sao). Không nói chung chung "phù hợp ngữ cảnh", phải nêu tên quy tắc ngữ pháp cụ thể!`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/\*\*/g, '');

    return res.status(200).json({ success: true, explanation: text });
  } catch (error) {
    console.error('Gemini Explain Error:', error);
    const { questionText, answerKey, studentAnswer } = req.body || {};
    const fallbackExplanation = generateFallbackExplanation(questionText, answerKey, studentAnswer);
    return res.status(200).json({ success: true, explanation: fallbackExplanation });
  }
}

function generateFallbackExplanation(qText, ansKey, stAns) {
  const displayAns = (ansKey && ansKey.trim()) ? ansKey.trim() : 'Đáp án chuẩn';
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
  let grammarRule = '';
  let contextReason = '';

  if (cleanQ.includes('decide') || cleanQ.includes('want') || cleanQ.includes('hope') || cleanQ.includes('agree') || cleanQ.includes('refuse') || cleanQ.includes('plan') || cleanQ.includes('afford')) {
    keywordHint = 'Động từ chỉ quyết định/mong muốn (decide, want, hope, agree, plan...).';
    grammarRule = 'Cấu trúc động từ theo sau bởi To-V (Verb + To-Infinitive): decide/want/hope + To + V-nguyên thể.';
    contextReason = `Động từ đứng trước chỗ trống yêu cầu dạng "to + V-nguyên thể". Vì vậy đáp án đúng duy nhất là "${displayAns}". Các dạng như V-nguyên thể không "to" (buy) hay V-ing (buying) đều bị sai cấu trúc.`;
  } else if (cleanQ.includes('enjoy') || cleanQ.includes('mind') || cleanQ.includes('avoid') || cleanQ.includes('finish') || cleanQ.includes('suggest') || cleanQ.includes('consider') || cleanQ.includes('practice') || cleanQ.includes('keep')) {
    keywordHint = 'Động từ chỉ sở thích/hành động (enjoy, mind, avoid, finish, suggest...).';
    grammarRule = 'Cấu trúc động từ theo sau bởi V-ing (Gerund): enjoy/mind/avoid/finish + V-ing.';
    contextReason = `Đi kèm sau động từ này bắt buộc là danh động từ (V-ing). Do đó "${displayAns}" là đáp án đúng duy nhất.`;
  } else if (cleanQ.includes('yesterday') || cleanQ.includes('ago') || cleanQ.includes('last ') || cleanQ.includes('in 19') || cleanQ.includes('in 20')) {
    keywordHint = 'Từ nhận biết Thì Quá khứ đơn: "yesterday", "ago", "last week/year", "in + năm quá khứ".';
    grammarRule = 'Thì Quá khứ đơn (Past Simple Tense): S + V2/ed.';
    contextReason = `Vì có dấu hiệu thời gian đã kết thúc trong quá khứ, động từ bắt buộc chia ở dạng Quá khứ đơn (V2 hoặc đuôi -ed) là "${displayAns}".`;
  } else if (cleanQ.includes('since') || cleanQ.includes('for ') || cleanQ.includes('already') || cleanQ.includes('just') || cleanQ.includes('yet') || cleanQ.includes('ever') || cleanQ.includes('never')) {
    keywordHint = 'Dấu hiệu Thì Hiện tại hoàn thành: "since", "for", "already", "just", "yet".';
    grammarRule = 'Thì Hiện tại hoàn thành (Present Perfect Tense): S + have/has + V3/ed.';
    contextReason = `Dựa vào trạng từ nhận biết trong câu, động từ phải chia ở thì Hiện tại hoàn thành là "${displayAns}".`;
  } else if (cleanAns.includes('->') || cleanAns.includes('→') || cleanAns.includes('thành')) {
    const parts = displayAns.split(/->|→|thành/).map((p) => p.trim());
    const errWord = parts[0] || 'Từ sai';
    const corrWord = parts[1] || 'Từ đúng';
    keywordHint = `Cụm từ sửa lỗi từ "${errWord}" sang "${corrWord}".`;
    grammarRule = 'Quy tắc Tìm & Sửa Lỗi Sai (Error Correction / Word Form): Chuyển đổi từ bị sai ngữ pháp/dạng từ sang dạng chuẩn.';
    contextReason = `Từ gốc "${errWord}" bị dùng sai bối cảnh câu. Cần sửa lại thành "${corrWord}" để đúng ngữ pháp.`;
  } else if (cleanQ.includes('because of') || cleanAns.includes('because of')) {
    keywordHint = 'Cụm từ chỉ nguyên nhân "Because of".';
    grammarRule = 'Cấu trúc "Because of" + Danh từ / Cụm danh từ / V-ing (không đi với mệnh đề S + V).';
    contextReason = `Đằng sau chỗ trống là danh từ/cụm danh từ chỉ lý do, nên phải chọn "${displayAns}".`;
  } else if (cleanQ.includes('because') || cleanAns.includes('because')) {
    keywordHint = 'Liên từ chỉ nguyên nhân "Because".';
    grammarRule = 'Liên từ "Because" + Mệnh đề (S + V) chỉ lý do trực tiếp.';
    contextReason = `Theo sau chỗ trống là một mệnh đề hoàn chỉnh (Chủ ngữ + Động từ) chỉ nguyên nhân, do đó dùng "${displayAns}".`;
  } else if (cleanQ.includes('so ') || cleanAns.includes('so')) {
    keywordHint = 'Từ nối chỉ kết quả "So".';
    grammarRule = 'Từ nối "So" (Cho nên/Vì vậy) đứng trước mệnh đề diễn đạt kết quả.';
    contextReason = `Vế sau câu diễn đạt kết quả xảy ra từ nguyên nhân ở vế trước, chọn "${displayAns}".`;
  } else if (cleanQ.includes('although') || cleanQ.includes('though')) {
    keywordHint = 'Liên từ nhượng bộ "Although / Even though".';
    grammarRule = 'Liên từ "Although / Even though" + Mệnh đề (S + V) thể hiện sự đối lập.';
    contextReason = `Hai vế câu mang ý nghĩa tương phản, nhượng bộ lẫn nhau, do đó dùng "${displayAns}".`;
  } else if (cleanAns === 'dp' || cleanQ.includes('phụ thuộc')) {
    keywordHint = 'Mệnh đề có liên từ phụ thuộc đứng đầu (Although, Because, While, When...).';
    grammarRule = 'Mệnh đề Phụ Thuộc (Dependent Clause - DP): Không thể đứng một mình làm câu hoàn chỉnh.';
    contextReason = `Vế câu chứa liên từ phụ thuộc nên phải là Mệnh đề phụ thuộc (DP).`;
  } else if (cleanAns === 'id' || cleanQ.includes('độc lập')) {
    keywordHint = 'Mệnh đề trọn vẹn ý nghĩa, không chứa liên từ phụ thuộc.';
    grammarRule = 'Mệnh đề Độc Lập (Independent Clause - ID): Có đủ S + V và có thể đứng một mình.';
    contextReason = `Vế câu diễn đạt ý nghĩa trọn vẹn và không bị ràng buộc bởi liên từ phụ thuộc, chọn (ID).`;
  } else {
    keywordHint = `Từ vựng & Cấu trúc ngữ pháp câu hỏi: "${qText}".`;
    grammarRule = `Quy tắc hòa hợp giữa Chủ ngữ - Động từ và cấu trúc từ vựng của câu.`;
    contextReason = `Dựa vào dạng từ và chức năng ngữ pháp trong câu, "${displayAns}" là đáp án chuẩn xác nhất.`;
  }

  let exp = `📘 HƯỚNG DẪN GIẢI CHI TIẾT THEO 3 BƯỚC\n\n`;

  exp += `📌 BƯỚC 1: ĐỌC & NHẬN DIỆN YÊU CẦU ĐỀ BÀI\n`;
  exp += `• Câu hỏi: "${qText}"\n`;
  exp += `• Dạng bài nhận diện: ${exerciseType}\n\n`;

  exp += `🔑 BƯỚC 2: CHỈ RA TỪ KHÓA & DẤU HIỆU NGỮ PHÁP (KEYWORDS)\n`;
  exp += `• Dấu hiệu nhận biết: ${keywordHint}\n`;
  exp += `• Quy tắc ngữ pháp: ${grammarRule}\n\n`;

  exp += `🎯 BƯỚC 3: PHÂN TÍCH LỖI SAI & ÁP DỤNG ĐÁP ÁN ĐÚNG\n`;
  exp += `• ✅ Đáp án đúng chính xác: "${displayAns}"\n`;
  if (stAns && stAns.trim()) {
    exp += `• 👤 Bài làm của em: "${stAns.trim()}"\n`;
  } else {
    exp += `• ⚪ Bài làm của em: (Chưa chọn/chưa điền đáp án)\n`;
  }
  exp += `• 💡 Phân tích ngữ cảnh: ${contextReason}\n`;

  return exp.replace(/\*\*/g, '');
}
