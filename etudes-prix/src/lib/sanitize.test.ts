// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('nettoyage du HTML des documents Word', () => {
  it('supprime scripts, gestionnaires d’événements et liens dangereux', () => {
    const out = sanitizeHtml('<p onclick="alert(1)">Texte</p><script>alert(2)</script><a href="javascript:alert(3)">x</a><a href="https://ex.fr">ok</a><img src="x" onerror="alert(4)">');
    expect(out).not.toMatch(/script|onclick|onerror|javascript:/i);
    expect(out).toContain('Texte');
    expect(out).toContain('href="https://ex.fr"');
    expect(out).toContain('rel="noopener noreferrer"');
  });
});
