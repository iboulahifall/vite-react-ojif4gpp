import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, UserCog, Users } from 'lucide-react';
import clsx from 'clsx';
import { authApi, ROLE_OPTIONS, type CurrentUser, type Role } from '../data/api';
import { useAuth } from '../state/auth';
import { formatDateTime } from '../domain/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { HelpBox } from '../components/ui/Help';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';

/** Mot de passe provisoire lisible (à communiquer à la personne, qui le changera). */
function provisionalPassword(): string {
  const words = ['chantier', 'tableau', 'cable', 'lumiere', 'prise', 'reseau', 'baie', 'tension'];
  const w = words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length];
  return `${w}-${String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0')}`;
}

function UserForm({ onSave, onClose }: { onSave: (u: { username: string; displayName: string; role: Role; password: string }) => Promise<void>; onClose: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('chiffreur');
  const [password, setPassword] = useState(provisionalPassword);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title="Nouveau compte" icon={<span className="rounded-full bg-brand-50 p-2 text-brand-700"><UserCog size={20} /></span>}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button form="user-form" type="submit" disabled={busy}>Créer le compte</Button></>}>
      <form id="user-form" className="space-y-3 text-sm" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError(null);
        try { await onSave({ username, displayName, role, password }); } catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false); }
      }}>
        <label className="block"><span className="mb-1 block font-medium">Nom affiché</span><input className={input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex. : Julie Martin" required autoFocus /></label>
        <label className="block"><span className="mb-1 block font-medium">Identifiant de connexion</span><input className={input} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="Ex. : jmartin" required /></label>
        <fieldset>
          <legend className="mb-1 font-medium">Rôle</legend>
          <div className="space-y-1.5">
            {ROLE_OPTIONS.map((r) => (
              <label key={r.id} className={clsx('flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 ring-1 ring-inset', role === r.id ? 'bg-brand-50 ring-brand-300' : 'ring-slate-200 hover:bg-slate-50')}>
                <input type="radio" name="role" className="mt-0.5 accent-brand-700" checked={role === r.id} onChange={() => setRole(r.id)} />
                <span><span className="block font-semibold">{r.label}</span><span className="block text-xs text-slate-500">{r.desc}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block"><span className="mb-1 block font-medium">Mot de passe provisoire</span><input className={`${input} font-mono`} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <span className="mt-1 block text-xs text-slate-500">À communiquer à la personne : il lui sera demandé de le changer à la première connexion.</span></label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800 ring-1 ring-inset ring-red-200">{error}</p>}
      </form>
    </Modal>
  );
}

/** Gestion des comptes (administrateurs). */
export function UsersPage() {
  const auth = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<CurrentUser[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<{ kind: 'active' | 'reset'; u: CurrentUser; password?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => { authApi.users().then(setUsers).catch((e) => setError(String(e.message ?? e))); }, []);
  useEffect(() => { if (auth.isAdmin && auth.mode === 'server') reload(); }, [auth.isAdmin, auth.mode, reload]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast(msg); reload(); } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  };

  if (auth.mode !== 'server') {
    return <Card className="mx-auto max-w-lg p-8 text-center text-sm text-slate-700">Les comptes utilisateurs existent quand l’application est utilisée avec son serveur. En mode navigateur, il n’y a pas de connexion.</Card>;
  }
  if (!auth.isAdmin) return <Card className="mx-auto max-w-lg p-8 text-center text-sm text-slate-700">Page réservée aux administrateurs.</Card>;

  return (
    <div className="space-y-5">
      <PageHeader crumbs={[{ label: 'Tableau de bord', to: '/' }, { label: 'Utilisateurs' }]} icon={<Users size={24} />} title="Utilisateurs"
        subtitle="Comptes de connexion et rôles." actions={<Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>Nouveau compte</Button>} />
      <HelpBox>
        <p><strong>Chiffreur</strong> : réalise les études. <strong>Direction</strong> : peut en plus <strong>valider</strong> et déverrouiller les études (contrôlé par le serveur). <strong>Administrateur</strong> : tous les droits, gère les comptes, le nom et le logo de l’entreprise.</p>
        <p>Un compte désactivé ne peut plus se connecter (sa session en cours est coupée) ; son nom reste dans l’historique des études.</p>
      </HelpBox>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-2.5">Nom</th><th className="px-3 py-2.5">Identifiant</th><th className="px-3 py-2.5">Rôle</th><th className="px-3 py-2.5">Dernière connexion</th><th className="px-3 py-2.5">État</th><th className="px-5 py-2.5 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(users ?? []).map((u) => (
                <tr key={u.id} className={clsx(!u.active && 'opacity-60')}>
                  <td className="px-5 py-3 font-semibold text-slate-900">{u.displayName}{u.id === auth.user?.id && <span className="ml-2 text-xs font-normal text-slate-500">(vous)</span>}</td>
                  <td className="px-3 py-3 font-mono text-xs">{u.username}</td>
                  <td className="px-3 py-3">
                    <select aria-label={`Rôle de ${u.displayName}`} value={u.role} className="rounded-md border border-slate-300 px-2 py-1"
                      onChange={(e) => void act(() => authApi.updateUser(u.id, { role: e.target.value as Role }), 'Rôle modifié')}>
                      {ROLE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Jamais'}</td>
                  <td className="px-3 py-3">{u.active ? (u.mustChangePassword ? <span className="text-amber-700">Mot de passe provisoire</span> : <span className="text-emerald-700">Actif</span>) : <span className="text-slate-500">Désactivé</span>}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button size="sm" variant="ghost" icon={<KeyRound size={14} />} onClick={() => setPending({ kind: 'reset', u, password: provisionalPassword() })}>Réinitialiser</Button>
                      {u.id !== auth.user?.id && <Button size="sm" variant="secondary" onClick={() => setPending({ kind: 'active', u })}>{u.active ? 'Désactiver' : 'Réactiver'}</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {creating && <UserForm onClose={() => setCreating(false)} onSave={async (u) => {
        await authApi.createUser(u);
        setCreating(false);
        toast(`Compte « ${u.username} » créé — mot de passe provisoire : ${u.password}`);
        reload();
      }} />}
      {pending?.kind === 'active' && (
        <ConfirmDialog open danger={pending.u.active} title={`${pending.u.active ? 'Désactiver' : 'Réactiver'} le compte de ${pending.u.displayName} ?`}
          message={pending.u.active ? 'La personne ne pourra plus se connecter ; sa session en cours est coupée.' : 'La personne pourra de nouveau se connecter.'}
          confirmLabel={pending.u.active ? 'Désactiver' : 'Réactiver'} onCancel={() => setPending(null)}
          onConfirm={() => { void act(() => authApi.updateUser(pending.u.id, { active: !pending.u.active }), pending.u.active ? 'Compte désactivé' : 'Compte réactivé'); setPending(null); }} />
      )}
      {pending?.kind === 'reset' && (
        <ConfirmDialog open title={`Nouveau mot de passe pour ${pending.u.displayName} ?`}
          message={<>Mot de passe provisoire : <strong className="font-mono">{pending.password}</strong>. Communiquez-le à la personne : il lui sera demandé de le changer à la connexion.</>}
          confirmLabel="Réinitialiser" onCancel={() => setPending(null)}
          onConfirm={() => { void act(() => authApi.updateUser(pending.u.id, { password: pending.password }), `Mot de passe réinitialisé : ${pending.password}`); setPending(null); }} />
      )}
    </div>
  );
}
