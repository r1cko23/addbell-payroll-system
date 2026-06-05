const POSSESSIVE_OR_CONTRACTION_BEFORE = new Set(["'", "\u2019", "`"]);

/** Title-case user-facing headings and short subtitles (e.g. "Executive Dashboard"). */
export function toTitleCase(text: string): string {
  if (!text) return text;
  return text.replace(/\b([a-z])/g, (match, letter: string, offset: number) => {
    const prev = text[offset - 1];
    if (prev && POSSESSIVE_OR_CONTRACTION_BEFORE.has(prev)) {
      return match;
    }
    return letter.toUpperCase();
  });
}
