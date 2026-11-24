const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 12345 -> "12.3K". Returns an empty string for null/undefined. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return compact.format(value);
}

/** Collapses whitespace and strips inline LaTeX delimiters for plain-text display. */
export function toPlainText(input: string): string {
  return input
    .replace(/\$\$?([^$]+)\$\$?/g, "$1")
    .replace(/\\([%&_#$])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
