import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Work } from '../types';
import { Book } from '../components/Book';

export function Library() {
  const [works, setWorks] = useState<Work[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [fandom, setFandom] = useState('');

  useEffect(() => { api.works().then(setWorks).catch((e) => setError(e.message)); }, []);

  const fandoms = useMemo(() => [...new Set((works || []).map((w) => w.fandom || 'Divers'))].sort((a, b) => a.localeCompare(b, 'fr')), [works]);
  const shelves = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (works || []).filter((w) => {
      if (fandom && (w.fandom || 'Divers') !== fandom) return false;
      if (!needle) return true;
      return [w.title, w.author, w.fandom, w.summary, ...(w.tags || [])].join(' ').toLowerCase().includes(needle);
    });
    const groups = new Map<string, Work[]>();
    for (const w of list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
      const k = w.fandom || 'Divers';
      groups.set(k, [...(groups.get(k) || []), w]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [works, q, fandom]);

  if (error) return <div className="empty"><h2>Impossible de charger la bibliothèque</h2><p>{error}</p></div>;
  if (!works) return <div className="empty"><p>Ouverture des portes de la bibliothèque…</p></div>;

  return (
    <div className="library">
      <section className="hero">
        <h1>La bibliothèque</h1>
        <p>{works.length ? `${works.length} œuvre${works.length > 1 ? 's' : ''} · ${works.reduce((n, w) => n + w.volumes.length, 0)} tome${works.reduce((n, w) => n + w.volumes.length, 0) > 1 ? 's' : ''}` : 'Les étagères attendent leurs premiers livres.'}</p>
        {works.length > 0 && (
          <div className="filters">
            <input className="search" placeholder="Rechercher un titre, un auteur, un tag…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="chips">
              <button className={!fandom ? 'chip active' : 'chip'} onClick={() => setFandom('')}>Tous les rayons</button>
              {fandoms.map((f) => <button key={f} className={fandom === f ? 'chip active' : 'chip'} onClick={() => setFandom(f)}>{f}</button>)}
            </div>
          </div>
        )}
      </section>

      {!works.length && (
        <div className="empty-shelf">
          <div className="shelf"><div className="shelf-books" /><div className="shelf-board" /></div>
          <Link to="/importer" className="btn btn-gold">Importer une première fan fiction</Link>
        </div>
      )}
      {works.length > 0 && !shelves.length && <div className="empty"><p>Aucun livre ne correspond à la recherche.</p></div>}

      {shelves.map(([name, list]) => (
        <section className="shelf-section" key={name}>
          <h2 className="shelf-name"><span>Rayon</span> {name}</h2>
          <div className="shelf">
            <div className="shelf-books">
              {list.map((w) => (
                <Link to={`/oeuvre/${w.id}`} className="shelf-item" key={w.id} title={w.title}>
                  <Book info={{ title: w.title, subtitle: w.subtitle, author: w.author, fandom: w.fandom, image: w.cover || w.volumes[0]?.cover }} />
                  <div className="shelf-label">
                    <strong>{w.title}</strong>
                    <span>{w.author || 'Anonyme'} · {w.volumes.length} tome{w.volumes.length > 1 ? 's' : ''}</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="shelf-board" />
          </div>
        </section>
      ))}
    </div>
  );
}
