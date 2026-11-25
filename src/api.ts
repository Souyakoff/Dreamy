import type { Volume, VolumeMeta, Work } from './types';

const PW_KEY = 'dreamy:admin';
export const getPassword = () => { try { return sessionStorage.getItem(PW_KEY) || ''; } catch { return ''; } };
export const setPassword = (p: string) => { try { sessionStorage.setItem(PW_KEY, p); } catch { /* ignore */ } };

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', 'x-admin-password': getPassword() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Erreur ${res.status}`), { status: res.status });
  return data as T;
}

export const api = {
  config: () => req<{ authRequired: boolean; isAdmin: boolean }>('GET', '/api/config'),
  works: () => req<Work[]>('GET', '/api/works'),
  work: (id: string) => req<Work>('GET', `/api/works/${id}`),
  createWork: (b: Partial<Work> & { coverDataUrl?: string }) => req<Work>('POST', '/api/works', b),
  updateWork: (id: string, b: Partial<Work> & { coverDataUrl?: string; removeCover?: boolean }) => req<Work>('PATCH', `/api/works/${id}`, b),
  deleteWork: (id: string) => req('DELETE', `/api/works/${id}`),
  createVolume: (workId: string, b: object) => req<VolumeMeta>('POST', `/api/works/${workId}/volumes`, b),
  volume: (id: string) => req<Volume>('GET', `/api/volumes/${id}`),
  updateVolume: (id: string, b: object) => req<VolumeMeta>('PATCH', `/api/volumes/${id}`, b),
  deleteVolume: (id: string) => req('DELETE', `/api/volumes/${id}`),
};

export const fileToDataUrl = (f: File) => new Promise<string>((ok, ko) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => ko(r.error);
  r.readAsDataURL(f);
});
