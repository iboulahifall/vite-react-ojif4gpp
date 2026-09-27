import { useEffect, useState } from 'react';
import { migrateLocalToServer, readLocalData } from '../data/migrateToServer';
import { useAuth } from '../state/auth';
import { Compass, Database, FlaskConical, HardDrive, Settings, Upload, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../state/store';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, TextInput } from '../components/ui/Field';
import { HelpBox } from '../components/ui/Help';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

export function SettingsPage() {
  const { settings, updateSettings, studies, resetDemo, removeDemo, storage } = useStore();
  const auth = useAuth();
  // Serveur : le nom vient du compte ; l'entreprise et le logo sont communs (modifiables par un administrateur).
  const nameLocked = auth.mode === 'server';
  const companyLocked = auth.mode === 'server' && !auth.isAdmin;
  const [localCount, setLocalCount] = useState(0);
  const [migrating, setMigrating] = useState(false);
  useEffect(() => {
    if (storage.kind === 'server') void readLocalData().then((d) => setLocalCount(d.studies.filter((x) => !studies.some((y) => y.id === x.id)).length));
  }, [storage.kind, studies]);
  const toast = useToast();
  const [userName, setUserName] = useState(settings.userName);
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [confirm, setConfirm] = useState<'reset' | 'remove' | null>(null);
  const demoCount = studies.filter((s) => s.isDemo).length;

  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Paramètres' }]} icon={<Settings size={24} />} title="Paramètres" />
      <HelpBox><p>Configurez votre nom (utilisé dans l’historique et les documents imprimés), le nom de l’entreprise et le mode d’affichage.</p></HelpBox>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profil" />
          <form className="space-y-4 p-5" onSubmit={(e) => {
            e.preventDefault();
            updateSettings({ userName: userName.trim() || settings.userName, companyName: companyName.trim() || settings.companyName });
            toast('Paramètres enregistrés');
          }}>
            <Field label="Votre nom" hint={nameLocked ? 'Nom de votre compte (modifiable par un administrateur).' : undefined}><TextInput value={userName} readOnly={nameLocked} onChange={(e) => setUserName(e.target.value)} /></Field>
            <Field label="Entreprise" hint={companyLocked ? 'Commun à tous les utilisateurs — modifiable par un administrateur.' : 'Affichée en en-tête des documents imprimés.'}><TextInput value={companyName} readOnly={companyLocked} onChange={(e) => setCompanyName(e.target.value)} /></Field>
            <Field label="Logo de l’entreprise" hint="PNG, JPG ou SVG, 300 Ko maximum. Affiché sur la page de garde et l’en-tête des rapports.">
              <div className="flex flex-wrap items-center gap-3">
                {settings.logo ? <img src={settings.logo} alt="Logo actuel" className="h-12 max-w-[160px] rounded border border-slate-200 bg-white object-contain p-1" /> : <span className="text-sm text-slate-500">Aucun logo</span>}
                {!companyLocked && <label className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
                  {settings.logo ? 'Changer' : 'Choisir une image'}
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="sr-only" data-testid="logo-input" onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    if (!/^image\/(png|jpeg|svg\+xml)$/.test(f.type)) { toast('Format non accepté : PNG, JPG ou SVG'); return; }
                    if (f.size > 300 * 1024) { toast('Logo trop lourd (300 Ko maximum)'); return; }
                    const r = new FileReader();
                    r.onload = () => { updateSettings({ logo: String(r.result) }); toast('Logo enregistré'); };
                    r.readAsDataURL(f);
                  }} />
                </label>}
                {settings.logo && !companyLocked && <Button type="button" size="sm" variant="ghost" onClick={() => { updateSettings({ logo: undefined }); toast('Logo retiré'); }}>Retirer</Button>}
              </div>
            </Field>
            {!(nameLocked && companyLocked) && <Button type="submit">Enregistrer</Button>}
          </form>
        </Card>

        <Card>
          <CardHeader title="Mode d’affichage" />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {[
              { guided: true, icon: <Compass size={22} />, label: '👨‍💻 Mode guidé', desc: 'L’application explique chaque étape et affiche l’aide « À quoi ça sert ? ». Idéal pour débuter.' },
              { guided: false, icon: <Zap size={22} />, label: '⚡ Mode expert', desc: 'Accès direct aux modules, sans bandeaux d’explication. L’aide reste disponible repliée.' },
            ].map((m) => (
              <button key={m.label} onClick={() => updateSettings({ guidedMode: m.guided })} aria-pressed={settings.guidedMode === m.guided}
                className={clsx('rounded-xl border-2 p-4 text-left transition cursor-pointer', settings.guidedMode === m.guided ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300')}>
                <span className="text-brand-700">{m.icon}</span>
                <span className="mt-2 block font-semibold">{m.label}</span>
                <span className="mt-1 block text-sm text-slate-600">{m.desc}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={storage.kind === 'server' ? <Database size={18} /> : <HardDrive size={18} />} title="Stockage des données"
            subtitle={storage.kind === 'server' ? `Serveur de l’application — base ${storage.status?.database ?? ''}` : 'Ce navigateur uniquement'} />
          <div className="space-y-3 p-5 text-sm text-slate-700">
            {storage.kind === 'server' ? (
              <>
                <p>Les études, fournisseurs, paramètres et fichiers sont enregistrés sur le <strong>serveur</strong> : ils sont partagés entre les postes et sauvegardables avec la base. Si une étude est modifiée en même temps sur deux postes, la seconde modification est refusée (rien n’est écrasé) et un bandeau propose de recharger.</p>
                {localCount > 0 && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-inset ring-amber-200">
                    <span className="flex-1 text-amber-900">Ce navigateur contient encore <strong>{localCount} étude(s)</strong> saisie(s) avant le passage au serveur.</span>
                    <Button size="sm" icon={<Upload size={14} />} disabled={migrating} onClick={async () => {
                      setMigrating(true);
                      try {
                        const r = await migrateLocalToServer();
                        toast(`${r.studies} étude(s), ${r.suppliers} fournisseur(s) et ${r.files} fichier(s) envoyés au serveur`);
                        setTimeout(() => window.location.reload(), 1200);
                      } catch { toast('Envoi impossible : serveur injoignable'); setMigrating(false); }
                    }}>Envoyer vers le serveur</Button>
                  </div>
                )}
              </>
            ) : (
              <p>Les données sont enregistrées <strong>dans ce navigateur</strong> (non partagées entre postes). Pour les partager, lancez le serveur de l’application (voir le fichier README) et ouvrez l’application depuis son adresse : elle l’utilisera automatiquement.</p>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={<FlaskConical size={18} />} title="Données de démonstration" subtitle={`${demoCount} étude(s) fictive(s) actuellement chargée(s)`} />
          <div className="flex flex-wrap gap-2 p-5">
            <Button variant="secondary" onClick={() => setConfirm('reset')}>Réinitialiser les données de démonstration</Button>
            <Button variant="secondary" className="text-red-700" disabled={!demoCount} onClick={() => setConfirm('remove')}>Supprimer les données de démonstration</Button>
            <p className="w-full text-xs text-slate-500">Vos propres études ne sont jamais modifiées par ces actions.</p>
          </div>
        </Card>
      </div>

      <ConfirmDialog open={confirm === 'reset'} title="Réinitialiser la démonstration ?" message="Les études de démonstration seront recréées dans leur état initial (vos modifications sur ces études seront perdues)."
        onCancel={() => setConfirm(null)} onConfirm={() => { resetDemo(); setConfirm(null); toast('Démonstration réinitialisée'); }} />
      <ConfirmDialog open={confirm === 'remove'} danger title="Supprimer la démonstration ?" message="Toutes les études marquées « Démo » seront supprimées. Vos études ne sont pas concernées."
        confirmLabel="Supprimer" onCancel={() => setConfirm(null)} onConfirm={() => { removeDemo(); setConfirm(null); toast('Données de démonstration supprimées'); }} />
    </div>
  );
}
