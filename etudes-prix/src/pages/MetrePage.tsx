import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { CheckCheck, Download, FileSpreadsheet, ListPlus, Loader2, Plus, Printer, RefreshCw, Ruler, Search, Sparkles } from 'lucide-react';
import { useStore, type MetreLinePatch } from '../state/store';
import type { Study } from '../domain/types';
import { effectiveQty, formatGap, formatQty, gapOf, metreSummary, metreToCsv, type MetreLine } from '../domain/metre';
import { FAMILIES } from '../domain/catalog';
import { PRESTATION_RULES } from '../domain/analysis/prestationRules';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge } from '../components/ui/Badges';
import { GuideBanner, HelpBox, InfoTip } from '../components/ui/Help';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Field, SelectInput, TextInput } from '../components/ui/Field';
import { useToast } from '../components/ui/Toast';
import { KpiCard } from '../components/KpiCard';
import { MetreTree, type TreeSelection } from '../components/metre/MetreTree';
import { MetreTable } from '../components/metre/MetreTable';
import { MetreLineModal } from '../components/metre/MetreLineModal';
import { PrintDocument, PrintSection, PrintTable } from '../print/PrintDocument';
import { downloadBlob } from '../lib/download';
import { isLocked } from '../domain/validation';

export function MetrePage() {
  const { id = '' } = useParams();
  const { getStudy } = useStore();
  const study = getStudy(id);
  if (!study) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <p className="text-lg font-semibold">Étude introuvable</p>
        <Link to="/metre" className="mt-4 inline-block font-medium text-brand-700 underline">Choisir une étude</Link>
      </Card>
    );
  }
  return <MetreView study={study} />;
}

type Filter = 'tous' | 'ecarts' | 'a-etablir' | 'a-valider' | 'validees';

const FILTERS: [Filter, string][] = [['tous', 'Toutes'], ['ecarts', 'Écarts > 10 %'], ['a-etablir', 'À établir'], ['a-valider', 'À valider'], ['validees', 'Validées']];

type Pending =
  | { kind: 'edit'; line: MetreLine; patch: MetreLinePatch }
  | { kind: 'bulk'; ids: string[] }
  | { kind: 'init' }
  | { kind: 'delete'; line: MetreLine };

function familyLabel(id: string | null): string {
  const f = FAMILIES.find((x) => x.id === id);
  return f ? `${f.lot} · ${f.label}` : 'À rattacher';
}

