/**
 * Stockage du contenu des fichiers (IndexedDB du navigateur).
 * Les métadonnées restent dans l'étude ; seul le binaire est ici.
 * À remplacer par un stockage serveur quand le backend sera en place.
 */
export interface FileStore {
  put(id: string, blob: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
  remove(id: string): Promise<void>;
}

const DB_NAME = 'etudes-prix-files';
const STORE = 'files';

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IndexedDbFileStore implements FileStore {
  private db: Promise<IDBDatabase>;

  constructor(factory: IDBFactory = indexedDB) {
    this.db = openDb(factory);
  }

  private async run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.db;
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error ?? req.error);
      tx.onabort = () => reject(tx.error ?? new Error('Transaction annulée'));
    });
  }

  async put(id: string, blob: Blob) {
    await this.run('readwrite', (s) => s.put(blob, id));
  }

  async get(id: string) {
    return ((await this.run<Blob | undefined>('readonly', (s) => s.get(id))) ?? null);
  }

  async remove(id: string) {
    await this.run('readwrite', (s) => s.delete(id));
  }
}

export class MemoryFileStore implements FileStore {
  private m = new Map<string, Blob>();
  async put(id: string, blob: Blob) { this.m.set(id, blob); }
  async get(id: string) { return this.m.get(id) ?? null; }
  async remove(id: string) { this.m.delete(id); }
}

let instance: FileStore | null = null;

/** Remplace le stockage des fichiers (serveur). */
export function setFileStore(store: FileStore): void {
  instance = store;
}

export function getFileStore(): FileStore {
  if (!instance) {
    try {
      instance = typeof indexedDB !== 'undefined' ? new IndexedDbFileStore() : new MemoryFileStore();
    } catch {
      instance = new MemoryFileStore();
    }
  }
  return instance;
}
