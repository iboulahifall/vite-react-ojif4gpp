import type { Study } from '../domain/types';
import type { Supplier } from '../domain/consultations';
import { LocalStudyRepository } from './repository';
import { IndexedDbFileStore, type FileStore } from './fileStore';

export interface LocalSnapshot { studies: Study[]; suppliers: Supplier[] }

/** Données encore présentes dans le stockage du navigateur (avant le passage au serveur). */
export async function readLocalData(): Promise<LocalSnapshot> {
  const local = new LocalStudyRepository();
  return { studies: (await local.loadStudies()) ?? [], suppliers: (await local.loadSuppliers()) ?? [] };
}

export interface MigrationResult { studies: number; suppliers: number; files: number; skipped: string[]; missingFiles: number }

/**
 * Envoie au serveur les études et fournisseurs du navigateur qui n'y sont pas encore,
 * avec le contenu de leurs fichiers. Rien n'est écrasé côté serveur.
 */
export async function migrateLocalToServer(base = '', fetchImpl: typeof fetch = (...a) => fetch(...a), files: FileStore = new IndexedDbFileStore()): Promise<MigrationResult> {
  const { studies, suppliers } = await readLocalData();
  const res: MigrationResult = { studies: 0, suppliers: 0, files: 0, skipped: [], missingFiles: 0 };
  const existing = new Set(((await (await fetchImpl(`${base}/api/studies`)).json()) as { items: { data: Study }[] }).items.map((i) => i.data.id));
  const existingSup = new Set(((await (await fetchImpl(`${base}/api/suppliers`)).json()) as { items: { data: Supplier }[] }).items.map((i) => i.data.id));
  const json = (body: unknown) => ({ method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-EP-Client': '1' }, body: JSON.stringify(body) });

  for (const s of studies) {
    if (existing.has(s.id)) { res.skipped.push(s.name); continue; }
    const ids = [...s.documents.map((d) => ({ id: d.id, name: d.name, mime: d.mime })),
      ...s.consultations.flatMap((c) => c.requests.flatMap((r) => r.offer?.files.map((f) => ({ id: f.id, name: f.name, mime: '' })) ?? []))];
    for (const f of ids) {
      const blob = await files.get(f.id).catch(() => null);
      if (!blob) { res.missingFiles++; continue; }
      const r = await fetchImpl(`${base}/api/files/${encodeURIComponent(f.id)}`, {
        method: 'PUT', body: blob, headers: { 'X-EP-Client': '1', 'Content-Type': blob.type || f.mime || 'application/octet-stream', 'X-File-Name': encodeURIComponent(f.name) },
      });
      if (r.ok) res.files++;
    }
    const r = await fetchImpl(`${base}/api/studies/${encodeURIComponent(s.id)}`, json({ data: s, baseVersion: null }));
    if (r.ok) res.studies++; else res.skipped.push(s.name);
  }
  for (const sup of suppliers) {
    if (existingSup.has(sup.id)) continue;
    const r = await fetchImpl(`${base}/api/suppliers/${encodeURIComponent(sup.id)}`, json({ data: sup, baseVersion: null }));
    if (r.ok) res.suppliers++;
  }
  return res;
}
