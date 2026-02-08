// Shared utilities for project components

export function applySpeakerNames(content, speakers) {
  if (!content || !speakers?.length) return content || '';
  let result = content;
  speakers.forEach((s) => {
    if (s.speaker_name && s.speaker_name !== s.speaker_label) {
      const escaped = s.speaker_label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped + ':', 'g'), s.speaker_name + ':');
    }
  });
  // Clean up markdown bold markers around speaker names: **Name:** → Name:
  result = result.replace(/\*\*([^*\n]+?):\*\*/g, '$1:');
  return result;
}

export function extractFullSentence(content, word) {
  if (!content || !word) return null;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\[+${escaped}\\?+\\]+|${escaped}`, 'i');
  const match = content.match(pattern);
  if (!match) return null;
  const pos = match.index;
  // Find sentence boundaries: newline or Speaker label
  let start = pos;
  while (start > 0 && content[start - 1] !== '\n') start--;
  let end = pos + match[0].length;
  while (end < content.length && content[end] !== '\n') end++;
  return content.slice(start, end).trim();
}

export function renderContextWithHighlight(context, word) {
  if (!context || !word) return context;
  
  // Escape special regex characters in the word
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Try to find the word with brackets first
  const bracketPattern = new RegExp(`\\[+${escapedWord}\\?+\\]+`, 'gi');
  const plainPattern = new RegExp(`(${escapedWord})`, 'gi');
  
  let parts = [];
  let lastIndex = 0;
  let match;
  
  // First try bracket pattern
  const testBracket = context.match(bracketPattern);
  
  const pattern = testBracket ? bracketPattern : plainPattern;
  const contextCopy = context;
  
  let hasMatch = false;
  while ((match = pattern.exec(contextCopy)) !== null) {
    hasMatch = true;
    // Add text before match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: contextCopy.slice(lastIndex, match.index), key: `text-${lastIndex}` });
    }
    // Add highlighted match
    parts.push({ 
      type: 'highlight', 
      value: testBracket ? word : match[0], 
      key: `mark-${match.index}` 
    });
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < contextCopy.length) {
    parts.push({ type: 'text', value: contextCopy.slice(lastIndex), key: 'text-end' });
  }
  
  return hasMatch ? parts : null;
}

export const statusConfig = {
  new: { label: 'Новый', color: 'bg-slate-100 text-slate-700' },
  transcribing: { label: 'Транскрибация...', color: 'bg-blue-100 text-blue-700' },
  processing: { label: 'Обработка...', color: 'bg-indigo-100 text-indigo-700' },
  needs_review: { label: 'Требует проверки', color: 'bg-orange-100 text-orange-700' },
  ready: { label: 'Готов к анализу', color: 'bg-green-100 text-green-700' },
  error: { label: 'Ошибка', color: 'bg-red-100 text-red-700' }
};

export const languageOptions = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pl', label: 'Polski' },
  { value: 'uk', label: 'Українська' },
];

export const reasoningEffortOptions = [
  { value: 'auto', label: 'Auto', description: 'Автоматический выбор' },
  { value: 'minimal', label: 'Minimal', description: 'Быстрый ответ' },
  { value: 'low', label: 'Low', description: 'Лёгкий анализ' },
  { value: 'medium', label: 'Medium', description: 'Средний анализ' },
  { value: 'high', label: 'High', description: 'Глубокий анализ' },
  { value: 'xhigh', label: 'Deep Thinking', description: 'Максимальный анализ' },
];
