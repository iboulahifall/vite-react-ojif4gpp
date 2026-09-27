import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  AlertTriangle, Download, ExternalLink, FileSearch, FileText, FolderInput, Loader2, Printer, Sparkles, Trash2, Upload,
} from 'lucide-react';
import { useStore } from '../state/store';
import type { DceCategory, DceFile, Study } from '../domain/types';
import {
  CATEGORY_ORDER, categoryLabel, classifyFileName, dceCompleteness, dceStatus, formatFacts, formatFileSize, type RejectedFile,
} from '../domain/documents';
import { dceDocInfo } from '../domain/catalog';
import { formatDate, formatDateTime } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge } from '../components/ui/Badges';
import { GuideBanner, HelpBox } from '../components/ui/Help';
import { SelectInput, TextArea } from '../components/ui/Field';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { DropZone } from '../components/dce/DropZone';
import { FileViewer } from '../components/dce/FileViewer';
import { FileIcon } from '../components/dce/FileIcon';
import { DceStatusBadge } from '../components/dce/DceStatusBadge';
import { PrintDocument, PrintSection, PrintTable } from '../print/PrintDocument';

export function DcePage() {
  const { id = '' } = useParams();
  const { getStudy } = useStore();
  const study = getStudy(id);
  if (!study) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <p className="text-lg font-semibold">Étude introuvable</p>
        <Link to="/dce" className="mt-4 inline-block font-medium text-brand-700 underline">Choisir une étude</Link>
      </Card>
    );
  }
  return <DceView study={study} />;
}

/** Types ouvrables sans risque dans un onglet (jamais de HTML / SVG importé). */
const SAFE_TO_OPEN: DceFile['kind'][] = ['pdf', 'image', 'text'];

