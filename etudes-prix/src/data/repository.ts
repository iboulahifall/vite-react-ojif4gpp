import type { AppSettings, Study } from '../domain/types';

/**
 * Accès aux données. La V1.1 stocke dans le navigateur (localStorage) ;
 * une implémentation HTTP (FastAPI + SQLite / PostgreSQL) pourra remplacer
 * celle-ci sans toucher aux écrans, grâce à cette interface asynchrone.
 */
export interface StudyRepository {
  loadStudies(): Promise<Study[] | null>;
  saveStudies(studies: Study[]): Promise<void>;
  loadSettings(): Promise<AppSettings | null>;
  saveSettings(settings: AppSettings): Promise<void>;
  clear(): Promise<void>;
}

const STUDIES_KEY = 'etudes-prix.v1.studies';
const SETTINGS_KEY = 'etudes-prix.v1.settings';

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

export class LocalStudyRepository implements StudyRepository {
  private store: KeyValueStore;

  constructor(store?: KeyValueStore) {
    if (store) {
      this.store = store;
    } else {
      try {
        window.localStorage.setItem('__probe', '1');
        window.localStorage.removeItem('__probe');
        this.store = window.localStorage;
      } catch {
        // Navigation privée / stockage bloqué : l'application reste utilisable en mémoire.
        this.store = memoryStore();
      }
    }
  }

  private read<T>(key: string): T | null {
    try {
      const raw = this.store.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown) {
    try {
      this.store.setItem(key, JSON.stringify(value));
    } catch {
      /* quota dépassé ou stockage indisponible : ignoré */
    }
  }

  async loadStudies() { return this.read<Study[]>(STUDIES_KEY); }
  async saveStudies(studies: Study[]) { this.write(STUDIES_KEY, studies); }
  async loadSettings() { return this.read<AppSettings>(SETTINGS_KEY); }
  async saveSettings(settings: AppSettings) { this.write(SETTINGS_KEY, settings); }
  async clear() {
    this.store.removeItem(STUDIES_KEY);
    this.store.removeItem(SETTINGS_KEY);
  }
}

export { memoryStore };
