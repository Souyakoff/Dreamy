// Éléments communs au lecteur et à l'export PDF : métadonnées du livre et HTML des pages.
import type { Volume } from '../types';
import { coverHtml } from '../components/cover';
import { themeTitle } from '../themes';
import { splitChapterTitle, type BookMeta, type Layout } from './paginate';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildMeta(vol: Volume, theme: string): BookMeta {
  const w = vol.work;
  const summary = vol.summary || w.summary;
  return {
    workTitle: themeTitle(w.title, theme), workSubtitle: w.subtitle, author: w.author, fandom: w.fandom,
    volumeNumber: vol.number, volumeTitle: vol.title, summary, version: vol.version,
    coverHtml: coverHtml({ title: w.title, subtitle: w.subtitle, author: w.author, fandom: w.fandom, volume: vol.number, image: vol.cover || w.cover, theme }),
    backHtml: `<div class="back-cover"><div class="bc-title">${esc(themeTitle(w.title, theme))}</div>${summary ? `<p class="bc-summary">${esc(summary)}</p>` : ''}<div class="bc-meta">${[w.author, w.fandom].filter(Boolean).map((x) => esc(x!)).join(' · ')}</div><div class="bc-brand">Dreamy</div></div>`,
  };
}

/** HTML de toutes les pages. En double page (ou pour l'impression recto-verso), les pages d'index impair sont à gauche. */
export function pagesToHtml(layout: Layout, meta: BookMeta, spread: boolean, extraClass = ''): string {
  return layout.pages.map((p, i) => {
    const hard = p.hard ? 'hard' : 'soft';
    if (p.kind === 'cover' || p.kind === 'back') return `<div class="page cover-page ${p.kind} ${extraClass}" data-density="hard">${p.body}</div>`;
    const left = spread ? i % 2 === 1 : false;
    const chTitle = p.chapter >= 0 ? splitChapterTitle(layout.chapterTitles[p.chapter], p.chapter).title : '';
    const running = p.kind === 'text' && !p.opener ? (left || !chTitle ? meta.workTitle : chTitle) : '';
    const folio = p.kind === 'text' || p.kind === 'front' || p.kind === 'toc' ? String(i) : '';
    const side = left ? 'left' : 'right';
    return `<div class="page paper ${p.kind}-page ${side} ${p.endpaper ? 'endpaper' : ''} ${extraClass}" data-density="${hard}">
      <div class="page-inner"><div class="running">${esc(running) || '&nbsp;'}</div><div class="page-body">${p.body}</div><div class="folio">${folio}</div></div>
    </div>`;
  }).join('');
}
