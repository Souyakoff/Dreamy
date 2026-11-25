import mammoth from 'mammoth/mammoth.browser';
import type { RawBlock, RawKind } from './structure';

const STYLE_MAP = [
  "p[style-name='Title'] => h1.doc-title:fresh",
  "p[style-name='Titre'] => h1.doc-title:fresh",
  "p[style-name='Subtitle'] => p.doc-subtitle:fresh",
  "p[style-name='Sous-titre'] => p.doc-subtitle:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Citation'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "p[style-name='heading 3'] => h3:fresh",
  "p[style-name='heading 4'] => h3:fresh",
  "u => u",
];

export async function parseDocx(buf: ArrayBuffer): Promise<RawBlock[]> {
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buf }, { styleMap: STYLE_MAP, includeDefaultStyleMap: true });
  const doc = new DOMParser().parseFromString(`<body>${value}</body>`, 'text/html');
  const out: RawBlock[] = [];
  for (const el of Array.from(doc.body.children)) {
    const tag = el.tagName.toLowerCase();
    const text = el.textContent || '';
    // Les ancres de sommaire Word génèrent des <a id="_Toc…"> vides : on les retire.
    el.querySelectorAll('a[id]:not([href])').forEach((a) => a.replaceWith(...Array.from(a.childNodes)));
    let kind: RawKind = 'p';
    if (tag === 'h1' && el.classList.contains('doc-title')) kind = 'title';
    else if (tag === 'p' && el.classList.contains('doc-subtitle')) kind = 'subtitle';
    else if (tag === 'h1') kind = 'h1';
    else if (/^h[2-6]$/.test(tag)) kind = 'h2';
    else if (tag === 'blockquote') kind = 'quote';
    else if (tag === 'ul' || tag === 'ol' || tag === 'table') kind = 'list';
    if (tag === 'p' && el.querySelector('img') && !text.trim()) {
      for (const img of Array.from(el.querySelectorAll('img'))) out.push({ kind: 'img', html: img.outerHTML, text: '' });
      continue;
    }
    out.push({ kind, html: kind === 'list' ? el.outerHTML : el.innerHTML, text });
  }
  return out;
}
