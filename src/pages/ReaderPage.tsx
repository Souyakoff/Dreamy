import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Volume } from '../types';
import { Reader } from '../reader/Reader';
import { coverHtml } from '../components/cover';
import type { BookMeta } from '../reader/paginate';
import { applyDocumentTheme, resolveTheme, themeTitle } from '../themes';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function ReaderPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [vol, setVol] = useState<Volume | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setVol(null); api.volume(id).then(setVol).catch((e) => setError(e.message)); }, [id]);

  // Thème : celui de l'œuvre, sauf si le lecteur en a choisi un autre pour cette œuvre.
  const workTheme = vol ? resolveTheme(vol.work) : 'classique';
  const overrideKey = vol ? `dreamy:theme:${vol.workId}` : '';
  const [override, setOverride] = useState<string | null>(null);
  useEffect(() => { if (overrideKey) { try { setOverride(JSON.parse(localStorage.getItem(overrideKey) || 'null')); } catch { setOverride(null); } } }, [overrideKey]);
  const theme = override || workTheme;
  useEffect(() => { applyDocumentTheme(theme); }, [theme]);
  const changeTheme = (t: string | null) => {
    setOverride(t);
    try { if (t) localStorage.setItem(overrideKey, JSON.stringify(t)); else localStorage.removeItem(overrideKey); } catch { /* ignore */ }
  };

  const meta = useMemo<BookMeta | null>(() => {
    if (!vol) return null;
    const w = vol.work;
    const summary = vol.summary || w.summary;
    return {
      workTitle: themeTitle(w.title, theme), workSubtitle: w.subtitle, author: w.author, fandom: w.fandom,
      volumeNumber: vol.number, volumeTitle: vol.title, summary, version: vol.version,
      coverHtml: coverHtml({ title: w.title, subtitle: w.subtitle, author: w.author, fandom: w.fandom, volume: vol.number, image: vol.cover || w.cover, theme }),
      backHtml: `<div class="back-cover"><div class="bc-title">${esc(themeTitle(w.title, theme))}</div>${summary ? `<p class="bc-summary">${esc(summary)}</p>` : ''}<div class="bc-meta">${[w.author, w.fandom].filter(Boolean).map((x) => esc(x!)).join(' · ')}</div><div class="bc-brand">Dreamy</div></div>`,
    };
  }, [vol, theme]);

  useEffect(() => {
    document.body.classList.add('reading');
    return () => document.body.classList.remove('reading');
  }, []);

  if (error) return <div className="empty"><h2>Tome introuvable</h2><p>{error}</p><Link to="/">Retour</Link></div>;
  if (!vol || !meta) return <div className="reader"><div className="paginating">Ouverture du livre…</div></div>;
  return <Reader volumeId={vol.id} content={vol.content} meta={meta} theme={theme} workTheme={workTheme} onThemeChange={changeTheme} onClose={() => nav(`/oeuvre/${vol.workId}`)} />;
}
