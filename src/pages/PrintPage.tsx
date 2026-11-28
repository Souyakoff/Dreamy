// Page d'impression : le livre complet, page par page, au format papier choisi.
// Utilisée par le serveur pour produire le PDF, ou directement via « Imprimer → Enregistrer au format PDF ».
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Volume } from '../types';
import { paginate } from '../reader/paginate';
import { buildMeta, pagesToHtml } from '../reader/book';
import { ensureThemeFonts, resolveTheme, themeById, THEMES } from '../themes';

declare global { interface Window { __PDF_READY?: boolean; __PDF_ERROR?: string } }

export const PRINT_SIZES = {
  a5: { label: 'A5 — format livre', w: 148, h: 210, fs: 14.2 },
  poche: { label: 'Poche — 11 × 17,8 cm', w: 110, h: 178, fs: 12.6 },
  a4: { label: 'A4 — feuille standard', w: 210, h: 297, fs: 16.5 },
} as const;
export type PrintSize = keyof typeof PRINT_SIZES;

const MM = 96 / 25.4;

/**
 * Les dégradés circulaires semi-transparents (vignettage, taches) sont convertis en image pleine page
 * à CHAQUE page par le moteur PDF : des dizaines de Mo. On dessine chaque fond distinct une seule fois
 * en JPEG et on le réutilise : le PDF ne contient alors qu'une copie par fond.
 */
async function flattenPageBackgrounds(root: HTMLElement) {
  const groups = new Map<string, HTMLElement[]>();
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('.print-page.paper'))) {
    const cs = getComputedStyle(el);
    if (!/radial-gradient|repeating-/.test(cs.backgroundImage) || cs.backgroundImage.includes('url(')) continue;
    const css = ['background-image', 'background-color', 'background-size', 'background-position', 'background-repeat']
      .map((k) => `${k}:${cs.getPropertyValue(k)}`).join(';');
    const key = `${el.offsetWidth}x${el.offsetHeight}|${css}`;
    groups.set(key, [...(groups.get(key) || []), el]);
  }
  for (const [key, els] of groups) {
    const [size, css] = key.split('|');
    const [w, h] = size.split('x').map(Number);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;${css.replace(/"/g, "'")}"></div></foreignObject></svg>`;
    try {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      const scale = 1.6;
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      const ctx = c.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      const url = c.toDataURL('image/jpeg', 0.9);
      for (const el of els) el.style.background = `url("${url}") 0 0 / 100% 100% no-repeat`;
    } catch { /* on garde le fond d'origine */ }
  }
}

const preload = (urls: string[]) => Promise.all(urls.map((u) => new Promise<void>((ok) => { const i = new Image(); i.onload = i.onerror = () => ok(); i.src = u; })));

export function PrintPage() {
  const { kind = 'tome', id = '' } = useParams();
  const [params] = useSearchParams();
  const sizeKey = (params.get('size') as PrintSize) in PRINT_SIZES ? (params.get('size') as PrintSize) : 'a5';
  const size = PRINT_SIZES[sizeKey];
  const ink = params.get('ink') === '1';
  const wantPrint = params.get('print') === '1';
  const [html, setHtml] = useState('');
  const [status, setStatus] = useState('Chargement…');
  const [theme, setTheme] = useState('classique');
  const [title, setTitle] = useState('');

  useEffect(() => {
    document.body.classList.add('print-mode');
    return () => { document.body.classList.remove('print-mode'); document.documentElement.style.removeProperty('--noise'); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let vols: Volume[];
        if (kind === 'oeuvre') {
          const w = await api.work(id);
          vols = await Promise.all(w.volumes.map((v) => api.volume(v.id)));
        } else vols = [await api.volume(id)];
        if (!vols.length) throw new Error('Aucun tome à exporter.');
        const work = vols[0].work;
        const t = THEMES.some((x) => x.id === params.get('theme')) ? params.get('theme')! : resolveTheme(work);
        setTheme(t);
        document.documentElement.dataset.theme = t;
        // Pas de grain dans le PDF : le navigateur le recopierait sur chaque page (fichiers énormes).
        document.documentElement.style.setProperty('--noise', 'none');
        setTitle(kind === 'oeuvre' ? work.title : `${work.title} — Tome ${vols[0].number}`);
        document.title = kind === 'oeuvre' ? work.title : `${work.title} — Tome ${vols[0].number}`;
        setStatus('Chargement des polices…');
        await ensureThemeFonts(t);
        const wpx = Math.floor(size.w * MM), hpx = Math.floor(size.h * MM);
        let out = '';
        for (let i = 0; i < vols.length; i++) {
          if (cancelled) return;
          setStatus(`Mise en page du tome ${vols[i].number}… (${i + 1}/${vols.length})`);
          const meta = buildMeta(vols[i], t);
          const layout = await paginate(vols[i].content, meta, { width: wpx, height: hpx, fontSize: Math.round(size.fs * themeById(t).textScale * 10) / 10, className: `book-root print-book${ink ? ' ink-saver' : ''}`, theme: t });
          out += pagesToHtml(layout, meta, true, 'print-page');
        }
        if (cancelled) return;
        setHtml(out);
        await preload(vols.flatMap((v) => [v.cover, v.work.cover]).filter((u): u is string => Boolean(u)));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        setStatus('Préparation des fonds de page…');
        const root = document.querySelector<HTMLElement>('.book-root.print-book');
        if (root) await flattenPageBackgrounds(root);
        setStatus('');
        window.__PDF_READY = true;
        if (wantPrint) setTimeout(() => window.print(), 300);
      } catch (e) {
        window.__PDF_ERROR = (e as Error).message || 'Erreur';
        setStatus(`Erreur : ${window.__PDF_ERROR}`);
      }
    })();
    return () => { cancelled = true; };
  }, [kind, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const MMpx = (mm: number) => `${(mm * MM).toFixed(2)}px`;
  return (
    <>
      <style>{`@page { size: ${size.w}mm ${size.h}mm; margin: 0; }`}</style>
      <div className="print-toolbar">
        <strong>{title || 'Export PDF'}</strong>
        <span>{status || `${size.label} · prêt`}</span>
        {!status && <button className="btn btn-gold" onClick={() => window.print()}>Imprimer / Enregistrer en PDF</button>}
        {!status && <small>Dans la fenêtre d’impression, choisis « Enregistrer au format PDF », marges « Aucune » et coche « Graphiques d’arrière-plan ».</small>}
      </div>
      <div className={`book-root print-book${ink ? ' ink-saver' : ''}`} data-theme={theme}
        style={{ '--page-w': MMpx(size.w), '--page-h': MMpx(size.h), '--fs': `${Math.round(size.fs * themeById(theme).textScale * 10) / 10}px`, '--print-w': `${size.w}mm`, '--print-h': `${size.h}mm` } as React.CSSProperties}
        dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
