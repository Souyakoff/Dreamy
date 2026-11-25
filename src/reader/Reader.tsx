import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageFlip } from 'page-flip';
import { paginate, pageForAnchor, splitChapterTitle, type BookMeta, type Layout } from './paginate';
import { pageSound } from './sound';
import type { VolumeContent } from '../types';

const RATIO = 1.42; // hauteur / largeur d'une page
const TOP = 56, BOTTOM = 64;

interface Dims { w: number; h: number; spread: boolean; fs: number }

function computeDims(scale: number): Dims {
  const vw = window.innerWidth, vh = window.innerHeight;
  const sideGutter = vw > 900 ? 72 : 12;
  const availW = vw - sideGutter * 2;
  const availH = vh - TOP - BOTTOM - 32;
  const spreadW = Math.floor(Math.min(availW / 2, availH / RATIO, 640));
  let w: number, spread: boolean;
  if (spreadW >= 300 && vw >= 820) { w = spreadW; spread = true; }
  else { w = Math.floor(Math.min(availW, availH / RATIO, 640)); spread = false; }
  const h = Math.floor(w * RATIO);
  const fs = Math.max(13, Math.min(22, w * 0.034)) * scale;
  return { w, h, spread, fs: Math.round(fs * 10) / 10 };
}

const storage = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

interface Props { volumeId: string; content: VolumeContent; meta: BookMeta; onClose: () => void }

