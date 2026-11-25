// Stockage simple sur disque : data/db.json (métadonnées), data/volumes/<id>.json (texte), data/covers/*
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const VOL_DIR = path.join(DATA_DIR, 'volumes');
export const COVER_DIR = path.join(DATA_DIR, 'covers');

for (const d of [DATA_DIR, VOL_DIR, COVER_DIR]) fs.mkdirSync(d, { recursive: true });

function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

let db = { works: [], volumes: [] };
if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const save = () => writeAtomic(DB_FILE, JSON.stringify(db, null, 2));

export const newId = () => crypto.randomBytes(6).toString('base64url');

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/** Enregistre une couverture envoyée en data URL ; renvoie son URL publique. */
export function saveCover(dataUrl, previous) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(dataUrl || '');
  if (!m) throw Object.assign(new Error('Image de couverture invalide'), { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 8 * 1024 * 1024) throw Object.assign(new Error('Couverture trop lourde (8 Mo max)'), { status: 400 });
  const name = `${newId()}.${MIME_EXT[m[1]]}`;
  fs.writeFileSync(path.join(COVER_DIR, name), buf);
  removeCover(previous);
  return `/covers/${name}`;
}

export function removeCover(url) {
  if (!url || !url.startsWith('/covers/')) return;
  const f = path.join(COVER_DIR, path.basename(url));
  fs.rmSync(f, { force: true });
}

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
const WORK_FIELDS = ['title', 'subtitle', 'theme', 'author', 'fandom', 'summary', 'tags', 'status', 'accent'];
const VOL_FIELDS = ['number', 'title', 'subtitle', 'summary', 'version'];


export function listWorks() {
  return db.works.map((w) => ({ ...w, volumes: volumesOf(w.id) }));
}

function volumesOf(workId) {
  return db.volumes.filter((v) => v.workId === workId).sort((a, b) => a.number - b.number);
}

export function getWork(id) {
  const w = db.works.find((x) => x.id === id);
  return w ? { ...w, volumes: volumesOf(id) } : null;
}

export function createWork(body) {
  const now = new Date().toISOString();
  const w = { id: newId(), title: 'Sans titre', author: '', fandom: '', summary: '', tags: [], status: 'en cours', ...pick(body, WORK_FIELDS), cover: null, createdAt: now, updatedAt: now };
  if (body.coverDataUrl) w.cover = saveCover(body.coverDataUrl);
  db.works.push(w);
  save();
  return getWork(w.id);
}

export function updateWork(id, body) {
  const w = db.works.find((x) => x.id === id);
  if (!w) return null;
  Object.assign(w, pick(body, WORK_FIELDS), { updatedAt: new Date().toISOString() });
  if (body.coverDataUrl) w.cover = saveCover(body.coverDataUrl, w.cover);
  if (body.removeCover) { removeCover(w.cover); w.cover = null; }
  save();
  return getWork(id);
}

export function deleteWork(id) {
  const w = db.works.find((x) => x.id === id);
  if (!w) return false;
  for (const v of db.volumes.filter((x) => x.workId === id)) deleteVolume(v.id, false);
  removeCover(w.cover);
  db.works = db.works.filter((x) => x.id !== id);
  save();
  return true;
}

function stats(content) {
  let words = 0;
  for (const ch of content.chapters || []) for (const b of ch.blocks || []) words += (b.html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return { words, chapterCount: (content.chapters || []).length };
}

function validateContent(c) {
  if (!c || !Array.isArray(c.chapters)) throw Object.assign(new Error('Contenu invalide'), { status: 400 });
  return { front: Array.isArray(c.front) ? c.front : [], chapters: c.chapters.map((ch) => ({ title: String(ch.title || ''), blocks: Array.isArray(ch.blocks) ? ch.blocks : [] })) };
}

export function createVolume(workId, body) {
  const w = db.works.find((x) => x.id === workId);
  if (!w) return null;
  const content = validateContent(body.content);
  const now = new Date().toISOString();
  const nextNum = Math.max(0, ...db.volumes.filter((v) => v.workId === workId).map((v) => v.number)) + 1;
  const v = { id: newId(), workId, number: nextNum, title: '', subtitle: '', summary: '', version: '', ...pick(body, VOL_FIELDS), cover: null, ...stats(content), createdAt: now, updatedAt: now };
  v.number = Number(v.number) || nextNum;
  if (body.coverDataUrl) v.cover = saveCover(body.coverDataUrl);
  writeAtomic(path.join(VOL_DIR, `${v.id}.json`), JSON.stringify(content));
  db.volumes.push(v);
  w.updatedAt = now;
  save();
  return v;
}

export function getVolume(id) {
  const v = db.volumes.find((x) => x.id === id);
  if (!v) return null;
  const content = JSON.parse(fs.readFileSync(path.join(VOL_DIR, `${id}.json`), 'utf8'));
  return { ...v, content, work: db.works.find((w) => w.id === v.workId) };
}

export function updateVolume(id, body) {
  const v = db.volumes.find((x) => x.id === id);
  if (!v) return null;
  Object.assign(v, pick(body, VOL_FIELDS), { updatedAt: new Date().toISOString() });
  v.number = Number(v.number) || 1;
  if (body.content) {
    const content = validateContent(body.content);
    writeAtomic(path.join(VOL_DIR, `${id}.json`), JSON.stringify(content));
    Object.assign(v, stats(content));
  }
  if (body.coverDataUrl) v.cover = saveCover(body.coverDataUrl, v.cover);
  if (body.removeCover) { removeCover(v.cover); v.cover = null; }
  const w = db.works.find((x) => x.id === v.workId);
  if (w) w.updatedAt = v.updatedAt;
  save();
  return v;
}

export function deleteVolume(id, persist = true) {
  const v = db.volumes.find((x) => x.id === id);
  if (!v) return false;
  removeCover(v.cover);
  fs.rmSync(path.join(VOL_DIR, `${id}.json`), { force: true });
  db.volumes = db.volumes.filter((x) => x.id !== id);
  if (persist) save();
  return true;
}
