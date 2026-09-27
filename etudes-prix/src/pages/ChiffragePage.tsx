import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { Calculator, Download, Import, Printer, Ruler, Search, Sparkles, Target } from 'lucide-react';
import { useStore } from '../state/store';
import type { Study } from '../domain/types';
import {
  buildUp, isPriced, lineCost, lineSalePrice, marginForTarget, SOURCE_LABELS, STATUS_LABELS, type PriceLine, type PricingParams, type SourceStatus,
} from '../domain/chiffrage';
import { importRetainedOffers, baseLineFor } from '../domain/priceBase';
import { FAMILIES } from '../domain/catalog';
import { formatQty } from '../domain/metre';
import { formatEuro } from '../domain/format';

const formatCoef = (c: number | null) => (c === null ? '—' : c.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }));
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge } from '../components/ui/Badges';
import { GuideBanner, HelpBox, InfoTip } from '../components/ui/Help';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SelectInput, TextInput } from '../components/ui/Field';
import { useToast } from '../components/ui/Toast';
import { SourceBadge } from '../components/chiffrage/SourceBadge';
import { PriceLineModal } from '../components/chiffrage/PriceLineModal';
import { chiffrageWorkbook } from '../lib/exportChiffrage';
import { downloadBlob } from '../lib/download';
import { PrintDocument, PrintSection, PrintTable } from '../print/PrintDocument';
import { isLocked } from '../domain/validation';

export function ChiffragePage() {
  const { id = '' } = useParams();
  const { getStudy } = useStore();
  const study = getStudy(id);
  if (!study) {
    return <Card className="mx-auto max-w-lg p-8 text-center"><p className="text-lg font-semibold">Étude introuvable</p><Link to="/chiffrage" className="mt-4 inline-block font-medium text-brand-700 underline">Choisir une étude</Link></Card>;
  }
  return <ChiffrageView study={study} />;
}

type Filter = 'tous' | 'manquant' | SourceStatus;
type Sort = 'poste' | 'total';

const DEFINITIONS = {
  ds: 'Le déboursé sec correspond aux coûts directs nécessaires à la réalisation de la prestation (matériel, main-d’œuvre, sous-traitance) avant frais généraux, marge et autres éléments de vente.',
  pr: 'Le prix de revient ajoute au déboursé sec les frais de chantier, les frais généraux de l’entreprise et une provision pour aléas : c’est ce que coûte réellement l’affaire.',
  pv: 'Le prix de vente est le prix de revient augmenté de la marge. C’est le montant HT remis au client.',
};

