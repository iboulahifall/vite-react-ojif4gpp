import clsx from 'clsx';
import { NavLink } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { MAIN_NAV, MODULE_NAV, SETTINGS_NAV, type NavItem } from './nav';

function Item({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={clsx('h-5 w-1 -ml-3 rounded-r', isActive ? 'bg-amber-400' : 'bg-transparent')} aria-hidden />
          <Icon size={18} className={clsx(isActive ? 'text-amber-300' : 'text-slate-400 group-hover:text-slate-200')} aria-hidden />
          <span className="flex-1">{item.label}</span>
          {item.version && (
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400" title={`Module prévu en ${item.version}`}>
              {item.version}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-amber-300 shadow-inner"><Zap size={20} fill="currentColor" /></span>
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">Études de Prix</div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">CFO · CFA</div>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4" aria-label="Navigation principale">
        <div className="space-y-0.5">
          {MAIN_NAV.map((i) => <Item key={i.to} item={i} onNavigate={onNavigate} />)}
        </div>
        <div>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Modules de l’étude</p>
          <div className="space-y-0.5">
            {MODULE_NAV.map((i) => <Item key={i.to} item={i} onNavigate={onNavigate} />)}
          </div>
        </div>
      </nav>
      <div className="border-t border-white/10 px-3 py-3">
        <Item item={SETTINGS_NAV} onNavigate={onNavigate} />
        <p className="mt-2 px-3 text-[11px] text-slate-500">Version 1.7</p>
      </div>
    </div>
  );
}
