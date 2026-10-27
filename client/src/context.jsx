import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';

const AuthCtx = createContext(null);
const ToastCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);
export const useToast = () => useContext(ToastCtx);

export function Providers({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'success') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const logout = useCallback(() => { setToken(null); setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { logout(); toast('Your session ended. Please log in again.', 'error'); });
    if (!getToken()) return;
    api('/auth/me').then((d) => setUser(d.user)).catch(() => logout()).finally(() => setLoading(false));
  }, [logout, toast]);

  const authenticate = async (mode, form) => {
    const d = await api(`/auth/${mode}`, { method: 'POST', body: form });
    setToken(d.token);
    setUser(d.user);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, authenticate, logout }}>
      <ToastCtx.Provider value={toast}>
        {children}
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>)}
        </div>
      </ToastCtx.Provider>
    </AuthCtx.Provider>
  );
}
