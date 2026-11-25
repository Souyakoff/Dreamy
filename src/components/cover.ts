// Couverture : image fournie, sinon couverture typographique générée à partir du titre.
import { toRoman } from '../import/structure';

export interface CoverInfo { title: string; subtitle?: string; author?: string; fandom?: string; volume?: number | null; image?: string | null }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Palettes de reliure : [fond, fond sombre, dorure]
const PALETTES: [string, string, string][] = [
  ['#5b1d1d', '#2a0c0c', '#d9b26a'], ['#1f3a3a', '#0c1d1d', '#d8c08a'], ['#22304f', '#0e1529', '#e0c27c'],
  ['#3c2a4d', '#1b1124', '#e3c48b'], ['#2f3d22', '#141c0d', '#d6bd7a'], ['#4a3320', '#1f140a', '#e6c88f'],
  ['#18232b', '#070c10', '#c9a45c'], ['#6a3b1c', '#2c160a', '#f0d39a'],
];
const MOTIFS = ['✦', '❧', '✷', '❖', '☙', '✺', '⚜', '✧'];

export function coverHtml(c: CoverInfo): string {
  const vol = c.volume ? `<div class="cv-volume">Tome ${toRoman(c.volume)}</div>` : '';
  if (c.image) {
    return `<div class="cover cover-image" style="background-image:url('${esc(c.image)}')">${vol ? `<div class="cv-badge">${vol}</div>` : ''}</div>`;
  }
  const h = hash(`${c.fandom}|${c.title}`);
  const [bg, dark, gold] = PALETTES[h % PALETTES.length];
  const motif = MOTIFS[(h >> 8) % MOTIFS.length];
  const len = c.title.length;
  const size = len > 36 ? 0.75 : len > 22 ? 0.9 : len > 12 ? 1.1 : 1.35;
  return `<div class="cover cover-gen pattern-${(h >> 4) % 4}" style="--cv-bg:${bg};--cv-dark:${dark};--cv-gold:${gold};--cv-size:${size}">
    <div class="cv-frame">
      ${c.fandom ? `<div class="cv-fandom">${esc(c.fandom)}</div>` : ''}
      <div class="cv-motif">${motif}</div>
      <div class="cv-title">${esc(c.title)}</div>
      ${c.subtitle ? `<div class="cv-subtitle">${esc(c.subtitle)}</div>` : ''}
      ${vol}
      <div class="cv-author">${esc(c.author || '')}</div>
    </div>
  </div>`;
}
