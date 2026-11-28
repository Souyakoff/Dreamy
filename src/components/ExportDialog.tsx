import { useState } from 'react';
import { THEMES, themeById } from '../themes';
import { PRINT_SIZES, type PrintSize } from '../pages/PrintPage';

interface Props { kind: 'tome' | 'oeuvre'; id: string; title: string; theme: string; onClose: () => void }

/** Fenêtre d'export PDF : format, thème, économie d'encre, puis téléchargement. */
export function ExportDialog({ kind, id, title, theme, onClose }: Props) {
  const [size, setSize] = useState<PrintSize>('a5');
  const [t, setT] = useState(theme);
  const [ink, setInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const query = () => new URLSearchParams({ size, theme: t, ...(ink ? { ink: '1' } : {}) }).toString();

  const download = async () => {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/export/${kind}/${id}.pdf?${query()}`);
      if (res.status === 501) {
        // Pas de navigateur côté serveur : on passe par l'impression du navigateur.
        window.open(`/imprimer/${kind}/${id}?${query()}&print=1`, '_blank');
        setMsg('Ton navigateur va ouvrir la fenêtre d’impression : choisis « Enregistrer au format PDF ».');
        return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Erreur ${res.status}`);
      const blob = await res.blob();
      const name = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(res.headers.get('content-disposition') || '')?.[1];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name ? decodeURIComponent(name) : 'livre.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      onClose();
    } catch (e) {
      setMsg((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal export-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Exporter en PDF</h2>
        <p className="muted">{title}</p>
        <span className="field-label">Format</span>
        <div className="seg">
          {(Object.keys(PRINT_SIZES) as PrintSize[]).map((k) => (
            <button key={k} type="button" className={size === k ? 'active' : ''} onClick={() => setSize(k)}>{PRINT_SIZES[k].label}</button>
          ))}
        </div>
        <label className="field">Thème
          <select value={t} onChange={(e) => setT(e.target.value)}>
            {THEMES.map((x) => <option key={x.id} value={x.id}>{x.name}{x.id === theme ? ' (actuel)' : ''}</option>)}
          </select>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={ink} onChange={(e) => setInk(e.target.checked)} />
          <span><strong>Économie d’encre</strong><small>Pages blanches sans textures, idéal pour imprimer{['darkfantasy', 'cyberpunk'].includes(t) ? ` (recommandé avec le thème ${themeById(t).name}, aux pages sombres)` : ''}.</small></span>
        </label>
        {msg && <div className="alert">{msg}</div>}
        <div className="modal-actions">
          <a className="link-btn" href={`/imprimer/${kind}/${id}?${query()}`} target="_blank" rel="noreferrer">Aperçu</a>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="btn btn-gold" onClick={download} disabled={busy}>{busy ? (kind === 'oeuvre' ? 'Génération de l’œuvre…' : 'Génération du PDF…') : '⬇ Télécharger le PDF'}</button>
        </div>
        {busy && <p className="muted export-wait">Mise en page de chaque page puis création du fichier : quelques secondes{kind === 'oeuvre' ? ', un peu plus pour une œuvre entière' : ''}.</p>}
      </div>
    </div>
  );
}
