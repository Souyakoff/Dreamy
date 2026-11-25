// Transforme une suite de blocs « bruts » (issus de Word ou PDF) en tome structuré.
import type { Block, Chapter, VolumeContent } from '../types';

export type RawKind = 'title' | 'subtitle' | 'h1' | 'h2' | 'p' | 'quote' | 'img' | 'list';
export interface RawBlock { kind: RawKind; html: string; text: string }

export interface ImportDraft {
  workTitle: string;
  workSubtitle: string;
  volumeNumber: number | null;
  volumeTitle: string;
  version: string;
  content: VolumeContent;
}

const TOC_RE = /^(sommaire|table des mati[eè]res|contents|table of contents|index)$/i;
const SEP_RE = /^[\s*•·⁂~#=—–-]{1,12}$/;
const CHAPTER_LINE_RE = /^(chapitre|chapter|prologue|[ée]pilogue|interlude|partie|acte)\b|^[IVXLC]+\s*[—–.:-]\s+\S/i;
const VOLUME_RE = /^(volume|tome|livre|book|partie)\s+([IVXLC]+|\d+)\b\s*[—–:.-]?\s*(.*)$/i;
const VERSION_RE = /^version\s+(.+)$/i;

export function romanToInt(s: string): number {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  const u = s.toUpperCase();
  for (let i = 0; i < u.length; i++) {
    const v = map[u[i]] || 0, n = map[u[i + 1]] || 0;
    total += v < n ? -v : v;
  }
  return total;
}

export function toRoman(n: number): string {
  const t: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of t) while (n >= v) { out += s; n -= v; }
  return out;
}

const toBlock = (r: RawBlock): Block | null => {
  const text = r.text.trim();
  if (r.kind === 'img') return { t: 'img', html: r.html };
  if (!text) return null;
  if (SEP_RE.test(text) && text.length <= 12) return { t: 'sep', html: '' };
  if (r.kind === 'h2') return { t: 'h', html: r.html };
  if (r.kind === 'quote') return { t: 'quote', html: r.html };
  if (r.kind === 'list') return { t: 'list', html: r.html };
  return { t: 'p', html: r.html };
};

export function buildDraft(raw: RawBlock[]): ImportDraft {
  // S'il n'y a aucun titre de chapitre explicite, on détecte les lignes « Chapitre … ».
  if (!raw.some((r) => r.kind === 'h1')) {
    for (const r of raw) if (r.kind === 'p' && r.text.length < 90 && CHAPTER_LINE_RE.test(r.text.trim())) r.kind = 'h1';
  }

  const draft: ImportDraft = { workTitle: '', workSubtitle: '', volumeNumber: null, volumeTitle: '', version: '', content: { front: [], chapters: [] } };
  let current: Chapter | null = null;
  let skipping = false; // dans un sommaire

  for (const r of raw) {
    const text = r.text.trim();
    if (r.kind === 'title' && !draft.workTitle) { draft.workTitle = text; continue; }
    if (r.kind === 'subtitle' && !draft.workSubtitle) { draft.workSubtitle = text; continue; }
    if (r.kind === 'h1') {
      if (TOC_RE.test(text)) { skipping = true; current = null; continue; }
      skipping = false;
      current = { title: text, blocks: [] };
      draft.content.chapters.push(current);
      continue;
    }
    if (skipping) continue;
    if (!current) {
      // Avant le premier chapitre : page de titre / avant-propos.
      const vm = VOLUME_RE.exec(text);
      if (vm && draft.volumeNumber === null && text.length < 120) {
        draft.volumeNumber = romanToInt(vm[2]);
        draft.volumeTitle = vm[3].trim();
        continue;
      }
      const ver = VERSION_RE.exec(text);
      if (ver && !draft.version && text.length < 80) { draft.version = ver[1].trim(); continue; }
      if (!draft.workTitle && r.kind !== 'p') { draft.workTitle = text; continue; }
      // Ligne courte juste après le titre : probablement un sous-titre.
      if (draft.workTitle && !draft.workSubtitle && !draft.content.front.length && draft.volumeNumber === null && r.kind === 'p' && text.length < 90 && !/[.!?]$/.test(text)) { draft.workSubtitle = text; continue; }
      const b = toBlock(r);
      if (b) draft.content.front.push(b);
      continue;
    }
    const b = toBlock(r);
    if (b) current.blocks.push(b);
  }

  if (!draft.content.chapters.length && draft.content.front.length) {
    draft.content.chapters.push({ title: draft.workTitle || 'Texte', blocks: draft.content.front });
    draft.content.front = [];
  }
  // Retire les séparateurs en début/fin de chapitre.
  for (const ch of draft.content.chapters) {
    while (ch.blocks[0]?.t === 'sep') ch.blocks.shift();
    while (ch.blocks[ch.blocks.length - 1]?.t === 'sep') ch.blocks.pop();
  }
  return draft;
}

export async function importFile(file: File): Promise<ImportDraft> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) {
    const { parseDocx } = await import('./parseDocx');
    return buildDraft(await parseDocx(await file.arrayBuffer()));
  }
  if (name.endsWith('.pdf')) {
    const { parsePdf } = await import('./parsePdf');
    return buildDraft(await parsePdf(await file.arrayBuffer()));
  }
  if (name.endsWith('.doc')) throw new Error('Le format .doc (ancien Word) n’est pas pris en charge : enregistre le fichier en .docx depuis Word.');
  throw new Error('Format non pris en charge. Utilise un fichier .docx ou .pdf.');
}
