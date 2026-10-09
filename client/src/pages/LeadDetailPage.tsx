import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ExternalLink, Mail, MapPin, Phone, RefreshCw, Trash2 } from 'lucide-react';
import { CATEGORY_LABELS, PIPELINE, STATUS_LABELS, uniquePhones, type Lead, type LeadStatus } from '../../../shared/types.ts';
import { api } from '../api.ts';
import { AuditChecks } from '../components/AuditChecks.tsx';
import { PitchPanel } from '../components/PitchPanel.tsx';
import { ScoreGauge } from '../components/Score.tsx';
import { ErrorNote, formatDate, relativeTime, SEVERITY_STYLES, Spinner, useToast } from '../components/ui.tsx';

function Pipeline({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const update = useMutation({
    mutationFn: (status: LeadStatus) => api.updateLead(lead.id, { status }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['lead', lead.id], updated);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast(`Status: ${STATUS_LABELS[updated.status]}`);
    },
    onError: (e) => toast(e.message, 'error'),
  });
  const currentIndex = PIPELINE.indexOf(lead.status);
  const discarded = lead.status === 'verworfen';

  return (
    <div className="panel flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-1" aria-label="Vertriebsstatus">
        {PIPELINE.map((status, i) => {
          const reached = !discarded && i <= currentIndex;
          const current = !discarded && i === currentIndex;
          return (
            <li key={status} className="flex items-center gap-1">
              {i > 0 && <span className={`h-px w-4 sm:w-6 ${reached ? 'bg-cobalt' : 'bg-line'}`} aria-hidden />}
              <button
                onClick={() => update.mutate(status)}
                disabled={update.isPending || current}
                aria-current={current ? 'step' : undefined}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                  current
                    ? 'border-cobalt bg-cobalt text-white'
                    : reached
                      ? 'border-cobalt/30 bg-cobalt-soft text-cobalt-deep hover:border-cobalt'
                      : 'border-line text-mute hover:border-ink-soft/40 hover:text-ink'
                }`}
              >
                {reached && !current && <Check className="size-3" />}
                {STATUS_LABELS[status]}
              </button>
            </li>
          );
        })}
      </ol>
      <button
        className={`btn h-8 ${discarded ? 'btn-secondary' : 'btn-ghost'}`}
        onClick={() => update.mutate(discarded ? 'geprueft' : 'verworfen')}
        disabled={update.isPending}
      >
        {discarded ? 'Wieder aufnehmen' : 'Verwerfen'}
      </button>
    </div>
  );
}

function Notes({ lead }: { lead: Lead }) {
  const [value, setValue] = useState(lead.notes);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const queryClient = useQueryClient();
  const last = useRef(lead.notes);

  useEffect(() => {
    if (value === last.current) return;
    setState('saving');
    const t = setTimeout(async () => {
      try {
        const updated = await api.updateLead(lead.id, { notes: value });
        last.current = value;
        queryClient.setQueryData(['lead', lead.id], updated);
        setState('saved');
      } catch {
        setState('error');
      }
    }, 700);
    return () => clearTimeout(t);
  }, [value, lead.id, queryClient]);

  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor="notes" className="text-[13px] font-semibold">Notizen</label>
        <span className="text-[11.5px] text-mute" aria-live="polite">
          {state === 'saving' ? 'Speichert …' : state === 'saved' ? 'Gespeichert' : state === 'error' ? <span className="text-bad">Nicht gespeichert</span> : ''}
        </span>
      </div>
      <textarea
        id="notes"
        className="field min-h-[150px] resize-y py-2 leading-relaxed"
        placeholder="Ansprechpartner, Gesprächsverlauf, nächste Schritte …"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}

function ContactCard({ lead }: { lead: Lead }) {
  const phones = uniquePhones([lead.phone, ...lead.foundPhones]);
  const emails = [...new Set([lead.email, ...lead.foundEmails].filter(Boolean) as string[])];
  const address = [lead.address, [lead.postcode, lead.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const mapUrl =
    lead.lat != null && lead.lon != null
      ? `https://www.openstreetmap.org/?mlat=${lead.lat}&mlon=${lead.lon}#map=18/${lead.lat}/${lead.lon}`
      : address
        ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${lead.name} ${address}`)}`
        : null;

  return (
    <div className="panel p-4">
      <h2 className="mb-3 text-[13px] font-semibold">Kontakt</h2>
      <ul className="space-y-2.5 text-[13px]">
        <li className="flex gap-2.5">
          <MapPin className="mt-0.5 size-4 shrink-0 text-mute" />
          {address ? (
            mapUrl ? <a href={mapUrl} target="_blank" rel="noreferrer" className="hover:text-cobalt">{address}</a> : <span>{address}</span>
          ) : (
            <span className="text-mute">Keine Adresse hinterlegt</span>
          )}
        </li>
        <li className="flex gap-2.5">
          <Phone className="mt-0.5 size-4 shrink-0 text-mute" />
          {phones.length ? (
            <div className="flex flex-col gap-0.5">
              {phones.map((p) => <a key={p} href={`tel:${p.replace(/[^\d+]/g, '')}`} className="tabular hover:text-cobalt">{p}</a>)}
            </div>
          ) : (
            <span className="text-mute">Keine Telefonnummer gefunden</span>
          )}
        </li>
        <li className="flex gap-2.5">
          <Mail className="mt-0.5 size-4 shrink-0 text-mute" />
          {emails.length ? (
            <div className="flex min-w-0 flex-col gap-0.5">
              {emails.map((m) => <a key={m} href={`mailto:${m}`} className="truncate hover:text-cobalt">{m}</a>)}
            </div>
          ) : (
            <span className="text-mute">Keine E-Mail-Adresse gefunden</span>
          )}
        </li>
      </ul>
      <p className="mt-3 text-[11.5px] text-mute">
        Quelle: {lead.source === 'osm' ? 'OpenStreetMap' : lead.source === 'google' ? 'Google Places' : 'manuell'}, ergänzt um Angaben aus Impressum und Kontaktseite.
      </p>
    </div>
  );
}

function TechFacts({ lead }: { lead: Lead }) {
  const f = lead.audit;
  if (!f || !f.reachable) return null;
  const rows: [string, string][] = [
    ['System', f.cms ? `${f.cms} ${f.cmsVersion ?? ''}`.trim() : f.siteBuilder ?? 'nicht erkannt'],
    ['Technik-Stand', f.estimatedEra ? `ca. ${f.estimatedEra}` : '–'],
    ['Copyright', f.copyrightYear ? String(f.copyrightYear) : 'kein Hinweis'],
    ['Ladezeit HTML', f.loadTimeMs != null ? `${(f.loadTimeMs / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} s` : '–'],
    ['Verschlüsselung', f.https ? (f.certValid === false ? 'HTTPS, Zertifikat ungültig' : 'HTTPS') : 'keine'],
    ['Geprüfte Seiten', String(f.pagesChecked.length)],
  ];
  return (
    <div className="panel p-4">
      <h2 className="mb-2 text-[13px] font-semibold">Steckbrief</h2>
      <dl className="divide-y divide-line-soft text-[12.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-1.5">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="truncate text-right font-medium tabular">{v}</dd>
          </div>
        ))}
      </dl>
      {f.eraHints.length > 0 && (
        <details className="mt-2 text-[12px]">
          <summary className="cursor-pointer text-mute hover:text-ink">Woran der Technik-Stand erkannt wurde</summary>
          <ul className="mt-1.5 space-y-0.5 text-ink-soft">
            {f.eraHints.map((h) => (
              <li key={h.source} className="flex justify-between gap-2"><span className="truncate">{h.source}</span><span className="tabular text-mute">{h.year}</span></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function PainPoints({ lead }: { lead: Lead }) {
  const [showAll, setShowAll] = useState(false);
  const points = showAll ? lead.painPoints : lead.painPoints.slice(0, 6);
  if (!lead.painPoints.length) {
    return <p className="text-[13px] text-ink-soft">Keine nennenswerten Schwachstellen gefunden. Dieser Lead eignet sich eher nicht für einen Relaunch-Pitch.</p>;
  }
  return (
    <>
      <ul className="divide-y divide-line-soft">
        {points.map((p) => (
          <li key={p.id} className="grid gap-x-4 gap-y-1 py-3 first:pt-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <div>
              <div className="flex items-center gap-2">
                <span className={`size-2 shrink-0 rounded-full ${SEVERITY_STYLES[p.severity].dot}`} aria-hidden />
                <span className="text-[13.5px] font-semibold">{p.title}</span>
              </div>
              <div className="mt-0.5 pl-4 text-[12px] text-mute">
                {SEVERITY_STYLES[p.severity].label}, {CATEGORY_LABELS[p.category]}, +{p.weight} Punkte
              </div>
              <p className="mt-1 pl-4 text-[12.5px] leading-relaxed text-ink-soft">{p.detail}</p>
            </div>
            <div className="pl-4 sm:pl-0">
              <p className="text-[12.5px] leading-relaxed"><span className="font-medium">Was es kostet:</span> {p.lever}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft"><span className="font-medium text-cobalt-deep">So löst es der Relaunch:</span> {p.fix}</p>
            </div>
          </li>
        ))}
      </ul>
      {lead.painPoints.length > 6 && (
        <button className="btn btn-ghost mt-2 h-8 px-2" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Weniger anzeigen' : `Alle ${lead.painPoints.length} Pain Points anzeigen`}
        </button>
      )}
    </>
  );
}

export function LeadDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const meta = useQuery({ queryKey: ['meta'], queryFn: api.meta });
  const lead = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.lead(id),
    refetchInterval: (q) => (q.state.data && (q.state.data.auditStatus === 'pending' || q.state.data.auditStatus === 'scanning') ? 1500 : false),
  });

  const prevStatus = useRef(lead.data?.auditStatus);
  useEffect(() => {
    const status = lead.data?.auditStatus;
    if (prevStatus.current === 'scanning' && status === 'done') {
      toast(`Prüfung abgeschlossen: Score ${lead.data!.score}.`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    }
    prevStatus.current = status;
  }, [lead.data, toast, queryClient]);

  const rescan = useMutation({
    mutationFn: () => api.rescan(id),
    onSuccess: (updated) => queryClient.setQueryData(['lead', id], updated),
    onError: (e) => toast(e.message, 'error'),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast('Lead gelöscht.');
      navigate('/leads');
    },
    onError: (e) => toast(e.message, 'error'),
  });

  if (lead.isLoading) {
    return <div className="flex items-center gap-2 py-10 text-ink-soft"><Spinner /> Lead wird geladen …</div>;
  }
  if (lead.error || !lead.data) {
    return (
      <div className="max-w-lg space-y-4 py-6">
        <ErrorNote message={lead.error?.message ?? 'Lead nicht gefunden.'} />
        <Link to="/leads" className="btn btn-secondary">Zurück zu den Leads</Link>
      </div>
    );
  }

  const l = lead.data;
  const scanning = l.auditStatus === 'pending' || l.auditStatus === 'scanning';
  const unreachable = l.audit && !l.audit.reachable;

  return (
    <>
      <Link to="/leads" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft hover:text-ink">
        <ArrowLeft className="size-3.5" /> Alle Leads
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.01em]">{l.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-soft">
            <a href={l.audit?.finalUrl ?? l.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-cobalt hover:underline">
              {l.domain} <ExternalLink className="size-3" />
            </a>
            <span>{l.industry}{l.category && l.category.toLowerCase() !== l.industry.toLowerCase() ? ` (${l.category})` : ''}</span>
            {l.city && <span>{l.city}{l.distanceKm != null && `, ${l.distanceKm.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km vom Suchzentrum`}</span>}
            <span className="text-mute">Geprüft {relativeTime(l.scannedAt)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => rescan.mutate()} disabled={scanning || rescan.isPending}>
            {scanning ? <Spinner /> : <RefreshCw className="size-4" />}
            {scanning ? 'Wird geprüft …' : 'Neu prüfen'}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm(`„${l.name}“ endgültig löschen? Notizen und Pitches gehen verloren.`)) remove.mutate();
            }}
            aria-label="Lead löschen"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="mb-5"><Pipeline lead={l} /></div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-5">
          <div className="panel p-5">
            {scanning ? (
              <div role="status">
                <div className="flex items-center gap-2 text-[14px] font-medium"><Spinner className="size-4 text-cobalt" /> Website wird geprüft …</div>
                <p className="mt-1 text-[12.5px] text-ink-soft">Startseite, Stylesheets, Zertifikat, Impressum und Kontaktseite werden analysiert. Das dauert meist wenige Sekunden.</p>
                <div className="relative mt-4 h-3 overflow-hidden rounded-[3px] bg-line-soft"><span className="scan-sweep absolute inset-y-0 left-0 w-1/3 bg-cobalt/40" /></div>
              </div>
            ) : l.auditStatus === 'error' ? (
              <ErrorNote message={l.auditError ?? 'Die Prüfung ist aus unbekanntem Grund fehlgeschlagen.'} />
            ) : (
              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <ScoreGauge score={l.score} summary={l.summary} />
                <div className="md:border-l md:border-line md:pl-6">
                  <h2 className="mb-2 text-[13px] font-semibold">Stärkste Argumente</h2>
                  <ul className="space-y-2">
                    {l.painPoints.slice(0, 4).map((p) => (
                      <li key={p.id} className="flex items-start gap-2 text-[13px]">
                        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${SEVERITY_STYLES[p.severity].dot}`} aria-hidden />
                        <span>{p.title}</span>
                      </li>
                    ))}
                    {!l.painPoints.length && <li className="text-[13px] text-mute">Keine gefunden.</li>}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {!scanning && l.auditStatus === 'done' && (
            <div className="panel p-5">
              <h2 className="mb-4 text-[15px] font-semibold">Pain Points und Verkaufshebel</h2>
              <PainPoints lead={l} />
            </div>
          )}

          <PitchPanel lead={l} aiLabel={meta.data?.aiReady ? (meta.data.aiProvider === 'gemini' ? 'Gemini' : 'Claude') : null} />

          {l.audit && !scanning && (
            <div className="panel p-5">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[15px] font-semibold">Audit im Detail</h2>
                <span className="text-[12px] text-mute">{formatDate(l.scannedAt, true)}</span>
              </div>
              {unreachable ? (
                <p className="text-[13px] text-ink-soft">Die Website war beim letzten Versuch nicht erreichbar ({l.audit.error ?? 'keine Antwort'}). Prüfe später erneut – oft ist genau das der beste Gesprächsanlass.</p>
              ) : (
                <AuditChecks facts={l.audit} />
              )}
            </div>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-8">
          <ContactCard lead={l} />
          <Notes key={l.id} lead={l} />
          <TechFacts lead={l} />
        </aside>
      </div>
    </>
  );
}
