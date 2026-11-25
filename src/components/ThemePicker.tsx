import { THEMES, themeById, ensureThemeFonts } from '../themes';
import { useEffect } from 'react';

/** Grille de thèmes ; value '' = automatique (deviné depuis l'univers). */
export function ThemePicker({ value, guessed, onChange }: { value: string; guessed: string; onChange: (v: string) => void }) {
  useEffect(() => { THEMES.forEach((t) => ensureThemeFonts(t.id)); }, []);
  return (
    <div className="theme-picker">
      <span className="field-label">Thème visuel <small>— {value ? themeById(value).tagline : `automatique : ${themeById(guessed).name}`}</small></span>
      <div className="theme-grid">
        <button type="button" className={`theme-card ${!value ? 'active' : ''}`} data-theme={guessed} onClick={() => onChange('')}>
          <span className="theme-swatch auto">Auto</span>
          <strong>Automatique</strong>
          <small>{themeById(guessed).name}</small>
        </button>
        {THEMES.map((t) => (
          <button type="button" key={t.id} className={`theme-card ${value === t.id ? 'active' : ''}`} data-theme={t.id} onClick={() => onChange(t.id)} title={t.tagline}>
            <span className="theme-swatch" style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 0 45%, ${t.swatch[1]} 45% 80%, ${t.swatch[2]} 80%)` }} />
            <strong>{t.name}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
