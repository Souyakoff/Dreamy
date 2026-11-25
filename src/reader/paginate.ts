// Découpe un tome en pages de taille fixe en mesurant réellement le texte dans le DOM.
import type { Block, VolumeContent } from '../types';
import { sanitizeInto } from './sanitize';
import { toRoman } from '../import/structure';

export type PageKind = 'cover' | 'blank' | 'title' | 'front' | 'toc' | 'text' | 'end' | 'back';
export interface Page { kind: PageKind; body: string; chapter: number; opener?: boolean; anchor: string; hard?: boolean; endpaper?: boolean }
export interface BookMeta {
  workTitle: string; workSubtitle?: string; author: string; fandom: string;
  volumeNumber: number; volumeTitle: string; summary: string; version?: string;
  coverHtml: string; backHtml?: string;
}
export interface Layout { pages: Page[]; chapterStarts: number[]; chapterTitles: string[] }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** « I — Les hommes… » → { label: 'Chapitre I', title: 'Les hommes…' } */
export function splitChapterTitle(t: string, i: number): { label: string; title: string } {
  const m = /^((?:chapitre|chapter)\s+)?([IVXLCDM]+|\d+)\s*[—–:.\-]\s*(.+)$/i.exec(t.trim());
  if (m) return { label: `Chapitre ${/^\d+$/.test(m[2]) ? toRoman(+m[2]) : m[2].toUpperCase()}`, title: m[3] };
  const m2 = /^(prologue|[ée]pilogue|interlude|continuit[ée]|annexe|bonus|avant-propos|postface)\s*[—–:.\-]\s*(.+)$/i.exec(t.trim());
  if (m2) return { label: m2[1][0].toUpperCase() + m2[1].slice(1).toLowerCase(), title: m2[2] };
  const m3 = /^(?:chapitre|chapter)\s+([IVXLCDM]+|\d+)$/i.exec(t.trim());
  if (m3) return { label: '', title: `Chapitre ${m3[1]}` };
  return { label: i >= 0 ? '' : '', title: t };
}

function blockEl(b: Block, first: boolean): HTMLElement {
  let el: HTMLElement;
  switch (b.t) {
    case 'h': el = document.createElement('h3'); el.className = 'scene'; break;
    case 'sep': el = document.createElement('div'); el.className = 'sep'; return el;
    case 'quote': el = document.createElement('blockquote'); break;
    case 'img': el = document.createElement('figure'); break;
    case 'list': el = document.createElement('div'); el.className = 'list'; break;
    default: el = document.createElement('p'); if (first) el.className = 'first';
  }
  sanitizeInto(el, b.html);
  return el;
}

const splittable = (el: HTMLElement) => el.tagName === 'P' || el.tagName === 'BLOCKQUOTE';

/** Positions de début de chaque mot dans l'élément. */
function wordStarts(el: HTMLElement): { node: Text; offset: number }[] {
  const out: { node: Text; offset: number }[] = [];
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let prevSpace = true;
  for (let n = tw.nextNode() as Text | null; n; n = tw.nextNode() as Text | null) {
    const s = n.data;
    for (let i = 0; i < s.length; i++) {
      const sp = /\s/.test(s[i]);
      if (!sp && prevSpace) out.push({ node: n, offset: i });
      prevSpace = sp;
    }
  }
  return out;
}

function splitAt(el: HTMLElement, pos: { node: Text; offset: number }): [DocumentFragment, DocumentFragment] {
  const a = document.createRange();
  a.setStart(el, 0); a.setEnd(pos.node, pos.offset);
  const b = document.createRange();
  b.setStart(pos.node, pos.offset); b.setEnd(el, el.childNodes.length);
  return [a.cloneContents(), b.cloneContents()];
}

export interface PaginateOptions { width: number; height: number; fontSize: number; className: string; theme: string }

