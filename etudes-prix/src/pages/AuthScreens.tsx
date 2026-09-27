import { useState, type FormEvent, type ReactNode } from 'react';
import { KeyRound, LogIn, ShieldCheck, Zap } from 'lucide-react';
import { authApi, type CurrentUser } from '../data/api';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';

function Frame({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white"><Zap size={22} /></span>
          <span><span className="block text-lg font-bold text-slate-900">Études de Prix</span><span className="block text-xs text-slate-500">CFO · CFA</span></span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function useSubmit(fn: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  };
  return { error, busy, submit };
}

const ErrorLine = ({ error }: { error: string | null }) => (error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200">{error}</p> : null);

/** Premier lancement du serveur : création du compte administrateur. */
export function SetupScreen({ onDone }: { onDone: (u: CurrentUser) => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { error, busy, submit } = useSubmit(async () => {
    if (password !== confirm) throw new Error('Les deux mots de passe sont différents.');
    onDone(await authApi.setup(username, displayName, password));
  });
  return (
    <Frame title="Première configuration" subtitle="Créez le compte administrateur. Il pourra ensuite créer les comptes des chiffreurs et de la direction.">
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Votre nom" hint="Affiché dans l’historique et sur les documents."><input className={input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex. : Ibrahima Fall" required autoFocus /></Field>
        <Field label="Identifiant de connexion" hint="Lettres minuscules, chiffres, point ou tiret."><input className={input} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="Ex. : ifall" autoComplete="username" required /></Field>
        <Field label="Mot de passe" hint="8 caractères minimum, lettres et chiffres."><input type="password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /></Field>
        <Field label="Confirmer le mot de passe"><input type="password" className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></Field>
        <ErrorLine error={error} />
        <Button type="submit" size="lg" className="w-full" icon={<ShieldCheck size={18} />} disabled={busy}>Créer le compte administrateur</Button>
      </form>
    </Frame>
  );
}

function LoginForm({ onDone, fixedUser }: { onDone: (u: CurrentUser) => void; fixedUser?: string }) {
  const [username, setUsername] = useState(fixedUser ?? '');
  const [password, setPassword] = useState('');
  const { error, busy, submit } = useSubmit(async () => onDone(await authApi.login(username, password)));
  return (
    <form className="space-y-3" onSubmit={submit}>
      <Field label="Identifiant"><input className={input} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required readOnly={!!fixedUser} autoFocus={!fixedUser} /></Field>
      <Field label="Mot de passe"><input type="password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required autoFocus={!!fixedUser} /></Field>
      <ErrorLine error={error} />
      <Button type="submit" size="lg" className="w-full" icon={<LogIn size={18} />} disabled={busy}>Se connecter</Button>
    </form>
  );
}

export function LoginScreen({ onDone }: { onDone: (u: CurrentUser) => void }) {
  return (
    <Frame title="Connexion" subtitle="Connectez-vous avec le compte fourni par votre administrateur.">
      <LoginForm onDone={onDone} />
    </Frame>
  );
}

/** Session expirée pendant le travail : reconnexion sans perdre les modifications en attente. */
export function ReLoginModal({ username, onDone, onCancel }: { username: string; onDone: (u: CurrentUser) => void; onCancel: () => void }) {
  return (
    <Modal open onClose={onCancel} title="Session expirée" size="sm" icon={<span className="rounded-full bg-amber-100 p-2 text-amber-700"><KeyRound size={20} /></span>}>
      <p className="mb-3 text-sm text-slate-600">Reconnectez-vous : vos modifications en attente seront enregistrées ensuite.</p>
      <LoginForm fixedUser={username} onDone={onDone} />
    </Modal>
  );
}

/** Changement de mot de passe (obligatoire si fixé par un administrateur). */
export function ChangePasswordModal({ required, onDone, onCancel }: { required?: boolean; onDone: () => void; onCancel?: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const { error, busy, submit } = useSubmit(async () => {
    if (next !== confirm) throw new Error('Les deux nouveaux mots de passe sont différents.');
    await authApi.changePassword(current, next);
    onDone();
  });
  return (
    <Modal open onClose={required ? () => {} : (onCancel ?? (() => {}))} title={required ? 'Choisissez votre mot de passe' : 'Changer mon mot de passe'} size="sm"
      icon={<span className="rounded-full bg-brand-50 p-2 text-brand-700"><KeyRound size={20} /></span>}>
      {required && <p className="mb-3 text-sm text-slate-600">Votre mot de passe a été fixé par un administrateur : remplacez-le par un mot de passe personnel.</p>}
      <form className="space-y-3" onSubmit={submit}>
        <Field label={required ? 'Mot de passe provisoire' : 'Mot de passe actuel'}><input type="password" className={input} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required autoFocus /></Field>
        <Field label="Nouveau mot de passe" hint="8 caractères minimum, lettres et chiffres."><input type="password" className={input} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required /></Field>
        <Field label="Confirmer"><input type="password" className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></Field>
        <ErrorLine error={error} />
        <div className="flex justify-end gap-2 pt-1">
          {!required && <Button variant="secondary" onClick={onCancel}>Annuler</Button>}
          <Button type="submit" disabled={busy}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
