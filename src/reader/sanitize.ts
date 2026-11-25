// Nettoyage du HTML importé : on ne garde que la mise en forme de texte.
const ALLOWED = new Set(['EM', 'STRONG', 'I', 'B', 'U', 'S', 'BR', 'SUP', 'SUB', 'SMALL', 'SPAN', 'A', 'IMG', 'UL', 'OL', 'LI', 'TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH', 'P']);

export function sanitizeInto(target: Element, html: string) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const walk = (node: Node, into: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) { into.appendChild(document.createTextNode(child.textContent || '')); continue; }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      if (!ALLOWED.has(el.tagName)) { walk(el, into); continue; }
      const copy = document.createElement(el.tagName.toLowerCase());
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') || '';
        if (/^https?:\/\//i.test(href)) { copy.setAttribute('href', href); copy.setAttribute('target', '_blank'); copy.setAttribute('rel', 'noopener noreferrer'); }
      }
      if (el.tagName === 'IMG') {
        const src = el.getAttribute('src') || '';
        if (!/^(data:image\/(png|jpe?g|gif|webp);|https?:\/\/)/i.test(src)) continue;
        copy.setAttribute('src', src);
        copy.setAttribute('alt', el.getAttribute('alt') || '');
      }
      walk(el, copy);
      into.appendChild(copy);
    }
  };
  walk(doc.body, target);
}
