import { useMemo } from 'react';
import { studiesToCsv } from '../domain/exports';
import { downloadBlob } from '../lib/download';
import { useToast } from '../components/ui/Toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown, FolderOpen, Plus, Printer, Search, X, Table2 } from 'lucide-react';
import { useStore } from '../state/store';
import type { Study } from '../domain/types';
import { STAGES, isActive, nextAction, stageIndex, stageOf, RISK_ORDER } from '../domain/workflow';
import { amountOf, isDueSoon, isOverdue } from '../domain/kpi';
import { formatDate, formatEuro } from '../domain/format';
import { RISK_LABELS } from '../domain/catalog';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DemoBadge, RiskBadge, StatusBadge } from '../components/ui/Badges';
import { ProgressBar } from '../components/ui/ProgressBar';
import { HelpBox } from '../components/ui/Help';
import { SelectInput } from '../components/ui/Field';
import { NextActionPill } from '../components/NextActionPill';
import { DueDate } from '../components/DueDate';
import { normalize } from '../components/layout/Header';
import { PrintDocument, PrintSection, PrintTable } from '../print/PrintDocument';

type SortKey = 'name' | 'dueDate' | 'status' | 'progress' | 'risk' | 'amount';

const FILTERS: Record<string, { label: string; test: (s: Study) => boolean }> = {
  echeance: { label: 'Échéance < 7 jours ou en retard', test: (s) => isDueSoon(s) || isOverdue(s) },
  risque: { label: 'Avec risques critiques', test: (s) => isActive(s) && (s.indicators.criticalRisks > 0 || s.riskLevel === 'critique') },
  prix: { label: 'Avec prix en attente', test: (s) => isActive(s) && s.indicators.pendingPrices > 0 },
};

const COMPARE: Record<SortKey, (a: Study, b: Study) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, 'fr'),
  dueDate: (a, b) => a.dueDate.localeCompare(b.dueDate),
  status: (a, b) => stageIndex(a.status) - stageIndex(b.status),
  progress: (a, b) => a.progress - b.progress,
  risk: (a, b) => RISK_ORDER.indexOf(a.riskLevel) - RISK_ORDER.indexOf(b.riskLevel),
  amount: (a, b) => amountOf(a) - amountOf(b),
};

