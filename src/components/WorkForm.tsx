import { useState } from 'react';
import type { Work } from '../types';
import { CoverPicker } from './CoverPicker';

export interface WorkFields { title: string; subtitle: string; author: string; fandom: string; summary: string; tags: string; status: string; cover: string | null }

export const workToFields = (w?: Partial<Work>): WorkFields => ({
  title: w?.title || '', subtitle: w?.subtitle || '', author: w?.author || '', fandom: w?.fandom || '',
  summary: w?.summary || '', tags: (w?.tags || []).join(', '), status: w?.status || 'en cours', cover: w?.cover || null,
});

export const fieldsToPayload = (f: WorkFields, original?: string | null) => ({
  title: f.title.trim() || 'Sans titre', subtitle: f.subtitle.trim(), author: f.author.trim(), fandom: f.fandom.trim(),
  summary: f.summary.trim(), status: f.status, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
  ...(f.cover && f.cover.startsWith('data:') ? { coverDataUrl: f.cover } : {}),
  ...(!f.cover && original ? { removeCover: true } : {}),
});

export function WorkFieldsEditor({ value, onChange }: { value: WorkFields; onChange: (v: WorkFields) => void }) {
  const set = (k: keyof WorkFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="form-grid">
      <label>Titre de l’œuvre<input value={value.title} onChange={set('title')} required /></label>
      <label>Sous-titre<input value={value.subtitle} onChange={set('subtitle')} placeholder="facultatif" /></label>
      <label>Auteur·ice<input value={value.author} onChange={set('author')} placeholder="Pseudo" /></label>
      <label>Univers (fandom)<input value={value.fandom} onChange={set('fandom')} placeholder="Fallout, Harry Potter…" /></label>
      <label className="span2">Résumé<textarea rows={4} value={value.summary} onChange={set('summary')} placeholder="Le texte de la quatrième de couverture" /></label>
      <label>Tags<input value={value.tags} onChange={set('tags')} placeholder="action, romance, post-apo" /></label>
      <label>Statut<select value={value.status} onChange={set('status')}><option value="en cours">En cours</option><option value="terminée">Terminée</option><option value="en pause">En pause</option></select></label>
      <div className="span2"><CoverPicker value={value.cover} onChange={(cover) => onChange({ ...value, cover })} label="Couverture de l’œuvre" /></div>
    </div>
  );
}

export function WorkEditDialog({ work, onSave, onClose }: { work: Work; onSave: (p: ReturnType<typeof fieldsToPayload>) => Promise<void>; onClose: () => void }) {
  const [f, setF] = useState(workToFields(work));
  const [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSave(fieldsToPayload(f, work.cover)); } finally { setBusy(false); } }}>
        <h2>Modifier l’œuvre</h2>
        <WorkFieldsEditor value={f} onChange={setF} />
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Annuler</button><button className="btn btn-gold" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div>
      </form>
    </div>
  );
}
