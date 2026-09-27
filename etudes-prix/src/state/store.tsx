import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppSettings, DceCategory, DceFile, HistoryEntry, Study, StudyDraft, StudyStatus } from '../domain/types';
import { getFileStore } from '../data/fileStore';
import { buildDemoFile } from '../data/demoFiles';
import { categoryLabel, kindOf, syncDeclarations, validateUpload, type RejectedFile } from '../domain/documents';
import { inspectFile } from '../lib/inspectFile';
import { LocalStudyRepository, type StudyRepository } from '../data/repository';
import { buildDemoStudies } from '../data/demo';
import { createStudyFromDraft, newId } from '../domain/studyFactory';
import { progressForStatus, stageOf } from '../domain/workflow';

export const DEFAULT_SETTINGS: AppSettings = {
  userName: 'Ibrahima',
  companyName: 'Mon entreprise d’électricité',
  guidedMode: true,
};

/** Modification tracée dans l'historique de l'étude. */
export interface TrackedChange {
  field: string;
  oldValue: string;
  newValue: string;
}

interface StoreValue {
  ready: boolean;
  studies: Study[];
  settings: AppSettings;
  hasDemo: boolean;
  getStudy(id: string): Study | undefined;
  createStudy(draft: StudyDraft): Study;
  updateStudy(id: string, patch: Partial<Study>, changes: TrackedChange[], reason: string): void;
  setStatus(id: string, status: StudyStatus, reason: string): void;
  setProgress(id: string, progress: number, reason: string): void;
  deleteStudy(id: string): void;
  /** Importe des fichiers dans le DCE d'une étude. */
  addDocuments(studyId: string, files: { file: File; category: DceCategory }[]): Promise<{ added: DceFile[]; rejected: RejectedFile[] }>;
  updateDocument(studyId: string, docId: string, patch: Partial<Pick<DceFile, 'category' | 'note'>>, reason: string): void;
  removeDocument(studyId: string, docId: string, reason: string): Promise<void>;
  /** Contenu d'un fichier (généré à la volée pour la démonstration). */
  getFileBlob(doc: DceFile): Promise<Blob | null>;
  updateSettings(patch: Partial<AppSettings>): void;
  resetDemo(): void;
  removeDemo(): void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, repository }: { children: ReactNode; repository?: StudyRepository }) {
  const repo = useMemo(() => repository ?? new LocalStudyRepository(), [repository]);
  const [ready, setReady] = useState(false);
  const [studies, setStudies] = useState<Study[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const loaded = useRef(false);

  // Premier lancement : création automatique du projet de démonstration.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = { ...DEFAULT_SETTINGS, ...((await repo.loadSettings()) ?? {}) };
      const stored = await repo.loadStudies();
      if (cancelled) return;
      setSettings(s);
      // Données enregistrées par une version antérieure : champs ajoutés depuis.
      setStudies((stored ?? buildDemoStudies(s.userName)).map((st) => ({ ...st, documents: st.documents ?? [] })));
      loaded.current = true;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [repo]);

  useEffect(() => {
    if (loaded.current) void repo.saveStudies(studies);
  }, [studies, repo]);

  useEffect(() => {
    if (loaded.current) void repo.saveSettings(settings);
  }, [settings, repo]);

  const entry = useCallback(
    (c: TrackedChange, reason: string): HistoryEntry => ({
      id: newId('h'),
      date: new Date().toISOString(),
      user: settings.userName,
      reason: reason.trim() || '—',
      ...c,
    }),
    [settings.userName],
  );

  const updateStudy = useCallback<StoreValue['updateStudy']>(
    (id, patch, changes, reason) => {
      setStudies((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                ...patch,
                updatedAt: new Date().toISOString(),
                history: [...changes.map((c) => entry(c, reason)).reverse(), ...s.history],
              }
            : s,
        ),
      );
    },
    [entry],
  );

  const patchDocuments = useCallback((studyId: string, docId: string, patch: Partial<DceFile>) => {
    setStudies((prev) =>
      prev.map((s) => (s.id === studyId ? { ...s, documents: s.documents.map((d) => (d.id === docId ? { ...d, ...patch } : d)) } : s)),
    );
  }, []);

  const getFileBlob = useCallback(
    async (doc: DceFile): Promise<Blob | null> => {
      const files = getFileStore();
      const existing = await files.get(doc.id);
      if (existing || !doc.isDemo) return existing;
      const built = await buildDemoFile(doc.id);
      if (!built) return null;
      await files.put(doc.id, built.blob).catch(() => {});
      const studyId = doc.id.slice(0, doc.id.indexOf('-doc-'));
      patchDocuments(studyId, doc.id, { size: built.blob.size, pages: built.pages, sheets: built.sheets });
      return built.blob;
    },
    [patchDocuments],
  );

  // Fichiers de démonstration : générés en arrière-plan pour connaître taille et pages.
  useEffect(() => {
    if (!ready) return;
    for (const st of studies) for (const d of st.documents) if (d.isDemo && d.size === 0) void getFileBlob(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const value = useMemo<StoreValue>(() => {
    const getStudy = (id: string) => studies.find((s) => s.id === id);
    return {
      ready,
      studies,
      settings,
      hasDemo: studies.some((s) => s.isDemo),
      getStudy,
      createStudy(draft) {
        const study = createStudyFromDraft(draft, settings.userName);
        setStudies((prev) => [study, ...prev]);
        return study;
      },
      updateStudy,
      setStatus(id, status, reason) {
        const s = getStudy(id);
        if (!s || s.status === status) return;
        const progress = progressForStatus(status, s.progress);
        const changes: TrackedChange[] = [
          { field: 'Étape', oldValue: stageOf(s.status).label, newValue: stageOf(status).label },
        ];
        if (progress !== s.progress) changes.push({ field: 'Avancement', oldValue: `${s.progress} %`, newValue: `${progress} %` });
        const plan = s.plan.map((t) => (t.stage === s.status && status !== 'analyse' ? { ...t, done: true } : t));
        updateStudy(id, { status, progress, plan }, changes, reason);
      },
      setProgress(id, progress, reason) {
        const s = getStudy(id);
        if (!s || s.progress === progress) return;
        updateStudy(id, { progress }, [{ field: 'Avancement', oldValue: `${s.progress} %`, newValue: `${progress} %` }], reason);
      },
      deleteStudy(id) {
        const s = getStudy(id);
        s?.documents.forEach((d) => void getFileStore().remove(d.id).catch(() => {}));
        setStudies((prev) => prev.filter((x) => x.id !== id));
      },
      async addDocuments(studyId, files) {
        const rejected: RejectedFile[] = [];
        const added: DceFile[] = [];
        const store = getFileStore();
        for (const { file, category } of files) {
          const err = validateUpload(file);
          if (err) { rejected.push({ name: file.name, reason: err }); continue; }
          const doc: DceFile = {
            id: newId('doc'),
            name: file.name,
            size: file.size,
            mime: file.type,
            kind: kindOf(file.name, file.type),
            category,
            uploadedAt: new Date().toISOString(),
            uploadedBy: settings.userName,
            note: '',
          };
          try {
            await store.put(doc.id, file);
            added.push(doc);
          } catch {
            rejected.push({ name: file.name, reason: 'Enregistrement impossible (espace de stockage du navigateur insuffisant ou bloqué).' });
          }
        }
        if (added.length) {
          setStudies((prev) =>
            prev.map((s) => {
              if (s.id !== studyId) return s;
              const documents = [...s.documents, ...added];
              const history = added.map((d) => entry({ field: 'Import DCE', oldValue: '—', newValue: `${d.name} → ${categoryLabel(d.category)}` }, 'Import de fichiers'));
              return { ...s, documents, dceDocs: syncDeclarations({ documents, dceDocs: s.dceDocs }), updatedAt: new Date().toISOString(), history: [...history.reverse(), ...s.history] };
            }),
          );
          // Lecture du contenu en tâche de fond (pages, feuilles, mots).
          for (const d of added) {
            const file = files.find((f) => f.file.name === d.name)!.file;
            void inspectFile(file, d.kind, d.name).then((facts) => patchDocuments(studyId, d.id, facts));
          }
        }
        return { added, rejected };
      },
      updateDocument(studyId, docId, patch, reason) {
        const s = getStudy(studyId);
        const doc = s?.documents.find((d) => d.id === docId);
        if (!s || !doc) return;
        const documents = s.documents.map((d) => (d.id === docId ? { ...d, ...patch } : d));
        const changes: TrackedChange[] = [];
        if (patch.category && patch.category !== doc.category) {
          changes.push({ field: `Classement de « ${doc.name} »`, oldValue: categoryLabel(doc.category), newValue: categoryLabel(patch.category) });
        }
        if (patch.note !== undefined && patch.note !== doc.note) {
          changes.push({ field: `Commentaire de « ${doc.name} »`, oldValue: doc.note || '—', newValue: patch.note || '—' });
        }
        updateStudy(studyId, { documents, dceDocs: syncDeclarations({ documents, dceDocs: s.dceDocs }) }, changes, reason);
      },
      async removeDocument(studyId, docId, reason) {
        const s = getStudy(studyId);
        const doc = s?.documents.find((d) => d.id === docId);
        if (!s || !doc) return;
        await getFileStore().remove(docId).catch(() => {});
        updateStudy(studyId, { documents: s.documents.filter((d) => d.id !== docId) },
          [{ field: 'Suppression DCE', oldValue: `${doc.name} (${categoryLabel(doc.category)})`, newValue: 'supprimé' }], reason);
      },
      getFileBlob,
      updateSettings(patch) {
        setSettings((prev) => ({ ...prev, ...patch }));
      },
      resetDemo() {
        setStudies((prev) => [...prev.filter((s) => !s.isDemo), ...buildDemoStudies(settings.userName)]);
      },
      removeDemo() {
        setStudies((prev) => prev.filter((s) => !s.isDemo));
      },
    };
  }, [ready, studies, settings, updateStudy, entry, patchDocuments, getFileBlob]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore doit être utilisé dans <StoreProvider>');
  return v;
}
