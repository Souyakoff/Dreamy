import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageFlip } from 'page-flip';
import { anchorKey, paginate, pageForAnchor, splitChapterTitle, type BookMeta, type Layout } from './paginate';
import { pageSound } from './sound';
import { pagesToHtml } from './book';
import { ExportDialog } from '../components/ExportDialog';
import type { VolumeContent } from '../types';
import { THEMES, ensureThemeFonts, themeById } from '../themes';

const RATIO = 1.42; // hauteur / largeur d'une page
const TOP = 56, BOTTOM = 64;

interface Dims { w: number; h: number; spread: boolean; fs: number }

function computeDims(scale: number, textScale = 1): Dims {
  const vw = window.innerWidth, vh = window.innerHeight;
  const sideGutter = vw > 900 ? 72 : 12;
  const availW = vw - sideGutter * 2;
  const availH = vh - TOP - BOTTOM - 32;
  const spreadW = Math.floor(Math.min(availW / 2, availH / RATIO, 640));
  let w: number, spread: boolean;
  if (spreadW >= 300 && vw >= 820) { w = spreadW; spread = true; }
  else { w = Math.floor(Math.min(availW, availH / RATIO, 640)); spread = false; }
  const h = Math.floor(w * RATIO);
  const fs = Math.max(13, Math.min(22, w * 0.034)) * scale * textScale;
  return { w, h, spread, fs: Math.round(fs * 10) / 10 };
}

const storage = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

export interface Bookmark { id: string; anchor: string; chapter: number; excerpt: string; note: string; at: number }
interface Progress { anchor: string; page: number; total: number; at: number; closed?: boolean }

const plainText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

interface Props { volumeId: string; content: VolumeContent; meta: BookMeta; theme: string; workTheme: string; onThemeChange: (t: string | null) => void; onClose: () => void }

