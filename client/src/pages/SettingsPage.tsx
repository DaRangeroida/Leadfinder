import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiProvider, Meta } from '../../../shared/types.ts';
import { api } from '../api.ts';
import { PageHeader } from '../components/Layout.tsx';
import { ErrorNote, Spinner, useToast } from '../components/ui.tsx';

function StatusDot({ active, label }: { active: boolean; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${active ? 'text-ok' : 'text-mute'}`}>
      <span className={`size-1.5 rounded-full ${active ? 'bg-ok' : 'bg-line'}`} />
      {label ?? (active ? 'Aktiv' : 'Nicht eingerichtet')}
    </span>
  );
}

function Row({ title, status, children }: { title: string; status: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-line-soft px-5 py-4 last:border-0 sm:grid-cols-[220px_1fr]">
      <div>
        <div className="text-[13px] font-semibold">{title}</div>
        <div className="mt-0.5">{status}</div>
      </div>
      <div className="max-w-[70ch] text-[13px] leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

const code = 'rounded bg-canvas px-1 py-0.5 font-[ui-monospace,monospace] text-[12px] text-ink';

const PROVIDERS: { value: AiProvider; label: string; envKey: string; ready: (m: Meta) => boolean; detail: (m: Meta) => string }[] = [
  { value: 'gemini', label: 'Gemini', envKey: 'GEMINI_API_KEY', ready: (m) => m.geminiEnabled, detail: (m) => `Modell ${m.geminiModel}` },
  { value: 'claude', label: 'Claude', envKey: 'ANTHROPIC_API_KEY', ready: (m) => m.claudeEnabled, detail: () => 'Modell claude-opus-5-5' },
];

function AiProviderSetting({ meta }: { meta: Meta }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const save = useMutation({
    mutationFn: (aiProvider: AiProvider) => api.updateSettings({ aiProvider }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['meta'], updated);
      toast(`Pitches werden jetzt mit ${updated.aiProvider === 'gemini' ? 'Gemini' : 'Claude'} erstellt.`);
    },
    onError: (e) => toast(e.message, 'error'),
  });
  const current = PROVIDERS.find((p) => p.value === meta.aiProvider)!;

  return (
    <Row
      title="KI für Pitches"
      status={<StatusDot active={meta.aiReady} label={meta.aiReady ? `${current.label} aktiv` : `${current.label} ohne Key`} />}
    >
      <div className="inline-grid grid-cols-2 gap-1 rounded-md border border-line bg-canvas p-1" role="radiogroup" aria-label="KI-Anbieter für Pitches">
        {PROVIDERS.map((p) => {
          const selected = meta.aiProvider === p.value;
          return (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={save.isPending}
              onClick={() => !selected && save.mutate(p.value)}
              className={`flex min-w-[120px] items-center justify-center gap-2 rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                selected ? 'bg-panel text-ink shadow-[0_1px_2px_rgba(26,34,54,0.12)]' : 'text-mute hover:text-ink'
              }`}
            >
              {save.isPending && save.variables === p.value && <Spinner className="size-3.5" />}
              {p.label}
            </button>
          );
        })}
      </div>

      <ul className="mt-3 space-y-1.5">
        {PROVIDERS.map((p) => (
          <li key={p.value} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px]">
            <span className="w-14 font-medium text-ink">{p.label}</span>
            <StatusDot active={p.ready(meta)} label={p.ready(meta) ? 'Key vorhanden' : 'Kein Key'} />
            <span className="text-mute">{p.ready(meta) ? p.detail(meta) : <>Setze <code className={code}>{p.envKey}</code> in der .env</>}</span>
          </li>
        ))}
      </ul>

      {!meta.aiReady && (
        <div className="mt-3">
          <ErrorNote message={`Für ${current.label} ist kein Key hinterlegt. Pitches werden bis dahin aus der Vorlage erstellt.`} />
        </div>
      )}
      <p className="mt-3">
        Die gewählte KI schreibt den kompletten Pitch: Einstieg, Argumente, Angebot, Gesprächsleitfaden, Einwände und Nachfass-E-Mail. Schlägt sie fehl,
        greift automatisch die eingebaute Vorlage.
      </p>
    </Row>
  );
}

export function SettingsPage() {
  const meta = useQuery({ queryKey: ['meta'], queryFn: api.meta });
  return (
    <>
      <PageHeader
        title="Einstellungen"
        description="Die KI-Auswahl gilt sofort. API-Keys und Datenquellen stehen in der Datei .env im Projektordner; nach Änderungen dort den Server neu starten."
      />
      {meta.isLoading ? (
        <div className="flex items-center gap-2 text-ink-soft"><Spinner /> Lade Konfiguration …</div>
      ) : meta.error ? (
        <ErrorNote message={meta.error.message} />
      ) : meta.data ? (
        <div className="panel max-w-4xl">
          <Row title="Dein Absender-Profil" status={<StatusDot active={meta.data.onboarded} label={meta.data.onboarded ? 'Vollständig' : 'Unvollständig'} />}>
            <div className="text-ink">
              <strong className="font-semibold">{meta.data.profile.name}</strong>
              {meta.data.profile.company && `, ${meta.data.profile.role ? `${meta.data.profile.role} bei ` : ''}${meta.data.profile.company}`}
            </div>
            <div className="mt-0.5">{[meta.data.profile.email, meta.data.profile.phone, meta.data.profile.website].filter(Boolean).join(', ')}</div>
            <p className="mt-2">Name, Kontaktdaten, Leistungen und Tonalität fließen in jeden Pitch und jede Nachfass-E-Mail.</p>
            <Link to="/willkommen?bearbeiten" className="btn btn-secondary mt-3">Profil bearbeiten</Link>
          </Row>
          <AiProviderSetting meta={meta.data} />
          <Row title="OpenStreetMap" status={<StatusDot active />}>
            Standard-Datenquelle für Unternehmen, Adressen und Websites über Nominatim und Overpass – kostenlos und ohne Key. Hinterlege in{' '}
            <code className={code}>OSM_CONTACT_EMAIL</code> eine Kontaktadresse, wie es die Nutzungsrichtlinie verlangt.
          </Row>
          <Row title="Google Places" status={<StatusDot active={meta.data.placesEnabled} />}>
            Ergänzt die Suche um Betriebe, die in OpenStreetMap fehlen. Setze <code className={code}>GOOGLE_PLACES_API_KEY</code> mit aktivierter „Places API (New)“.
          </Row>
          <Row title="Parallele Prüfungen" status={<StatusDot active />}>
            Aktuell <strong className="font-semibold text-ink">{meta.data.auditConcurrency}</strong> Websites gleichzeitig. Anpassbar über <code className={code}>AUDIT_CONCURRENCY</code>.
          </Row>
          <Row title="Rechtlicher Rahmen" status={<StatusDot active label="Hinweis" />}>
            Altbau ruft nur öffentlich erreichbare Seiten so auf, wie es ein Besucher tun würde. Für die Kontaktaufnahme gilt: Anrufe bei Unternehmen sind
            bei mutmaßlichem Interesse zulässig, Werbe-E-Mails ohne vorherige Einwilligung nicht (§ 7 UWG). Daten aus OpenStreetMap stehen unter der ODbL.
          </Row>
        </div>
      ) : null}
    </>
  );
}
