import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppSettings, DceCategory, DceFile, HistoryEntry, Study, StudyDraft, StudyStatus } from '../domain/types';
import { getFileStore } from '../data/fileStore';
import { buildDemoFile } from '../data/demoFiles';
import { categoryLabel, kindOf, syncDeclarations, validateUpload, type RejectedFile } from '../domain/documents';
import { inspectFile } from '../lib/inspectFile';
import { extractSheets, extractText } from '../lib/extractText';
import { summarize } from '../domain/analysis/summary';
import type { AnalysisResult, DpgfLine, FindingStatus } from '../domain/analysis/types';
import { analyse, dceSignature } from '../domain/analysis/analyse';
import { parseDpgf } from '../domain/analysis/dpgf';
import { effectiveQty, formatQty, mergeDpgf, type MergeResult, type MetreLine } from '../domain/metre';
import { FAMILIES } from '../domain/catalog';
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
  target?: string;
}

/** Champs d'une ligne de métré modifiables par l'utilisateur. */
export type MetreLinePatch = Partial<Pick<MetreLine, 'calcQty' | 'calcDetail' | 'retainedQty' | 'familyId' | 'comment' | 'designation' | 'unit' | 'ref'>>;

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
  /** Analyse automatique du DCE ; `onStep` reçoit chaque étape réalisée. */
  runAnalysis(studyId: string, onStep?: (label: string) => void): Promise<AnalysisResult>;
  decideFinding(studyId: string, findingId: string, status: FindingStatus, comment: string): void;
  /** Crée ou met à jour le métré depuis la DPGF (le travail déjà fait est conservé). */
  initMetre(studyId: string): Promise<MergeResult>;
  updateMetreLine(studyId: string, lineId: string, patch: MetreLinePatch, reason: string): void;
  addMetreLine(studyId: string, line: Pick<MetreLine, 'familyId' | 'ref' | 'designation' | 'unit'> & Partial<MetreLine>): MetreLine;
  removeMetreLine(studyId: string, lineId: string, reason: string): void;
  setMetreValidation(studyId: string, lineIds: string[], validated: boolean, reason: string): void;
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
      setStudies((stored ?? buildDemoStudies(s.userName)).map((st) => ({ ...st, documents: st.documents ?? [], analysisDecisions: st.analysisDecisions ?? {}, metre: st.metre ?? [] })));
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
      async initMetre(studyId) {
        const s = getStudy(studyId);
        if (!s) throw new Error('Étude introuvable');
        let dpgfLines: DpgfLine[] | null = null;
        // Réutilise la lecture de la DPGF faite par l'analyse si le DCE n'a pas changé.
        if (s.analysis?.dpgf && s.analysis.dceSignature === dceSignature(s.documents)) dpgfLines = s.analysis.dpgfLines;
        if (!dpgfLines) {
          const dd = s.documents.find((x) => x.category === 'DPGF' && x.kind === 'excel' && !/\.xls$/i.test(x.name));
          if (!dd) throw new Error('Aucune DPGF au format Excel ou CSV dans le DCE.');
          const blob = await getFileBlob(dd);
          if (!blob) throw new Error('Le contenu de la DPGF n’est plus disponible : réimportez-la.');
          const sheets = await extractSheets(blob, dd.name);
          dpgfLines = sheets.map((sh) => parseDpgf(sh.rows)).sort((a, b) => b.length - a.length)[0] ?? [];
          if (!dpgfLines.length) throw new Error('Les colonnes « Désignation » et « Unité » n’ont pas été trouvées dans la DPGF.');
        }
        const res = mergeDpgf(s.metre, dpgfLines, () => newId('m'));
        updateStudy(studyId, { metre: res.lines }, [{
          field: 'Métré',
          oldValue: s.metre.length ? `${s.metre.length} ligne(s)` : '—',
          newValue: `${res.lines.length} ligne(s) : ${res.added} ajoutée(s), ${res.updated} modifiée(s), ${res.removed} retirée(s) de la DPGF`,
        }], s.metre.length ? 'Mise à jour depuis la DPGF' : 'Initialisation depuis la DPGF');
        return res;
      },
      updateMetreLine(studyId, lineId, patch, reason) {
        const s = getStudy(studyId);
        const l = s?.metre.find((x) => x.id === lineId);
        if (!s || !l) return;
        const next: MetreLine = { ...l, ...patch };
        const label = `Métré ${l.ref || l.designation}`;
        const changes: TrackedChange[] = [];
        const q = (n: number | null) => (n === null ? '—' : `${formatQty(n)} ${l.unit}`.trim());
        if ('calcQty' in patch && patch.calcQty !== l.calcQty) changes.push({ field: `${label} — calculé`, oldValue: q(l.calcQty), newValue: q(next.calcQty), target: lineId });
        if ('retainedQty' in patch && patch.retainedQty !== l.retainedQty) changes.push({ field: `${label} — retenu`, oldValue: q(effectiveQty(l)), newValue: q(effectiveQty(next)), target: lineId });
        if ('familyId' in patch && patch.familyId !== l.familyId) {
          const fam = (id: string | null) => FAMILIES.find((f) => f.id === id)?.label ?? 'À rattacher';
          changes.push({ field: `${label} — famille`, oldValue: fam(l.familyId), newValue: fam(next.familyId), target: lineId });
        }
        if ('comment' in patch && patch.comment !== l.comment) changes.push({ field: `${label} — commentaire`, oldValue: l.comment || '—', newValue: next.comment || '—', target: lineId });
        for (const k of ['designation', 'unit', 'ref'] as const) {
          if (k in patch && patch[k] !== l[k]) changes.push({ field: `${label} — ${k === 'ref' ? 'poste' : k === 'unit' ? 'unité' : 'désignation'}`, oldValue: l[k] || '—', newValue: next[k] || '—', target: lineId });
        }
        if (!changes.length) return;
        // Une quantité modifiée après validation doit être revalidée.
        if (l.validated && effectiveQty(next) !== effectiveQty(l)) {
          next.validated = false;
          changes.push({ field: `${label} — validation`, oldValue: 'Validée', newValue: 'À revalider', target: lineId });
        }
        updateStudy(studyId, { metre: s.metre.map((x) => (x.id === lineId ? next : x)) }, changes, reason);
      },
      addMetreLine(studyId, data) {
        const s = getStudy(studyId);
        const line: MetreLine = { calcQty: null, calcDetail: [], retainedQty: null, dpgfQty: null, validated: false, section: 'Ajouts', comment: '', ...data, id: newId('m'), source: 'manuel' };
        if (s) updateStudy(studyId, { metre: [...s.metre, line] }, [{ field: 'Métré — ligne ajoutée', oldValue: '—', newValue: `${line.ref} ${line.designation}`.trim(), target: line.id }], 'Ajout manuel');
        return line;
      },
      removeMetreLine(studyId, lineId, reason) {
        const s = getStudy(studyId);
        const l = s?.metre.find((x) => x.id === lineId);
        if (!s || !l) return;
        updateStudy(studyId, { metre: s.metre.filter((x) => x.id !== lineId) }, [{ field: 'Métré — ligne supprimée', oldValue: `${l.ref} ${l.designation}`.trim(), newValue: 'supprimée', target: lineId }], reason);
      },
      setMetreValidation(studyId, lineIds, validated, reason) {
        const s = getStudy(studyId);
        if (!s) return;
        const now = new Date().toISOString();
        const changes: TrackedChange[] = [];
        const metre = s.metre.map((l) => {
          if (!lineIds.includes(l.id) || l.validated === validated) return l;
          const q = effectiveQty(l);
          if (validated && q === null) return l; // rien à valider sans quantité
          changes.push({ field: `Métré ${l.ref || l.designation} — validation`, oldValue: validated ? 'À valider' : 'Validée',
            newValue: validated ? `Validée (${formatQty(q)} ${l.unit})` : 'Dévalidée', target: l.id });
          return validated
            ? { ...l, validated: true, retainedQty: q, validatedBy: settings.userName, validatedAt: now }
            : { ...l, validated: false, validatedBy: undefined, validatedAt: undefined };
        });
        if (changes.length) updateStudy(studyId, { metre }, changes, reason);
      },
      async runAnalysis(studyId, onStep) {
        const s = getStudy(studyId);
        if (!s) throw new Error('Étude introuvable');
        const texts: { doc: DceFile; pages: string[] }[] = [];
        for (const d of s.documents.filter((x) => ['RC', 'CCAP', 'CCTP'].includes(x.category) && ['pdf', 'word', 'text'].includes(x.kind))) {
          const blob = await getFileBlob(d);
          if (!blob) continue;
          const t = await extractText(blob, d).catch(() => ({ pages: [] as string[] }));
          texts.push({ doc: d, pages: t.pages });
          onStep?.(`Lecture ${categoryLabel(d.category)} (${t.pages.length} p.)`);
        }
        let dpgf: Parameters<typeof analyse>[0]['dpgf'];
        const dd = s.documents.find((x) => x.category === 'DPGF' && x.kind === 'excel' && !/\.xls$/i.test(x.name));
        if (dd) {
          const blob = await getFileBlob(dd);
          if (blob) {
            const sheets = await extractSheets(blob, dd.name).catch(() => []);
            dpgf = { doc: dd, sheets };
          }
          onStep?.('Lecture DPGF');
        }
        const result = analyse({ study: s, texts, dpgf, user: settings.userName });
        onStep?.('Détection des prestations');
        onStep?.('Comparaison CCTP / DPGF');
        onStep?.('Repérage des clauses à risque');
        const sum = summarize(result, s.analysisDecisions);
        updateStudy(studyId, { analysis: result }, [{
          field: 'Analyse du DCE',
          oldValue: s.analysis ? `${summarize(s.analysis, s.analysisDecisions).critical} point(s) critique(s)` : '—',
          newValue: `${sum.critical} critique(s), ${sum.toCheck} à vérifier, ${sum.questions} question(s)`,
        }], 'Analyse automatique');
        return result;
      },
      decideFinding(studyId, findingId, status, comment) {
        const s = getStudy(studyId);
        const f = s?.analysis?.findings.find((x) => x.id === findingId);
        if (!s || !f) return;
        const labels: Record<FindingStatus, string> = { ouvert: 'Ouvert', traite: 'Traité', ecarte: 'Écarté' };
        const previous = s.analysisDecisions[findingId]?.status ?? 'ouvert';
        const decisions = { ...s.analysisDecisions };
        if (status === 'ouvert') delete decisions[findingId];
        else decisions[findingId] = { status, comment, by: settings.userName, at: new Date().toISOString() };
        updateStudy(studyId, { analysisDecisions: decisions },
          [{ field: `Constat « ${f.title} »`, oldValue: labels[previous], newValue: labels[status] }], comment || 'Décision sur constat');
      },
      updateSettings(patch) {
        setSettings((prev) => ({ ...prev, ...patch }));
      },
      resetDemo() {
        // Les fichiers de démonstration seront régénérés (version à jour).
        studies.filter((x) => x.isDemo).forEach((x) => x.documents.forEach((d) => void getFileStore().remove(d.id).catch(() => {})));
        setStudies((prev) => [...prev.filter((s) => !s.isDemo), ...buildDemoStudies(settings.userName)]);
      },
      removeDemo() {
        studies.filter((x) => x.isDemo).forEach((x) => x.documents.forEach((d) => void getFileStore().remove(d.id).catch(() => {})));
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
