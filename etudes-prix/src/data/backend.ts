import type { StudyRepository } from './repository';
import { LocalStudyRepository } from './repository';
import { HttpStudyRepository } from './httpRepository';
import { HttpFileStore } from './httpFileStore';
import { setFileStore } from './fileStore';

export interface BackendInfo { app: string; version: string; database: string; studies: number }

/** Le serveur de l'application répond-il (même origine, ou VITE_API_URL) ? */
export async function detectBackend(base = '', timeoutMs = 2500): Promise<BackendInfo | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/health`, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
    const info = (await res.json()) as BackendInfo;
    return info.app === 'etudes-prix' ? info : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Choix du stockage au démarrage : le serveur s'il répond, sinon le navigateur.
 * `?stockage=navigateur` dans l'adresse force le stockage local.
 */
export async function chooseRepository(): Promise<StudyRepository> {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  const forceLocal = /[?&]stockage=navigateur\b/.test(window.location.search + window.location.hash);
  // Le serveur pose le cookie « ep_server » : sans lui (site statique), pas de requête inutile.
  const served = import.meta.env.DEV || !!base || /(?:^|;\s*)ep_server=1/.test(document.cookie);
  const info = forceLocal || !served ? null : await detectBackend(base);
  if (!info) return new LocalStudyRepository();
  setFileStore(new HttpFileStore(base));
  return new HttpStudyRepository(base, undefined, 400, info.database);
}
