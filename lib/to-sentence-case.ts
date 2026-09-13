const DOTTED_ACRONYM = /[A-Z](?:\.[A-Z])+\.?/;
const WORD = /[A-Z](?:\.[A-Z])+\.?|[A-Za-z0-9][A-Za-z0-9'’-]*/g;

function shouldPreserve(word: string): boolean {
  if (DOTTED_ACRONYM.test(word)) return true;
  if (/^[A-Z0-9]{2,6}s?$/.test(word)) return true;
  if (/[a-z][A-Z]/.test(word)) return true;
  const hyphenated = word.split("-");
  if (
    hyphenated.length > 1 &&
    hyphenated
      .slice(1)
      .some(
        (part) => /^[A-Z0-9]{2,6}s?$/.test(part) || /[a-z][A-Z]/.test(part)
      )
  ) {
    return true;
  }
  return false;
}

/** Sentence-case UI chrome: page headers and form labels. Preserves acronyms and mixed-case proper nouns. */
export function toSentenceCase(text: string): string {
  if (!text) return text;
  let firstWordDone = false;
  return text.replace(WORD, (word) => {
    if (shouldPreserve(word)) {
      firstWordDone = true;
      return word;
    }
    if (!firstWordDone) {
      firstWordDone = true;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word.toLowerCase();
  });
}
