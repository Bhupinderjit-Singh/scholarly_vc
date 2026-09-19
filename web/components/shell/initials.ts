/**
 * Initials for an avatar fallback: the first letter of the first word plus
 * the first letter of the last word, upper-cased. Iterates code points so a
 * name starting with an emoji or a non-BMP character is not split in half.
 * Returns "?" for an empty or whitespace-only name.
 */
export function getInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const [firstWord] = words;
  if (firstWord === undefined) {
    return "?";
  }
  const lastWord = words.length > 1 ? words[words.length - 1] : undefined;
  const first = Array.from(firstWord)[0] ?? "";
  const last = lastWord === undefined ? "" : (Array.from(lastWord)[0] ?? "");
  return `${first}${last}`.toUpperCase();
}
