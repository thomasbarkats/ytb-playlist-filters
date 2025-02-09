export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

export function searchInText(text: string, searchQuery: string): boolean {
  if (!searchQuery) return true;  // Empty search matches everything

  const normalizedText = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const searchTerms = searchQuery.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().split(/\s+/);

  return searchTerms.every(term => {
    if (normalizedText.includes(term)) return true;

    const boundaryRegex = new RegExp(`\\b${term}|${term}\\b`);
    if (boundaryRegex.test(normalizedText)) return true;

    return false;
  });
};