function BigNumber({ label, value, help, tone, sub }: { label: string; value: number; help: string; tone: string; sub?: ReactNode }) {
  return (
    <div className={clsx('rounded-xl border bg-white p-5 shadow-sm', tone)}>
      <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label} <InfoTip text={help} /></div>
      <div className="mt-1 text-3xl font-bold tabular tracking-tight text-slate-900">{formatEuro(value)}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

type Pending =
  | { kind: 'price'; metreLineId: string; patch: Omit<PriceLine, 'metreLineId'>; before: number; after: number; pvBefore: number; pvAfter: number }
  | { kind: 'params'; params: PricingParams; pvBefore: number; pvAfter: number }
  | { kind: 'base'; count: number }
  | { kind: 'offers'; count: number; kept: number };

function ChiffrageView({ study }: { study: Study }) {
  const store = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [family, setFamily] = useState('');
  const [filter, setFilter] = useState<Filter>('tous');
  const [sort, setSort] = useState<Sort>('poste');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [params, setParams] = useState<PricingParams>(study.chiffrage.params);
  const [target, setTarget] = useState('');
  const locked = isLocked(study);
  const ch = study.chiffrage;
  const b = useMemo(() => buildUp(study.metre, ch), [study.metre, ch]);
  const paramsDirty = JSON.stringify(params) !== JSON.stringify(ch.params);
  const preview = useMemo(() => (paramsDirty ? buildUp(study.metre, { ...ch, params }) : b), [paramsDirty, study.metre, ch, params, b]);

  const baseCandidates = study.metre.filter((m) => !m.removedFromDpgf && !ch.lines.some((l) => l.metreLineId === m.id) && baseLineFor(m)).length;
  const offersPreview = useMemo(() => importRetainedOffers(study.consultations, study.metre, ch.lines), [study.consultations, study.metre, ch.lines]);
  const offersToApply = offersPreview.lines.filter((l) => {
    const prev = ch.lines.find((x) => x.metreLineId === l.metreLineId);
    return JSON.stringify(prev) !== JSON.stringify(l);
  }).length;

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return study.metre
      .filter((m) => !m.removedFromDpgf)
      .filter((m) => !family || (family === 'aucune' ? !m.familyId : m.familyId === family))
      .filter((m) => !n || `${m.ref} ${m.designation}`.toLowerCase().includes(n))
      .map((m) => {
        const p = ch.lines.find((l) => l.metreLineId === m.id);
        const c = lineCost(m, p, ch.params);
        return { m, p, c, pv: lineSalePrice(c, b), status: (c.missing ? 'manquant' : p!.source.status) as Filter };
      })
      .filter((r) => filter === 'tous' || r.status === filter);
  }, [study.metre, ch, b, q, family, filter]);

  const groups = useMemo(() => {
    const byFam = [...FAMILIES.map((f) => f.id), null].map((fid) => ({
      fid, rows: rows.filter((r) => r.m.familyId === fid).sort((x, y) => (sort === 'total' ? y.c.total - x.c.total : x.m.ref.localeCompare(y.m.ref, 'fr', { numeric: true }))),
    })).filter((g) => g.rows.length);
    return byFam;
  }, [rows, sort]);

  const openLine = study.metre.find((m) => m.id === openId);
  const history = openId ? study.history.filter((h) => h.target === `prix:${openId}`) : [];
  const supplierName = (id?: string) => store.suppliers.find((s) => s.id === id)?.name ?? '';

  /** Prix confirmé modifié ou écart ≥ 1 000 € : confirmation avec motif (impact sur le prix de vente). */
  const requestSave = (metreLineId: string, patch: Omit<PriceLine, 'metreLineId'>) => {
    const m = study.metre.find((x) => x.id === metreLineId)!;
    const prev = ch.lines.find((l) => l.metreLineId === metreLineId);
    const before = lineCost(m, prev, ch.params).total;
    const after = lineCost(m, { metreLineId, ...patch }, ch.params).total;
    const nextLines = [...ch.lines.filter((l) => l.metreLineId !== metreLineId), { metreLineId, ...patch }];
    const pvAfter = buildUp(study.metre, { ...ch, lines: nextLines }).salePrice;
    if (before !== after && (prev?.source.status === 'confirme' || Math.abs(after - before) >= 1000)) {
      setPending({ kind: 'price', metreLineId, patch, before, after, pvBefore: b.salePrice, pvAfter });
      return;
    }
    store.updatePriceLine(study.id, metreLineId, patch, 'Saisie du chiffrage');
    setOpenId(null);
    toast('Prix enregistré');
  };

  const dialog = (() => {
    if (!pending) return null;
    switch (pending.kind) {
      case 'price': {
        const m = study.metre.find((x) => x.id === pending.metreLineId)!;
        return { title: 'Modifier ce prix ?', confirm: 'Confirmer', required: false,
          message: <>⚠️ Vous êtes sur le point de modifier le prix retenu de <strong>{m.ref} {m.designation}</strong> de <strong>{formatEuro(pending.before)}</strong> à <strong>{formatEuro(pending.after)}</strong>.</>,
          impact: `Cette modification impactera le prix de vente : ${formatEuro(pending.pvBefore)} → ${formatEuro(pending.pvAfter)}.` };
      }
      case 'params':
        return { title: 'Appliquer ces paramètres ?', confirm: 'Appliquer', required: false,
          message: <>Les paramètres de calcul seront modifiés.</>, impact: `Prix de vente : ${formatEuro(pending.pvBefore)} → ${formatEuro(pending.pvAfter)}.` };
      case 'base':
        return { title: 'Pré-remplir avec la base de prix ?', confirm: 'Pré-remplir', required: false,
          message: <><strong>{pending.count}</strong> ligne(s) sans prix recevront un prix de fourniture et un temps de pose issus de la base indicative de l’application.</>,
          impact: 'Ces prix sont marqués « 🟡 Estimé » : ils doivent être confirmés par une offre ou remplacés par vos propres prix.' };
      case 'offers':
        return { title: 'Reporter les offres retenues ?', confirm: 'Reporter', required: false,
          message: <><strong>{pending.count}</strong> ligne(s) seront mises à jour avec les prix des offres retenues dans les consultations (statut « 🟢 Confirmé »).</>,
          impact: pending.kept ? `${pending.kept} ligne(s) dont le prix a été confirmé à la main ne seront pas modifiées.` : 'Les prix de base ou estimés de ces lignes seront remplacés.' };
    }
  })();

  const confirm = (reason: string) => {
    if (!pending) return;
    switch (pending.kind) {
      case 'price': store.updatePriceLine(study.id, pending.metreLineId, pending.patch, reason || 'Modification de prix'); setOpenId(null); toast('Prix modifié'); break;
      case 'params': store.setPricingParams(study.id, pending.params, reason || 'Paramètres de chiffrage'); toast('Paramètres appliqués'); break;
      case 'base': toast(`${store.applyBasePrices(study.id)} ligne(s) pré-remplie(s)`); break;
      case 'offers': toast(`${store.importOffers(study.id).applied} ligne(s) mise(s) à jour depuis les offres`); break;
    }
    setPending(null);
  };

  const exportExcel = async () => {
    const blob = await chiffrageWorkbook(study, supplierName);
    downloadBlob(blob, `Chiffrage_${study.reference}.xlsx`);
    toast('Chiffrage exporté');
  };

  const pct = (n: number) => `${Math.round((n / (b.salePrice || 1)) * 1000) / 10} %`;
  const num = (s: string) => { const n = Number(s.replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : NaN; };

  if (!study.metre.length) {
    return (
      <div className="space-y-5">
        <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: study.reference, to: `/etudes/${study.id}` }, { label: 'Chiffrage' }]} icon={<Calculator size={24} />} title={`Chiffrage — ${study.name}`} />
        <Card className="p-8 text-center">
          <Ruler size={36} className="mx-auto text-slate-300" />
          <p className="mt-3 font-semibold text-slate-800">Le chiffrage s’appuie sur le métré</p>
          <p className="text-sm text-slate-500">Créez d’abord le métré (quantités par poste) : chaque ligne recevra ensuite ses prix.</p>
          <Button className="mt-4" onClick={() => navigate(`/etudes/${study.id}/metre`)}>Ouvrir le métré</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Mes études', to: '/etudes' }, { label: study.reference, to: `/etudes/${study.id}` }, { label: 'Chiffrage' }]}
        icon={<Calculator size={24} />}
        title={<span className="flex flex-wrap items-center gap-2">Chiffrage — {study.name} {study.isDemo && <DemoBadge />}</span>}
        subtitle="Prix de chaque poste, du déboursé sec au prix de vente."
        actions={<>
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => void exportExcel()}>Exporter (Excel)</Button>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimer</Button>
        </>}
      />

      <GuideBanner step="Étape 4/7" title="Chiffrage : du déboursé au prix de vente">
        Reportez les <strong>offres retenues</strong>, pré-remplissez le reste avec la <strong>base de prix</strong>, puis ajustez chaque ligne (cliquez dessus pour voir la <strong>source du prix</strong>).
        Réglez enfin frais et marge pour obtenir le <strong>prix de vente</strong>.
      </GuideBanner>

      <div className="no-print grid gap-4 md:grid-cols-3">
        <BigNumber label="Déboursé sec" value={b.dryCost} help={DEFINITIONS.ds} tone="border-slate-200"
          sub={<>Matériel {formatEuro(b.material)} · MO {formatEuro(b.labor)} ({formatQty(b.laborHours)} h) · ST {formatEuro(b.subcontract)}</>} />
        <BigNumber label="Prix de revient" value={b.costPrice} help={DEFINITIONS.pr} tone="border-slate-200"
          sub={<>+ {formatEuro(b.costPrice - b.dryCost)} de frais et aléas</>} />
        <BigNumber label="Prix de vente HT" value={b.salePrice} help={DEFINITIONS.pv} tone="border-brand-300 ring-2 ring-brand-100"
          sub={<>Marge {formatEuro(b.margin)} ({ch.params.marginPct} %) · coefficient {formatCoef(b.coefficient)} · estimé à la création : {formatEuro(study.estimatedAmount)}</>} />
      </div>

      <div className="no-print flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">{b.lines} lignes :</span>
        <button onClick={() => setFilter('manquant')} className="cursor-pointer"><SourceBadge status="manquant" /> <span className="text-sm font-semibold tabular">{b.missing}</span></button>
        <button onClick={() => setFilter('estime')} className="cursor-pointer"><SourceBadge status="estime" /> <span className="text-sm font-semibold tabular">{b.estimated}</span></button>
        <button onClick={() => setFilter('a-confirmer')} className="cursor-pointer"><SourceBadge status="a-confirmer" /> <span className="text-sm font-semibold tabular">{b.toConfirm}</span></button>
        <button onClick={() => setFilter('confirme')} className="cursor-pointer"><SourceBadge status="confirme" /> <span className="text-sm font-semibold tabular">{b.lines - b.missing - b.estimated - b.toConfirm}</span></button>
        <span className="flex-1" />
        {!locked && offersToApply > 0 && <Button variant="success" icon={<Import size={16} />} onClick={() => setPending({ kind: 'offers', count: offersToApply, kept: offersPreview.kept.length })}>Reporter les offres retenues ({offersToApply})</Button>}
        {!locked && baseCandidates > 0 && <Button variant="secondary" icon={<Sparkles size={16} />} onClick={() => setPending({ kind: 'base', count: baseCandidates })}>Pré-remplir avec la base de prix ({baseCandidates})</Button>}
      </div>

      <div className="no-print grid gap-5 min-[1800px]:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <div className="relative w-full sm:w-64">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un poste…" aria-label="Rechercher dans le chiffrage"
                className="h-9 w-full rounded-lg border border-slate-300 pl-8 pr-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
            </div>
            <SelectInput value={family} onChange={(e) => setFamily(e.target.value)} className="!h-9 !py-1 sm:w-56" aria-label="Famille">
              <option value="">Toutes les familles</option>
              {FAMILIES.filter((f) => study.metre.some((m) => m.familyId === f.id)).map((f) => <option key={f.id} value={f.id}>{f.lot} · {f.label}</option>)}
            </SelectInput>
            <SelectInput value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="!h-9 !py-1 sm:w-44" aria-label="Statut du prix">
              <option value="tous">Tous les prix</option><option value="manquant">Manquants</option><option value="estime">Estimés</option><option value="a-confirmer">À confirmer</option><option value="confirme">Confirmés</option>
            </SelectInput>
            <SelectInput value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="!h-9 !py-1 sm:w-48" aria-label="Tri">
              <option value="poste">Tri par poste</option><option value="total">Tri par montant décroissant</option>
            </SelectInput>
          </div>
          <div className="max-h-[calc(100vh-14rem)] overflow-auto">
            <table className="table-sticky w-full min-w-[1080px] text-sm">
              <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr className="[&>th]:bg-slate-100">
                  <th className="px-3 py-2">Poste</th><th className="px-2 py-2">Désignation</th><th className="px-2 py-2 text-right">Qté</th><th className="px-2 py-2 text-right" title="Déboursé sec unitaire">PU</th>
                  <th className="px-2 py-2 text-right">Matériel</th><th className="px-2 py-2 text-right">MO</th><th className="px-2 py-2 text-right">ST</th><th className="px-2 py-2 text-right">Total DS</th>
                  <th className="px-2 py-2 text-right">Prix vente</th><th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              {groups.map((g) => {
                const fam = FAMILIES.find((f) => f.id === g.fid);
                const sub = g.rows.reduce((t, r) => t + r.c.total, 0);
                const subPv = g.rows.reduce((t, r) => t + (r.pv ?? 0), 0);
                return (
                  <tbody key={g.fid ?? 'none'} className="divide-y divide-slate-100">
                    <tr className="bg-slate-50">
                      <td colSpan={7} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">{fam ? `${fam.lot} · ${fam.label}` : 'À rattacher'}</td>
                      <td className="px-2 py-1.5 text-right text-xs font-bold tabular">{formatEuro(sub)}</td>
                      <td className="px-2 py-1.5 text-right text-xs font-bold tabular">{formatEuro(subPv)}</td>
                      <td />
                    </tr>
                    {g.rows.map(({ m, p, c, pv, status }) => (
                      <tr key={m.id} tabIndex={0} onClick={() => setOpenId(m.id)} onKeyDown={(e) => e.key === 'Enter' && setOpenId(m.id)}
                        className={clsx('cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none', status === 'manquant' && 'bg-red-50/40')}>
                        <td className="px-3 py-2 tabular text-slate-600">{m.ref}</td>
                        <td className="max-w-72 px-2 py-2">
                          <div className="truncate text-slate-900" title={m.designation}>{m.designation}</div>
                          {p?.comment && <div className="truncate text-[11px] text-slate-500">💬 {p.comment}</div>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular">{formatQty(c.qty)} {m.unit}</td>
                        <td className="px-2 py-2 text-right tabular">{c.unitCost !== null && !c.missing ? formatEuro(c.unitCost) : '—'}</td>
                        <td className="px-2 py-2 text-right tabular">{c.material ? formatEuro(c.material) : '—'}</td>
                        <td className="px-2 py-2 text-right tabular" title={`${formatQty(c.laborHours)} h`}>{c.labor ? formatEuro(c.labor) : '—'}</td>
                        <td className="px-2 py-2 text-right tabular">{c.subcontract ? formatEuro(c.subcontract) : '—'}</td>
                        <td className="px-2 py-2 text-right font-semibold tabular">{formatEuro(c.total)}</td>
                        <td className="px-2 py-2 text-right tabular">{pv !== null ? formatEuro(pv) : '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-start gap-0.5">
                            <SourceBadge status={status === 'tous' ? 'manquant' : (status as SourceStatus | 'manquant')} />
                            {p && isPriced(p) && <span className="max-w-40 truncate text-[11px] text-slate-500">{SOURCE_LABELS[p.source.kind]}{p.source.supplierId ? ` · ${supplierName(p.source.supplierId)}` : ''}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                );
              })}
              <tfoot className="sticky bottom-0 bg-slate-100 text-sm font-bold">
                <tr>
                  <td colSpan={4} className="border-t-2 border-slate-300 px-3 py-2">Total ({rows.length} ligne(s))</td>
                  <td className="border-t-2 border-slate-300 px-2 py-2 text-right tabular">{formatEuro(rows.reduce((t, r) => t + r.c.material, 0))}</td>
                  <td className="border-t-2 border-slate-300 px-2 py-2 text-right tabular">{formatEuro(rows.reduce((t, r) => t + r.c.labor, 0))}</td>
                  <td className="border-t-2 border-slate-300 px-2 py-2 text-right tabular">{formatEuro(rows.reduce((t, r) => t + r.c.subcontract, 0))}</td>
                  <td className="border-t-2 border-slate-300 px-2 py-2 text-right tabular">{formatEuro(rows.reduce((t, r) => t + r.c.total, 0))}</td>
                  <td className="border-t-2 border-slate-300 px-2 py-2 text-right tabular">{formatEuro(rows.reduce((t, r) => t + (r.pv ?? 0), 0))}</td>
                  <td className="border-t-2 border-slate-300" />
                </tr>
              </tfoot>
            </table>
            {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">Aucune ligne dans cette sélection.</p>}
          </div>
        </Card>

        <Card className="h-fit min-[1800px]:sticky min-[1800px]:top-20">
          <CardHeader icon={<Target size={18} />} title="Du déboursé au prix de vente" subtitle={paramsDirty ? 'Aperçu avec les nouveaux paramètres' : undefined} />
          <div className="space-y-4 p-4 text-sm">
            <dl className="space-y-1.5">
              {([
                ['Déboursé sec', preview.dryCost, 'strong'],
                [`+ Frais de chantier (${params.siteCostsPct} %)`, preview.siteCosts, ''],
                [`+ Frais généraux (${params.overheadPct} %)`, preview.overhead, ''],
                [`+ Aléas (${params.riskPct} %)`, preview.risk, ''],
                ['= Prix de revient', preview.costPrice, 'strong'],
                [`+ Marge (${params.marginPct} % du PV)`, preview.margin, ''],
                ['= Prix de vente HT', preview.salePrice, 'total'],
              ] as [string, number, string][]).map(([label, v, kind]) => (
                <div key={label} className={clsx('flex justify-between gap-2', kind === 'strong' && 'border-t border-slate-200 pt-1.5 font-semibold', kind === 'total' && 'rounded-lg bg-brand-50 px-2 py-1.5 text-base font-bold text-brand-900')}>
                  <dt>{label}</dt><dd className="tabular">{formatEuro(v)}</dd>
                </div>
              ))}
            </dl>
            {!locked && (
              <>
                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  {([['hourlyRate', 'Taux horaire (€/h)'], ['siteCostsPct', 'Frais chantier (%)'], ['overheadPct', 'Frais généraux (%)'], ['riskPct', 'Aléas (%)'], ['marginPct', 'Marge (%)']] as [keyof PricingParams, string][]).map(([k, l]) => (
                    <label key={k} className="block">
                      <span className="text-xs text-slate-600">{l}</span>
                      <TextInput inputMode="decimal" value={String(params[k]).replace('.', ',')} className="!py-1"
                        onChange={(e) => { const n = num(e.target.value); if (!Number.isNaN(n) && (k === 'hourlyRate' || n < 100)) setParams({ ...params, [k]: n }); }} />
                    </label>
                  ))}
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <span className="text-xs text-slate-600">Prix de vente visé (€ HT) → marge calculée</span>
                  <div className="mt-1 flex gap-2">
                    <TextInput inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={String(Math.round(preview.salePrice))} className="!py-1" />
                    <Button size="sm" variant="secondary" disabled={Number.isNaN(num(target)) || !target} onClick={() => setParams({ ...params, marginPct: marginForTarget(num(target), preview.costPrice) })}>Calculer</Button>
                  </div>
                  {params.marginPct < 0 && <p className="mt-1 text-xs font-semibold text-red-700">⚠ Marge négative : prix de vente inférieur au prix de revient.</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={!paramsDirty} onClick={() => setPending({ kind: 'params', params, pvBefore: b.salePrice, pvAfter: preview.salePrice })}>Appliquer</Button>
                  {paramsDirty && <Button size="sm" variant="ghost" onClick={() => { setParams(ch.params); setTarget(''); }}>Annuler</Button>}
                </div>
              </>
            )}
            <p className="text-xs text-slate-500">Répartition du prix de vente : matériel {pct(b.material * (b.coefficient ?? 0))}, main-d’œuvre {pct(b.labor * (b.coefficient ?? 0))}, sous-traitance {pct(b.subcontract * (b.coefficient ?? 0))}.</p>
          </div>
        </Card>
      </div>

      <HelpBox>
        <p><strong>Déboursé sec</strong> : {DEFINITIONS.ds}</p>
        <p><strong>Prix de revient</strong> : {DEFINITIONS.pr}</p>
        <p><strong>Prix de vente</strong> : {DEFINITIONS.pv} Le <strong>coefficient de vente</strong> (prix de vente ÷ déboursé sec) sert à calculer le prix de vente de chaque ligne de la DPGF.</p>
        <p>Chaque prix indique sa <strong>source</strong> : 🟢 confirmé (offre retenue), 🟠 à confirmer, 🟡 estimé (base de prix indicative), 🔴 manquant. Toute modification importante est confirmée et conservée dans l’historique.</p>
      </HelpBox>

      {openLine && (
        <PriceLineModal study={study} line={openLine} price={ch.lines.find((l) => l.metreLineId === openLine.id)} history={history}
          onClose={() => setOpenId(null)} onSave={(patch) => requestSave(openLine.id, patch)} />
      )}
      {dialog && (
        <ConfirmDialog open title={dialog.title} message={dialog.message} impact={dialog.impact} confirmLabel={dialog.confirm} askReason={pending?.kind === 'price' || pending?.kind === 'params'}
          reasonRequired={dialog.required} onCancel={() => setPending(null)} onConfirm={confirm} />
      )}

      <PrintDocument title="Chiffrage" reference={study.reference} version={`PV ${formatEuro(b.salePrice)}`} demo={study.isDemo}>
        <div className="mb-3 text-[13pt] font-bold">{study.name}</div>
        <PrintSection title="Synthèse">
          <PrintTable head={['Déboursé sec', 'Prix de revient', 'Prix de vente HT', 'Marge', 'Coefficient']} align={['right', 'right', 'right', 'right', 'right']}
            rows={[[formatEuro(b.dryCost), formatEuro(b.costPrice), formatEuro(b.salePrice), `${formatEuro(b.margin)} (${ch.params.marginPct} %)`, formatCoef(b.coefficient)]]} />
          <PrintTable head={['Étape', 'Base', 'Montant']} align={['left', 'left', 'right']}
            rows={[['Matériel', '', formatEuro(b.material)], ['Main-d’œuvre', `${formatQty(b.laborHours)} h × ${ch.params.hourlyRate} €/h`, formatEuro(b.labor)], ['Sous-traitance', '', formatEuro(b.subcontract)],
              ['Frais de chantier', `${ch.params.siteCostsPct} % du DS`, formatEuro(b.siteCosts)], ['Frais généraux', `${ch.params.overheadPct} % (DS + FC)`, formatEuro(b.overhead)], ['Aléas', `${ch.params.riskPct} % du DS`, formatEuro(b.risk)]]} />
          <p className="mt-1 text-[9pt]">Lignes : {b.lines} · sans prix : {b.missing} · à confirmer : {b.toConfirm} · estimées : {b.estimated}</p>
        </PrintSection>
        {groups.map((g) => {
          const fam = FAMILIES.find((f) => f.id === g.fid);
          return (
            <PrintSection key={g.fid ?? 'none'} title={fam ? `${fam.lot} · ${fam.label}` : 'À rattacher'}>
              <PrintTable head={['Poste', 'Désignation', 'Qté', 'Matériel', 'MO', 'ST', 'Total DS', 'Prix vente', 'Source']} align={['left', 'left', 'right', 'right', 'right', 'right', 'right', 'right', 'left']}
                rows={g.rows.map(({ m, p, c, pv }) => [m.ref, m.designation, `${formatQty(c.qty)} ${m.unit}`, formatEuro(c.material), formatEuro(c.labor), formatEuro(c.subcontract), formatEuro(c.total),
                  pv !== null ? formatEuro(pv) : '—', c.missing ? 'MANQUANT' : `${STATUS_LABELS[p!.source.status]} — ${SOURCE_LABELS[p!.source.kind]}${p!.source.reference ? ` (${p!.source.reference})` : ''}`])} />
            </PrintSection>
          );
        })}
      </PrintDocument>
    </div>
  );
}
