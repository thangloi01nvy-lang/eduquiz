import { marked } from 'marked';
import { ClassModel } from '../types';

export function normalizeClassName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  let norm = name.trim().toLowerCase().replace(/[\s\-_–—]+/g, '');
  norm = norm.replace(/\b0+(\d+)\b/g, '$1');
  return norm;
}

export function isClassMatching(studentClass: string, targetClass: string): boolean {
  if (!studentClass || !targetClass) return false;
  const s = studentClass.trim().toLowerCase();
  const t = targetClass.trim().toLowerCase();

  if (t === 'all' || s === 'all' || t.includes('tất cả') || s.includes('tất cả')) return true;
  if (s === t) return true;

  const sNorm = normalizeClassName(studentClass);
  const tNorm = normalizeClassName(targetClass);
  if (sNorm === tNorm) return true;
  if (sNorm && tNorm && (sNorm.includes(tNorm) || tNorm.includes(sNorm))) return true;

  const sClean = sNorm.replace(/^(lớp|class|lop)/i, '');
  const tClean = tNorm.replace(/^(lớp|class|lop)/i, '');
  if (sClean && tClean && (sClean === tClean || sClean.includes(tClean) || tClean.includes(sClean))) return true;

  return false;
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function escapeQuotes(str: string): string {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

export function safeParseMarkdown(text: string): string {
  if (!text) return '';
  try {
    if (typeof marked !== 'undefined' && typeof marked.parseInline === 'function') {
      return marked.parseInline(text) as string;
    }
  } catch (e) {
    console.warn('safeParseMarkdown fallback:', e);
  }
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/___/g, '<u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>');
}

export function sanitizeClassesData(classes: ClassModel[], deletedClasses: string[] = []): ClassModel[] {
  if (!Array.isArray(classes)) return [];
  const seenNorm = new Set<string>();
  const cleanClasses: ClassModel[] = [];
  const deletedSet = new Set((deletedClasses || []).map((d) => normalizeClassName(d)));

  classes.forEach((c) => {
    if (c && typeof c === 'object') {
      const classId = c.id || `class_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const className = c.name || 'Lớp chưa đặt tên';
      const classDesc = c.desc || 'Lớp học mới';
      const students = Array.isArray(c.students) ? c.students : [];

      const norm = normalizeClassName(className);
      if (deletedSet.has(norm) || deletedSet.has(normalizeClassName(classId))) return;

      if (!seenNorm.has(norm)) {
        seenNorm.add(norm);
        cleanClasses.push({
          id: classId,
          name: className,
          desc: classDesc,
          students,
        });
      } else {
        const target = cleanClasses.find((tc) => normalizeClassName(tc.name) === norm);
        if (target) {
          students.forEach((st) => {
            if (st && st.id && !target.students.some((ts) => ts.id === st.id)) {
              target.students.push(st);
            }
          });
        }
      }
    }
  });

  return cleanClasses;
}

export function formatDateVN(dateStr?: string): string {
  if (!dateStr) return new Date().toLocaleDateString('vi-VN');
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN');
  } catch {
    return dateStr;
  }
}

export function cleanAnswerText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/^[\d\.\s\)\:\-]+/g, '')
    .replace(/^[.?:;!,"'()]+|[.?:;!,"'()]+$/g, '')
    .replace(/\s+/g, ' ');
}

export function smartCompareAnswers(userAns: string, expectedAns: string, qTitle?: string): boolean {
  let cleanUser = cleanAnswerText(userAns);
  let cleanExp = cleanAnswerText(expectedAns);

  if (!cleanUser || !cleanExp) return false;

  // 1. Direct exact match
  if (cleanUser === cleanExp) return true;

  // 2. Sentence starter prefix matching (e.g. prompt is "She has ___")
  if (qTitle && (qTitle.includes('→') || qTitle.includes('->') || qTitle.includes('=>'))) {
    const arrowParts = qTitle.split(/→|->|=>/);
    if (arrowParts.length > 1) {
      const promptPart = arrowParts[1].replace(/___/g, '').trim();
      const cleanPrompt = cleanAnswerText(promptPart);
      if (cleanPrompt && cleanPrompt.length > 1) {
        // Strip prefix if user typed full sentence starting with prompt
        if (cleanUser.startsWith(cleanPrompt)) {
          cleanUser = cleanAnswerText(cleanUser.slice(cleanPrompt.length));
        }
        // Strip prefix if expected answer starts with prompt
        if (cleanExp.startsWith(cleanPrompt)) {
          cleanExp = cleanAnswerText(cleanExp.slice(cleanPrompt.length));
        }
        if (cleanUser === cleanExp && cleanUser.length > 0) return true;
      }
    }
  }

  // 3. Multi-option split by /, |, comma, or "or"/"hoặc"
  const expVariants = cleanExp
    .split(/[/|,]/)
    .map((s) => cleanAnswerText(s))
    .filter(Boolean);

  for (const v of expVariants) {
    if (cleanUser === v) return true;
    if (v.endsWith(cleanUser) || cleanUser.endsWith(v)) {
      if (Math.abs(cleanUser.length - v.length) <= 30) return true;
    }
  }

  // 4. Handle abbreviations (e.g. ID -> independent, DP -> dependent)
  if (cleanUser === 'id' && (cleanExp.includes('independent') || cleanExp.includes('độc lập') || cleanExp === 'id')) return true;
  if (cleanUser === 'dp' && (cleanExp.includes('dependent') || cleanExp.includes('phụ thuộc') || cleanExp === 'dp')) return true;
  if (cleanExp === 'id' && (cleanUser.includes('independent') || cleanUser.includes('độc lập') || cleanUser === 'id')) return true;
  if (cleanExp === 'dp' && (cleanUser.includes('dependent') || cleanUser.includes('phụ thuộc') || cleanUser === 'dp')) return true;

  return false;
}