export function Reader({ volumeId, content, meta, onClose }: Props) {
  const [scale, setScale] = useState(() => storage.get('dreamy:fontScale', 1));
  const [sound, setSound] = useState(() => storage.get('dreamy:sound', true));
  const [dims, setDims] = useState(() => computeDims(scale));
  const [layout, setLayout] = useState<Layout | null>(null);
  const [page, setPage] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const progressKey = `dreamy:progress:${volumeId}`;
  const anchorRef = useRef<string>(storage.get(progressKey, { anchor: 'start' }).anchor);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  // Recalcul des dimensions au redimensionnement.
  useEffect(() => {
    let t: number;
    const onResize = () => { clearTimeout(t); t = window.setTimeout(() => setDims(computeDims(scale)), 250); };
    setDims(computeDims(scale));
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(t); };
  }, [scale]);

  // Mise en page (après chargement des polices pour des mesures exactes).
  useEffect(() => {
    let cancelled = false;
    setLayout(null);
    (async () => {
      await document.fonts.ready;
      const l = await paginate(content, meta, { width: dims.w, height: dims.h, fontSize: dims.fs, className: 'book-root' });
      if (!cancelled) setLayout(l);
    })();
    return () => { cancelled = true; };
  }, [content, meta, dims]);

  const pagesHtml = useMemo(() => {
    if (!layout) return '';
    return layout.pages.map((p, i) => {
      const hard = p.hard ? 'hard' : 'soft';
      if (p.kind === 'cover' || p.kind === 'back') return `<div class="page cover-page ${p.kind}" data-density="hard">${p.body}</div>`;
      const left = dims.spread ? i % 2 === 1 : false;
      const chTitle = p.chapter >= 0 ? splitChapterTitle(layout.chapterTitles[p.chapter], p.chapter).title : '';
      const running = p.kind === 'text' && !p.opener ? (left || !chTitle ? meta.workTitle : chTitle) : '';
      const folio = p.kind === 'text' || p.kind === 'front' || p.kind === 'toc' ? String(i) : '';
      const side = left ? 'left' : 'right';
      return `<div class="page paper ${p.kind}-page ${side} ${p.endpaper ? 'endpaper' : ''}" data-density="${hard}">
        <div class="page-inner"><div class="running">${running.replace(/</g, '&lt;') || '&nbsp;'}</div><div class="page-body">${p.body}</div><div class="folio">${folio}</div></div>
      </div>`;
    }).join('');
  }, [layout, dims.spread, meta.workTitle]);

  // Création du livre animé.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !layout) return;
    const el = document.createElement('div');
    el.className = 'flip-book';
    el.style.width = `${dims.spread ? dims.w * 2 : dims.w}px`;
    el.style.height = `${dims.h}px`;
    el.innerHTML = pagesHtml;
    host.appendChild(el);
    const start = Math.min(pageForAnchor(layout.pages, anchorRef.current), layout.pages.length - 1);
    const pf = new PageFlip(el, {
      width: dims.w, height: dims.h, size: 'fixed' as any,
      showCover: true, usePortrait: true, startPage: start,
      drawShadow: true, maxShadowOpacity: 0.45, flippingTime: 750,
      mobileScrollSupport: false, clickEventForward: true, useMouseEvents: true,
      showPageCorners: true, swipeDistance: 30, autoSize: false,
    } as any);
    pf.loadFromHTML(el.querySelectorAll('.page') as unknown as HTMLElement[]);
    setPage(start);
    pf.on('flip', (e) => {
      const idx = Number(e.data);
      setPage(idx);
      const p = layout.pages[idx];
      if (p) {
        // En double page, la page de droite est la plus avancée : on retient celle de gauche.
        anchorRef.current = p.anchor;
        storage.set(progressKey, { anchor: p.anchor, page: idx, total: layout.pages.length, at: Date.now() });
      }
    });
    pf.on('changeState', (e) => { if (e.data === 'flipping' && soundRef.current) pageSound(); });
    flipRef.current = pf;

    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as HTMLElement).closest('[data-goto-chapter]');
      if (a) { ev.preventDefault(); ev.stopPropagation(); pf.flip(layout.chapterStarts[Number(a.getAttribute('data-goto-chapter'))]); }
    };
    // Empêche page-flip de tourner la page quand on clique sur une entrée du sommaire.
    const shield = (ev: Event) => { if ((ev.target as HTMLElement).closest('[data-goto-chapter]')) ev.stopPropagation(); };
    el.addEventListener('click', onClick, true);
    el.addEventListener('mousedown', shield, true);
    el.addEventListener('touchstart', shield, true);
    return () => {
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('mousedown', shield, true);
      el.removeEventListener('touchstart', shield, true);
      try { pf.destroy(); } catch { /* ignore */ }
      flipRef.current = null;
      host.innerHTML = '';
    };
  }, [layout, pagesHtml, dims, progressKey]);

  const goto = useCallback((n: number, animate = true) => {
    const pf = flipRef.current;
    if (!pf) return;
    if (animate) pf.flip(n); else { pf.turnToPage(n); setPage(n); const p = layout?.pages[n]; if (p) { anchorRef.current = p.anchor; storage.set(progressKey, { anchor: p.anchor, page: n, total: layout!.pages.length, at: Date.now() }); } }
  }, [layout, progressKey]);

  // Clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); flipRef.current?.flipNext(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); flipRef.current?.flipPrev(); }
      else if (e.key === 'Home') goto(0);
      else if (e.key === 'End' && layout) goto(layout.pages.length - 1);
      else if (e.key === 'Escape') { if (tocOpen) setTocOpen(false); else onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goto, layout, tocOpen, onClose]);

  const changeScale = (d: number) => {
    const s = Math.round(Math.max(0.8, Math.min(1.5, scale + d)) * 10) / 10;
    setScale(s); storage.set('dreamy:fontScale', s);
  };
  const toggleSound = () => { setSound(!sound); storage.set('dreamy:sound', !sound); };

  const total = layout?.pages.length ?? 0;
  const currentChapter = layout ? layout.pages[page]?.chapter ?? -1 : -1;
  // Position du livre : fermé, la couverture est centrée ; ouvert, la double page est centrée.
  const shift = dims.spread && layout ? (page === 0 ? -dims.w / 2 : page >= total - 1 ? dims.w / 2 : 0) : 0;

  return (
    <div className="reader">
      <header className="reader-bar">
        <button className="icon-btn" onClick={onClose} title="Retour (Échap)">←</button>
        <div className="reader-title">
          <strong>{meta.workTitle}</strong>
          <span>{meta.volumeNumber ? `Tome ${meta.volumeNumber}` : ''}{meta.volumeTitle ? ` · ${meta.volumeTitle}` : ''}</span>
        </div>
        <div className="reader-tools">
          <button className="icon-btn" onClick={() => setTocOpen(true)} title="Sommaire">☰</button>
          <button className="icon-btn" onClick={() => changeScale(-0.1)} title="Texte plus petit">A−</button>
          <button className="icon-btn" onClick={() => changeScale(0.1)} title="Texte plus grand">A+</button>
          <button className="icon-btn" onClick={toggleSound} title="Son des pages">{sound ? '🔊' : '🔈'}</button>
          <button className="icon-btn hide-sm" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())} title="Plein écran">⛶</button>
        </div>
      </header>

      <div className="reader-stage" style={{ '--page-w': `${dims.w}px`, '--page-h': `${dims.h}px`, '--fs': `${dims.fs}px` } as React.CSSProperties}>
        {dims.spread && <button className="nav-arrow prev" onClick={() => flipRef.current?.flipPrev()} disabled={page === 0} aria-label="Page précédente">‹</button>}
        <div className="book-root" style={{ transform: `translateX(${shift}px)` }}>
          <div ref={hostRef} className="flip-host" />
          {!layout && <div className="paginating">Mise en page du livre…</div>}
        </div>
        {dims.spread && <button className="nav-arrow next" onClick={() => flipRef.current?.flipNext()} disabled={page >= total - 1} aria-label="Page suivante">›</button>}
      </div>

      <footer className="reader-foot">
        <span className="foot-chapter">{currentChapter >= 0 && layout ? splitChapterTitle(layout.chapterTitles[currentChapter], currentChapter).title : meta.workTitle}</span>
        <input type="range" min={0} max={Math.max(0, total - 1)} value={page} onChange={(e) => goto(Number(e.target.value), false)} aria-label="Aller à la page" />
        <span className="foot-page">{total ? `${page} / ${total - 1}` : ''}</span>
      </footer>

      {tocOpen && layout && (
        <div className="drawer-backdrop" onClick={() => setTocOpen(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <h3>Sommaire</h3>
            <ol>
              {layout.chapterTitles.map((t, i) => {
                const { label, title } = splitChapterTitle(t, i);
                return (
                  <li key={i} className={i === currentChapter ? 'current' : ''}>
                    <button onClick={() => { setTocOpen(false); goto(layout.chapterStarts[i], Math.abs(layout.chapterStarts[i] - page) < 6); }}>
                      <small>{label}</small><span>{title}</span><em>{layout.chapterStarts[i]}</em>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}
