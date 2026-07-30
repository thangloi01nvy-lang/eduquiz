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

  const defaultClasses: ClassModel[] = [
    {
      id: 'c_teen4',
      name: 'Teen 4',
      desc: 'Lớp Teen 4',
      students: [
        { id: 's1', name: 'Nguyễn Văn A' },
        { id: 's2', name: 'Trần Thị B' },
        { id: 's3', name: 'Lê Văn C' }
      ],
    },
    { id: 'c_free', name: 'Học sinh tự do chưa xếp lớp', desc: 'Học sinh tự do', students: [] },
  ];

  defaultClasses.forEach((def) => {
    const norm = normalizeClassName(def.name);
    if (!deletedSet.has(norm) && !cleanClasses.some((c) => normalizeClassName(c.name) === norm)) {
      cleanClasses.push(def);
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
