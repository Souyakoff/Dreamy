import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Volume } from '../types';
import { Reader } from '../reader/Reader';
import { buildMeta } from '../reader/book';
import type { BookMeta } from '../reader/paginate';
import { applyDocumentTheme, resolveTheme } from '../themes';

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

  const meta = useMemo<BookMeta | null>(() => (vol ? buildMeta(vol, theme) : null), [vol, theme]);

  useEffect(() => {
    document.body.classList.add('reading');
    return () => document.body.classList.remove('reading');
  }, []);

  if (error) return <div className="empty"><h2>Tome introuvable</h2><p>{error}</p><Link to="/">Retour</Link></div>;
  if (!vol || !meta) return <div className="reader"><div className="paginating">Ouverture du livre…</div></div>;
  return <Reader volumeId={vol.id} content={vol.content} meta={meta} theme={theme} workTheme={workTheme} onThemeChange={changeTheme} onClose={() => nav(`/oeuvre/${vol.workId}`)} />;
}
