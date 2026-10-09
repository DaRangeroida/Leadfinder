import { useState, type ReactNode } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { History, Menu, Radar, Settings, Table2, X } from 'lucide-react';
import { api } from '../api.ts';

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#2a3450" />
      <path d="M8 24V14l8-6 8 6v10" fill="none" stroke="#F2F4F7" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M16 12l-1.5 4 3 2-2 6" fill="none" stroke="#E2531F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV = [
  { to: '/leads', label: 'Leads', icon: Table2 },
  { to: '/suche', label: 'Neue Suche', icon: Radar },
  { to: '/suchlaeufe', label: 'Suchläufe', icon: History },
  { to: '/einstellungen', label: 'Einstellungen', icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 5000 });
  const scanning = stats.data?.scanning ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-7">
        <Logo />
        <div>
          <div className="font-condensed text-[19px] font-bold leading-none tracking-tight text-white">Altbau</div>
          <div className="mt-1 text-[11px] text-white/45">Leads für Relaunches</div>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 px-3" aria-label="Hauptnavigation">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon className="size-4" strokeWidth={1.9} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-5 pb-5">
        {scanning > 0 ? (
          <div className="rounded-md bg-white/6 px-3 py-2.5" role="status">
            <div className="flex items-center gap-2 text-[12px] font-medium text-white">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-heat-hot opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-heat-hot" />
              </span>
              {scanning === 1 ? '1 Website wird geprüft' : `${scanning} Websites werden geprüft`}
            </div>
          </div>
        ) : (
          stats.data && (
            <div className="text-[12px] leading-relaxed text-white/45">
              {stats.data.total} Leads im Bestand
              <br />
              {stats.data.hot} davon mit akutem Bedarf
            </div>
          )
        )}
      </div>
    </div>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const current = NAV.find((n) => location.pathname.startsWith(n.to));
  const meta = useQuery({ queryKey: ['meta'], queryFn: api.meta });

  if (meta.data && !meta.data.onboarded) return <Navigate to="/willkommen" replace />;

  return (
    <div className="min-h-dvh lg:pl-[232px]">
      <aside className="fixed inset-y-0 left-0 hidden w-[232px] bg-ink lg:block">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-ink px-4 lg:hidden">
        <button className="text-white/80" onClick={() => setOpen(true)} aria-label="Navigation öffnen">
          <Menu className="size-5" />
        </button>
        <Logo />
        <span className="text-[14px] font-medium text-white">{current?.label ?? 'Altbau'}</span>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} aria-label="Navigation schließen" />
          <aside className="rise-in absolute inset-y-0 left-0 w-[260px] bg-ink">
            <button className="absolute right-3 top-5 text-white/70" onClick={() => setOpen(false)} aria-label="Navigation schließen">
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-9 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h1>
        {description && <p className="mt-1 max-w-[70ch] text-[13px] text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
