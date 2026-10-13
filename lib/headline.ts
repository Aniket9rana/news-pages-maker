export interface HeadlinePart {
  text: string;
  hl: boolean;
}

/** Headlines mark highlighted words with *asterisks*: "अब कर्ज लेना *महंगा*". An unmatched * is kept as text. */
export function parseHeadline(raw: string): HeadlinePart[] {
  const parts: HeadlinePart[] = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0;
  for (let m = re.exec(raw); m; m = re.exec(raw)) {
    if (m.index > last) parts.push({ text: raw.slice(last, m.index), hl: false });
    parts.push({ text: m[1], hl: true });
    last = m.index + m[0].length;
  }
  if (last < raw.length) parts.push({ text: raw.slice(last), hl: false });
  return parts;
}

export function plainHeadline(raw: string): string {
  return parseHeadline(raw)
    .map((p) => p.text)
    .join("");
}

/** A deck is bulleted when it has several lines or starts with a bullet character. */
export function deckBullets(deck: string): string[] | null {
  const lines = deck
    .split("\n")
    .map((l) => l.replace(/^[\s■•▪-]+/, "").trim())
    .filter(Boolean);
  const bulleted = lines.length > 1 || /^\s*[■•▪]/.test(deck);
  return bulleted ? lines : null;
}
