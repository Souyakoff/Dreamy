import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import * as store from './store.js';
import { renderPdf } from './pdf.js';

const PORT = Number(process.env.PORT || 5173);
const PROD = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const app = express();
app.use(express.json({ limit: '40mb' }));

const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const isAdmin = (req) => !ADMIN_PASSWORD || safeEq(req.get('x-admin-password') || '', ADMIN_PASSWORD);
const admin = (req, res, next) => (isAdmin(req) ? next() : res.status(401).json({ error: 'Mot de passe administrateur requis' }));
const wrap = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res);
    if (out === null || out === false) return res.status(404).json({ error: 'Introuvable' });
    if (out !== undefined) res.json(out);
  } catch (e) { next(e); }
};

const api = express.Router();
api.get('/config', (req, res) => res.json({ authRequired: Boolean(ADMIN_PASSWORD), isAdmin: isAdmin(req) }));
api.get('/works', wrap(() => store.listWorks()));
api.get('/works/:id', wrap((req) => store.getWork(req.params.id)));
api.post('/works', admin, wrap((req) => store.createWork(req.body)));
api.patch('/works/:id', admin, wrap((req) => store.updateWork(req.params.id, req.body)));
api.delete('/works/:id', admin, wrap((req) => store.deleteWork(req.params.id) && { ok: true }));
api.post('/works/:id/volumes', admin, wrap((req) => store.createVolume(req.params.id, req.body)));
api.get('/volumes/:id', wrap((req) => store.getVolume(req.params.id)));
api.patch('/volumes/:id', admin, wrap((req) => store.updateVolume(req.params.id, req.body)));
api.delete('/volumes/:id', admin, wrap((req) => store.deleteVolume(req.params.id) && { ok: true }));

// Export PDF d'un tome ou d'une œuvre entière.
const slug = (s) => String(s || 'livre').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'livre';
api.get('/export/:kind/:id.pdf', async (req, res, next) => {
  try {
    const { kind, id } = req.params;
    let name, version;
    if (kind === 'tome') {
      const v = store.getVolume(id);
      if (!v) return res.status(404).json({ error: 'Tome introuvable' });
      name = `${slug(v.work.title)}-Tome-${v.number}`;
      version = `${v.updatedAt}${v.work.updatedAt}`;
    } else if (kind === 'oeuvre') {
      const w = store.getWork(id);
      if (!w) return res.status(404).json({ error: 'Œuvre introuvable' });
      if (!w.volumes.length) return res.status(400).json({ error: 'Cette œuvre n’a pas encore de tome.' });
      name = slug(w.title);
      version = `${w.updatedAt}${w.volumes.map((v) => v.updatedAt).join('')}`;
    } else return res.status(404).json({ error: 'Type inconnu' });
    const file = await renderPdf({
      kind: kind === 'tome' ? 'volume' : 'work', id, version,
      size: String(req.query.size || 'a5'), theme: String(req.query.theme || ''), ink: req.query.ink === '1',
      baseUrl: `http://127.0.0.1:${PORT}`,
    });
    res.download(file, `${name}.pdf`);
  } catch (e) { next(e); }
});
app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }));
app.use('/covers', express.static(store.COVER_DIR, { maxAge: '30d', immutable: true }));

if (PROD) {
  const dist = path.resolve('dist');
  app.use(express.static(dist, { index: false }));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`Dreamy → http://localhost:${PORT}${PROD ? '' : '  (développement)'}`);
  if (!ADMIN_PASSWORD) console.log('⚠  ADMIN_PASSWORD non défini : tout le monde peut importer et modifier.');
});
