import { useRef } from 'react';
import { fileToDataUrl } from '../api';

export function CoverPicker({ value, onChange, label = 'Couverture' }: { value: string | null; onChange: (v: string | null) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="cover-picker">
      <span className="field-label">{label}</span>
      <div className="cover-picker-row">
        <div className="cover-thumb" style={value ? { backgroundImage: `url('${value}')` } : undefined} onClick={() => input.current?.click()}>
          {!value && <span>Aucune<br />image</span>}
        </div>
        <div className="cover-picker-actions">
          <button type="button" className="btn" onClick={() => input.current?.click()}>Choisir une image…</button>
          {value && <button type="button" className="link-btn" onClick={() => onChange(null)}>Retirer</button>}
          <small>JPG, PNG ou WebP, format portrait (2:3 idéal). Sans image, une couverture est générée.</small>
        </div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        if (f) onChange(await fileToDataUrl(f));
        e.target.value = '';
      }} />
    </div>
  );
}
