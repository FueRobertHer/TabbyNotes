const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** Counts words, ignoring Markdown punctuation such as #, -, > and |. */
export function countWords(markdown: string): number {
  return markdown.match(WORD)?.length ?? 0;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "3 hr ago", "yesterday", then a short date. */
export function formatEdited(timestamp: number, now = Date.now(), locale?: string): string {
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < MINUTE) return "just now";
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), "hour");
  if (elapsed < 2 * DAY) return relative.format(-1, "day");
  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(locale, sameYear ? { month: "short", day: "numeric" } : { dateStyle: "medium" });
}
