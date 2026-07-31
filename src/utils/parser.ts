import { Question, Section } from '../types';

export function parseMarkdownQuiz(text: string): { questions: Question[]; sections: Section[]; wordBank: string[] } {
  if (!text || typeof text !== 'string') {
    return { questions: [], sections: [], wordBank: [] };
  }

  // 1. Separate Questions Section vs Answer Key Section
  const answerSectionRegex = /(?:^|\n)#+\s*đáp án|(?:^|\n)đáp án\s*:/i;
  const answerMatch = text.match(answerSectionRegex);

  let questionsText = text;
  let answerKeyText = '';

  if (answerMatch && answerMatch.index !== undefined) {
    questionsText = text.slice(0, answerMatch.index);
    answerKeyText = text.slice(answerMatch.index + answerMatch[0].length);
  }

  // Parse raw questions
  const { questions, sections, wordBank } = parseRawQuestions(questionsText);

  // If Answer Key section exists, extract and attach answers
  if (answerKeyText.trim()) {
    attachAnswerKeys(questions, answerKeyText);
  }

  return { questions, sections, wordBank };
}

function parseRawQuestions(text: string): { questions: Question[]; sections: Section[]; wordBank: string[] } {
  const lines = text.split(/\r?\n/);
  const questions: Question[] = [];
  const sections: Section[] = [];
  let globalWordBank: string[] = [];

  let currentSectionTitle = 'Bài tập chung';
  let currentSectionQuestions: Question[] = [];
  let currentSectionId = 0;

  let currentQ: Partial<Question> | null = null;
  let qCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // Recognize Section Headers: e.g. "## Bài 1", "Bài 1 Complete...", "Bài A:", "Bài 3:", "Phần A:", "Part 1:", "## 2 Choose..."
    const isQuestionLine = /^(\d+)[\.\)\:\s]\s*[A-Z\w"']/i.test(line) || /^câu\s*\d+/i.test(line);
    const isSectionHeader =
      !isQuestionLine &&
      (line.startsWith('#') ||
        /^bài\s*[0-9a-z]+/i.test(line) ||
        /^phần\s*[0-9a-z]+/i.test(line) ||
        /^part\s*[0-9a-z]+/i.test(line) ||
        /^section\s*[0-9a-z]+/i.test(line));

    if (isSectionHeader) {
      if (currentQ) {
        const qFinal = finalizeQuestion(currentQ, qCounter++);
        questions.push(qFinal);
        currentSectionQuestions.push(qFinal);
        currentQ = null;
      }
      if (currentSectionQuestions.length > 0) {
        sections.push({
          id: currentSectionId++,
          title: currentSectionTitle,
          questions: [...currentSectionQuestions],
        });
        currentSectionQuestions = [];
      }
      let rawTitle = line.replace(/^#+\s*/, '').trim();
      if (/^\d+\s+/i.test(rawTitle)) {
        rawTitle = `Bài ${rawTitle}`;
      }
      currentSectionTitle = rawTitle;
      continue;
    }

    // Extract Word Bank (Explicit "word bank:" OR lines with multiple phrases in a box line right after instruction)
    if (line.toLowerCase().includes('word bank:') || line.toLowerCase().includes('từ vựng:')) {
      const parts = line.split(/word bank:|từ vựng:/i);
      if (parts[1]) {
        const words = parts[1].split(/[,;\t]/).map((w) => w.trim()).filter(Boolean);
        globalWordBank.push(...words);
      }
      continue;
    }

    // Auto-detect word bank line (e.g. "can-do attitude communication skills critical thinking...")
    const isWordBankBoxLine =
      !currentQ &&
      !isQuestionLine &&
      lines[i - 1] &&
      /in the box|words and phrases|từ trong khung/i.test(lines[i - 1]) &&
      line.length > 15;

    if (isWordBankBoxLine) {
      // Split by 2 or more spaces or tabs
      const phrases = line.split(/\s{2,}|\t/).map((w) => w.trim()).filter(Boolean);
      if (phrases.length > 1) {
        globalWordBank.push(...phrases);
      } else {
        // Fallback: split common 2-word phrases
        const tokens = line.split(/\s+/);
        globalWordBank.push(line);
      }
      continue;
    }

    // Check Question Start: e.g. "1.", "1)", "1 ", "Câu 1:"
    const qMatch =
      line.match(/^(\d+)[\.\)\:]\s*(.*)/) ||
      line.match(/^câu\s*(\d+)[\.\:]\s*(.*)/i) ||
      line.match(/^(\d+)\s+([A-Z\w"'].*)/);

    if (qMatch) {
      if (currentQ) {
        const qFinal = finalizeQuestion(currentQ, qCounter++);
        questions.push(qFinal);
        currentSectionQuestions.push(qFinal);
      }
      currentQ = {
        id: qCounter,
        title: qMatch[2] || line,
        type: 'short_answer',
        options: [],
        sectionId: currentSectionId,
        sectionTitle: currentSectionTitle,
        points: 1,
      };
      continue;
    }

    // Check Options A. B. C. D. (Smart detection for separate lines OR inline options like "A. read  B. reading  C. to read")
    if (currentQ && /([A-Da-d])[\.\)]\s*/.test(line)) {
      // Check if line contains multiple options e.g. "A. read  B. reading  C. to read"
      const inlineMatches = [...line.matchAll(/([A-Da-d])[\.\)]\s*([^A-Da-d\.\)]+?)(?=(?:\s+[A-Da-d][\.\)]|$))/gi)];
      if (inlineMatches.length > 1) {
        currentQ.type = 'multiple_choice';
        if (!currentQ.options) currentQ.options = [];
        inlineMatches.forEach((m) => {
          const k = m[1].toUpperCase();
          const t = m[2].trim();
          if (t && !currentQ!.options!.some((o) => o.key === k)) {
            currentQ!.options!.push({ key: k, text: t });
          }
        });
        continue;
      }

      // Single option line e.g. "A. read" or "A) read"
      const optMatch = line.match(/^([A-Da-d])[\.\)]\s*(.*)/);
      if (optMatch) {
        currentQ.type = 'multiple_choice';
        if (!currentQ.options) currentQ.options = [];
        const k = optMatch[1].toUpperCase();
        const t = optMatch[2].trim();
        if (!currentQ.options.some((o) => o.key === k)) {
          currentQ.options.push({ key: k, text: t });
        }
        continue;
      }
    }

    // Check Answer: X
    if (line.toLowerCase().startsWith('answer:') || line.toLowerCase().startsWith('đáp án:')) {
      if (currentQ) {
        const ansVal = line.split(/answer:|đáp án:/i)[1]?.trim();
        if (ansVal) currentQ.answer = ansVal;
      }
      continue;
    }

    // Append text to existing question title if continuation line
    if (currentQ && line && !line.startsWith('---')) {
      currentQ.title += ' ' + line;
    }
  }

  if (currentQ) {
    const qFinal = finalizeQuestion(currentQ, qCounter++);
    questions.push(qFinal);
    currentSectionQuestions.push(qFinal);
  }

  if (currentSectionQuestions.length > 0 || sections.length === 0) {
    sections.push({
      id: currentSectionId,
      title: currentSectionTitle,
      questions: currentSectionQuestions,
    });
  }

  return { questions, sections, wordBank: Array.from(new Set(globalWordBank)) };
}

