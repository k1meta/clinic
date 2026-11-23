/** Name comparison tolerant of case, diacritics and word order ("Đenan" ≈ "Denan"). */

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(dr|mr|prim|prof|doktor|doktorica|doktoru|doktorici)\b\.?/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function countNameParts(name: string): number {
  return tokens(name).length;
}

/** Same set of name parts, in any order. */
export function sameFullName(a: string, b: string): boolean {
  const left = tokens(a).sort();
  const right = tokens(b).sort();
  return left.length > 0 && left.length === right.length && left.every((part, i) => part === right[i]);
}

/** Every spoken part appears in the stored name ("Amra" matches "Amra Hodžić"). */
export function nameMatches(spoken: string, stored: string): boolean {
  const spokenParts = tokens(spoken);
  const storedParts = new Set(tokens(stored));
  return spokenParts.length > 0 && spokenParts.every((part) => storedParts.has(part));
}