function DceView({ study }: { study: Study }) {
  const { addDocuments, updateDocument, removeDocument, getFileBlob } = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const locked = study.status === 'remise';
  const status = useMemo(() => dceStatus(study), [study]);
  const completeness = useMemo(() => dceCompleteness(study), [study]);
  const selectedId = params.get('doc') ?? study.documents[0]?.id ?? null;
  const selected = study.documents.find((d) => d.id === selectedId) ?? null;
  // Le contenu chargé est lié à son document : jamais d'aperçu d'un fichier avec le contenu du précédent.
  const [loaded, setLoaded] = useState<{ id: string; blob: Blob } | null>(null);
  const blob = selected && loaded?.id === selected.id ? loaded.blob : null;
  const [blobState, setBlobState] = useState<'idle' | 'loading' | 'missing'>('idle');
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [toDelete, setToDelete] = useState<DceFile | null>(null);
  const [note, setNote] = useState('');
  const forced = useRef<DceCategory | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const select = (docId: string) => {
    const p = new URLSearchParams(params);
    p.set('doc', docId);
    setParams(p, { replace: true });
  };

  useEffect(() => {
    let alive = true;
    if (!selected) { setBlobState('idle'); return; }
    setBlobState('loading');
    const docId = selected.id;
    getFileBlob(selected).then((b) => {
      if (!alive) return;
      setLoaded(b ? { id: docId, blob: b } : null);
      setBlobState(b ? 'idle' : 'missing');
    });
    return () => { alive = false; };
    // Rechargement uniquement au changement de fichier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => setNote(selected?.note ?? ''), [selected?.id, selected?.note]);

  const importFiles = async (files: File[]) => {
    setBusy(true);
    const category = forced.current;
    forced.current = null;
    const res = await addDocuments(study.id, files.map((file) => ({ file, category: category ?? classifyFileName(file.name) })));
    setBusy(false);
    setRejected(res.rejected);
    setRecent(res.added.map((d) => d.id));
    if (res.added.length) {
      toast(`${res.added.length} fichier(s) importé(s)`);
      select(res.added[0].id);
    }
  };

  const importInto = (category: DceCategory) => {
    forced.current = category;
    picker.current?.click();
  };

  const download = () => {
    if (!blob || !selected) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selected.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openInTab = () => {
    if (!blob || !selected) return;
    const url = URL.createObjectURL(new Blob([blob], { type: selected.kind === 'pdf' ? 'application/pdf' : blob.type }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const unclassified = study.documents.filter((d) => d.category === 'AUTRE');
  const recentUnclassified = unclassified.filter((d) => recent.includes(d.id));

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Mes études', to: '/etudes' }, { label: study.reference, to: `/etudes/${study.id}` }, { label: 'DCE' }]}
        icon={<FileText size={24} />}
        title={<span className="flex flex-wrap items-center gap-2">DCE — {study.name} {study.isDemo && <DemoBadge />}</span>}
        subtitle="Dossier de consultation des entreprises : importez, classez et consultez les pièces."
        actions={
          <>
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer le bordereau</Button>
            <Button icon={<Upload size={16} />} disabled={locked || busy} onClick={() => { forced.current = null; picker.current?.click(); }}>Importer des fichiers</Button>
          </>
        }
      />
      <input ref={picker} type="file" multiple hidden onChange={(e) => { if (e.target.files?.length) void importFiles(Array.from(e.target.files)); e.target.value = ''; }} data-testid="dce-picker" />

      <GuideBanner title="Constituez le dossier de l’étude">
        Importez les fichiers reçus (glisser-déposer accepté). L’application les <strong>classe automatiquement</strong> d’après leur nom :
        vérifiez le classement à droite et complétez les pièces signalées <strong>⚠ Manquant</strong>.
      </GuideBanner>

      {/* Résumé de complétude */}
      <div className={clsx('no-print flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border px-5 py-3',
        completeness.missing.length ? 'border-orange-200 bg-orange-50' : 'border-emerald-200 bg-emerald-50')}>
        <span className="text-sm font-semibold text-slate-900">
          {completeness.imported}/{completeness.expected} pièces importées
          {completeness.declared > 0 && <span className="font-normal text-slate-600"> · {completeness.declared} reçue(s) non importée(s)</span>}
        </span>
        {completeness.missing.length > 0 ? (
          <span className="flex items-center gap-1.5 text-sm text-orange-900">
            <AlertTriangle size={16} /> Manquant : <strong>{completeness.missing.map((m) => m.label).join(', ')}</strong>
          </span>
        ) : <span className="text-sm text-emerald-900">✓ Aucune pièce attendue manquante</span>}
        {completeness.unclassified > 0 && <span className="text-sm text-slate-700">{completeness.unclassified} fichier(s) non classé(s)</span>}
      </div>

      {rejected.length > 0 && (
        <div className="no-print rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-900" role="alert">
          <p className="font-semibold">{rejected.length} fichier(s) non importé(s) :</p>
          <ul className="list-disc pl-5">{rejected.map((r) => <li key={r.name}><strong>{r.name}</strong> — {r.reason}</li>)}</ul>
        </div>
      )}
      {recentUnclassified.length > 0 && (
        <div className="no-print rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          <strong>{recentUnclassified.length} fichier(s) à classer</strong> : le nom ne permet pas de reconnaître la pièce. Sélectionnez-le puis choisissez son classement dans le panneau de droite.
        </div>
      )}

      <div className="no-print grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_300px]">
        {/* GAUCHE : pièces du DCE */}
        <Card className="flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden lg:sticky lg:top-20">
          <div className="border-b border-slate-100 p-3">
            <DropZone compact disabled={locked || busy} onFiles={(f) => { forced.current = null; void importFiles(f); }} label={busy ? 'Import en cours…' : 'Déposez des fichiers'} />
          </div>
          <nav className="flex-1 overflow-y-auto py-2" aria-label="Pièces du DCE">
            {status.map((st) => (
              <div key={st.category} className="px-2 pb-2">
                <div className="flex items-center justify-between gap-2 px-2 py-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{st.label}</span>
                  <DceStatusBadge state={st.state} />
                </div>
                {st.files.map((d) => <DocRow key={d.id} doc={d} active={d.id === selected?.id} isNew={recent.includes(d.id)} onClick={() => select(d.id)} />)}
                {st.files.length === 0 && st.state !== 'na' && !locked && (
                  <button onClick={() => importInto(st.category)}
                    className={clsx('ml-2 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-lg border border-dashed px-2.5 py-1.5 text-left text-xs cursor-pointer',
                      st.state === 'missing' ? 'border-red-300 text-red-800 hover:bg-red-50' : 'border-slate-300 text-slate-600 hover:bg-slate-50')}>
                    <FolderInput size={14} /> Importer {dceDocInfo(st.category).file.replace(/\.[a-z]+$/, '')}
                  </button>
                )}
              </div>
            ))}
            <div className="px-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Autres pièces</span>
                {unclassified.length > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">{unclassified.length} à classer</span>}
              </div>
              {unclassified.map((d) => <DocRow key={d.id} doc={d} active={d.id === selected?.id} isNew={recent.includes(d.id)} onClick={() => select(d.id)} />)}
              {unclassified.length === 0 && <p className="px-2 pb-2 text-xs text-slate-400">Annexes, études de sol, listes de points…</p>}
            </div>
          </nav>
        </Card>

        {/* CENTRE : visualisation */}
        <Card className="flex h-[calc(100vh-7rem)] min-h-[520px] flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2.5">
                <FileIcon kind={selected.kind} />
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-900" title={selected.name}>{selected.name}</span>
                {SAFE_TO_OPEN.includes(selected.kind) && (
                  <Button variant="ghost" size="sm" icon={<ExternalLink size={14} />} disabled={!blob} onClick={openInTab}>Ouvrir</Button>
                )}
                <Button variant="secondary" size="sm" icon={<Download size={14} />} disabled={!blob} onClick={download}>Télécharger</Button>
              </div>
              <div className="min-h-0 flex-1">
                {blobState === 'loading' && <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" /> Chargement…</div>}
                {blobState === 'missing' && (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-slate-600">
                    <AlertTriangle className="text-orange-500" />
                    Le contenu de ce fichier n’est plus disponible dans ce navigateur (données effacées ou autre poste). Réimportez-le.
                  </div>
                )}
                {blob && <FileViewer doc={selected} blob={blob} />}
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <FileSearch size={40} className="text-slate-300" />
              <div>
                <p className="font-semibold text-slate-800">Aucun fichier importé</p>
                <p className="text-sm text-slate-500">Importez les pièces du DCE pour les consulter ici.</p>
              </div>
              {!locked && <div className="w-full max-w-md"><DropZone onFiles={(f) => { forced.current = null; void importFiles(f); }} disabled={busy} /></div>}
            </div>
          )}
        </Card>

        {/* DROITE : informations et classement */}
        <div className="space-y-4 lg:col-span-2 2xl:col-span-1">
          {selected ? (
            <Card>
              <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Document sélectionné</div>
              <dl className="space-y-3 p-4 text-sm">
                <div>
                  <dt className="mb-1 text-xs font-medium text-slate-500">Classement</dt>
                  <dd>
                    <SelectInput value={selected.category} disabled={locked} aria-label="Classement du document"
                      onChange={(e) => { updateDocument(study.id, selected.id, { category: e.target.value as DceCategory }, 'Reclassement'); toast('Classement mis à jour'); }}>
                      {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                    </SelectInput>
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Fact label="Taille">{selected.size ? formatFileSize(selected.size) : '…'}</Fact>
                  <Fact label={selected.kind === 'excel' ? 'Feuilles' : selected.kind === 'word' ? 'Mots' : 'Pages'}>
                    {selected.pages ?? selected.sheets ?? selected.words ?? (SAFE_TO_OPEN.includes(selected.kind) || selected.kind !== 'other' ? '…' : '—')}
                  </Fact>
                  <Fact label="Importé le">{formatDate(selected.uploadedAt.slice(0, 10))}</Fact>
                  <Fact label="Par">{selected.uploadedBy}</Fact>
                </div>
                <div>
                  <dt className="mb-1 text-xs font-medium text-slate-500">Commentaire</dt>
                  <dd>
                    <TextArea value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} placeholder="Indice, date de réception, remarque…" className="min-h-16" />
                    {note !== selected.note && (
                      <Button size="sm" className="mt-2" onClick={() => { updateDocument(study.id, selected.id, { note }, 'Commentaire'); toast('Commentaire enregistré'); }}>Enregistrer le commentaire</Button>
                    )}
                  </dd>
                </div>
                {!locked && (
                  <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} className="text-red-700 hover:bg-red-50" onClick={() => setToDelete(selected)}>Supprimer le fichier</Button>
                )}
              </dl>
            </Card>
          ) : null}
          <Card>
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"><Sparkles size={14} /> Analyse du document</div>
            <div className="space-y-2 p-4 text-sm">
              <AnalysisRow label="Pages" value={selected?.pages ?? '—'} />
              <AnalysisRow label="Prestations détectées" value="V1.3" muted />
              <AnalysisRow label="Points critiques" value="V1.3" muted />
              <AnalysisRow label="Questions" value="V1.3" muted />
              <p className="pt-1 text-xs text-slate-500">L’analyse automatique du CCTP et de la DPGF (prestations, points critiques, questions) arrive en V1.3.</p>
            </div>
          </Card>
        </div>
      </div>

      <HelpBox>
        <p>Le <strong>DCE</strong> (dossier de consultation des entreprises) regroupe les pièces transmises par le maître d’ouvrage : RC, CCAP, CCTP, DPGF et plans.</p>
        <p>Chaque fichier importé est rangé dans une catégorie. Une pièce attendue sans fichier est signalée <strong>⚠ Manquant</strong> ; si vous l’avez reçue sous un autre format (papier, plateforme), cochez-la dans l’onglet « Pièces DCE » de l’étude : elle apparaîtra « Reçu, non importé ».</p>
        <p>Les fichiers sont conservés dans ce navigateur. Toute importation, reclassement ou suppression est tracé dans l’historique de l’étude.</p>
      </HelpBox>

      <ConfirmDialog open={!!toDelete} danger title="Supprimer ce fichier ?" askReason
        message={<>Le fichier <strong>{toDelete?.name}</strong> sera retiré du DCE et son contenu effacé.</>}
        impact={toDelete && study.documents.filter((d) => d.category === toDelete.category).length === 1 && toDelete.category !== 'AUTRE'
          ? `C’était le seul fichier « ${categoryLabel(toDelete.category)} ».` : undefined}
        confirmLabel="Supprimer"
        onCancel={() => setToDelete(null)}
        onConfirm={async (reason) => {
          const d = toDelete!;
          setToDelete(null);
          const p = new URLSearchParams(params); p.delete('doc'); setParams(p, { replace: true });
          await removeDocument(study.id, d.id, reason);
          toast('Fichier supprimé');
        }} />

      <PrintDocument title="Bordereau des pièces du DCE" reference={study.reference} demo={study.isDemo}>
        <div className="mb-3 text-[13pt] font-bold">{study.name}</div>
        <PrintSection title="Pièces attendues">
          <PrintTable head={['Pièce', 'État', 'Fichier(s)']}
            rows={status.map((s) => [s.label,
              s.state === 'imported' ? 'Importé' : s.state === 'declared' ? 'Reçu, non importé' : s.state === 'missing' ? 'MANQUANT' : 'Sans objet',
              s.files.map((f) => f.name).join(', ') || '—'])} />
        </PrintSection>
        <PrintSection title={`Inventaire des fichiers (${study.documents.length})`}>
          <PrintTable head={['Fichier', 'Classement', 'Taille', 'Contenu', 'Importé le', 'Par', 'Commentaire']}
            align={['left', 'left', 'right', 'right', 'left', 'left', 'left']}
            rows={study.documents.map((d) => [d.name, categoryLabel(d.category), d.size ? formatFileSize(d.size) : '—', formatFacts(d),
              formatDateTime(d.uploadedAt), d.uploadedBy, d.note || ''])} />
        </PrintSection>
      </PrintDocument>
    </div>
  );
}

function DocRow({ doc, active, isNew, onClick }: { doc: DceFile; active: boolean; isNew: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-current={active || undefined}
      className={clsx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm cursor-pointer',
        active ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50')}>
      <FileIcon kind={doc.kind} size={16} />
      <span className={clsx('min-w-0 flex-1 truncate', active ? 'font-semibold text-brand-900' : 'text-slate-800')} title={doc.name}>{doc.name}</span>
      {isNew && <span className="rounded bg-brand-600 px-1 text-[10px] font-bold uppercase text-white">Nouveau</span>}
    </button>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="font-semibold tabular text-slate-900">{children}</dd></div>;
}

function AnalysisRow({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className={clsx('font-semibold tabular', muted ? 'rounded bg-slate-100 px-1.5 text-xs text-slate-500' : 'text-slate-900')}>{value}</span>
    </div>
  );
}