function attachAnswerKeys(questions: Question[], answerKeyText: string): void {
  const lines = answerKeyText.split(/\r?\n/);
  let currentAnsSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect section header in Answer Key block e.g. "Bài 1:", "Bài A:", "Bài 3:"
    const secMatch = line.match(/^(bài\s*[0-9a-z]+|phần\s*[0-9a-z]+|part\s*[0-9a-z]+|section\s*[0-9a-z]+)/i);
    if (secMatch) {
      currentAnsSection = secMatch[1].toLowerCase();
      continue;
    }

    // Detect question number answer line e.g. "1. She was tired, so..." or "1. ... -> DP (Mệnh đề phụ thuộc)"
    const qAnsMatch = line.match(/^(\d+)[\.\)]\s*(.*)/);
    if (qAnsMatch) {
      const qNum = parseInt(qAnsMatch[1]);
      let ansContent = qAnsMatch[2].trim();

      // Filter questions in current section
      const normAnsSec = currentAnsSection.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sectionQuestions = questions.filter((q) => {
        if (!normAnsSec) return true;
        const normSec = (q.sectionTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return normSec.includes(normAnsSec) || normAnsSec.includes(normSec);
      });

      let targetQ = sectionQuestions[qNum - 1];
      if (!targetQ) {
        targetQ = questions.find((q) => q.id === qNum) || questions[qNum - 1];
      }
      if (targetQ) {
        // Preserve exact answer content written by teacher e.g. "to → going" or "go -> goes"
        targetQ.answer = ansContent;
      }
    }
  }
}