export async function paginate(content: VolumeContent, meta: BookMeta, opt: PaginateOptions): Promise<Layout> {
  // Conteneur de mesure hors écran, avec exactement le même CSS que les vraies pages.
  const root = document.createElement('div');
  root.className = `${opt.className} measuring`;
  root.dataset.theme = opt.theme;
  root.style.cssText = `position:absolute;left:-99999px;top:0;visibility:hidden;--page-w:${opt.width}px;--page-h:${opt.height}px;--fs:${opt.fontSize}px;`;
  root.innerHTML = `<div class="page paper text-page right" style="width:${opt.width}px;height:${opt.height}px"><div class="page-inner"><div class="running">&nbsp;</div><div class="page-body"></div><div class="folio">0</div></div></div>`;
  document.body.appendChild(root);
  const body = root.querySelector('.page-body') as HTMLElement;
  const overflows = () => body.scrollHeight > body.clientHeight + 1;

  const pages: Page[] = [];
  const chapterStarts: number[] = [];
  const chapterTitles = content.chapters.map((c) => c.title);
  let pageAnchor = '';
  let pageChapter = -1;
  let opener = false;
  let kind: PageKind = 'text';
  let yieldCount = 0;

  const pushPage = () => {
    pages.push({ kind, body: body.innerHTML, chapter: pageChapter, opener, anchor: pageAnchor });
    body.innerHTML = '';
    opener = false;
  };
  const startPage = (anchor: string) => { pageAnchor = anchor; };

  /** Ajoute un bloc dans le flux en le coupant entre les pages si nécessaire. */
  const flow = async (el: HTMLElement, anchorBase: string) => {
    if (++yieldCount % 40 === 0) await new Promise((r) => setTimeout(r));
    if (!body.childNodes.length) startPage(`${anchorBase}:0`);
    body.appendChild(el);
    let wordOffset = 0;
    while (overflows()) {
      if (splittable(el)) {
        const words = wordStarts(el);
        // Recherche dichotomique du nombre de mots qui tiennent sur la page.
        const full = el.cloneNode(true) as HTMLElement;
        const fw = wordStarts(full);
        let lo = 0, hi = words.length - 1, best = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const [a] = splitAt(full, fw[mid]);
          el.replaceChildren(a);
          if (overflows()) hi = mid - 1; else { best = mid; lo = mid + 1; }
        }
        // Au moins ~2 lignes en bas de page et quelques mots en haut de la suivante (veuves / orphelines).
        const cut = Math.min(best, words.length - 4);
        if (cut >= 10) {
          best = cut;
          const [a, b] = splitAt(full, fw[best]);
          el.replaceChildren(a);
          el.classList.add('split');
          pushPage();
          wordOffset += best;
          const rest = document.createElement(el.tagName.toLowerCase());
          rest.className = 'cont';
          rest.append(b);
          startPage(`${anchorBase}:${wordOffset}`);
          body.appendChild(rest);
          el = rest;
          continue;
        }
        el.replaceChildren(...Array.from(full.childNodes));
      }
      // Bloc entier sur la page suivante (en emportant un intertitre resté seul en bas).
      if (body.childNodes.length === 1) break; // déjà seul sur sa page : on le laisse déborder (image géante…)
      body.removeChild(el);
      const carry: Node[] = [];
      const last = body.lastElementChild;
      if (last && last.tagName === 'H3' && body.childNodes.length > 1) { body.removeChild(last); carry.push(last); }
      pushPage();
      startPage(`${anchorBase}:${wordOffset}`);
      body.append(...carry, el);
    }
  };

  // 0. Couverture, 1. garde, 2. page de titre
  pages.push({ kind: 'cover', body: meta.coverHtml, chapter: -1, anchor: 'start', hard: true });
  pages.push({ kind: 'blank', body: '', chapter: -1, anchor: 'start', hard: true, endpaper: true });
  const vol = meta.volumeNumber ? `Tome ${toRoman(meta.volumeNumber)}` : '';
  // Page de titre : réduite automatiquement si elle ne tient pas (petits écrans, gros texte).
  body.innerHTML = `<div class="title-page">
      ${meta.fandom ? `<div class="tp-fandom">${esc(meta.fandom)}</div>` : ''}
      <h1 class="tp-title">${esc(meta.workTitle)}</h1>
      ${meta.workSubtitle ? `<div class="tp-subtitle">${esc(meta.workSubtitle)}</div>` : ''}
      <div class="ornament"></div>
      ${vol ? `<div class="tp-volume">${vol}</div>` : ''}
      ${meta.volumeTitle ? `<div class="tp-voltitle">${esc(meta.volumeTitle)}</div>` : ''}
      <div class="tp-author">${esc(meta.author || 'Auteur anonyme')}</div>
      ${meta.version ? `<div class="tp-version">Version ${esc(meta.version)}</div>` : ''}
    </div>`;
  const tp = body.firstElementChild as HTMLElement;
  for (let k = 0, size = 1; k < 10 && overflows(); k++) { size *= 0.9; tp.style.fontSize = `${size.toFixed(3)}em`; }
  pages.push({ kind: 'title', chapter: -1, anchor: 'start', body: body.innerHTML });
  body.innerHTML = '';

  // Avant-propos
  if (content.front.length) {
    kind = 'front'; pageChapter = -1;
    const h = document.createElement('h3'); h.className = 'front-title'; h.textContent = 'Avant-propos';
    await flow(h, 'front:0');
    for (let i = 0; i < content.front.length; i++) await flow(blockEl(content.front[i], false), `front:${i}`);
    pushPage();
  }

  // Sommaire (numéros provisoires, remplacés après la mise en page des chapitres)
  kind = 'toc'; pageChapter = -1;
  const tocStart = pages.length;
  const tocTitle = document.createElement('h3'); tocTitle.className = 'toc-title'; tocTitle.textContent = 'Sommaire';
  await flow(tocTitle, 'toc:0');
  content.chapters.forEach((ch, i) => {
    const { label, title } = splitChapterTitle(ch.title, i);
    const row = document.createElement('div');
    row.className = 'toc-row';
    row.innerHTML = `<a data-goto-chapter="${i}"><span class="toc-label">${esc(label)}</span><span class="toc-name">${esc(title)}</span><span class="toc-dots"></span><span class="toc-num">{{p${i}}}</span></a>`;
    body.appendChild(row);
    if (overflows()) { body.removeChild(row); pushPage(); body.appendChild(row); }
  });
  pushPage();
  const tocEnd = pages.length;

  // Chapitres
  kind = 'text';
  for (let c = 0; c < content.chapters.length; c++) {
    const ch = content.chapters[c];
    pageChapter = c;
    chapterStarts.push(pages.length);
    const { label, title } = splitChapterTitle(ch.title, c);
    const head = document.createElement('header');
    head.className = 'chapter-opener';
    head.innerHTML = `${label ? `<div class="ch-label">${esc(label)}</div>` : ''}<h2 class="ch-title">${esc(title)}</h2><div class="ornament chapter-orn"></div>`;
    startPage(`${c}:0:0`);
    body.appendChild(head);
    opener = true;
    let firstPara = true; // lettrine : uniquement au tout premier paragraphe du chapitre
    for (let b = 0; b < ch.blocks.length; b++) {
      const blk = ch.blocks[b];
      const isP = blk.t === 'p';
      await flow(blockEl(blk, isP && firstPara), `${c}:${b}`);
      if (isP) firstPara = false;
    }
    pushPage();
  }
  document.body.removeChild(root);

  // Numéros du sommaire
  for (let i = tocStart; i < tocEnd; i++) {
    pages[i].body = pages[i].body.replace(/\{\{p(\d+)\}\}/g, (_, n) => String(chapterStarts[+n]));
  }

  pages.push({
    kind: 'end', chapter: content.chapters.length - 1, anchor: 'end',
    body: `<div class="end-page"><div class="ornament"></div><div class="end-text">Fin ${vol ? `du ${vol.replace('Tome', 'tome')}` : ''}</div><div class="end-sub">${esc(meta.workTitle)}</div></div>`,
  });
  // La garde (intérieur du plat arrière) doit tomber sur une page de droite (index pair),
  // la quatrième de couverture à gauche (index impair) : nombre total de pages pair.
  if (pages.length % 2 === 1) pages.push({ kind: 'blank', body: '', chapter: -1, anchor: 'end' });
  pages.push({ kind: 'blank', body: '', chapter: -1, anchor: 'end', hard: true, endpaper: true });
  pages.push({ kind: 'back', body: meta.backHtml || '', chapter: -1, anchor: 'end', hard: true });
  return { pages, chapterStarts, chapterTitles };
}

/** Compare deux ancres « chapitre:bloc:mot ». */
export function anchorKey(a: string): number[] | null {
  const m = /^(\d+):(\d+):(\d+)$/.exec(a);
  return m ? [+m[1], +m[2], +m[3]] : null;
}
export function pageForAnchor(pages: Page[], anchor: string): number {
  const k = anchorKey(anchor);
  if (!k) return anchor === 'end' ? pages.length - 1 : 0;
  let best = 0;
  for (let i = 0; i < pages.length; i++) {
    const p = anchorKey(pages[i].anchor);
    if (!p) continue;
    if (p[0] < k[0] || (p[0] === k[0] && (p[1] < k[1] || (p[1] === k[1] && p[2] <= k[2])))) best = i;
    else break;
  }
  return best;
}
