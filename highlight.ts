import type { Theme } from "@mariozechner/pi-coding-agent";

export interface MatchParts {
  before: string;
  match: string;
  after: string;
}

export function getFirstMatchParts(text: string, query: string): MatchParts | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  const matchIndex = text.toLowerCase().indexOf(normalizedQuery);
  if (matchIndex === -1) return null;

  return {
    before: text.slice(0, matchIndex),
    match: text.slice(matchIndex, matchIndex + normalizedQuery.length),
    after: text.slice(matchIndex + normalizedQuery.length),
  };
}

export function highlightFirstMatch(text: string, query: string, theme: Theme): string {
  const parts = getFirstMatchParts(text, query);
  if (!parts) return text;
  return `${parts.before}${theme.fg("accent", theme.bold(parts.match))}${parts.after}`;
}
