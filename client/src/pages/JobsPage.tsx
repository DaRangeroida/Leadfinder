import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Radar } from 'lucide-react';
import type { JobStatus } from '../../../shared/types.ts';
import { api } from '../api.ts';
import { PageHeader } from '../components/Layout.tsx';
import { EmptyState, ErrorNote, formatDate, Spinner } from '../components/ui.tsx';

const JOB_STATUS: Record<JobStatus, { label: string; className: string }> = {
  queued: { label: 'Wartet', className: 'text-mute' },
  discovering: { label: 'Sammelt Unternehmen', className: 'text-cobalt' },
  auditing: { label: 'Prüft Websites', className: 'text-cobalt' },
  done: { label: 'Fertig', className: 'text-ok' },
  error: { label: 'Fehlgeschlagen', className: 'text-bad' },
};

export function JobsPage() {
  const jobs = useQuery({
    queryKey: ['jobs'],
    queryFn: api.jobs,
    refetchInterval: (q) => (q.state.data?.some((j) => j.status !== 'done' && j.status !== 'error') ? 2000 : false),
  });

  return (
    <>
      <PageHeader
        title="Suchläufe"
        description="Jede Suche nach Branche und Ort. Laufende Suchen lassen sich live verfolgen."
        actions={<Link to="/suche" className="btn btn-primary"><Radar className="size-4" /> Neue Suche</Link>}
      />
      <div className="panel overflow-hidden">
        {jobs.error ? (
          <div className="p-4"><ErrorNote message={jobs.error.message} /></div>
        ) : jobs.isLoading ? (
          <div className="flex items-center gap-2 px-4 py-10 text-ink-soft"><Spinner /> Lade Suchläufe …</div>
        ) : !jobs.data?.length ? (
          <EmptyState title="Noch keine Suchläufe" action={<Link to="/suche" className="btn btn-primary">Erste Suche starten</Link>}>
            Hier erscheinen alle Suchen mit ihren Ergebnissen.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="text-[12px] text-mute">
                <tr className="border-b border-line">
                  <th className="py-2.5 pl-4 pr-3 text-left font-medium">Suche</th>
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Neue Leads</th>
                  <th className="px-3 py-2.5 text-right font-medium">Bereits bekannt</th>
                  <th className="px-3 py-2.5 text-left font-medium">Gestartet</th>
                  <th className="py-2.5 pl-3 pr-4" />
                </tr>
              </thead>
              <tbody>
                {jobs.data.map((job) => {
                  const running = job.status !== 'done' && job.status !== 'error';
                  return (
                    <tr key={job.id} className="border-b border-line-soft last:border-0">
                      <td className="py-2.5 pl-4 pr-3">
                        <div className="font-medium">{job.industryLabel} in {job.location}</div>
                        <div className="text-[12px] text-mute">{job.radiusKm} km Umkreis, höchstens {job.limit}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${JOB_STATUS[job.status].className}`}>
                          {running && <Spinner className="size-3.5" />}
                          {JOB_STATUS[job.status].label}
                          {job.status === 'auditing' && <span className="tabular">({job.processed}/{job.total})</span>}
                        </span>
                        {job.error && <div className="max-w-[300px] truncate text-[12px] text-bad" title={job.error}>{job.error}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-condensed text-[15px] font-semibold tabular">{job.found}</td>
                      <td className="px-3 py-2.5 text-right tabular text-mute">{job.skipped}</td>
                      <td className="px-3 py-2.5 text-[12.5px] text-ink-soft">{formatDate(job.createdAt, true)}</td>
                      <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
                        {running ? (
                          <Link to={`/suche?job=${job.id}`} className="btn btn-secondary h-8">Live verfolgen</Link>
                        ) : job.found > 0 ? (
                          <Link to={`/leads?jobId=${job.id}`} className="btn btn-ghost h-8">Leads ansehen</Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
