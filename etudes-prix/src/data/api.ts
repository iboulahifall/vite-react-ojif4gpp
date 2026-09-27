/** Appels à l'API du serveur : cookie de session, en-tête applicatif (anti-CSRF), erreurs lisibles. */

export type Role = 'chiffreur' | 'direction' | 'admin';

export interface CurrentUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  roleLabel: string;
  active: boolean;
  mustChangePassword: boolean;
  canValidate: boolean;
  isAdmin: boolean;
  lastLoginAt: string | null;
}

export const ROLE_OPTIONS: { id: Role; label: string; desc: string }[] = [
  { id: 'chiffreur', label: 'Chiffreur', desc: 'Réalise les études : DCE, métré, consultations, chiffrage, revue.' },
  { id: 'direction', label: 'Direction', desc: 'Comme le chiffreur, et valide ou déverrouille les études.' },
  { id: 'admin', label: 'Administrateur', desc: 'Tous les droits, gère les comptes et les paramètres de l’entreprise.' },
];

let apiBase = '';
export function setApiBase(base: string) { apiBase = base; }
export function getApiBase() { return apiBase; }

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`${apiBase}${path}`, {
    credentials: 'same-origin',
    ...rest,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    headers: { 'X-EP-Client': '1', ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') msg = body.detail;
      else if (Array.isArray(body.detail)) msg = 'Données invalides.';
      else if (body.detail && typeof (body.detail as { message?: string }).message === 'string') msg = (body.detail as { message: string }).message;
    } catch { /* corps non JSON */ }
    throw new ApiError(res.status, msg);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const authApi = {
  status: () => api<{ setupRequired: boolean; user: CurrentUser | null }>('/api/auth/status'),
  setup: (username: string, displayName: string, password: string) => api<CurrentUser>('/api/auth/setup', { method: 'POST', json: { username, displayName, password } }),
  login: (username: string, password: string) => api<CurrentUser>('/api/auth/login', { method: 'POST', json: { username, password } }),
  logout: () => api<void>('/api/auth/logout', { method: 'POST' }),
  me: () => api<CurrentUser>('/api/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) => api('/api/auth/password', { method: 'PUT', json: { currentPassword, newPassword } }),
  users: () => api<CurrentUser[]>('/api/users'),
  createUser: (u: { username: string; displayName: string; role: Role; password: string }) => api<CurrentUser>('/api/users', { method: 'POST', json: u }),
  updateUser: (id: number, patch: Partial<{ displayName: string; role: Role; active: boolean; password: string }>) => api<CurrentUser>(`/api/users/${id}`, { method: 'PATCH', json: patch }),
};
