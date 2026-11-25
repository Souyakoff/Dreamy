import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setPassword } from './api';

interface AdminState { isAdmin: boolean; authRequired: boolean; login: () => Promise<boolean>; logout: () => void }
const Ctx = createContext<AdminState>({ isAdmin: false, authRequired: false, login: async () => false, logout: () => {} });

export function AdminProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState({ isAdmin: false, authRequired: false });
  const refresh = useCallback(() => api.config().then(setCfg).catch(() => {}), []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = useCallback(async () => {
    if (cfg.isAdmin) return true;
    const pw = window.prompt('Mot de passe administrateur :');
    if (!pw) return false;
    setPassword(pw);
    const c = await api.config();
    setCfg(c);
    if (!c.isAdmin) window.alert('Mot de passe incorrect.');
    return c.isAdmin;
  }, [cfg.isAdmin]);
  const logout = useCallback(() => { setPassword(''); refresh(); }, [refresh]);
  return <Ctx.Provider value={{ ...cfg, login, logout }}>{children}</Ctx.Provider>;
}
export const useAdmin = () => useContext(Ctx);
