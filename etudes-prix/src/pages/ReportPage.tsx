import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { FileSpreadsheet, FileText, MonitorPlay, Printer, Table2 } from 'lucide-react';
import { useStore } from '../state/store';
import type { Study } from '../domain/types';
import { versionLabel } from '../domain/validation';
import { FAMILIES } from '../domain/catalog';
import { metreToCsv } from '../domain/metre';
import { chiffrageWorkbook } from '../lib/exportChiffrage';
import { downloadBlob } from '../lib/download';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge } from '../components/ui/Badges';
import { GuideBanner, HelpBox } from '../components/ui/Help';
import { useToast } from '../components/ui/Toast';
import { REPORT_SECTIONS, ReportDocument, type ReportKind, type ReportSectionId } from '../print/ReportDocument';

export function ReportPage() {
  const { id = '' } = useParams();
  const study = useStore().getStudy(id);
  if (!study) return <Card className="mx-auto max-w-lg p-8 text-center"><p className="text-lg font-semibold">Étude introuvable</p><Link to="/rapports" className="mt-4 inline-block font-medium text-brand-700 underline">Choisir une étude</Link></Card>;
  return <ReportView study={study} />;
}

function ReportView({ study }: { study: Study }) {
  const store = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [kind, setKind] = useState<ReportKind>('complet');
  const [sections, setSections] = useState<ReportSectionId[]>(REPORT_SECTIONS.map((s) => s.id));
  const hasMetre = study.metre.some((l) => !l.removedFromDpgf);

  const exportExcel = async () => {
    const blob = await chiffrageWorkbook(study, (sid) => store.suppliers.find((x) => x.id === sid)?.name ?? '');
    downloadBlob(blob, `Chiffrage_${study.reference}.xlsx`);
    toast('Chiffrage exporté (Excel)');
  };
  const exportCsv = () => {
    const label = (fid: string | null) => FAMILIES.find((f) => f.id === fid)?.label ?? 'À rattacher';
    downloadBlob(new Blob([metreToCsv(study.metre, label)], { type: 'text/csv;charset=utf-8' }), `Metre_${study.reference}.csv`);
    toast('Métré exporté (CSV)');
  };

  return (
    <div className="space-y-5">
      <div className="no-print space-y-5">
        <PageHeader
          crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Mes études', to: '/etudes' }, { label: study.reference, to: `/etudes/${study.id}` }, { label: 'Rapport' }]}
          icon={<FileText size={24} />}
          title={<span className="flex flex-wrap items-center gap-2">Rapport — {study.name} {study.isDemo && <DemoBadge />}</span>}
          subtitle={`Dossier de l’étude, version ${versionLabel(study)}${study.validation ? ' validée' : ' (projet, non validée)'}.`}
          actions={<>
            <Button variant="secondary" icon={<MonitorPlay size={16} />} onClick={() => navigate(`/presentation/${study.id}`)}>📺 Mode présentation</Button>
            <Button size="lg" icon={<Printer size={18} />} onClick={() => window.print()}>Imprimer / PDF</Button>
          </>}
        />

        <GuideBanner step="Étape 7/7" title="Rapport : le dossier final">
          Choisissez le document, vérifiez l’aperçu, puis cliquez sur <strong>Imprimer / PDF</strong>. Pour obtenir un fichier PDF,
          choisissez <strong>« Enregistrer au format PDF »</strong> comme imprimante dans la fenêtre d’impression.
          {!study.validation && <> L’étude n’est pas encore validée : le document est marqué « projet ».</>}
        </GuideBanner>

        <Card className="p-4">
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Document</div>
              <div className="flex gap-2">
                {([['complet', 'Rapport complet', 'Page de garde + 10 sections'], ['synthese', 'Synthèse réunion', 'Version courte, 1 à 2 pages']] as const).map(([k, l, d]) => (
                  <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
                    className={clsx('cursor-pointer rounded-xl border-2 px-4 py-2 text-left', kind === k ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300')}>
                    <span className="block font-semibold text-slate-900">{l}</span><span className="block text-xs text-slate-500">{d}</span>
                  </button>
                ))}
              </div>
            </div>
            {kind === 'complet' && (
              <div className="min-w-[280px] flex-1">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sections ({sections.length}/{REPORT_SECTIONS.length})</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {REPORT_SECTIONS.map((s, i) => (
                    <label key={s.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={sections.includes(s.id)}
                        onChange={(e) => setSections((cur) => (e.target.checked ? REPORT_SECTIONS.map((x) => x.id).filter((x) => x === s.id || cur.includes(x)) : cur.filter((x) => x !== s.id)))} />
                      <span className="tabular text-slate-400">{i + 2}.</span> {s.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Exports</div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={<FileSpreadsheet size={16} />} disabled={!study.chiffrage.lines.length} onClick={() => void exportExcel()}>Chiffrage (Excel)</Button>
                <Button variant="secondary" icon={<Table2 size={16} />} disabled={!hasMetre} onClick={exportCsv}>Métré (CSV)</Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="rounded-2xl bg-slate-200/70 p-4 sm:p-8 print:bg-transparent print:p-0" aria-label="Aperçu du document">
        <ReportDocument study={study} kind={kind} sections={sections} />
      </div>

      <div className="no-print">
        <HelpBox>
          <p>Le <strong>rapport complet</strong> reprend toute l’étude : page de garde (logo et nom de l’entreprise, à régler dans <Link to="/parametres" className="underline">Paramètres</Link>), synthèse, périmètre, analyse du DCE, métrés, consultations, chiffrage, risques, questions, contrôles et validation. La <strong>synthèse réunion</strong> tient sur une à deux pages.</p>
          <p>Format A4 avec en-tête, pied de page, numéro de page, date, référence affaire et version. Les exports <strong>Excel</strong> (chiffrage détaillé) et <strong>CSV</strong> (métré) s’ouvrent dans Excel.</p>
        </HelpBox>
      </div>
    </div>
  );
}
