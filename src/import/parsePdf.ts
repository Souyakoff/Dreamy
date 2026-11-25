// Extraction de texte PDF : reconstruit lignes, paragraphes et titres à partir des tailles de police.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { RawBlock, RawKind } from './structure';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Line { text: string; size: number; x: number; y: number; right: number; page: number; pageH: number; pageW: number; bold: boolean; italic: boolean }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const norm = (s: string) => s.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();

export async function parsePdf(buf: ArrayBuffer): Promise<RawBlock[]> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const lines: Line[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const styles = tc.styles as Record<string, { fontFamily?: string }>;
    let cur: Line | null = null;
    for (const it of tc.items as any[]) {
      if (typeof it.str !== 'string') continue;
      const size = Math.hypot(it.transform[2], it.transform[3]) || it.height;
      const x = it.transform[4], y = vp.height - it.transform[5];
      const font = `${it.fontName} ${styles[it.fontName]?.fontFamily || ''}`;
      if (cur && Math.abs(cur.y - y) < Math.max(2, size * 0.4)) {
        if (it.str) {
          const gap = x - cur.right;
          cur.text += (gap > size * 0.15 && !cur.text.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '') + it.str;
          cur.right = Math.max(cur.right, x + (it.width || 0));
          cur.size = Math.max(cur.size, size);
        }
      } else if (it.str.trim()) {
        if (cur) lines.push(cur);
        cur = { text: it.str, size, x, y, right: x + (it.width || 0), page: p, pageH: vp.height, pageW: vp.width, bold: /bold|black|heavy|semibold/i.test(font), italic: /italic|oblique/i.test(font) };
      }
    }
    if (cur) lines.push(cur);
  }
  for (const l of lines) l.text = l.text.replace(/\s+/g, ' ').trim();

  // En-têtes et pieds de page répétés.
  const pages = pdf.numPages;
  if (pages >= 3) {
    const counts = new Map<string, number>();
    for (const l of lines) if (l.y < l.pageH * 0.1 || l.y > l.pageH * 0.9) counts.set(norm(l.text), (counts.get(norm(l.text)) || 0) + 1);
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      const edge = l.y < l.pageH * 0.1 || l.y > l.pageH * 0.9;
      if (edge && ((counts.get(norm(l.text)) || 0) >= Math.max(2, pages * 0.3) || /^[\d\s/–—-]+$/.test(l.text) || /^page\s+\d+/i.test(l.text))) lines.splice(i, 1);
    }
  }
  if (!lines.length) throw new Error('Aucun texte trouvé dans ce PDF (document scanné ?).');

  // Taille de police du corps = la plus fréquente (pondérée par nb de caractères).
  const bySize = new Map<number, number>();
  for (const l of lines) bySize.set(Math.round(l.size * 2) / 2, (bySize.get(Math.round(l.size * 2) / 2) || 0) + l.text.length);
  const body = [...bySize.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const isHeading = (l: Line) => l.size >= body * 1.18 && l.text.length < 140;
  const headingSizes = [...new Set(lines.filter(isHeading).map((l) => Math.round(l.size * 2) / 2))].sort((a, b) => b - a);
  // Niveau « chapitre » : la plus grande taille utilisée au moins deux fois.
  const countSize = (s: number) => lines.filter((l) => isHeading(l) && Math.round(l.size * 2) / 2 === s).length;
  const chapterSize = headingSizes.find((s) => countSize(s) >= 2) ?? headingSizes[0];

  const leftMargin = median(lines.filter((l) => !isHeading(l)).map((l) => l.x));
  const rightEdge = percentile(lines.filter((l) => !isHeading(l)).map((l) => l.right), 0.9);
  const lineGap = median(lines.slice(1).map((l, i) => (l.page === lines[i].page ? l.y - lines[i].y : NaN)).filter((g) => g > 0 && g < body * 3));

  const out: RawBlock[] = [];
  let para: { html: string; text: string } | null = null;
  let prev: Line | null = null;
  const flush = () => { if (para) out.push({ kind: 'p', html: para.html, text: para.text }); para = null; };
  const fmt = (l: Line) => (l.bold && l.italic ? `<strong><em>${esc(l.text)}</em></strong>` : l.bold ? `<strong>${esc(l.text)}</strong>` : l.italic ? `<em>${esc(l.text)}</em>` : esc(l.text));

  let seenChapter = false;
  for (const l of lines) {
    if (isHeading(l)) {
      flush();
      const s = Math.round(l.size * 2) / 2;
      let kind: RawKind = s >= chapterSize ? 'h1' : 'h2';
      if (s > chapterSize && l.page <= 2) kind = out.some((b) => b.kind === 'title') ? 'subtitle' : 'title';
      if (kind === 'h1') seenChapter = true;
      const last = out[out.length - 1];
      if (last && last.kind === kind && prev && isHeading(prev) && prev.page === l.page && l.y - prev.y < l.size * 1.8) {
        last.text += ' ' + l.text; last.html += ' ' + esc(l.text);
      } else out.push({ kind, html: esc(l.text), text: l.text });
      prev = l;
      continue;
    }
    const startsDialogue = /^[—–-]\s/.test(l.text) || /^[«“"]/.test(l.text);
    const indented = l.x > leftMargin + body * 0.8;
    const gap = prev && prev.page === l.page ? l.y - prev.y : lineGap;
    // Ligne précédente courte : fin de paragraphe (sur la page de titre, chaque ligne courte est isolée).
    const prevShort = prev && !isHeading(prev) && prev.right < rightEdge - body * 3 && (!seenChapter || /[.!?»…:"”)]$/.test(prev.text));
    const newPara = !para || !prev || isHeading(prev) || startsDialogue || indented || gap > lineGap * 1.45 || prevShort;
    if (newPara) { flush(); para = { html: fmt(l), text: l.text }; }
    else if (para) {
      const p: { html: string; text: string } = para;
      if (/[a-zà-ÿ]-$/i.test(p.text) && /^[a-zà-ÿ]/.test(l.text)) { p.text = p.text.slice(0, -1) + l.text; p.html = p.html.replace(/-(<\/\w+>)*$/, '$1') + fmt(l); }
      else { p.text += ' ' + l.text; p.html += ' ' + fmt(l); }
    }
    prev = l;
  }
  flush();
  return out.map((b) => ({ ...b, html: b.html.replace(/<\/(em|strong)>\s?<\1>/g, ' ') }));
}

function median(a: number[]) { return percentile(a, 0.5); }
function percentile(a: number[], q: number) {
  const s = a.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0;
}
