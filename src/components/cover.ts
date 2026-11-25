// Couverture : image fournie, sinon couverture typographique générée à partir du titre.
import { toRoman } from '../import/structure';
import { themeById, themeTitle } from '../themes';

export interface CoverInfo { title: string; subtitle?: string; author?: string; fandom?: string; volume?: number | null; image?: string | null; theme?: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}


export function coverHtml(c: CoverInfo): string {
  const vol = c.volume ? `<div class="cv-volume">Tome ${toRoman(c.volume)}</div>` : '';
  if (c.image) {
    return `<div class="cover cover-image" data-theme="${themeById(c.theme).id}" style="background-image:url('${esc(c.image)}')">${vol ? `<div class="cv-badge">${vol}</div>` : ''}</div>`;
  }
  const theme = themeById(c.theme);
  const h = hash(`${c.fandom}|${c.title}`);
  const [bg, dark, gold] = theme.palettes[h % theme.palettes.length];
  const motif = theme.motifs[(h >>> 8) % theme.motifs.length];
  const len = c.title.length;
  const size = len > 36 ? 0.75 : len > 22 ? 0.9 : len > 12 ? 1.1 : 1.35;
  return `<div class="cover cover-gen pattern-${(h >>> 4) % 4}" data-theme="${theme.id}" style="--cv-bg:${bg};--cv-dark:${dark};--cv-gold:${gold};--cv-size:${size}">
    <div class="cv-frame">
      ${c.fandom ? `<div class="cv-fandom">${esc(c.fandom)}</div>` : ''}
      <div class="cv-motif">${motif}</div>
      <div class="cv-deco"></div>
      <div class="cv-title">${esc(themeTitle(c.title, theme.id))}</div>
      ${c.subtitle ? `<div class="cv-subtitle">${esc(c.subtitle)}</div>` : ''}
      ${vol}
      <div class="cv-author">${esc(c.author || '')}</div>
    </div>
  </div>`;
}
