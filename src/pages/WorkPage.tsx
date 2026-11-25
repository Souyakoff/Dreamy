import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAdmin } from '../admin';
import type { VolumeMeta, Work } from '../types';
import { Book } from '../components/Book';
import { CoverPicker } from '../components/CoverPicker';
import { WorkEditDialog } from '../components/WorkForm';
import { toRoman } from '../import/structure';

const progressOf = (id: string): { page: number; total: number } | null => {
  try { const v = JSON.parse(localStorage.getItem(`dreamy:progress:${id}`) || 'null'); return v && v.total ? v : null; } catch { return null; }
};
const fmtWords = (n: number) => `${n.toLocaleString('fr-FR')} mots · ~${Math.max(1, Math.round(n / 230))} min`;

export function WorkPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { isAdmin, login } = useAdmin();
  const [work, setWork] = useState<Work | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editVol, setEditVol] = useState<VolumeMeta | null>(null);

  const load = useCallback(() => api.work(id).then(setWork).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const guard = async (fn: () => unknown) => { if (await login()) fn(); };

  if (error) return <div className="empty"><h2>Œuvre introuvable</h2><p>{error}</p><Link to="/">Retour à la bibliothèque</Link></div>;
  if (!work) return <div className="empty"><p>Chargement…</p></div>;

  const vols = work.volumes;
  const resume = vols.map((v) => ({ v, p: progressOf(v.id) })).filter((x) => x.p).pop();
  const totalWords = vols.reduce((n, v) => n + v.words, 0);
  const coverOf = (v: VolumeMeta) => v.cover || work.cover;

  return (
    <div className="work-page">
      <Link to="/" className="back-link">← Bibliothèque</Link>
      <section className="work-head">
        <div className="work-cover">
          <Book size="lg" info={{ title: work.title, subtitle: work.subtitle, author: work.author, fandom: work.fandom, image: work.cover || vols[0]?.cover }} />
        </div>
        <div className="work-info">
          {work.fandom && <div className="eyebrow">{work.fandom}</div>}
          <h1>{work.title}</h1>
          {work.subtitle && <div className="work-subtitle">{work.subtitle}</div>}
          <div className="work-author">par <strong>{work.author || 'Anonyme'}</strong></div>
          <div className="work-stats">
            <span className={`status status-${work.status.replace(/\s/g, '-')}`}>{work.status}</span>
            <span>{vols.length} tome{vols.length > 1 ? 's' : ''}</span>
            {totalWords > 0 && <span>{fmtWords(totalWords)}</span>}
          </div>
          {work.summary ? <p className="work-summary">{work.summary}</p> : <p className="work-summary muted">Pas encore de résumé.</p>}
          {work.tags?.length > 0 && <div className="chips">{work.tags.map((t) => <span className="chip static" key={t}>{t}</span>)}</div>}
          <div className="work-actions">
            {vols.length > 0 && (resume
              ? <Link className="btn btn-gold" to={`/lire/${resume.v.id}`}>Reprendre le tome {toRoman(resume.v.number)} · p. {resume.p!.page}</Link>
              : <Link className="btn btn-gold" to={`/lire/${vols[0].id}`}>Commencer la lecture</Link>)}
            <button className="btn" onClick={() => guard(() => nav(`/importer?work=${work.id}`))}>+ Ajouter un tome</button>
            <button className="btn" onClick={() => guard(() => setEditing(true))}>Modifier</button>
            <button className="btn btn-danger" onClick={() => guard(async () => {
              if (!window.confirm(`Supprimer « ${work.title} » et ses ${vols.length} tome(s) ? C’est définitif.`)) return;
              await api.deleteWork(work.id); nav('/');
            })}>Supprimer</button>
          </div>
        </div>
      </section>

      <section className="volumes">
        <h2 className="shelf-name"><span>Les</span> tomes</h2>
        {!vols.length && <p className="muted">Aucun tome pour l’instant. <button className="link-btn" onClick={() => guard(() => nav(`/importer?work=${work.id}`))}>Importer le premier</button></p>}
        <div className="shelf">
          <div className="shelf-books">
            {vols.map((v) => {
              const p = progressOf(v.id);
              return (
                <div className="volume-item" key={v.id}>
                  <Link to={`/lire/${v.id}`} className="shelf-item">
                    <Book size="md" info={{ title: work.title, author: work.author, fandom: work.fandom, volume: v.number, image: coverOf(v) }} />
                    {p && <div className="progress-bar"><i style={{ width: `${Math.min(100, (p.page / Math.max(1, p.total - 1)) * 100)}%` }} /></div>}
                  </Link>
                  <div className="shelf-label">
                    <strong>Tome {toRoman(v.number)}{v.title ? ` — ${v.title}` : ''}</strong>
                    <span>{v.chapterCount} chapitre{v.chapterCount > 1 ? 's' : ''} · {fmtWords(v.words)}</span>
                    {v.version && <span>Version {v.version}</span>}
                    <span className="vol-admin">
                      <button className="link-btn" onClick={() => guard(() => setEditVol(v))}>modifier</button>
                      <button className="link-btn" onClick={() => guard(() => nav(`/importer?volume=${v.id}`))}>remplacer le texte</button>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="shelf-board" />
        </div>
      </section>

      {editing && <WorkEditDialog work={work} onClose={() => setEditing(false)} onSave={async (p) => { await api.updateWork(work.id, p); setEditing(false); load(); }} />}
      {editVol && <VolumeEditDialog vol={editVol} onClose={() => setEditVol(null)} onSaved={() => { setEditVol(null); load(); }} isAdmin={isAdmin} />}
    </div>
  );
}

function VolumeEditDialog({ vol, onClose, onSaved }: { vol: VolumeMeta; onClose: () => void; onSaved: () => void; isAdmin: boolean }) {
  const [f, setF] = useState({ number: String(vol.number), title: vol.title, summary: vol.summary, version: vol.version, cover: vol.cover as string | null });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try {
          await api.updateVolume(vol.id, {
            number: Number(f.number) || 1, title: f.title, summary: f.summary, version: f.version,
            ...(f.cover?.startsWith('data:') ? { coverDataUrl: f.cover } : {}), ...(!f.cover && vol.cover ? { removeCover: true } : {}),
          });
          onSaved();
        } finally { setBusy(false); }
      }}>
        <h2>Modifier le tome {toRoman(vol.number)}</h2>
        <div className="form-grid">
          <label>Numéro<input type="number" min={1} value={f.number} onChange={set('number')} /></label>
          <label>Version<input value={f.version} onChange={set('version')} placeholder="1.0" /></label>
          <label className="span2">Titre du tome<input value={f.title} onChange={set('title')} placeholder="Chapitres I à X" /></label>
          <label className="span2">Résumé du tome<textarea rows={3} value={f.summary} onChange={set('summary')} /></label>
          <div className="span2"><CoverPicker value={f.cover} onChange={(cover) => setF({ ...f, cover })} label="Couverture du tome (sinon celle de l’œuvre)" /></div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-danger" onClick={async () => { if (window.confirm('Supprimer ce tome ?')) { await api.deleteVolume(vol.id); onSaved(); } }}>Supprimer le tome</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-gold" disabled={busy}>Enregistrer</button>
        </div>
      </form>
    </div>
  );
}