export function Reader({ volumeId, content, meta, theme, workTheme, onThemeChange, onClose }: Props) {
  const [scale, setScale] = useState(() => storage.get('dreamy:fontScale', 1));
  const [sound, setSound] = useState(() => storage.get('dreamy:sound', true));
  const textScale = themeById(theme).textScale;
  const [dims, setDims] = useState(() => computeDims(scale, textScale));
  const [themeOpen, setThemeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [page, setPage] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const progressKey = `dreamy:progress:${volumeId}`;
  const bookmarksKey = `dreamy:bookmarks:${volumeId}`;
  const savedProgress = useRef(storage.get<Progress | null>(progressKey, null));
  const anchorRef = useRef<string>(savedProgress.current?.anchor || 'start');
  // Le livre se rouvre fermé si on l'avait quitté fermé.
  const startClosedRef = useRef(Boolean(savedProgress.current?.closed));
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => storage.get(bookmarksKey, []));
  const [flipping, setFlipping] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'toc' | 'bm'>('toc');
  const soundRef = useRef(sound);
  soundRef.current = sound;

  // Recalcul des dimensions au redimensionnement.
  useEffect(() => {
    let t: number;
    const onResize = () => { clearTimeout(t); t = window.setTimeout(() => setDims(computeDims(scale, textScale)), 250); };
    setDims(computeDims(scale, textScale));
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(t); };
  }, [scale, textScale]);

  // Mise en page (après chargement des polices pour des mesures exactes).
  useEffect(() => {
    let cancelled = false;
    setLayout(null);
    (async () => {
      // Toutes les polices doivent être chargées, sinon les mesures sont fausses (texte coupé en bas de page).
      await ensureThemeFonts(theme);
      if (cancelled) return;
      const l = await paginate(content, meta, { width: dims.w, height: dims.h, fontSize: dims.fs, className: 'book-root', theme });
      if (!cancelled) setLayout(l);
    })();
    return () => { cancelled = true; };
  }, [content, meta, dims, theme]);

  const pagesHtml = useMemo(() => (layout ? pagesToHtml(layout, meta, dims.spread) : ''), [layout, dims.spread, meta]);

  /** Mémorise la page de lecture. Couverture et pages liminaires ne l'écrasent pas : on peut fermer le livre n'importe où. */
  const saveProgress = (idx: number) => {
    if (!layout) return;
    const p = layout.pages[idx];
    const prev = storage.get<Progress | null>(progressKey, null);
    if (idx === 0) {
      startClosedRef.current = true;
      storage.set(progressKey, { ...(prev || { anchor: 'start', page: 0, total: layout.pages.length }), closed: true, at: Date.now() });
      return;
    }
    startClosedRef.current = false;
    if (p && (anchorKey(p.anchor) || p.anchor === 'end')) {
      anchorRef.current = p.anchor;
      storage.set(progressKey, { anchor: p.anchor, page: idx, total: layout.pages.length, at: Date.now(), closed: false });
    } else if (prev?.closed) storage.set(progressKey, { ...prev, closed: false });
  };
  const saveProgressRef = useRef(saveProgress);
  saveProgressRef.current = saveProgress;

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
    const start = startClosedRef.current ? 0 : Math.min(pageForAnchor(layout.pages, anchorRef.current), layout.pages.length - 1);
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
      saveProgressRef.current(idx);
    });
    pf.on('changeState', (e) => {
      if (e.data === 'flipping' && soundRef.current) pageSound();
      // « fold_corner » = simple coin soulevé au survol : on garde les rubans visibles.
      setFlipping(e.data === 'flipping' || e.data === 'user_fold');
    });
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
    if (animate) pf.flip(n); else { pf.turnToPage(n); setPage(n); saveProgressRef.current(n); }
  }, []);

  const closeBook = () => { if (page !== 0) flipRef.current?.flip(0); };

  // Clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (exportOpen) { if (e.key === 'Escape') setExportOpen(false); return; }
      const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
      if (e.key === 'Escape') { if (tocOpen) setTocOpen(false); else if (themeOpen) setThemeOpen(false); else if (!typing) onClose(); return; }
      if (typing) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); flipRef.current?.flipNext(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); flipRef.current?.flipPrev(); }
      else if (e.key === 'Home') goto(0);
      else if (e.key === 'End' && layout) goto(layout.pages.length - 1);
      else if (e.key === 'm' || e.key === 'M') toggleCurrentRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goto, layout, tocOpen, themeOpen, exportOpen, onClose]);

  useEffect(() => { if (themeOpen) THEMES.forEach((t) => ensureThemeFonts(t.id)); }, [themeOpen]);

  const changeScale = (d: number) => {
    const s = Math.round(Math.max(0.8, Math.min(1.5, scale + d)) * 10) / 10;
    setScale(s); storage.set('dreamy:fontScale', s);
  };
  const toggleSound = () => { setSound(!sound); storage.set('dreamy:sound', !sound); };

  const total = layout?.pages.length ?? 0;
  const currentChapter = layout ? layout.pages[page]?.chapter ?? -1 : -1;
  // Position du livre : fermé, la couverture est centrée ; ouvert, la double page est centrée.
  const shift = dims.spread && layout ? (page === 0 ? -dims.w / 2 : page >= total - 1 ? dims.w / 2 : 0) : 0;

  // ---- Marque-pages ----
  const saveBookmarks = (list: Bookmark[]) => { setBookmarks(list); storage.set(bookmarksKey, list); };
  const bookmarkPage = (b: Bookmark) => (layout ? pageForAnchor(layout.pages, b.anchor) : -1);
  const canBookmark = (idx: number) => Boolean(layout && layout.pages[idx] && layout.pages[idx].kind === 'text' && anchorKey(layout.pages[idx].anchor));
  const bookmarkAt = (idx: number) => bookmarks.find((b) => bookmarkPage(b) === idx);
  const toggleBookmark = (idx: number) => {
    if (!layout || !canBookmark(idx)) return;
    const existing = bookmarkAt(idx);
    if (existing) return saveBookmarks(bookmarks.filter((b) => b !== existing));
    const pg = layout.pages[idx];
    const excerpt = plainText(pg.body.replace(/<header class="chapter-opener">[\s\S]*?<\/header>/, '').replace(/<h3[^>]*>[\s\S]*?<\/h3>/g, ' ')).slice(0, 110);
    saveBookmarks([...bookmarks, { id: Math.random().toString(36).slice(2, 10), anchor: pg.anchor, chapter: pg.chapter, excerpt, note: '', at: Date.now() }]
      .sort((a, b) => bookmarkPage(a) - bookmarkPage(b)));
  };
  // Pages visibles (en double page, l'index de page-flip désigne la page de gauche).
  const visible: { idx: number; side: 'left' | 'right' }[] = !layout ? [] : !dims.spread ? [{ idx: page, side: 'right' }]
    : page === 0 ? [{ idx: 0, side: 'right' }]
    : (() => { const l = page % 2 === 1 ? page : page - 1; return [{ idx: l, side: 'left' as const }, ...(l + 1 < total ? [{ idx: l + 1, side: 'right' as const }] : [])]; })();
  const visibleMarked = visible.filter((v) => bookmarkAt(v.idx));
  const toggleCurrent = () => {
    if (visibleMarked.length) return saveBookmarks(bookmarks.filter((b) => !visibleMarked.some((v) => bookmarkPage(b) === v.idx)));
    const target = visible.find((v) => canBookmark(v.idx));
    if (target) toggleBookmark(target.idx);
  };
  const toggleCurrentRef = useRef(toggleCurrent);
  toggleCurrentRef.current = toggleCurrent;
  const resumePage = layout ? pageForAnchor(layout.pages, anchorRef.current) : 0;
  const isClosed = page === 0 && Boolean(layout);

  return (
    <div className="reader">
      <header className="reader-bar">
        <button className="icon-btn" onClick={onClose} title="Retour (Échap)">←</button>
        <div className="reader-title">
          <strong>{meta.workTitle}</strong>
          <span>{meta.volumeNumber ? `Tome ${meta.volumeNumber}` : ''}{meta.volumeTitle ? ` · ${meta.volumeTitle}` : ''}</span>
        </div>
        <div className="reader-tools">
          <button className="icon-btn" onClick={() => { setDrawerTab('toc'); setTocOpen(true); }} title="Sommaire et marque-pages">☰</button>
          <button className={`icon-btn ${visibleMarked.length ? 'active' : ''}`} onClick={toggleCurrent} disabled={!visible.some((v) => canBookmark(v.idx))} title={visibleMarked.length ? 'Retirer le marque-page (M)' : 'Ajouter un marque-page (M)'}>🔖</button>
          <button className="icon-btn" onClick={closeBook} disabled={isClosed} title="Fermer le livre">📕</button>
          <button className="icon-btn" onClick={() => setThemeOpen(!themeOpen)} title="Thème">🎨</button>
          <button className="icon-btn" onClick={() => changeScale(-0.1)} title="Texte plus petit">A−</button>
          <button className="icon-btn" onClick={() => changeScale(0.1)} title="Texte plus grand">A+</button>
          <button className="icon-btn" onClick={toggleSound} title="Son des pages">{sound ? '🔊' : '🔈'}</button>
          <button className="icon-btn hide-sm" onClick={() => setExportOpen(true)} title="Exporter ce tome en PDF">⬇</button>
          <button className="icon-btn hide-sm" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())} title="Plein écran">⛶</button>
        </div>
      </header>

      <div className="reader-stage" style={{ '--page-w': `${dims.w}px`, '--page-h': `${dims.h}px`, '--fs': `${dims.fs}px` } as React.CSSProperties}>
        {dims.spread && <button className="nav-arrow prev" onClick={() => flipRef.current?.flipPrev()} disabled={page === 0} aria-label="Page précédente">‹</button>}
        <div className="book-root" data-theme={theme} style={{ transform: `translateX(${shift}px)` }}>
          <div ref={hostRef} className="flip-host" />
          {!layout && <div className="paginating">Mise en page du livre…</div>}
          {layout && !flipping && visible.map((v) => canBookmark(v.idx) && (
            <button key={v.idx} className={`ribbon ${v.side} ${bookmarkAt(v.idx) ? 'on' : ''}`}
              style={{ left: (dims.spread && v.side === 'right' ? dims.w : 0) + (v.side === 'right' ? dims.w * 0.86 : dims.w * 0.08) }}
              onClick={() => toggleBookmark(v.idx)}
              onMouseMove={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} title={bookmarkAt(v.idx) ? 'Retirer le marque-page' : 'Poser un marque-page ici'} aria-label="Marque-page" />
          ))}
          {isClosed && !flipping && (
            <div className="cover-actions" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onMouseMove={(e) => e.stopPropagation()} style={{ left: dims.spread ? dims.w : 0, width: dims.w }}>
              {resumePage > 2 && <button className="btn btn-gold" onClick={() => goto(resumePage)}>Reprendre · p. {resumePage}</button>}
              <button className="btn" onClick={() => flipRef.current?.flipNext()}>{resumePage > 2 ? 'Depuis le début' : 'Ouvrir le livre'}</button>
              {bookmarks.length > 0 && <button className="link-btn" onClick={() => { setDrawerTab('bm'); setTocOpen(true); }}>🔖 {bookmarks.length} marque-page{bookmarks.length > 1 ? 's' : ''}</button>}
            </div>
          )}
        </div>
        {dims.spread && <button className="nav-arrow next" onClick={() => flipRef.current?.flipNext()} disabled={page >= total - 1} aria-label="Page suivante">›</button>}
      </div>

      <footer className="reader-foot">
        <span className="foot-chapter">{isClosed ? 'Livre fermé' : currentChapter >= 0 && layout ? splitChapterTitle(layout.chapterTitles[currentChapter], currentChapter).title : meta.workTitle}</span>
        <div className="slider">
          <input type="range" min={0} max={Math.max(0, total - 1)} value={page} onChange={(e) => goto(Number(e.target.value), false)} aria-label="Aller à la page" />
          {total > 1 && bookmarks.map((b) => {
            const bp = bookmarkPage(b);
            return <button key={b.id} className="slider-tick" style={{ left: `calc(8px + (100% - 16px) * ${bp / (total - 1)})` }} title={`Marque-page · p. ${bp}`} onClick={() => goto(bp, Math.abs(bp - page) < 6)} />;
          })}
        </div>
        <span className="foot-page">{total ? `${page} / ${total - 1}` : ''}</span>
      </footer>

      {exportOpen && <ExportDialog kind="tome" id={volumeId} title={`${meta.workTitle}${meta.volumeNumber ? ` — Tome ${meta.volumeNumber}` : ''}`} theme={theme} onClose={() => setExportOpen(false)} />}

      {themeOpen && (
        <div className="popover-backdrop" onClick={() => setThemeOpen(false)}>
          <div className="theme-popover" onClick={(e) => e.stopPropagation()}>
            <h4>Thème de lecture</h4>
            <div className="theme-grid compact">
              {THEMES.map((t) => (
                <button key={t.id} className={`theme-card ${t.id === theme ? 'active' : ''}`} data-theme={t.id} onClick={() => { setThemeOpen(false); onThemeChange(t.id === workTheme ? null : t.id); }}>
                  <span className="theme-swatch" style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 0 45%, ${t.swatch[1]} 45% 80%, ${t.swatch[2]} 80%)` }} />
                  <strong>{t.name}</strong>
                  {t.id === workTheme && <small>thème de l’œuvre</small>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tocOpen && layout && (
        <div className="drawer-backdrop" onClick={() => setTocOpen(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-tabs">
              <button className={drawerTab === 'toc' ? 'active' : ''} onClick={() => setDrawerTab('toc')}>Sommaire</button>
              <button className={drawerTab === 'bm' ? 'active' : ''} onClick={() => setDrawerTab('bm')}>Marque-pages{bookmarks.length ? ` (${bookmarks.length})` : ''}</button>
            </div>
            {drawerTab === 'bm' && (
              <div className="bm-list">
                {!bookmarks.length && <p className="muted bm-empty">Aucun marque-page pour l’instant. Clique sur le coin supérieur d’une page, sur 🔖, ou appuie sur <kbd>M</kbd> pour en poser un.</p>}
                {bookmarks.map((b) => {
                  const bp = bookmarkPage(b);
                  const ch = b.chapter >= 0 && layout.chapterTitles[b.chapter] ? splitChapterTitle(layout.chapterTitles[b.chapter], b.chapter) : null;
                  return (
                    <div className="bm-item" key={b.id}>
                      <button className="bm-go" onClick={() => { setTocOpen(false); goto(bp, Math.abs(bp - page) < 6); }}>
                        <small>{ch ? ch.label || ch.title : ''} · p. {bp}</small>
                        <span>{b.note || `« ${b.excerpt}… »`}</span>
                        {b.note && <em>« {b.excerpt}… »</em>}
                      </button>
                      <div className="bm-actions">
                        <input placeholder="Ajouter une note…" value={b.note} onChange={(e) => saveBookmarks(bookmarks.map((x) => (x.id === b.id ? { ...x, note: e.target.value } : x)))} />
                        <button className="icon-btn" title="Supprimer" onClick={() => saveBookmarks(bookmarks.filter((x) => x.id !== b.id))}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {drawerTab === 'toc' && <ol>
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
            </ol>}
          </aside>
        </div>
      )}
    </div>
  );
}
