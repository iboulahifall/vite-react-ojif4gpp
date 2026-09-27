import type { StudyRepository } from './repository';
import { LocalStudyRepository } from './repository';
import { HttpStudyRepository, type RepoUser } from './httpRepository';
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
 * Serveur disponible ? `?stockage=navigateur` dans l'adresse force le stockage local.
 * Le serveur pose le cookie « ep_server » : sans lui (site statique), pas de requête inutile.
 */
export async function findServer(): Promise<{ base: string; info: BackendInfo } | null> {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  const forceLocal = /[?&]stockage=navigateur\b/.test(window.location.search + window.location.hash);
  const served = import.meta.env.DEV || !!base || /(?:^|;\s*)ep_server=1/.test(document.cookie);
  if (forceLocal || !served) return null;
  const info = await detectBackend(base);
  return info ? { base, info } : null;
}

export function serverRepository(base: string, info: BackendInfo, user: RepoUser): StudyRepository {
  setFileStore(new HttpFileStore(base));
  return new HttpStudyRepository(base, undefined, 400, info.database, user);
}

export function localRepository(): StudyRepository {
  return new LocalStudyRepository();
}
