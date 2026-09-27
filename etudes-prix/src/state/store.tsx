import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppSettings, HistoryEntry, Study, StudyDraft, StudyStatus } from '../domain/types';
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
      setStudies(stored ?? buildDemoStudies(s.userName));
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
        setStudies((prev) => prev.filter((s) => s.id !== id));
      },
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
  }, [ready, studies, settings, updateStudy]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore doit être utilisé dans <StoreProvider>');
  return v;
}