function finalizeQuestion(q: Partial<Question>, count: number): Question {
  const title = (q.title || '').trim();
  let type: Question['type'] = 'short_answer';

  // Detect inline blanks e.g. ___ or [option1/option2] or parenthesized choices (choice1 / choice2)
  const inlineBlanks: Question['inlineBlanks'] = [];
  const matches = [...title.matchAll(/\[(.*?)\]/g)];
  if (matches.length > 0) {
    matches.forEach((m) => {
      const content = m[1].trim();
      if (content.includes('/')) {
        const choices = content.split('/').map((c) => c.trim());
        inlineBlanks.push({ placeholder: m[0], choices, answer: choices[0] });
      } else {
        inlineBlanks.push({ placeholder: m[0], answer: content });
      }
    });
  }

  // Check parenthesized choices e.g. (but / so / because) or (both / either / neither)
  const parenMatch = title.match(/\((.*?\/.*?)\)/);
  if (parenMatch && parenMatch[1]) {
    const choices = parenMatch[1].split('/').map((c) => c.trim());
    if (choices.length > 1) {
      inlineBlanks.push({ placeholder: parenMatch[0], choices, answer: choices[0] });
    }
  }

  // AUTO-EXTRACT CHOICE OPTIONS FOR MULTIPLE CHOICE (CLICK-SELECT INTERACTION)
  let generatedOptions: Question['options'] = q.options || [];
  if (generatedOptions.length === 0 && inlineBlanks.length > 0) {
    const blankWithChoices = inlineBlanks.find((b) => b.choices && b.choices.length > 1);
    if (blankWithChoices && blankWithChoices.choices) {
      generatedOptions = blankWithChoices.choices.map((cStr, idx) => ({
        key: String.fromCharCode(65 + idx),
        text: cStr,
      }));
    }
  }

  // Check slash choices inside question body e.g. "confident/independent" or "ambitious / passionate"
  if (inlineBlanks.length === 0 && generatedOptions.length === 0) {
    const slashMatch = title.match(/\b([A-Za-z0-9_\-]{2,20})\s*\/\s*([A-Za-z0-9_\-]{2,20})\b/);
    if (slashMatch && slashMatch[1] && slashMatch[2]) {
      const choiceA = slashMatch[1].trim();
      const choiceB = slashMatch[2].trim();
      if (choiceA && choiceB) {
        inlineBlanks.push({
          placeholder: `${choiceA}/${choiceB}`,
          choices: [choiceA, choiceB],
          answer: choiceA,
        });
        generatedOptions = [
          { key: 'A', text: choiceA },
          { key: 'B', text: choiceB },
        ];
      }
    }
  }

  const normTitle = title.toLowerCase();
  const normSec = (q.sectionTitle || '').toLowerCase();
  const isErrorCorrectionKey =
    normTitle.includes('sửa lỗi') ||
    normTitle.includes('tìm lỗi') ||
    normSec.includes('sửa lỗi') ||
    normSec.includes('tìm lỗi') ||
    normTitle.includes('lỗi sai') ||
    normSec.includes('lỗi sai') ||
    normTitle.includes('câu sai') ||
    normSec.includes('câu sai') ||
    normTitle.includes('error correction') ||
    normSec.includes('error correction') ||
    normTitle.includes('find the error') ||
    normSec.includes('find the error');

  // CLASSIFICATION PRIORITY RULES:
  if (isErrorCorrectionKey) {
    type = 'error_correction';
    generatedOptions = [];
    if (inlineBlanks.length < 2) {
      inlineBlanks.length = 0;
      inlineBlanks.push({ placeholder: 'Lỗi sai', answer: '' });
      inlineBlanks.push({ placeholder: 'Sửa lại', answer: '' });
    }
  } else if (generatedOptions.length > 0) {
    type = 'multiple_choice';
  } else if (inlineBlanks.length > 0 || title.includes('___') || title.includes('_')) {
    type = 'fill_in_blank';
    if (inlineBlanks.length === 0) {
      inlineBlanks.push({ answer: q.answer || '' });
    }
  } else if (
    title.toLowerCase().includes('đúng/sai') ||
    title.toLowerCase().includes('true/false') ||
    title.toLowerCase().includes('đúng hay sai')
  ) {
    type = 'true_false';
  } else if (q.answer || title.length < 150) {
    type = 'short_answer';
  } else {
    // LAST RESORT FALLBACK: essay
    type = 'essay';
  }

  return {
    id: q.id || count,
    title,
    type,
    options: generatedOptions,
    answer: q.answer || (inlineBlanks[0]?.answer || ''),
    inlineBlanks,
    sectionId: q.sectionId || 0,
    sectionTitle: q.sectionTitle || 'Bài tập chung',
    points: q.points || 1,
  };
}
