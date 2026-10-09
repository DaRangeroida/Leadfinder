import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Download, Plus, Radar, Search, X } from 'lucide-react';
import { PIPELINE, STATUS_LABELS, type LeadListItem, type LeadStatus } from '../../../shared/types.ts';
import { api } from '../api.ts';
import { PageHeader } from '../components/Layout.tsx';
import { ScoreCell } from '../components/Score.tsx';
import { EmptyState, ErrorNote, PainChip, relativeTime, Spinner, STATUS_DOT, useToast } from '../components/ui.tsx';

const STATUS_TABS: (LeadStatus | '')[] = ['', ...PIPELINE, 'verworfen'];
const HIDE_UNREACHABLE_KEY = 'altbau.hideUnreachable';

function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function StatsStrip() {
  const { data } = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 5000 });
  const items = [
    { label: 'Leads im Bestand', value: data?.total ?? '–' },
    { label: 'Akuter Relaunch-Bedarf', value: data?.hot ?? '–', accent: true },
    { label: 'Ø Redesign-Score', value: data?.avgScore ?? '–' },
    { label: 'Kontaktiert oder in Verhandlung', value: data ? data.byStatus.kontaktiert + data.byStatus.verhandlung : '–' },
    { label: 'Abgeschlossen', value: data?.byStatus.abgeschlossen ?? '–' },
  ];
  return (
    <div className="panel mb-5 grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
      {items.map((item) => (
        <div key={item.label} className="px-4 py-3.5">
          <div className={`font-condensed text-[26px] font-semibold leading-none tabular ${item.accent ? 'text-heat-hot' : ''}`}>
            {item.value}
          </div>
          <div className="mt-1.5 text-[12px] text-ink-soft">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function AddWebsiteForm({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const create = useMutation({
    mutationFn: () => api.createLead({ url, name: name || undefined }),
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast(`${lead.domain} wird jetzt geprüft.`);
      navigate(`/leads/${lead.id}`);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  return (
    <form onSubmit={submit} className="panel rise-in mb-5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">Einzelne Website prüfen</h2>
        <button type="button" className="btn btn-ghost h-7 px-2" onClick={onClose} aria-label="Formular schließen">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="add-url">Website</label>
          <input id="add-url" className="field" placeholder="z. B. tischlerei-schmidt.de" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus required />
        </div>
        <div>
          <label className="label" htmlFor="add-name">Firmenname (optional)</label>
          <input id="add-name" className="field" placeholder="Tischlerei Schmidt" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={create.isPending || !url.trim()}>
          {create.isPending ? <Spinner /> : <Plus className="size-4" />}
          Prüfen und hinzufügen
        </button>
      </div>
      {create.error && <div className="mt-3"><ErrorNote message={create.error.message} /></div>}
    </form>
  );
}

function SortHeader({ label, column, sort, dir, onSort, className = '' }: {
  label: string;
  column: string;
  sort: string;
  dir: string;
  onSort: (column: string) => void;
  className?: string;
}) {
  const active = sort === column;
  return (
    <th className={`px-3 py-2.5 text-left font-medium ${className}`} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className={`inline-flex items-center gap-1 hover:text-ink ${active ? 'text-ink' : ''}`} onClick={() => onSort(column)}>
        {label}
        {active && (dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}

function StatusSelect({ lead }: { lead: LeadListItem }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const update = useMutation({
    mutationFn: (status: LeadStatus) => api.updateLead(lead.id, { status }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.setQueryData(['lead', lead.id], updated);
      toast(`${updated.name}: Status auf „${STATUS_LABELS[updated.status]}“ gesetzt.`);
    },
    onError: (e) => toast(e.message, 'error'),
  });
  return (
    <div className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      <span className={`pointer-events-none absolute left-2 size-1.5 rounded-full ${STATUS_DOT[lead.status]}`} />
      <select
        aria-label={`Status von ${lead.name}`}
        className="h-7 cursor-pointer appearance-none rounded border border-transparent bg-transparent pl-5 pr-2 text-[12.5px] font-medium text-ink-soft hover:border-line hover:bg-panel focus:border-cobalt focus:outline-none"
        value={lead.status}
        disabled={update.isPending}
        onChange={(e) => update.mutate(e.target.value as LeadStatus)}
      >
        {[...PIPELINE, 'verworfen' as const].map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
    </div>
  );
}

export function LeadsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebounced(q, 250);

  const filters = {
    industry: params.get('industry') ?? '',
    city: params.get('city') ?? '',
    status: params.get('status') ?? '',
    minScore: Number(params.get('minScore') ?? 0),
    jobId: params.get('jobId') ? Number(params.get('jobId')) : undefined,
    sort: params.get('sort') ?? 'score',
    dir: (params.get('dir') as 'asc' | 'desc') ?? 'desc',
  };

  const setParam = (key: string, value: string | number | undefined) => {
    const next = new URLSearchParams(params);
    if (value === undefined || value === '' || value === 0) next.delete(key);
    else next.set(key, String(value));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get('q') ?? '') !== debouncedQ) setParam('q', debouncedQ);
  }, [debouncedQ]);

  const [hideUnreachable, setHideUnreachable] = useState(() => readPreference(HIDE_UNREACHABLE_KEY) === '1');
  const toggleUnreachable = () => {
    setHideUnreachable((v) => {
      writePreference(HIDE_UNREACHABLE_KEY, v ? '0' : '1');
      return !v;
    });
  };

  const query = {
    ...filters,
    q: debouncedQ,
    minScore: filters.minScore || undefined,
    hideUnreachable: hideUnreachable ? (1 as const) : undefined,
  };
  const leads = useQuery({
    queryKey: ['leads', query],
    queryFn: () => api.leads(query),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.some((l) => l.auditStatus === 'pending' || l.auditStatus === 'scanning') ? 2000 : false),
  });
  const options = useQuery({ queryKey: ['filters'], queryFn: api.filters });
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats });

  const onSort = (column: string) => {
    const next = new URLSearchParams(params);
    if (filters.sort === column) next.set('dir', filters.dir === 'asc' ? 'desc' : 'asc');
    else {
      next.set('sort', column);
      next.set('dir', column === 'name' ? 'asc' : 'desc');
    }
    setParams(next, { replace: true });
  };

  const hasFilters = !!(debouncedQ || filters.industry || filters.city || filters.minScore || filters.jobId);
  const resetFilters = () => {
    setQ('');
    const next = new URLSearchParams();
    if (filters.status) next.set('status', filters.status);
    setParams(next, { replace: true });
  };

  const rows = leads.data ?? [];
  const tabCount = useMemo(() => {
    const by = stats.data?.byStatus;
    return (s: LeadStatus | '') => {
      if (!by) return null;
      if (!s) return stats.data!.total;
      return by[s];
    };
  }, [stats.data]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Alle gefundenen Unternehmen, sortiert nach Redesign-Bedarf. Ein Klick öffnet Audit, Notizen und Pitch."
        actions={
          <>
            <a className="btn btn-ghost" href={api.exportUrl({ status: filters.status || undefined, minScore: filters.minScore || undefined })}>
              <Download className="size-4" /> CSV
            </a>
            <button className="btn btn-secondary" onClick={() => setShowAdd((v) => !v)}>
              <Plus className="size-4" /> Website prüfen
            </button>
            <Link to="/suche" className="btn btn-primary">
              <Radar className="size-4" /> Neue Suche
            </Link>
          </>
        }
      />

      <StatsStrip />
      {showAdd && <AddWebsiteForm onClose={() => setShowAdd(false)} />}

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line px-3 py-2.5">
          <label className="flex cursor-pointer select-none items-center gap-2.5 text-[13px]">
            <button
              type="button"
              role="switch"
              aria-checked={hideUnreachable}
              onClick={toggleUnreachable}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${hideUnreachable ? 'bg-cobalt' : 'bg-line'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(26,34,54,0.25)] transition-transform ${
                  hideUnreachable ? 'translate-x-4' : ''
                }`}
              />
            </button>
            <span onClick={toggleUnreachable}>Nicht aufrufbare Websites ausblenden</span>
          </label>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-[12px] text-ink-soft">Sortieren nach</label>
            <select
              id="sort"
              className="field h-8 w-auto py-0 text-[12.5px]"
              value={`${filters.sort}:${filters.dir}`}
              onChange={(e) => {
                const [sort, dir] = e.target.value.split(':');
                const next = new URLSearchParams(params);
                next.set('sort', sort);
                next.set('dir', dir);
                setParams(next, { replace: true });
              }}
            >
              <option value="score:desc">Höchster Redesign-Score</option>
              <option value="score:asc">Niedrigster Redesign-Score</option>
              <option value="distance:asc">Geringste Entfernung</option>
              <option value="updated:desc">Zuletzt aktualisiert</option>
              <option value="name:asc">Name A–Z</option>
              <option value="name:desc">Name Z–A</option>
            </select>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-2" role="tablist" aria-label="Nach Status filtern">
          {STATUS_TABS.map((s) => {
            const active = filters.status === s;
            const count = tabCount(s);
            return (
              <button
                key={s || 'alle'}
                role="tab"
                aria-selected={active}
                onClick={() => setParam('status', s)}
                className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2.5 pt-1.5 text-[13px] font-medium transition-colors ${
                  active ? 'border-cobalt text-ink' : 'border-transparent text-mute hover:text-ink'
                }`}
              >
                {s ? STATUS_LABELS[s] : 'Alle aktiven'}
                {count != null && <span className={`tabular text-[11.5px] ${active ? 'text-cobalt' : 'text-mute'}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="grid gap-2.5 border-b border-line bg-canvas/50 px-3 py-3 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1.4fr)_1fr_1fr_minmax(190px,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-mute" />
            <input className="field pl-8" placeholder="Name, Domain oder Ort suchen" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Leads durchsuchen" />
          </div>
          <select className="field" value={filters.industry} onChange={(e) => setParam('industry', e.target.value)} aria-label="Branche">
            <option value="">Alle Branchen</option>
            {options.data?.industries.map((i) => <option key={i}>{i}</option>)}
          </select>
          <select className="field" value={filters.city} onChange={(e) => setParam('city', e.target.value)} aria-label="Standort">
            <option value="">Alle Orte</option>
            {options.data?.cities.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="flex h-9 items-center gap-3 rounded-md border border-line bg-panel px-3">
            <label htmlFor="min-score" className="shrink-0 text-[12px] text-ink-soft">Score ab</label>
            <input
              id="min-score"
              type="range"
              min={0}
              max={90}
              step={10}
              value={filters.minScore}
              onChange={(e) => setParam('minScore', Number(e.target.value))}
              className="w-full accent-cobalt"
            />
            <span className="w-6 text-right font-condensed text-[14px] font-semibold tabular">{filters.minScore}</span>
          </div>
          <button className="btn btn-ghost" onClick={resetFilters} disabled={!hasFilters}>
            Filter zurücksetzen
          </button>
        </div>
        {filters.jobId && (
          <div className="flex items-center gap-2 border-b border-line bg-cobalt-soft/60 px-4 py-2 text-[12.5px] text-cobalt-deep">
            Gefiltert auf Suchlauf #{filters.jobId}
            <button className="underline underline-offset-2" onClick={() => setParam('jobId', undefined)}>Alle anzeigen</button>
          </div>
        )}

        {leads.error ? (
          <div className="p-4"><ErrorNote message={leads.error.message} /></div>
        ) : leads.isLoading ? (
          <div className="flex items-center gap-2 px-4 py-10 text-ink-soft"><Spinner /> Leads werden geladen …</div>
        ) : rows.length === 0 ? (
          hasFilters || filters.status ? (
            <EmptyState title="Keine Leads für diese Filter" action={<button className="btn btn-secondary" onClick={resetFilters}>Filter zurücksetzen</button>}>
              Lockere die Filter oder wechsle den Status-Tab.
            </EmptyState>
          ) : (
            <EmptyState
              title="Noch keine Leads"
              action={<Link to="/suche" className="btn btn-primary"><Radar className="size-4" /> Erste Suche starten</Link>}
            >
              Wähle eine Branche und einen Ort. Altbau sammelt passende Unternehmen, prüft ihre Websites und sortiert sie nach Relaunch-Bedarf.
            </EmptyState>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[13px]">
              <thead className="text-[12px] text-mute">
                <tr className="border-b border-line">
                  <SortHeader label="Unternehmen" column="name" sort={filters.sort} dir={filters.dir} onSort={onSort} className="pl-4" />
                  <th className="px-3 py-2.5 text-left font-medium">Branche und Ort</th>
                  <SortHeader label="Redesign-Score" column="score" sort={filters.sort} dir={filters.dir} onSort={onSort} />
                  <th className="px-3 py-2.5 text-left font-medium">Wichtigste Pain Points</th>
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  <SortHeader label="Aktualisiert" column="updated" sort={filters.sort} dir={filters.dir} onSort={onSort} className="pr-4" />
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="cursor-pointer border-b border-line-soft transition-colors last:border-0 hover:bg-canvas/70"
                  >
                    <td className="max-w-[260px] py-2.5 pl-4 pr-3">
                      <Link to={`/leads/${lead.id}`} className="block truncate font-medium text-ink hover:text-cobalt" onClick={(e) => e.stopPropagation()}>
                        {lead.name}
                      </Link>
                      <div className="truncate text-[12px] text-mute">{lead.domain}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="truncate text-ink-soft">{lead.industry}</div>
                      <div className="truncate text-[12px] text-mute">
                        {lead.city ?? 'Ort unbekannt'}
                        {lead.distanceKm != null && <span className="tabular">, {lead.distanceKm.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><ScoreCell score={lead.score} status={lead.auditStatus} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {lead.painPoints.slice(0, 2).map((p) => <PainChip key={p.id} title={p.title} severity={p.severity} />)}
                        {lead.painPoints.length > 2 && <span className="text-[11.5px] text-mute tabular">+{lead.painPoints.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2"><StatusSelect lead={lead} /></td>
                    <td className="py-2.5 pl-3 pr-4 text-[12px] text-mute whitespace-nowrap">{relativeTime(lead.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <p className="mt-3 text-[12px] text-mute tabular">
          {rows.length} {rows.length === 1 ? 'Lead' : 'Leads'} angezeigt
          {leads.isFetching && !leads.isLoading && <span className="ml-2 inline-flex items-center gap-1"><Spinner className="size-3" /> aktualisiere</span>}
        </p>
      )}
    </>
  );
}
