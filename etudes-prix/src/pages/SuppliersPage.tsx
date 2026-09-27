import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search } from 'lucide-react';
import { useStore } from '../state/store';
import { FAMILIES } from '../domain/catalog';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DemoBadge } from '../components/ui/Badges';
import { HelpBox } from '../components/ui/Help';
import { SelectInput } from '../components/ui/Field';
import { useToast } from '../components/ui/Toast';
import { SupplierFormModal } from '../components/consultations/SupplierFormModal';

/** Annuaire des fournisseurs et sous-traitants. */
export function SuppliersPage() {
  const { suppliers, studies, saveSupplier } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [family, setFamily] = useState('');
  const [creating, setCreating] = useState(false);

  const stats = useMemo(() => {
    const m = new Map<string, { consulted: number; received: number; retained: number }>();
    for (const s of studies) for (const c of s.consultations) for (const r of c.requests) {
      const x = m.get(r.supplierId) ?? { consulted: 0, received: 0, retained: 0 };
      x.consulted++;
      if (r.status === 'recue') x.received++;
      if (c.retainedRequestId === r.id) x.retained++;
      m.set(r.supplierId, x);
    }
    return m;
  }, [studies]);

  const rows = suppliers
    .filter((s) => !kind || s.kind === kind)
    .filter((s) => !family || s.familyIds.includes(family))
    .filter((s) => !q.trim() || `${s.name} ${s.contactName} ${s.email}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Fournisseurs' }]} icon={<Building2 size={24} />} title="Fournisseurs et sous-traitants"
        subtitle="Annuaire commun à toutes les études." actions={<Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>Nouveau fournisseur</Button>} />
      <HelpBox><p>Renseignez ici vos fournisseurs et sous-traitants habituels et les familles de postes pour lesquelles vous les consultez : ils seront proposés en priorité lors de la création d’une consultation. Le <strong>taux de réponse</strong> est calculé sur toutes les études.</p></HelpBox>
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un nom, un contact…" aria-label="Rechercher un fournisseur"
              className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
          </div>
          <SelectInput value={kind} onChange={(e) => setKind(e.target.value)} className="md:w-48" aria-label="Type">
            <option value="">Tous les types</option><option value="fournisseur">Fournisseurs</option><option value="sous-traitant">Sous-traitants</option>
          </SelectInput>
          <SelectInput value={family} onChange={(e) => setFamily(e.target.value)} className="md:w-60" aria-label="Famille">
            <option value="">Toutes les familles</option>
            {FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.lot} · {f.label}</option>)}
          </SelectInput>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5">Nom</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Contact</th><th className="px-3 py-2.5">Familles</th><th className="px-3 py-2.5 text-right">Consultations</th><th className="px-5 py-2.5 text-right">Taux de réponse</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => {
                const st = stats.get(s.id);
                return (
                  <tr key={s.id} tabIndex={0} onClick={() => navigate(`/fournisseurs/${s.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/fournisseurs/${s.id}`)}
                    className="cursor-pointer hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none">
                    <td className="px-5 py-3"><span className="flex items-center gap-2 font-semibold text-slate-900">{s.name} {s.isDemo && <DemoBadge />}</span></td>
                    <td className="px-3 py-3">{s.kind === 'fournisseur' ? 'Fournisseur' : 'Sous-traitant'}</td>
                    <td className="px-3 py-3 text-slate-700">{s.contactName || '—'}<div className="text-xs text-slate-500">{s.email}</div></td>
                    <td className="max-w-72 px-3 py-3 text-xs text-slate-600">{s.familyIds.map((f) => FAMILIES.find((x) => x.id === f)?.label).join(', ') || '—'}</td>
                    <td className="px-3 py-3 text-right tabular">{st?.consulted ?? 0}</td>
                    <td className="px-5 py-3 text-right tabular">{st?.consulted ? `${Math.round((st.received / st.consulted) * 100)} %` : '—'}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Aucun fournisseur.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {creating && <SupplierFormModal onClose={() => setCreating(false)} onSave={(d) => { const s = saveSupplier(d); setCreating(false); toast(`${s.name} ajouté à l’annuaire`); }} />}
    </div>
  );
}
