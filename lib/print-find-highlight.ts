/**
 * Chrome's Ctrl+F also highlights matches inside print iframes, and the highlight prints
 * (print-color-adjust: exact). Separate rules: one unknown pseudo-element would drop a whole selector list.
 */
export const PRINT_NO_FIND_HIGHLIGHT_CSS = [
  "::search-text{background:transparent!important;color:inherit!important}",
  "::search-text:current{background:transparent!important;color:inherit!important}",
  "::selection{background:transparent!important;color:inherit!important}",
].join("");
