/** Minuscules sans accents, espaces normalisés : base de toutes les règles. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/œ/g, 'oe')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Découpe une page en phrases (en conservant le texte original).
 * Une ligne nettement plus courte que les autres et sans ponctuation finale
 * (titre, en-tête de page) est traitée comme une phrase à part.
 */
export function sentences(page: string): string[] {
  const lines = page.replace(/-\n(?=[a-zà-ÿ])/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const maxLen = Math.max(0, ...lines.map((l) => l.length));
  let text = '';
  lines.forEach((line, i) => {
    const next = lines[i + 1];
    const isBreak = next !== undefined && !/[.,;:!?]$/.test(line) && line.length < maxLen * 0.75 && /^[A-ZÀ-Ý0-9«(]/.test(next);
    text += line + (isBreak ? '\u0000' : ' ');
  });
  return text
    // Pas de coupure après une numérotation en début de phrase (« 3. Éclairage », « 2.1. TGBT »),
    // mais coupure normale après un nombre en fin de phrase (« … avec le lot 12. La liste… »).
    .split(/\u0000|(?<=[.;!?])(?<!(?:^|[.;:!?\u0000]\s*)\d{1,2}(?:\.\d{1,2}){0,3}\.)\s+(?=[A-ZÀ-Ý0-9«(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

export function excerpt(s: string, max = 240): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Petit hachage stable (FNV-1a) pour les identifiants de constats. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Titre de section (court, sans ponctuation finale) : ne porte pas d'engagement à lui seul. */
export function isHeading(sentence: string): boolean {
  return sentence.length < 70 && !/[.;:!?)]$/.test(sentence);
}
