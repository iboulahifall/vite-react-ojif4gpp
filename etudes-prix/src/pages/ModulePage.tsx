import { Link, useParams } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { MODULE_NAV } from '../components/layout/nav';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { HelpBox } from '../components/ui/Help';
import { NotFoundPage } from './NotFoundPage';

const ROADMAP = [
  ['V1.1', 'Tableau de bord, navigation, création d’étude'],
  ['V1.2', 'Import et gestion du DCE'],
  ['V1.3', 'Analyse CCTP / DPGF'],
  ['V1.4', 'Postes et métré'],
  ['V1.5', 'Consultations fournisseurs'],
  ['V1.6', 'Chiffrage'],
  ['V1.7', 'Risques et questions'],
  ['V1.8', 'Revue de prix'],
  ['V1.9', 'Validation'],
  ['V1.10', 'Impression et rapports PDF'],
];

/** Page d'attente claire pour les modules des versions suivantes. */
export function ModulePage() {
  const { module } = useParams();
  const item = MODULE_NAV.find((m) => m.to === `/modules/${module}`);
  if (!item) return <NotFoundPage />;
  const Icon = item.icon;
  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: item.label }]} icon={<Icon size={24} />} title={item.label} />
      <Card className="p-8">
        <div className="mx-auto max-w-xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Construction size={28} /></span>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Module prévu en {item.version}</h2>
          <p className="mt-2 text-slate-600">{item.description}</p>
          <p className="mt-4 text-sm text-slate-500">
            En attendant, suivez l’avancement de vos études depuis le{' '}
            <Link to="/" className="font-medium text-brand-700 underline">tableau de bord</Link> ou{' '}
            <Link to="/etudes" className="font-medium text-brand-700 underline">Mes études</Link>.
          </p>
        </div>
      </Card>
      <HelpBox title="Feuille de route">
        <ol className="grid gap-1 sm:grid-cols-2">
          {ROADMAP.map(([v, l]) => (
            <li key={v} className={v === item.version ? 'font-semibold' : ''}>
              <span className="inline-block w-14 tabular">{v}</span>{l}{['V1.1', 'V1.2', 'V1.3', 'V1.4', 'V1.5', 'V1.6', 'V1.7', 'V1.8'].includes(v) && ' ✓'}
            </li>
          ))}
        </ol>
      </HelpBox>
    </div>
  );
}