function MetreView({ study }: { study: Study }) {
  const { initMetre, updateMetreLine, addMetreLine, removeMetreLine, setMetreValidation } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selection = (params.get('famille') as TreeSelection) || 'tous';
  const filter = (params.get('filtre') as Filter) || 'tous';
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const locked = isLocked(study);
  const lines = study.metre;
  const summary = useMemo(() => metreSummary(lines), [lines]);
  const hasDpgf = study.documents.some((d) => d.category === 'DPGF' && d.kind === 'excel');

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v && v !== 'tous') p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };

  const inSelection = (l: MetreLine) => {
    if (selection === 'tous') return true;
    if (selection === 'a-rattacher') return !l.familyId;
    if (selection === 'CFO' || selection === 'CFA') return FAMILIES.find((f) => f.id === l.familyId)?.lot === selection;
    return l.familyId === selection;
  };

  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    return lines.filter((l) => {
      if (!inSelection(l)) return false;
      if (n && !`${l.ref} ${l.designation} ${l.comment}`.toLowerCase().includes(n)) return false;
      const g = gapOf(l).level;
      switch (filter) {
        case 'ecarts': return g === 'important';
        case 'a-etablir': return g === 'a-etablir';
        case 'a-valider': return !l.validated && !l.removedFromDpgf;
        case 'validees': return l.validated;
        default: return true;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, q, filter, selection]);

  // Prestations du CCTP absentes de la DPGF, pas encore reprises au métré.
  const suggestions = useMemo(() => {
    const a = study.analysis;
    if (!a) return [];
    return a.comparison.filter((c) => c.status === 'cctp-seul' && !lines.some((l) => l.fromRule === c.ruleId) && !PRESTATION_RULES.find((r) => r.id === c.ruleId)?.transverse);
  }, [study.analysis, lines]);

  const openLine = lines.find((l) => l.id === openId) ?? null;
  const lineHistory = useMemo(() => (openId ? study.history.filter((h) => h.target === openId) : []), [study.history, openId]);

  /** Toute modification d'une quantité validée est confirmée (avec motif) et impose une revalidation. */
  const requestUpdate = (line: MetreLine, patch: MetreLinePatch) => {
    const next = { ...line, ...patch };
    if (line.validated && effectiveQty(next) !== effectiveQty(line)) {
      setPending({ kind: 'edit', line, patch });
      return;
    }
    updateMetreLine(study.id, line.id, patch, 'Saisie du métré');
  };

  const bulkCandidates = visible.filter((l) => !l.validated && !l.removedFromDpgf && effectiveQty(l) !== null && gapOf(l).level !== 'important');

  const runInit = async () => {
    setBusy(true);
    try {
      const r = await initMetre(study.id);
      toast(`Métré à jour : ${r.added} ajoutée(s), ${r.updated} modifiée(s), ${r.removed} retirée(s)`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Lecture de la DPGF impossible');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    downloadBlob(new Blob([metreToCsv(lines, familyLabel)], { type: 'text/csv;charset=utf-8' }), `Metre_${study.reference}.csv`);
  };

  const dialog = (() => {
    if (!pending) return null;
    switch (pending.kind) {
      case 'edit': {
        const before = effectiveQty(pending.line);
        const after = effectiveQty({ ...pending.line, ...pending.patch });
        return {
          title: 'Modifier une quantité validée ?',
          message: <>⚠️ Vous êtes sur le point de modifier la quantité retenue de <strong>{pending.line.ref} {pending.line.designation}</strong> de <strong>{formatQty(before)}</strong> à <strong>{formatQty(after)} {pending.line.unit}</strong>.</>,
          impact: 'Cette modification impactera le chiffrage. La ligne devra être revalidée.',
          confirmLabel: 'Modifier', askReason: true,
        };
      }
      case 'bulk':
        return {
          title: `Valider ${pending.ids.length} ligne(s) ?`,
          message: <>Les lignes affichées ayant une quantité et <strong>sans écart supérieur à 10 %</strong> seront validées avec leur quantité retenue (ou proposée).</>,
          impact: 'Les lignes présentant un écart important restent à examiner une par une.',
          confirmLabel: 'Valider', askReason: true,
        };
      case 'init':
        return {
          title: 'Mettre à jour le métré depuis la DPGF ?',
          message: <>Les nouvelles lignes de la DPGF seront ajoutées. Vos quantités calculées, retenues, détails et commentaires sont <strong>conservés</strong>.</>,
          impact: 'Une ligne dont la quantité DPGF a changé perd sa validation ; une ligne disparue de la DPGF est signalée « retirée ».',
          confirmLabel: 'Mettre à jour', askReason: false,
        };
      case 'delete':
        return {
          title: 'Supprimer cette ligne ?',
          message: <>La ligne <strong>{pending.line.ref} {pending.line.designation}</strong> sera retirée du métré.</>,
          confirmLabel: 'Supprimer', askReason: true, danger: true,
        };
    }
  })();

  const confirm = (reason: string) => {
    if (!pending) return;
    switch (pending.kind) {
      case 'edit': updateMetreLine(study.id, pending.line.id, pending.patch, reason || 'Modification après validation'); toast('Quantité modifiée — à revalider'); break;
      case 'bulk': setMetreValidation(study.id, pending.ids, true, reason || 'Validation groupée'); toast(`${pending.ids.length} ligne(s) validée(s)`); break;
      case 'init': void runInit(); break;
      case 'delete': removeMetreLine(study.id, pending.line.id, reason); setOpenId(null); toast('Ligne supprimée'); break;
    }
    setPending(null);
  };

  const selectionLabel = selection === 'tous' ? 'Tous les postes' : selection === 'a-rattacher' ? 'À rattacher' : selection === 'CFO' || selection === 'CFA' ? selection : familyLabel(selection);
  const pctValidated = summary.total ? Math.round((summary.validated / summary.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Mes études', to: '/etudes' }, { label: study.reference, to: `/etudes/${study.id}` }, { label: 'Métré' }]}
        icon={<Ruler size={24} />}
        title={<span className="flex flex-wrap items-center gap-2">Métré — {study.name} {study.isDemo && <DemoBadge />}</span>}
        subtitle="Quantités par poste : DPGF, calculé par l’entreprise, retenu pour le chiffrage."
        actions={lines.length > 0 && (
          <>
            <Button variant="secondary" icon={<Download size={16} />} onClick={exportCsv}>Exporter (CSV)</Button>
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer</Button>
            {hasDpgf && <Button variant="secondary" icon={busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} disabled={locked || busy} onClick={() => setPending({ kind: 'init' })}>Mettre à jour depuis la DPGF</Button>}
            <Button icon={<Plus size={16} />} disabled={locked} onClick={() => setAdding(true)}>Ajouter une ligne</Button>
          </>
        )}
      />

      <GuideBanner step="Étape 2/7" title="Métré : établir et valider les quantités">
        {lines.length
          ? <>Pour chaque poste, saisissez la quantité <strong>calculée</strong> (directement ou via le détail 📐), vérifiez l’<strong>écart</strong> avec la DPGF, puis <strong>validez</strong>. Commencez par les écarts importants (filtre « Écarts &gt; 10 % »).</>
          : <>Le métré se crée à partir des lignes de la DPGF. Chaque ligne pourra ensuite être recalculée, commentée et validée.</>}
      </GuideBanner>

      {lines.length === 0 ? (
        <Card className="p-8">
          <div className="mx-auto max-w-xl text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><FileSpreadsheet size={28} /></span>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Aucun métré pour cette étude</h2>
            <p className="mt-2 text-sm text-slate-600">
              {hasDpgf ? 'La DPGF est importée : créez le métré à partir de ses lignes.' : 'Importez d’abord la DPGF (format Excel) dans le DCE, ou ajoutez les lignes manuellement.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {!hasDpgf && <Button variant="secondary" onClick={() => navigate(`/etudes/${study.id}/dce`)}>Ouvrir le DCE</Button>}
              <Button variant="secondary" icon={<Plus size={16} />} disabled={locked} onClick={() => setAdding(true)}>Ajouter une ligne</Button>
              {hasDpgf && <Button size="lg" icon={busy ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />} disabled={locked || busy} onClick={() => void runInit()}>Créer le métré depuis la DPGF</Button>}
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="no-print grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Lignes" value={summary.total} icon={<Ruler size={18} />} tone="brand" hint={summary.unassigned ? `${summary.unassigned} à rattacher` : 'Toutes rattachées'} />
            <KpiCard label="Validées" value={`${pctValidated} %`} icon={<CheckCheck size={18} />} tone="emerald" hint={`${summary.validated} / ${summary.total} lignes`} />
            <KpiCard label="Écarts > 10 %" value={summary.majorGaps} icon={<span className="font-bold">▲</span>} tone="red" hint={`${summary.minorGaps} écart(s) mineur(s)`}
              help="Écart entre la quantité retenue et la quantité de la DPGF. Au-delà de 10 %, l’écart est à justifier ou à signaler au maître d’ouvrage." />
            <KpiCard label="À établir" value={summary.toEstablish} icon={<span className="font-bold">⚠</span>} tone="amber" hint="Lignes sans aucune quantité" />
          </div>

          {suggestions.length > 0 && !locked && (
            <div className="no-print rounded-xl border border-violet-200 bg-violet-50 px-5 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-violet-900"><Sparkles size={16} /> {suggestions.length} prestation(s) du CCTP absente(s) de la DPGF — à ajouter au métré ?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Button key={s.ruleId} size="sm" variant="secondary" icon={<ListPlus size={14} />} onClick={() => {
                    const n = lines.filter((l) => l.source === 'manuel').length + 1;
                    addMetreLine(study.id, { familyId: s.familyId, ref: `A${n}`, designation: s.label, unit: 'ens', section: 'Ajouts CCTP', fromRule: s.ruleId,
                      comment: `Prestation du CCTP (p. ${s.cctpPages.join(', ')}) absente de la DPGF` });
                    toast(`« ${s.label} » ajouté au métré`);
                  }}>{s.label}</Button>
                ))}
              </div>
            </div>
          )}

          <div className="no-print grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Card className="h-fit p-3 lg:sticky lg:top-20">
              <p className="mb-2 flex items-center gap-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Postes <InfoTip text="Cliquez sur une famille pour afficher ses lignes. La barre indique la part de lignes validées ; ▲ = écarts > 10 %, ⚠ = quantités à établir." />
              </p>
              <MetreTree lines={lines} lots={study.lots} families={study.families} selected={selection} onSelect={(s) => set('famille', s)} />
            </Card>

            <Card className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
                <h2 className="mr-2 font-semibold text-slate-900">{selectionLabel}</h2>
                {FILTERS.map(([f, l]) => (
                  <button key={f} onClick={() => set('filtre', f)} aria-pressed={filter === f}
                    className={clsx('rounded-full px-3 py-1 text-xs font-medium cursor-pointer', filter === f ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}>{l}</button>
                ))}
                <span className="flex-1" />
                <div className="relative w-full sm:w-60">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un poste…" aria-label="Rechercher dans le métré"
                    className="h-8 w-full rounded-lg border border-slate-300 pl-8 pr-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
                </div>
                {!locked && bulkCandidates.length > 0 && (
                  <Button size="sm" variant="success" icon={<CheckCheck size={14} />} onClick={() => setPending({ kind: 'bulk', ids: bulkCandidates.map((l) => l.id) })}>
                    Valider sans écart ({bulkCandidates.length})
                  </Button>
                )}
              </div>
              <MetreTable
                lines={visible}
                locked={locked}
                revision={revision}
                showFamily={selection === 'tous' || selection === 'CFO' || selection === 'CFA'}
                onCommit={(l, field, v) => requestUpdate(l, { [field]: v })}
                onToggleValidated={(l) => {
                  setMetreValidation(study.id, [l.id], !l.validated, l.validated ? 'Dévalidation' : 'Validation');
                  toast(l.validated ? 'Ligne dévalidée' : 'Quantité validée');
                }}
                onOpen={(l) => setOpenId(l.id)}
              />
            </Card>
          </div>
        </>
      )}

      <HelpBox>
        <p>Le <strong>métré</strong> consiste à établir les quantités de chaque poste. Trois colonnes : <strong>DPGF</strong> (quantité du maître d’ouvrage), <strong>Calculé</strong> (votre comptage, par exemple sur plans) et <strong>Retenu</strong> (la quantité qui sera chiffrée).</p>
        <p>Si vous ne saisissez pas de quantité retenue, l’application <em>propose</em> la quantité calculée, sinon celle de la DPGF (affichée en gris italique). L’<strong>écart</strong> compare le retenu à la DPGF : ▲ au-dessus, ▼ en dessous ; au-delà de 10 % il est signalé en rouge.</p>
        <p>Cliquez sur une désignation pour saisir le <strong>détail du calcul</strong> (ex. 12 bureaux × 4 prises), un commentaire, ou consulter l’<strong>historique</strong> de la ligne. Colonnes triables et redimensionnables (bord droit des en-têtes).</p>
      </HelpBox>

      {openLine && (
        <MetreLineModal line={openLine} history={lineHistory} locked={locked} onClose={() => setOpenId(null)}
          onSave={(patch) => {
            if (Object.keys(patch).length) { requestUpdate(openLine, patch); toast('Ligne enregistrée'); }
            setOpenId(null);
          }}
          onDelete={() => setPending({ kind: 'delete', line: openLine })} />
      )}

      {adding && <AddLineModal defaultFamily={selection.includes('-') && selection !== 'a-rattacher' ? selection : ''} onClose={() => setAdding(false)}
        onAdd={(data) => {
          const l = addMetreLine(study.id, data);
          setAdding(false);
          if (data.familyId) set('famille', data.familyId);
          toast(`Ligne « ${l.designation} » ajoutée`);
        }} />}

      {dialog && (
        <ConfirmDialog open title={dialog.title} message={dialog.message} impact={'impact' in dialog ? dialog.impact : undefined} confirmLabel={dialog.confirmLabel}
          askReason={dialog.askReason} danger={'danger' in dialog ? dialog.danger : false} onCancel={() => { setPending(null); setRevision((r) => r + 1); }} onConfirm={confirm} />
      )}

      <PrintDocument title="Métré" reference={study.reference} version={`${pctValidated} % validé`} demo={study.isDemo}>
        <div className="mb-3 text-[13pt] font-bold">{study.name}</div>
        <PrintSection title="Synthèse">
          <PrintTable head={['Lignes', 'Validées', 'Écarts > 10 %', 'Écarts mineurs', 'À établir', 'À rattacher']} align={['center', 'center', 'center', 'center', 'center', 'center']}
            rows={[[summary.total, `${summary.validated} (${pctValidated} %)`, summary.majorGaps, summary.minorGaps, summary.toEstablish, summary.unassigned]]} />
        </PrintSection>
        {[...FAMILIES.map((f) => f.id), null].map((fid) => {
          const own = lines.filter((l) => l.familyId === fid && !l.removedFromDpgf);
          if (!own.length) return null;
          return (
            <PrintSection key={fid ?? 'none'} title={familyLabel(fid)}>
              <PrintTable head={['Poste', 'Désignation', 'U', 'DPGF', 'Calculé', 'Retenu', 'Écart', 'Validé']}
                align={['left', 'left', 'center', 'right', 'right', 'right', 'right', 'center']}
                rows={own.map((l) => [l.ref, <>{l.designation}{l.comment && <><br /><em>{l.comment}</em></>}</>, l.unit, formatQty(l.dpgfQty), formatQty(l.calcQty),
                  formatQty(effectiveQty(l)), gapOf(l).level === 'sans-dpgf' ? 'hors DPGF' : formatGap(gapOf(l)), l.validated ? '✓' : ''])} />
            </PrintSection>
          );
        })}
      </PrintDocument>
    </div>
  );
}

function AddLineModal({ defaultFamily, onClose, onAdd }: {
  defaultFamily: string;
  onClose: () => void;
  onAdd: (d: Pick<MetreLine, 'familyId' | 'ref' | 'designation' | 'unit'> & { calcQty: number | null }) => void;
}) {
  const [familyId, setFamilyId] = useState(defaultFamily);
  const [ref, setRef] = useState('');
  const [designation, setDesignation] = useState('');
  const [unit, setUnit] = useState('u');
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  return (
    <Modal open onClose={onClose} title="Ajouter une ligne au métré"
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => {
        if (!designation.trim()) { setError('Indiquez la désignation.'); return; }
        const n = qty.trim() ? Number(qty.replace(',', '.')) : null;
        if (n !== null && !(n >= 0)) { setError('Quantité invalide.'); return; }
        onAdd({ familyId: familyId || null, ref: ref.trim(), designation: designation.trim(), unit: unit.trim(), calcQty: n });
      }}>Ajouter</Button></>}>
      <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
        <Field label="Poste"><TextInput value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ex. A3" /></Field>
        <Field label="Désignation" required error={error}><TextInput value={designation} onChange={(e) => { setDesignation(e.target.value); setError(''); }} placeholder="Ex. Prises de sol supplémentaires" /></Field>
        <Field label="Unité"><TextInput value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>
        <Field label="Quantité calculée"><TextInput value={qty} inputMode="decimal" onChange={(e) => setQty(e.target.value)} placeholder="Optionnel" /></Field>
        <Field label="Famille" className="sm:col-span-2">
          <SelectInput value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
            <option value="">— À rattacher —</option>
            {(['CFO', 'CFA'] as const).map((lot) => (
              <optgroup key={lot} label={lot}>{FAMILIES.filter((f) => f.lot === lot).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</optgroup>
            ))}
          </SelectInput>
        </Field>
      </div>
    </Modal>
  );
}
