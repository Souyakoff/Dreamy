import { coverHtml, type CoverInfo } from './cover';

/** Livre en 3D (couverture + tranche + pages) pour les étagères. */
export function Book({ info, size = 'md' }: { info: CoverInfo; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`book3d book-${size}`}>
      <div className="book3d-inner">
        <div className="book3d-front" dangerouslySetInnerHTML={{ __html: coverHtml(info) }} />
        <div className="book3d-pages" />
        <div className="book3d-back" />
      </div>
    </div>
  );
}
