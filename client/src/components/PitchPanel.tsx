import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, FileText, RefreshCw, Sparkles } from 'lucide-react';
import type { Lead, Pitch } from '../../../shared/types.ts';
import { api } from '../api.ts';
import { ErrorNote, formatDate, Spinner, useToast } from './ui.tsx';

function providerName(pitch: Pitch): string {
  return pitch.provider === 'gemini' ? 'Gemini' : pitch.provider === 'claude' ? 'Claude' : 'KI';
}

function pitchAsText(pitch: Pitch, lead: Lead): string {
  return [
    `Gesprächsvorbereitung: ${lead.name} (${lead.domain})`,
    '',
    'Einstieg',
    pitch.opener,
    '',
    'Argumente',
    ...pitch.talkingPoints.map((p) => `- ${p.title}: ${p.argument} Lösung: ${p.solution}`),
    '',
    'Angebot',
    pitch.offer,
    '',
    'Gesprächsleitfaden',
    ...pitch.callScript.map((s, i) => `${i + 1}. ${s}`),
    '',
    'Einwände',
    ...pitch.objections.flatMap((o) => [`„${o.objection}“`, `  ${o.answer}`]),
    '',
    `Nachfass-E-Mail: ${pitch.email.subject}`,
    pitch.email.body,
  ].join('\n');
}

function CopyButton({ text, label = 'Kopieren' }: { text: string; label?: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn btn-ghost h-7 px-2 text-[12px]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast('In die Zwischenablage kopiert.');
        } catch {
          toast('Kopieren ist in diesem Browser nicht erlaubt.', 'error');
        }
      }}
    >
      <Copy className="size-3.5" /> {label}
    </button>
  );
}

function Section({ title, children, copy }: { title: string; children: ReactNode; copy?: string }) {
  return (
    <section className="border-t border-line-soft py-4 first:border-0 first:pt-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {copy && <CopyButton text={copy} />}
      </div>
      {children}
    </section>
  );
}

function PitchSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[92, 78, 85, 60, 88, 70].map((w, i) => (
        <div key={i} className="relative h-3 overflow-hidden rounded bg-line-soft" style={{ width: `${w}%` }}>
          <span className="scan-sweep absolute inset-y-0 left-0 w-1/3 bg-white/70" />
        </div>
      ))}
    </div>
  );
}

