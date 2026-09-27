/** Nettoie un HTML produit à partir d'un fichier importé (Word) avant affichage. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, link, meta, form').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if ((name === 'href' || name === 'src') && !/^(https?:|mailto:|#|data:image\/(png|jpe?g|gif|webp);)/.test(value)) el.removeAttribute(attr.name);
    }
    if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
  });
  return doc.body.firstElementChild?.innerHTML ?? '';
}