export function StudiesPage() {
  const { studies } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const statut = params.get('statut') ?? 'en-cours';
  const filtre = params.get('filtre') ?? '';
  const sort = (params.get('tri') as SortKey) || 'dueDate';
  const dir = params.get('ordre') === 'desc' ? -1 : 1;

  const set = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value); else p.delete(key);
    setParams(p, { replace: true });
  };

  const rows = useMemo(() => {
    const n = normalize(q.trim());
    return studies
      .filter((s) => (statut === 'toutes' ? true : statut === 'en-cours' ? (filtre ? true : isActive(s)) : s.status === statut))
      .filter((s) => (filtre && FILTERS[filtre] ? FILTERS[filtre].test(s) : true))
      .filter((s) => !n || normalize(`${s.name} ${s.client} ${s.reference} ${s.location} ${s.owner}`).includes(n))
      .sort((a, b) => COMPARE[sort](a, b) * dir);
  }, [studies, q, statut, filtre, sort, dir]);

  const total = rows.reduce((t, s) => t + amountOf(s), 0);

  const header = (key: SortKey, label: string, className?: string) => {
    const active = sort === key;
    return (
      <th className={clsx('px-3 py-2.5', className)} aria-sort={active ? (dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button
          className={clsx('inline-flex items-center gap-1 uppercase tracking-wide cursor-pointer hover:text-slate-900', active && 'text-slate-900')}
          onClick={() => {
            const p = new URLSearchParams(params);
            p.set('tri', key);
            p.set('ordre', active && dir === 1 ? 'desc' : 'asc');
            setParams(p, { replace: true });
          }}
        >
          {label}
          {active ? (dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Mes études' }]}
        icon={<FolderOpen size={24} />}
        title="Mes études"
        subtitle="Toutes vos études de prix. Recherchez, filtrez, triez, puis cliquez sur une étude pour l’ouvrir."
        actions={
          <>
            <Button variant="secondary" icon={<Table2 size={16} />} disabled={!rows.length} onClick={() => {
              downloadBlob(new Blob([studiesToCsv(rows)], { type: 'text/csv;charset=utf-8' }), `Etudes_${new Date().toISOString().slice(0, 10)}.csv`);
              toast(`${rows.length} étude(s) exportée(s) (CSV)`);
            }}>Exporter (CSV)</Button>
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer la liste</Button>
            <Button icon={<Plus size={18} />} onClick={() => navigate('/nouvelle-etude')}>Nouvelle étude</Button>
          </>
        }
      />

      <HelpBox>
        <p>Cette liste regroupe toutes vos études. Par défaut, seules les études <strong>en cours</strong> (non remises) sont affichées.</p>
        <p>Cliquez sur un titre de colonne pour trier. La colonne <strong>Prochaine action</strong> indique quoi faire sur chaque étude.</p>
      </HelpBox>

      <Card className="no-print">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => set('q', e.target.value)}
              placeholder="Filtrer par projet, client, référence, ville…"
              aria-label="Filtrer les études"
              className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <SelectInput value={statut} onChange={(e) => set('statut', e.target.value)} className="md:w-56" aria-label="Filtrer par étape">
            <option value="en-cours">Études en cours</option>
            <option value="toutes">Toutes les études</option>
            {STAGES.map((s, i) => <option key={s.id} value={s.id}>Étape {i + 1} — {s.label}</option>)}
          </SelectInput>
          <SelectInput value={filtre} onChange={(e) => set('filtre', e.target.value)} className="md:w-64" aria-label="Filtre rapide">
            <option value="">Aucun filtre rapide</option>
            {Object.entries(FILTERS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
          </SelectInput>
        </div>
        {(q || filtre || statut !== 'en-cours') && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
            <span>{rows.length} résultat(s)</span>
            <button onClick={() => setParams({}, { replace: true })} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium hover:bg-slate-200 cursor-pointer">
              <X size={12} /> Réinitialiser les filtres
            </button>
          </div>
        )}
        <div className="max-h-[65vh] overflow-auto">
          <table className="table-sticky w-full min-w-[980px] text-sm">
            <thead className="text-left text-xs font-semibold text-slate-500">
              <tr className="[&>th]:bg-slate-50">
                {header('name', 'Projet', 'pl-5')}
                {header('dueDate', 'Remise')}
                {header('status', 'Étape')}
                {header('progress', 'Avancement', 'w-40')}
                {header('risk', 'Risque')}
                {header('amount', 'Montant HT', 'text-right')}
                <th className="px-5 py-2.5 uppercase tracking-wide">Prochaine action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => (
                <tr key={s.id} tabIndex={0} onClick={() => navigate(`/etudes/${s.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/etudes/${s.id}`)}
                  className="cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none">
                  <td className="min-w-[300px] px-5 py-3">
                    <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{s.name}</span>{s.isDemo && <DemoBadge />}</div>
                    <div className="text-xs text-slate-500">{s.reference} · {s.client} · {s.location}</div>
                  </td>
                  <td className="px-3 py-3"><DueDate iso={s.dueDate} done={!isActive(s)} /></td>
                  <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-3 py-3"><ProgressBar value={s.progress} size="sm" /></td>
                  <td className="px-3 py-3"><RiskBadge level={s.riskLevel} /></td>
                  <td className="px-3 py-3 text-right tabular font-medium" title={s.chiffrage.lines.length ? 'Prix de vente chiffré' : 'Montant estimé'}>{formatEuro(amountOf(s))}{!s.chiffrage.lines.length && <span className="ml-0.5 text-slate-400">*</span>}</td>
                  <td className="px-5 py-3"><NextActionPill action={nextAction(s)} /></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">Aucune étude ne correspond à ces critères.</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold">
                <tr>
                  <td className="px-5 py-3">{rows.length} étude(s)</td>
                  <td colSpan={4} />
                  <td className="px-3 py-3 text-right tabular">{formatEuro(total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">Montant : prix de vente chiffré ; <span className="text-slate-400">*</span> montant estimé (étude pas encore chiffrée).</p>
      </Card>

      <PrintDocument title="Liste des études" demo={rows.some((s) => s.isDemo)}>
        <PrintSection title={`${rows.length} étude(s)${filtre && FILTERS[filtre] ? ` — ${FILTERS[filtre].label}` : ''}`}>
          <PrintTable
            head={['Réf.', 'Projet / client', 'Remise', 'Étape', 'Av.', 'Risque', 'Montant HT', 'Responsable']}
            align={['left', 'left', 'left', 'left', 'right', 'left', 'right', 'left']}
            rows={rows.map((s) => [s.reference, <><strong>{s.name}</strong><br />{s.client}</>, formatDate(s.dueDate), stageOf(s.status).label,
              `${s.progress} %`, RISK_LABELS[s.riskLevel], formatEuro(amountOf(s)), s.owner])}
            foot={['', 'Total', '', '', '', '', formatEuro(total), '']}
          />
        </PrintSection>
      </PrintDocument>
    </div>
  );
}