export function PitchPanel({ lead, aiLabel }: { lead: Lead; aiLabel: string | null }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [warning, setWarning] = useState<string | null>(null);
  const saved = useQuery({ queryKey: ['pitch', lead.id], queryFn: () => api.pitch(lead.id) });
  const generate = useMutation({
    mutationFn: (mode: 'auto' | 'vorlage') => api.generatePitch(lead.id, mode),
    onSuccess: (result) => {
      queryClient.setQueryData(['pitch', lead.id], result);
      setWarning(result.warning);
      toast(result.pitch.mode === 'ki' ? `Pitch mit ${providerName(result.pitch)} erstellt.` : 'Pitch aus der Vorlage erstellt.');
    },
  });

  const pitch = saved.data?.pitch ?? null;
  const ready = lead.auditStatus === 'done';

  const actions = (
    <div className="flex flex-wrap gap-2">
      <button className="btn btn-primary" disabled={!ready || generate.isPending} onClick={() => generate.mutate('auto')}>
        {generate.isPending ? <Spinner /> : pitch ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}
        {pitch ? 'Neu erstellen' : aiLabel ? `Pitch mit ${aiLabel} erstellen` : 'Pitch erstellen'}
      </button>
      {aiLabel && (
        <button className="btn btn-secondary" disabled={!ready || generate.isPending} onClick={() => generate.mutate('vorlage')}>
          <FileText className="size-4" /> Aus Vorlage
        </button>
      )}
    </div>
  );

  return (
    <div className="panel p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Pitch-Generator</h2>
          <p className="mt-0.5 max-w-[60ch] text-[12.5px] text-ink-soft">
            {pitch
              ? `${pitch.mode === 'ki' ? `Mit ${providerName(pitch)} erstellt` : 'Aus Vorlage erstellt'} am ${formatDate(pitch.createdAt, true)}`
              : 'Erstellt aus den gefundenen Schwachstellen eine Gesprächsvorbereitung mit Einstieg, Argumenten, Einwandbehandlung und Nachfass-E-Mail.'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {pitch && <CopyButton text={pitchAsText(pitch, lead)} label="Alles kopieren" />}
        </div>
      </div>

      {!ready && <p className="mb-4 text-[12.5px] text-mute">Verfügbar, sobald die Website geprüft ist.</p>}
      {generate.error && <div className="mb-4"><ErrorNote message={generate.error.message} /></div>}
      {warning && <div className="mb-4 rounded-md bg-heat-warm-soft px-3 py-2 text-[12.5px] text-[#7a5404]">{warning}</div>}

      {generate.isPending ? (
        <div>
          <p className="mb-4 flex items-center gap-2 text-[13px] text-ink-soft">
            <Spinner /> {aiLabel ? `${aiLabel} formuliert den Pitch, das dauert etwa 10–40 Sekunden …` : 'Pitch wird erstellt …'}
          </p>
          <PitchSkeleton />
        </div>
      ) : pitch ? (
        <div className="rise-in">
          <Section title="Gesprächseinstieg" copy={pitch.opener}>
            <p className="max-w-[72ch] text-[13.5px] leading-relaxed">{pitch.opener}</p>
          </Section>

          <Section title="Argumente aus dem Audit">
            <ul className="space-y-3">
              {pitch.talkingPoints.map((p) => (
                <li key={p.title} className="border-l-2 border-heat-hot/60 pl-3">
                  <div className="text-[13px] font-semibold">{p.title}</div>
                  <p className="mt-0.5 max-w-[72ch] text-[13px] leading-relaxed text-ink-soft">{p.argument}</p>
                  <p className="mt-1 max-w-[72ch] text-[12.5px] leading-relaxed text-ink"><span className="font-medium text-cobalt-deep">Lösung:</span> {p.solution}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Angebot" copy={pitch.offer}>
            <p className="max-w-[72ch] text-[13px] leading-relaxed">{pitch.offer}</p>
          </Section>

          <Section title="Gesprächsleitfaden">
            <ol className="space-y-1.5">
              {pitch.callScript.map((step, i) => (
                <li key={i} className="grid grid-cols-[22px_1fr] text-[13px] leading-relaxed">
                  <span className="font-condensed font-semibold tabular text-mute">{i + 1}</span>
                  <span className="max-w-[70ch]">{step}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Einwände und Antworten">
            <dl className="space-y-3">
              {pitch.objections.map((o) => (
                <div key={o.objection}>
                  <dt className="text-[13px] font-medium">„{o.objection}“</dt>
                  <dd className="mt-0.5 max-w-[72ch] text-[13px] leading-relaxed text-ink-soft">{o.answer}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Nachfass-E-Mail" copy={`Betreff: ${pitch.email.subject}\n\n${pitch.email.body}`}>
            <div className="rounded-md border border-line bg-canvas/60">
              <div className="border-b border-line px-3.5 py-2 text-[12.5px]">
                <span className="text-mute">Betreff:</span> <span className="font-medium">{pitch.email.subject}</span>
              </div>
              <pre className="whitespace-pre-wrap px-3.5 py-3 font-sans text-[13px] leading-relaxed">{pitch.email.body}</pre>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-mute">
              Gedacht für den Versand nach dem ersten Gespräch. Unaufgeforderte Werbe-E-Mails an Unternehmen sind nach § 7 UWG ohne Einwilligung unzulässig.
            </p>
          </Section>
        </div>
      ) : null}

      <div className={pitch || generate.isPending ? 'mt-2 border-t border-line-soft pt-4' : ''}>{!generate.isPending && actions}</div>
    </div>
  );
}
