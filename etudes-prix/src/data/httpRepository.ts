import type { AppSettings, Study } from '../domain/types';
import type { Supplier } from '../domain/consultations';
import type { StudyRepository, SyncStatus } from './repository';

type Fetch = typeof fetch;

interface Versioned<T> { version: number; data: T }
interface ListOut<T> { initialized: boolean; items: Versioned<T>[] }

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

/**
 * Collection de documents versionnés côté serveur (études, fournisseurs) :
 * seuls les éléments modifiés sont envoyés, avec la version lue, pour que le serveur
 * refuse (409) d'écraser une modification faite entre-temps sur un autre poste.
 */
class VersionedCollection<T extends { id: string }> {
  versions = new Map<string, number>();
  /** Dernier contenu confirmé par le serveur (JSON). */
  saved = new Map<string, string>();
  /** À envoyer : contenu JSON, ou null pour une suppression. */
  wanted = new Map<string, string | null>();
  conflicts = new Set<string>();

  constructor(private path: string) {}

  loaded(items: Versioned<T>[]) {
    for (const it of items) {
      this.versions.set(it.data.id, it.version);
      this.saved.set(it.data.id, JSON.stringify(it.data));
    }
  }

  /** Compare l'état voulu avec le dernier état confirmé. */
  diff(list: T[]) {
    const ids = new Set<string>();
    for (const x of list) {
      ids.add(x.id);
      if (this.conflicts.has(x.id)) continue;
      const json = JSON.stringify(x);
      if (json === this.saved.get(x.id)) this.wanted.delete(x.id);
      else this.wanted.set(x.id, json);
    }
    for (const id of this.saved.keys()) if (!ids.has(id) && !this.conflicts.has(id)) this.wanted.set(id, null);
    for (const id of [...this.wanted.keys()]) if (!ids.has(id) && !this.saved.has(id)) this.wanted.delete(id);
  }

  async flush(req: (method: string, url: string, body?: string) => Promise<Response>) {
    for (const [id, json] of [...this.wanted]) {
      const base = this.versions.get(id);
      const url = `${this.path}/${encodeURIComponent(id)}`;
      const res = json === null
        ? await req('DELETE', `${url}${base !== undefined ? `?baseVersion=${base}` : ''}`)
        : await req('PUT', url, `{"data":${json},"baseVersion":${base ?? 'null'}}`);
      if (res.status === 409) {
        this.conflicts.add(id);
        if (this.wanted.get(id) === json) this.wanted.delete(id);
        continue;
      }
      if (!res.ok) throw new HttpError(res.status, `${res.status} ${await res.text().catch(() => '')}`);
      if (json === null) {
        this.versions.delete(id);
        this.saved.delete(id);
      } else {
        this.versions.set(id, ((await res.json()) as { version: number }).version);
        this.saved.set(id, json);
      }
      // Une modification plus récente, faite pendant l'envoi, reste en attente.
      if (this.wanted.get(id) === json) this.wanted.delete(id);
    }
  }
}

/**
 * Données sur le serveur FastAPI (SQLite ou PostgreSQL). Les écritures sont regroupées
 * (quelques centaines de ms), réessayées si le serveur est injoignable, et jamais écrasées
 * en silence en cas de modification concurrente.
 */
export class HttpStudyRepository implements StudyRepository {
  readonly kind = 'server' as const;
  private studies = new VersionedCollection<Study>('/api/studies');
  private suppliers = new VersionedCollection<Supplier>('/api/suppliers');
  private settingsSaved: string | null = null;
  private settingsWanted: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  private listeners = new Set<(s: SyncStatus) => void>();
  private status: SyncStatus;

  constructor(private base = '', private fetchImpl: Fetch = (...a) => fetch(...a), private delay = 400, database?: string) {
    this.status = { state: 'saved', pending: 0, conflicts: [], database };
  }

  private req = (method: string, url: string, body?: string) =>
    this.fetchImpl(`${this.base}${url}`, { method, body, headers: body ? { 'Content-Type': 'application/json' } : undefined });

  private async getJson<T>(url: string): Promise<T> {
    const res = await this.req('GET', url);
    if (!res.ok) throw new HttpError(res.status, `${url} : ${res.status}`);
    return (await res.json()) as T;
  }

  async loadStudies() {
    const r = await this.getJson<ListOut<Study>>('/api/studies');
    this.studies.loaded(r.items);
    return !r.initialized && !r.items.length ? null : r.items.map((i) => i.data);
  }

  async loadSuppliers() {
    const r = await this.getJson<ListOut<Supplier>>('/api/suppliers');
    this.suppliers.loaded(r.items);
    return !r.initialized && !r.items.length ? null : r.items.map((i) => i.data);
  }

  async loadSettings() {
    const r = await this.getJson<{ data: AppSettings | null }>('/api/settings');
    this.settingsSaved = r.data ? JSON.stringify(r.data) : null;
    return r.data;
  }

  async saveStudies(studies: Study[]) { this.studies.diff(studies); this.schedule(); }
  async saveSuppliers(suppliers: Supplier[]) { this.suppliers.diff(suppliers); this.schedule(); }
  async saveSettings(settings: AppSettings) {
    const json = JSON.stringify(settings);
    this.settingsWanted = json === this.settingsSaved ? null : json;
    this.schedule();
  }

  async clear() {
    this.studies.diff([]);
    this.suppliers.diff([]);
    await this.flush();
  }

  private pending(): number {
    return this.studies.wanted.size + this.suppliers.wanted.size + (this.settingsWanted ? 1 : 0);
  }

  hasPendingChanges(): boolean {
    return this.pending() > 0 || this.running !== null;
  }

  private emit(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch, pending: this.pending(), conflicts: [...this.studies.conflicts, ...this.suppliers.conflicts] };
    if (this.status.conflicts.length && this.status.state !== 'offline') this.status.state = 'conflict';
    for (const l of this.listeners) l(this.status);
  }

  subscribe(listener: (s: SyncStatus) => void) {
    this.listeners.add(listener);
    listener(this.status);
    return () => void this.listeners.delete(listener);
  }

  private schedule(delay = this.delay) {
    if (this.timer) clearTimeout(this.timer);
    if (!this.pending()) { this.emit({ state: this.status.state === 'offline' ? 'offline' : 'saved' }); return; }
    this.emit({ state: this.status.state === 'offline' ? 'offline' : 'saving' });
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, delay);
  }

  /** Envoie tout ce qui est en attente (appelé automatiquement). */
  async flush(): Promise<void> {
    if (this.running) { this.again = true; return this.running; }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.studies.flush(this.req);
          await this.suppliers.flush(this.req);
          const settings = this.settingsWanted;
          if (settings) {
            const res = await this.req('PUT', '/api/settings', `{"data":${settings}}`);
            if (!res.ok) throw new HttpError(res.status, 'settings');
            this.settingsSaved = settings;
            if (this.settingsWanted === settings) this.settingsWanted = null;
          }
        } while (this.again || this.pending() > 0);
        this.emit({ state: 'saved', lastSavedAt: new Date().toISOString() });
      } catch {
        // Serveur injoignable ou en erreur : on garde tout et on réessaie.
        this.emit({ state: 'offline' });
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, 5000);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }
}
