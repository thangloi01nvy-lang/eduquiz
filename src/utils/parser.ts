import { Question, Section } from '../types';

export function parseMarkdownQuiz(text: string): { questions: Question[]; sections: Section[]; wordBank: string[] } {
  if (!text || typeof text !== 'string') {
    return { questions: [], sections: [], wordBank: [] };
  }

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

    // Recognize Section Headers: e.g. "## Bài 1", "Bài 1:", "Bài 3:", "Phần 1:", "Part 1:"
    const isSectionHeader =
      line.startsWith('#') ||
      /^bài\s*\d+/i.test(line) ||
      /^phần\s*\d+/i.test(line) ||
      /^part\s*\d+/i.test(line) ||
      /^section\s*\d+/i.test(line);

    if (isSectionHeader && !line.match(/^(\d+)[\.\)]\s*/)) {
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
      currentSectionTitle = line.replace(/^#+\s*/, '').trim();
      continue;
    }

    // Extract Word Bank
    if (line.toLowerCase().includes('word bank:') || line.toLowerCase().includes('từ vựng:')) {
      const parts = line.split(/word bank:|từ vựng:/i);
      if (parts[1]) {
        const words = parts[1].split(/[,;]/).map(w => w.trim()).filter(Boolean);
        globalWordBank.push(...words);
      }
      continue;
    }

    // Check Question Start: e.g. "1.", "1)", "Câu 1:"
    const qMatch = line.match(/^(\d+)[\.\)]\s*(.*)/) || line.match(/^câu\s*(\d+)[\.\:]\s*(.*)/i);
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

    // Check Options A. B. C. D.
    const optMatch = line.match(/^([A-Da-d])[\.\)]\s*(.*)/);
    if (optMatch && currentQ) {
      currentQ.type = 'multiple_choice';
      if (!currentQ.options) currentQ.options = [];
      currentQ.options.push({
        key: optMatch[1].toUpperCase(),
        text: optMatch[2].trim(),
      });
      continue;
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

function finalizeQuestion(q: Partial<Question>, count: number): Question {
  const title = (q.title || '').trim();
  let type: Question['type'] = q.type || 'short_answer';

  // Detect inline blanks e.g. ___ or [option1/option2] or parenthesized choices (choice1 / choice2)
  const inlineBlanks: Question['inlineBlanks'] = [];
  const matches = [...title.matchAll(/\[(.*?)\]/g)];
  if (matches.length > 0) {
    matches.forEach(m => {
      const content = m[1].trim();
      if (content.includes('/')) {
        const choices = content.split('/').map(c => c.trim());
        inlineBlanks.push({ placeholder: m[0], choices, answer: choices[0] });
      } else {
        inlineBlanks.push({ placeholder: m[0], answer: content });
      }
    });
  }

  // Check parenthesized choices e.g. (but / so / because)
  const parenMatch = title.match(/\((.*?\/.*?)\)/);
  if (parenMatch && parenMatch[1]) {
    const choices = parenMatch[1].split('/').map((c) => c.trim());
    if (choices.length > 1) {
      inlineBlanks.push({ placeholder: parenMatch[0], choices, answer: choices[0] });
    }
  }

  if (title.includes('___') || title.includes('_')) {
    type = 'fill_in_blank';
    if (inlineBlanks.length === 0) {
      inlineBlanks.push({ answer: q.answer || '' });
    }
  }

  return {
    id: q.id || count,
    title,
    type,
    options: q.options || [],
    answer: q.answer || (inlineBlanks[0]?.answer || ''),
    inlineBlanks,
    sectionId: q.sectionId || 0,
    sectionTitle: q.sectionTitle || 'Bài tập chung',
    points: q.points || 1,
  };
}
