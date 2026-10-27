/** Match aliases in any order, but keep console suffixes such as S and X distinct. */
export function matchesLibrarySearch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const words = lower.split(/[^a-z0-9]+/);
  return query.toLowerCase().trim().split(/\s+/).every((term) =>
    /^[a-z]$/.test(term) ? words.includes(term) : lower.includes(term),
  );
}
