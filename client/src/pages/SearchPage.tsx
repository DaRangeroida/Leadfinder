import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, CircleAlert, MapPin, Radar } from 'lucide-react';
import type { SearchJob } from '../../../shared/types.ts';
import { api } from '../api.ts';
import { PageHeader } from '../components/Layout.tsx';
import { ScoreCell } from '../components/Score.tsx';
import { ErrorNote, PainChip, Spinner } from '../components/ui.tsx';
import { useJobEvents } from '../hooks/useJobEvents.ts';

const LIMITS = [10, 25, 50, 100];
const PHASES = ['Standort finden', 'Unternehmen sammeln', 'Websites prüfen', 'Fertig'];

function phaseIndex(job: SearchJob | null): number {
  if (!job) return 0;
  if (job.status === 'done') return 3;
  if (job.status === 'auditing') return 2;
  if (job.status === 'discovering' && job.centerLat != null) return 1;
  return 0;
}

function PhaseTrack({ job }: { job: SearchJob | null }) {
  const current = phaseIndex(job);
  const failed = job?.status === 'error';
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Fortschritt">
      {PHASES.map((label, i) => {
        const done = i < current || job?.status === 'done';
        const active = i === current && !done && !failed;
        return (
          <li key={label} className="min-w-0">
            <div className={`h-1 rounded-full ${done ? 'bg-cobalt' : active ? 'relative overflow-hidden bg-cobalt/15' : failed && i === current ? 'bg-bad' : 'bg-line'}`}>
              {active && <span className="scan-sweep absolute inset-y-0 left-0 w-1/3 bg-cobalt" />}
            </div>
            <div className={`mt-2 flex items-center gap-1.5 truncate text-[12px] ${done || active ? 'text-ink' : 'text-mute'}`}>
              {done ? <Check className="size-3.5 shrink-0 text-cobalt" /> : active ? <Spinner className="size-3.5 shrink-0 text-cobalt" /> : failed && i === current ? <CircleAlert className="size-3.5 shrink-0 text-bad" /> : <span className="tabular shrink-0">{i + 1}</span>}
              <span className="truncate">{label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function LiveJob({ jobId }: { jobId: number }) {
  const stream = useJobEvents(jobId);
  const job = stream.job;
  const leads = useQuery({
    queryKey: ['leads', { jobId, sort: 'score' }],
    queryFn: () => api.leads({ jobId, sort: 'score', status: undefined }),
    enabled: job != null && job.found > 0,
  });
  const logEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [stream.log.length]);

  if (!job) {
    return (
      <div className="panel flex items-center gap-2 p-5 text-ink-soft">
        <Spinner /> Verbinde mit dem Suchlauf …
      </div>
    );
  }

  const progress = job.total ? Math.round((job.processed / job.total) * 100) : 0;
  const rows = leads.data ?? [];
  const hot = rows.filter((l) => (l.score ?? 0) >= 70).length;

  return (
    <div className="panel">
      <div className="border-b border-line p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold">
            {job.industryLabel} in {job.location}
            <span className="ml-2 text-[13px] font-normal text-mute">{job.radiusKm} km Umkreis</span>
          </h2>
          {job.status === 'auditing' && (
            <span className="font-condensed text-[15px] font-semibold tabular text-cobalt">
              {job.processed} von {job.total} geprüft
            </span>
          )}
        </div>
        <PhaseTrack job={job} />
        {job.status === 'auditing' && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line-soft" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-cobalt transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}
        {job.status === 'error' && job.error && <div className="mt-4"><ErrorNote message={job.error} /></div>}
        {job.status === 'done' && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-canvas px-4 py-3">
            <p className="text-[13px]">
              {job.found === 0 ? (
                'Keine neuen Leads gefunden.'
              ) : (
                <>
                  <strong className="font-semibold">{job.found} neue Leads</strong> geprüft
                  {hot > 0 && <>, davon <strong className="font-semibold text-heat-hot">{hot} mit akutem Relaunch-Bedarf</strong></>}.
                </>
              )}
            </p>
            {job.found > 0 && <Link to={`/leads?jobId=${job.id}`} className="btn btn-primary">Leads ansehen</Link>}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <ul className="max-h-[420px] divide-y divide-line-soft overflow-y-auto">
          {rows.map((lead) => (
            <li key={lead.id} className="rise-in">
              <Link to={`/leads/${lead.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-2.5 hover:bg-canvas/70 sm:grid-cols-[minmax(0,1fr)_170px_minmax(0,1fr)]">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{lead.name}</div>
                  <div className="truncate text-[12px] text-mute">{lead.domain}</div>
                </div>
                <ScoreCell score={lead.score} status={lead.auditStatus} />
                <div className="col-span-2 flex flex-wrap gap-1 sm:col-span-1">
                  {lead.painPoints.slice(0, 2).map((p) => <PainChip key={p.id} title={p.title} severity={p.severity} />)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {stream.log.length > 0 && <details className="group border-t border-line" open={job.status !== 'done'}>
        <summary className="cursor-pointer select-none px-5 py-2.5 text-[12px] text-mute hover:text-ink">Protokoll ({stream.log.length})</summary>
        <div className="max-h-48 overflow-y-auto px-5 pb-4 font-[ui-monospace,monospace] text-[11.5px] leading-relaxed">
          {stream.log.map((entry, i) => (
            <div key={i} className={entry.level === 'error' ? 'text-bad' : entry.level === 'warn' ? 'text-[#9a6a05]' : 'text-ink-soft'}>
              <span className="text-mute tabular">{new Date(entry.at).toLocaleTimeString('de-DE')}</span> {entry.message}
            </div>
          ))}
          <div ref={logEnd} />
        </div>
      </details>}
    </div>
  );
}

export function SearchPage() {
  const meta = useQuery({ queryKey: ['meta'], queryFn: api.meta, staleTime: Infinity });
  const [params, setParams] = useSearchParams();
  const jobId = params.get('job') ? Number(params.get('job')) : null;

  const [industry, setIndustry] = useState('zahnaerzte');
  const [custom, setCustom] = useState('');
  const [location, setLocation] = useState('');
  const [radiusKm, setRadiusKm] = useState(10);
  const [limit, setLimit] = useState(25);

  const start = useMutation({
    mutationFn: () => api.createJob({ industry: custom.trim() || industry, location, radiusKm, limit }),
    onSuccess: (job) => setParams({ job: String(job.id) }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    start.mutate();
  };

  return (
    <>
      <PageHeader
        title="Neue Suche"
        description="Altbau sammelt Unternehmen mit eigener Website aus OpenStreetMap und prüft jede Seite auf Mobiltauglichkeit, Aktualität, Sicherheit und Technik."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <form onSubmit={submit} className="panel p-5 lg:sticky lg:top-8">
          <fieldset>
            <legend className="label">Branche</legend>
            <div className="flex flex-wrap gap-1.5">
              {meta.data?.industries.map((i) => {
                const active = !custom.trim() && industry === i.key;
                return (
                  <button
                    type="button"
                    key={i.key}
                    aria-pressed={active}
                    onClick={() => {
                      setIndustry(i.key);
                      setCustom('');
                    }}
                    className={`rounded-md border px-2.5 py-1 text-[12.5px] transition-colors ${
                      active ? 'border-cobalt bg-cobalt-soft font-medium text-cobalt-deep' : 'border-line text-ink-soft hover:border-ink-soft/40 hover:text-ink'
                    }`}
                  >
                    {i.label}
                  </button>
                );
              }) ?? <Spinner />}
            </div>
            <input
              className="field mt-2.5"
              placeholder="Andere Branche, z. B. Hörakustiker"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              aria-label="Andere Branche"
            />
          </fieldset>

          <div className="mt-5">
            <label className="label" htmlFor="location">Ort oder PLZ</label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-mute" />
              <input id="location" className="field pl-8" placeholder="z. B. Köln-Ehrenfeld oder 80331" value={location} onChange={(e) => setLocation(e.target.value)} required />
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <label className="label" htmlFor="radius">Umkreis</label>
              <span className="font-condensed text-[15px] font-semibold tabular">{radiusKm} km</span>
            </div>
            <input id="radius" type="range" min={1} max={50} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="w-full accent-cobalt" />
          </div>

          <div className="mt-5">
            <span className="label">Höchstens prüfen</span>
            <div className="grid grid-cols-4 gap-1 rounded-md border border-line bg-canvas p-1" role="radiogroup" aria-label="Höchstens prüfen">
              {LIMITS.map((n) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={limit === n}
                  key={n}
                  onClick={() => setLimit(n)}
                  className={`h-7 rounded text-[12.5px] font-medium tabular transition-colors ${limit === n ? 'bg-panel text-ink shadow-[0_1px_2px_rgba(26,34,54,0.12)]' : 'text-mute hover:text-ink'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-mute">Die nächstgelegenen Unternehmen zuerst. Eine Prüfung dauert etwa 3–10 Sekunden.</p>
          </div>

          {start.error && <div className="mt-4"><ErrorNote message={start.error.message} /></div>}

          <button className="btn btn-primary mt-5 h-10 w-full" disabled={start.isPending || !location.trim()}>
            {start.isPending ? <Spinner /> : <Radar className="size-4" />}
            Suche starten
          </button>
          {meta.data && !meta.data.placesEnabled && (
            <p className="mt-3 text-[11.5px] leading-relaxed text-mute">
              Quelle: OpenStreetMap. Mit einem Google-Places-Key in der .env findet Altbau zusätzliche Betriebe.
            </p>
          )}
        </form>

        <div className="min-w-0">
          {jobId ? (
            <LiveJob key={jobId} jobId={jobId} />
          ) : (
            <div className="rounded-[10px] border border-dashed border-line px-6 py-12">
              <h2 className="text-[15px] font-semibold">So läuft eine Suche ab</h2>
              <ol className="mt-4 grid gap-4 text-[13px] text-ink-soft sm:grid-cols-3">
                <li>
                  <div className="font-condensed text-[20px] font-semibold text-ink">1</div>
                  Altbau sucht Betriebe der Branche im Umkreis und übernimmt Name, Adresse, Telefon und Website.
                </li>
                <li>
                  <div className="font-condensed text-[20px] font-semibold text-ink">2</div>
                  Jede Website wird geladen und auf rund 30 Kriterien geprüft, Impressum und Kontaktseite inklusive.
                </li>
                <li>
                  <div className="font-condensed text-[20px] font-semibold text-ink">3</div>
                  Jeder Lead erhält einen Redesign-Score und Pain Points, die du direkt im Gespräch nutzen kannst.
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
