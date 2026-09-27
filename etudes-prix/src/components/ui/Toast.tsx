import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  const push = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p, { id, msg }]);
    setTimeout(() => setItems((p) => p.filter((i) => i.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
            <CheckCircle2 size={18} className="text-emerald-400" /> {i.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
