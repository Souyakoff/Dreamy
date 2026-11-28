// Export PDF : un navigateur sans interface (Edge ou Chrome déjà installés) imprime la page /imprimer/… du site.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './store.js';

const EXPORT_DIR = path.join(DATA_DIR, 'exports');
fs.mkdirSync(EXPORT_DIR, { recursive: true });

let browserPromise = null;
let idleTimer = null;

async function launch() {
  const { chromium } = await import('playwright-core');
  const tries = [];
  if (process.env.CHROME_PATH) tries.push({ executablePath: process.env.CHROME_PATH });
  tries.push({ channel: 'msedge' }, { channel: 'chrome' }, {});
  for (const p of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']) {
    if (fs.existsSync(p)) tries.push({ executablePath: p });
  }
  let last;
  for (const opt of tries) {
    try { return await chromium.launch({ headless: true, ...opt }); } catch (e) { last = e; }
  }
  throw Object.assign(new Error('Aucun navigateur (Edge ou Chrome) trouvé pour générer le PDF.'), { status: 501, cause: last });
}

async function getBrowser() {
  if (browserPromise) {
    const current = await browserPromise.catch(() => null);
    if (!current || !current.isConnected()) browserPromise = null;
  }
  if (!browserPromise) {
    browserPromise = launch().then((b) => { b.on('disconnected', () => { browserPromise = null; }); return b; })
      .catch((e) => { browserPromise = null; throw e; });
  }
  const b = await browserPromise;
  clearTimeout(idleTimer);
  // Ferme le navigateur après 2 minutes sans export.
  idleTimer = setTimeout(() => { browserPromise = null; b.close().catch(() => {}); }, 120_000);
  return b;
}

// Un export à la fois (un livre complet peut prendre quelques secondes).
let queue = Promise.resolve();
const serial = (fn) => { const run = queue.then(fn, fn); queue = run.catch(() => {}); return run; };

const SIZES = { a5: true, a4: true, poche: true };
// À incrémenter quand le rendu change, pour ne pas resservir d'anciens PDF en cache.
const RENDER_VERSION = 'r5';

/**
 * Génère (ou réutilise depuis le cache) le PDF d'un tome ou d'une œuvre.
 * @param {{ kind: 'volume'|'work', id: string, version: string, size: string, theme: string, ink: boolean, baseUrl: string }} o
 */
export async function renderPdf(o) {
  const size = SIZES[o.size] ? o.size : 'a5';
  const theme = /^[a-z]*$/.test(o.theme || '') ? o.theme : '';
  const key = `${RENDER_VERSION}-${o.kind}-${o.id}-${o.version.replace(/[^0-9A-Za-z]/g, '')}-${size}-${theme || 'auto'}-${o.ink ? 'eco' : 'full'}.pdf`;
  const file = path.join(EXPORT_DIR, key);
  if (fs.existsSync(file)) return file;
  return serial(async () => {
    if (fs.existsSync(file)) return file;
    let browser = await getBrowser();
    let page;
    try { page = await browser.newPage(); } catch {
      browserPromise = null;
      browser = await getBrowser();
      page = await browser.newPage();
    }
    try {
      const qs = new URLSearchParams({ size, ...(theme ? { theme } : {}), ...(o.ink ? { ink: '1' } : {}) });
      await page.goto(`${o.baseUrl}/imprimer/${o.kind === 'work' ? 'oeuvre' : 'tome'}/${o.id}?${qs}`, { waitUntil: 'load', timeout: 60_000 });
      await page.waitForFunction('window.__PDF_READY === true || typeof window.__PDF_ERROR === "string"', null, { timeout: 180_000 });
      const err = await page.evaluate('window.__PDF_ERROR');
      if (err) throw new Error(err);
      const tmp = `${file}.tmp`;
      await page.pdf({ path: tmp, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
      fs.renameSync(tmp, file);
      // Ne garde que les exports récents.
      const old = fs.readdirSync(EXPORT_DIR).map((f) => ({ f, t: fs.statSync(path.join(EXPORT_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t).slice(30);
      for (const { f } of old) fs.rmSync(path.join(EXPORT_DIR, f), { force: true });
      return file;
    } finally {
      await page.close().catch(() => {});
    }
  });
}
