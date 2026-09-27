import { createContext, useContext, type ReactNode } from 'react';
import type { CurrentUser } from '../data/api';

export interface AuthValue {
  /** 'local' : données dans le navigateur, sans comptes. */
  mode: 'local' | 'server';
  user: CurrentUser | null;
  /** Valider / déverrouiller une étude (direction, administrateur ; toujours en mode navigateur). */
  canValidate: boolean;
  isAdmin: boolean;
  setUser(u: CurrentUser): void;
  logout(): Promise<void>;
}

const LOCAL: AuthValue = { mode: 'local', user: null, canValidate: true, isAdmin: true, setUser: () => {}, logout: async () => {} };
const AuthContext = createContext<AuthValue>(LOCAL);

export function AuthProvider({ value, children }: { value: AuthValue | null; children: ReactNode }) {
  return <AuthContext.Provider value={value ?? LOCAL}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}
