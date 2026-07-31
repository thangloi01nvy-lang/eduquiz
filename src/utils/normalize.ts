import { marked } from 'marked';
import { ClassModel } from '../types';

export function normalizeClassName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  let norm = name.trim().toLowerCase().replace(/[\s\-_–—]+/g, '');
  norm = norm.replace(/\b0+(\d+)\b/g, '$1');
  return norm;
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

export function smartCompareAnswers(userAns: string, expectedAns: string): boolean {
  const cleanUser = cleanAnswerText(userAns);
  const cleanExp = cleanAnswerText(expectedAns);

  if (!cleanUser || !cleanExp) return false;

  // 1. Direct exact match
  if (cleanUser === cleanExp) return true;

  // 2. Multi-option split by /, |, comma, or "or"/"hoặc"
  const expVariants = cleanExp
    .split(/[/|,]/)
    .map((s) => cleanAnswerText(s))
    .filter(Boolean);

  if (expVariants.includes(cleanUser)) return true;

  // 3. Handle abbreviations (e.g., ID -> independent, DP -> dependent)
  if (cleanUser === 'id' && (cleanExp.includes('independent') || cleanExp.includes('độc lập') || cleanExp === 'id')) return true;
  if (cleanUser === 'dp' && (cleanExp.includes('dependent') || cleanExp.includes('phụ thuộc') || cleanExp === 'dp')) return true;
  if (cleanExp === 'id' && (cleanUser.includes('independent') || cleanUser.includes('độc lập') || cleanUser === 'id')) return true;
  if (cleanExp === 'dp' && (cleanUser.includes('dependent') || cleanUser.includes('phụ thuộc') || cleanUser === 'dp')) return true;

  // 4. Exact word match in sentence (e.g. cleanUser "so" inside sentence "She was tired, so she went to bed early")
  const wordBoundaryRegex = new RegExp(`\\b${cleanUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  if (wordBoundaryRegex.test(cleanExp)) {
    return true;
  }

  // 5. Reverse word boundary check
  for (const variant of expVariants) {
    if (variant.length >= 1) {
      if (cleanUser === variant) return true;
      const vRegex = new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (vRegex.test(cleanUser)) return true;
    }
  }

  return false;
}
