import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { AdminProvider, useAdmin } from './admin';
import { Library } from './pages/Library';
import { WorkPage } from './pages/WorkPage';
import { ImportPage } from './pages/ImportPage';
import { ReaderPage } from './pages/ReaderPage';

function Shell({ children }: { children: React.ReactNode }) {
  const { isAdmin, authRequired, login, logout } = useAdmin();
  const loc = useLocation();
  if (loc.pathname.startsWith('/lire/')) return <>{children}</>;
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand"><span className="brand-mark">❦</span> Dreamy</Link>
        <nav>
          <Link to="/">Bibliothèque</Link>
          <Link to="/importer" className="btn btn-gold">+ Importer</Link>
          {authRequired && (isAdmin ? <button className="link-btn" onClick={logout}>Déconnexion</button> : <button className="link-btn" onClick={() => login()}>Connexion</button>)}
        </nav>
      </header>
      <main>{children}</main>
      <footer className="site-foot">Dreamy · bibliothèque de fan fictions · les œuvres appartiennent à leurs auteurs</footer>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AdminProvider>
        <Shell>
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/oeuvre/:id" element={<WorkPage />} />
            <Route path="/importer" element={<ImportPage />} />
            <Route path="/lire/:id" element={<ReaderPage />} />
            <Route path="*" element={<div className="empty"><h2>Page introuvable</h2><Link to="/">Retour à la bibliothèque</Link></div>} />
          </Routes>
        </Shell>
      </AdminProvider>
    </BrowserRouter>
  );
}
