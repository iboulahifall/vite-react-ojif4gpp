import type { FileStore } from './fileStore';

/** Contenu des fichiers (DCE, devis) sur le serveur : /api/files/{id}. */
export class HttpFileStore implements FileStore {
  constructor(private base = '', private fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  private url(id: string) {
    return `${this.base}/api/files/${encodeURIComponent(id)}`;
  }

  async put(id: string, blob: Blob) {
    const name = blob instanceof File ? blob.name : '';
    const res = await this.fetchImpl(this.url(id), {
      method: 'PUT', body: blob,
      headers: { 'Content-Type': blob.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(name) },
    });
    if (!res.ok) throw new Error(res.status === 413 ? 'Fichier trop volumineux pour le serveur.' : `Envoi du fichier impossible (${res.status}).`);
  }

  async get(id: string) {
    const res = await this.fetchImpl(this.url(id));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Lecture du fichier impossible (${res.status}).`);
    return res.blob();
  }

  async remove(id: string) {
    await this.fetchImpl(this.url(id), { method: 'DELETE' });
  }
}
