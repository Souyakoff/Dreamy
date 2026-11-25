import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Volume } from '../types';
import { Reader } from '../reader/Reader';
import { coverHtml } from '../components/cover';
import type { BookMeta } from '../reader/paginate';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function ReaderPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [vol, setVol] = useState<Volume | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setVol(null); api.volume(id).then(setVol).catch((e) => setError(e.message)); }, [id]);

  const meta = useMemo<BookMeta | null>(() => {
    if (!vol) return null;
    const w = vol.work;
    const summary = vol.summary || w.summary;
    return {
      workTitle: w.title, workSubtitle: w.subtitle, author: w.author, fandom: w.fandom,
      volumeNumber: vol.number, volumeTitle: vol.title, summary, version: vol.version,
      coverHtml: coverHtml({ title: w.title, subtitle: w.subtitle, author: w.author, fandom: w.fandom, volume: vol.number, image: vol.cover || w.cover }),
      backHtml: `<div class="back-cover"><div class="bc-title">${esc(w.title)}</div>${summary ? `<p class="bc-summary">${esc(summary)}</p>` : ''}<div class="bc-meta">${[w.author, w.fandom].filter(Boolean).map((x) => esc(x!)).join(' · ')}</div><div class="bc-brand">❦ Dreamy</div></div>`,
    };
  }, [vol]);

  useEffect(() => {
    document.body.classList.add('reading');
    return () => document.body.classList.remove('reading');
  }, []);

  if (error) return <div className="empty"><h2>Tome introuvable</h2><p>{error}</p><Link to="/">Retour</Link></div>;
  if (!vol || !meta) return <div className="reader"><div className="paginating">Ouverture du livre…</div></div>;
  return <Reader volumeId={vol.id} content={vol.content} meta={meta} onClose={() => nav(`/oeuvre/${vol.workId}`)} />;
}
