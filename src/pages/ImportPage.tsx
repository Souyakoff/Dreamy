import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAdmin } from '../admin';
import { applyDocumentTheme } from '../themes';
import type { Volume, Work } from '../types';
import { importFile, toRoman, type ImportDraft } from '../import/structure';
import { WorkFieldsEditor, fieldsToPayload, workToFields, type WorkFields } from '../components/WorkForm';
import { CoverPicker } from '../components/CoverPicker';

const words = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const plain = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/** « FALLOUT: LAZARUS » → univers « Fallout » */
function guessFandom(title: string) {
  const m = /^([^:–—]+)\s*[:–—]\s*\S/.exec(title);
  return m ? titleCase(m[1].trim()) : '';
}

export function ImportPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { isAdmin, authRequired, login } = useAdmin();
  const replaceId = params.get('volume');
  const [works, setWorks] = useState<Work[]>([]);
  const [replacing, setReplacing] = useState<Volume | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [include, setInclude] = useState<boolean[]>([]);
  const [keepFront, setKeepFront] = useState(true);
  const [target, setTarget] = useState<string>(params.get('work') || 'new');
  const [wf, setWf] = useState<WorkFields>(workToFields());
  const [vf, setVf] = useState({ number: '1', title: '', version: '', summary: '', cover: null as string | null });
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);

  useEffect(() => { api.works().then(setWorks).catch(() => {}); applyDocumentTheme('classique'); }, []);
  useEffect(() => { if (replaceId) api.volume(replaceId).then(setReplacing).catch((e) => setError(e.message)); }, [replaceId]);

  const nextNumber = (workId: string) => Math.max(0, ...(works.find((w) => w.id === workId)?.volumes.map((v) => v.number) || [])) + 1;

  const onFile = async (file: File) => {
    setError(''); setDraft(null); setParsing(true); setFileName(file.name);
    try {
      const d = await importFile(file);
      if (!d.content.chapters.length) throw new Error('Aucun texte n’a été trouvé dans ce fichier.');
      setDraft(d);
      setInclude(d.content.chapters.map(() => true));
      const title = d.workTitle || file.name.replace(/\.(docx|pdf)$/i, '').replace(/[_-]+/g, ' ');
      const existing = !params.get('work') && works.find((w) => w.title.trim().toLowerCase() === title.trim().toLowerCase());
      if (existing) setTarget(existing.id);
      setWf((f) => ({ ...f, title, subtitle: d.workSubtitle, fandom: guessFandom(title) || f.fandom }));
      const wid = existing ? existing.id : params.get('work');
      setVf((v) => ({ ...v, title: d.volumeTitle, version: d.version.split(/\s*[•·|]\s*/)[0] || '', number: String(d.volumeNumber ?? (wid ? nextNumber(wid) : 1)) }));
    } catch (e) {
      setError((e as Error).message || 'Lecture du fichier impossible.');
    } finally { setParsing(false); }
  };

  const setChapterTitle = (i: number, title: string) => {
    if (!draft) return;
    const chapters = draft.content.chapters.map((c, j) => (j === i ? { ...c, title } : c));
    setDraft({ ...draft, content: { ...draft.content, chapters } });
  };

  const existingVolume = target !== 'new' ? works.find((w) => w.id === target)?.volumes.find((v) => v.number === Number(vf.number)) : undefined;

  const save = async () => {
    if (!draft) return;
    if (authRequired && !isAdmin && !(await login())) return;
    setSaving(true); setError('');
    try {
      const content = { front: keepFront ? draft.content.front : [], chapters: draft.content.chapters.filter((_, i) => include[i]) };
      if (!content.chapters.length) throw new Error('Sélectionne au moins un chapitre.');
      if (replacing) {
        await api.updateVolume(replacing.id, { content, ...(vf.version ? { version: vf.version } : {}) });
        nav(`/oeuvre/${replacing.workId}`);
        return;
      }
      if (existingVolume && updateExisting) {
        await api.updateVolume(existingVolume.id, { content, ...(vf.version ? { version: vf.version } : {}), ...(vf.title ? { title: vf.title.trim() } : {}) });
        nav(`/oeuvre/${target}`);
        return;
      }
      let workId = target;
      if (target === 'new') workId = (await api.createWork(fieldsToPayload(wf))).id;
      await api.createVolume(workId, {
        number: Number(vf.number) || 1, title: vf.title.trim(), version: vf.version.trim(), summary: vf.summary.trim(), content,
        ...(vf.cover ? { coverDataUrl: vf.cover } : {}),
      });
      nav(`/oeuvre/${workId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally { setSaving(false); }
  };

  const totalWords = draft ? draft.content.chapters.reduce((n, c, i) => n + (include[i] ? c.blocks.reduce((m, b) => m + words(b.html), 0) : 0), 0) : 0;

  return (
    <div className="import-page">
      <Link to={replacing ? `/oeuvre/${replacing.workId}` : '/'} className="back-link">← Retour</Link>
      <h1>{replacing ? `Remplacer le texte du tome ${toRoman(replacing.number)}` : 'Importer une fan fiction'}</h1>
      {replacing && <p className="muted">« {replacing.work.title} » — la couverture et les informations du tome sont conservées, seul le texte est remplacé (pratique pour une nouvelle version avec des chapitres en plus).</p>}

      <label className={`dropzone ${drag ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
        <input type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        <div className="dz-icon">📜</div>
        <strong>{parsing ? 'Lecture du manuscrit…' : fileName ? `${fileName} — choisir un autre fichier` : 'Dépose ton manuscrit ici ou clique pour le choisir'}</strong>
        <span>Word (.docx) ou PDF. Les styles « Titre 1 » deviennent des chapitres, « Titre 2 » des intertitres de scène.</span>
      </label>

      {error && <div className="alert">{error}</div>}

      {draft && (
        <div className="import-grid">
          <section className="panel">
            <h2>Chapitres détectés</h2>
            <p className="muted">{draft.content.chapters.length} chapitres · {totalWords.toLocaleString('fr-FR')} mots sélectionnés. Tu peux renommer ou décocher.</p>
            {draft.content.front.length > 0 && (
              <label className="check-row">
                <input type="checkbox" checked={keepFront} onChange={(e) => setKeepFront(e.target.checked)} />
                <span><strong>Avant-propos</strong><small>{plain(draft.content.front[0].html).slice(0, 140)}…</small></span>
              </label>
            )}
            <ol className="chapter-list">
              {draft.content.chapters.map((c, i) => (
                <li key={i} className={include[i] ? '' : 'off'}>
                  <input type="checkbox" checked={include[i]} onChange={(e) => setInclude(include.map((v, j) => (j === i ? e.target.checked : v)))} />
                  <div>
                    <input className="ch-input" value={c.title} onChange={(e) => setChapterTitle(i, e.target.value)} />
                    <small>{c.blocks.reduce((n, b) => n + words(b.html), 0).toLocaleString('fr-FR')} mots · {plain(c.blocks.find((b) => b.t === 'p')?.html || '').slice(0, 110)}…</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel">
            {!replacing && (
              <>
                <h2>Œuvre</h2>
                <label className="field">Ajouter ce tome à…
                  <select value={target} onChange={(e) => { setTarget(e.target.value); if (e.target.value !== 'new') setVf({ ...vf, number: String(draft.volumeNumber ?? nextNumber(e.target.value)) }); }}>
                    <option value="new">➕ Une nouvelle œuvre</option>
                    {works.map((w) => <option key={w.id} value={w.id}>{w.title} ({w.volumes.length} tome{w.volumes.length > 1 ? 's' : ''})</option>)}
                  </select>
                </label>
                {target === 'new' && <WorkFieldsEditor value={wf} onChange={setWf} />}
              </>
            )}
            <h2>Tome</h2>
            <div className="form-grid">
              {!replacing && <label>Numéro du tome<input type="number" min={1} value={vf.number} onChange={(e) => setVf({ ...vf, number: e.target.value })} /></label>}
              <label>Version<input value={vf.version} onChange={(e) => setVf({ ...vf, version: e.target.value })} placeholder="1.0" /></label>
              {!replacing && <>
                <label className="span2">Titre du tome<input value={vf.title} onChange={(e) => setVf({ ...vf, title: e.target.value })} placeholder="ex. Chapitres I à X" /></label>
                <label className="span2">Résumé du tome<textarea rows={3} value={vf.summary} onChange={(e) => setVf({ ...vf, summary: e.target.value })} placeholder="facultatif — sinon le résumé de l’œuvre est utilisé" /></label>
                <div className="span2"><CoverPicker value={vf.cover} onChange={(cover) => setVf({ ...vf, cover })} label="Couverture propre à ce tome (facultatif)" /></div>
              </>}
            </div>
            {existingVolume && (
              <label className="check-row notice">
                <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
                <span><strong>Le tome {toRoman(existingVolume.number)} existe déjà{existingVolume.version ? ` (version ${existingVolume.version})` : ''}</strong>
                  <small>Coché : son texte est mis à jour (couverture et progression de lecture conservées). Décoché : un nouveau tome est créé.</small></span>
              </label>
            )}
            <div className="save-row">
              <button className="btn btn-gold big" onClick={save} disabled={saving}>{saving ? 'Mise en rayon…' : replacing || (existingVolume && updateExisting) ? 'Mettre à jour le tome' : 'Ranger dans la bibliothèque'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
