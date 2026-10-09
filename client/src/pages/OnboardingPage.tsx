import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react';
import { EMPTY_PROFILE, type SenderProfile } from '../../../shared/types.ts';
import { api } from '../api.ts';
import { ErrorNote, Spinner, useToast } from '../components/ui.tsx';

type Field = keyof Omit<SenderProfile, 'tone'>;

interface Step {
  title: string;
  intro: string;
  fields: { key: Field; label: string; placeholder: string; hint?: string; required?: boolean; multiline?: boolean; type?: string }[];
}

const STEPS: Step[] = [
  {
    title: 'Wer ruft an?',
    intro: 'Mit diesen Angaben stellt dich die KI im Gesprächseinstieg vor und unterschreibt die E-Mail in deinem Namen.',
    fields: [
      { key: 'name', label: 'Dein Name', placeholder: 'Julia Schneider', required: true },
      { key: 'company', label: 'Firma oder Agentur', placeholder: 'Schneider Webdesign', required: true },
      { key: 'role', label: 'Deine Rolle', placeholder: 'Inhaberin, Webdesignerin' },
      { key: 'city', label: 'Standort', placeholder: 'Bamberg', hint: 'Lokale Nähe ist im Gespräch ein starkes Argument.' },
    ],
  },
  {
    title: 'Wie erreicht man dich?',
    intro: 'Diese Kontaktdaten erscheinen in der Signatur der Nachfass-E-Mail. Mindestens E-Mail oder Telefon ist nötig.',
    fields: [
      { key: 'email', label: 'E-Mail', placeholder: 'hallo@schneider-webdesign.de', type: 'email' },
      { key: 'phone', label: 'Telefon', placeholder: '0951 123 456', type: 'tel' },
      { key: 'website', label: 'Website', placeholder: 'schneider-webdesign.de', hint: 'Am besten mit Referenzen – Inhaber schauen sich die Seite nach dem Anruf an.' },
    ],
  },
  {
    title: 'Was bietest du an?',
    intro: 'Daraus formuliert die KI das Angebot und verknüpft deine Stärken mit den Schwachstellen der jeweiligen Website.',
    fields: [
      { key: 'services', label: 'Leistungen', placeholder: 'Webdesign, WordPress, Local SEO, Wartung', multiline: true },
      {
        key: 'usp',
        label: 'Was dich auszeichnet',
        placeholder: '12 Jahre Erfahrung, über 40 Handwerksbetriebe in Franken, feste Ansprechpartnerin, Festpreise',
        multiline: true,
      },
      { key: 'offer', label: 'Einstiegsangebot im Gespräch', placeholder: 'kostenloser 20-minütiger Website-Check per Video oder vor Ort' },
      { key: 'priceHint', label: 'Preisrahmen (optional)', placeholder: 'Relaunch ab 2.500 €, Pflege ab 39 € im Monat', hint: 'Wird nur genannt, wenn du etwas einträgst.' },
    ],
  },
];

const TONES: { value: SenderProfile['tone']; label: string; example: string }[] = [
  { value: 'freundlich', label: 'Freundlich', example: '„Mir ist dabei etwas aufgefallen, das ich Ihnen gern zeigen würde.“' },
  { value: 'sachlich', label: 'Sachlich', example: '„Bei der Prüfung Ihrer Website sind drei Punkte aufgefallen.“' },
  { value: 'locker', label: 'Locker', example: '„Ich bin über Ihre Seite gestolpert und hätte da zwei, drei Ideen.“' },
];

function Preview({ profile }: { profile: SenderProfile }) {
  const company = profile.role ? `${profile.role}, ${profile.company}` : profile.company;
  const lines = [profile.name, company, profile.phone, profile.email, profile.website].filter(Boolean);
  return (
    <div className="rounded-md border border-line bg-canvas/60 p-4 text-[13px] leading-relaxed">
      <div className="mb-2 text-[12px] font-medium text-mute">So stellt dich der Pitch vor</div>
      <p>
        „Guten Tag, mein Name ist {profile.name || '[Ihr Name]'} von {profile.company || '[Ihre Agentur]'}
        {profile.city ? ` aus ${profile.city}` : ''}. Ich habe mir Ihre Website angesehen …“
      </p>
      <div className="mt-3 border-t border-line pt-3 whitespace-pre-line text-ink-soft">
        Viele Grüße{'\n'}
        {lines.length ? lines.join('\n') : '[Ihr Name]\n[Ihre Agentur]'}
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-[620px]">
        <div className="mb-8 flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
            <rect width="32" height="32" rx="7" fill="#1a2236" />
            <path d="M8 24V14l8-6 8 6v10" fill="none" stroke="#F2F4F7" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M16 12l-1.5 4 3 2-2 6" fill="none" stroke="#E2531F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-condensed text-[20px] font-bold tracking-tight">Altbau</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function OnboardingPage() {
  const meta = useQuery({ queryKey: ['meta'], queryFn: api.meta });
  const [params] = useSearchParams();
  const editing = params.has('bearbeiten');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<SenderProfile>(EMPTY_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => {
    if (meta.data && !loaded) {
      setProfile(meta.data.profile);
      setLoaded(true);
    }
  }, [meta.data, loaded]);

  const save = useMutation({
    mutationFn: () => api.updateProfile(profile),
    onSuccess: (updated) => {
      queryClient.setQueryData(['meta'], updated);
      queryClient.invalidateQueries({ queryKey: ['pitch'] });
      toast(editing ? 'Profil gespeichert.' : 'Profil gespeichert. Los geht’s mit der ersten Suche.');
      navigate(editing ? '/einstellungen' : '/suche');
    },
  });

  if (meta.isLoading || !loaded) {
    return <Shell><div className="flex items-center gap-2 text-ink-soft"><Spinner /> Lade …</div></Shell>;
  }

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const set = (key: keyof SenderProfile, value: string) => setProfile((p) => ({ ...p, [key]: value }));

  const validate = (): string | null => {
    for (const f of current.fields) if (f.required && !profile[f.key].trim()) return `Bitte „${f.label}“ ausfüllen.`;
    if (step === 1) {
      if (!profile.email.trim() && !profile.phone.trim()) return 'Bitte mindestens eine E-Mail-Adresse oder Telefonnummer angeben.';
      if (profile.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) return 'Die E-Mail-Adresse sieht nicht gültig aus.';
    }
    return null;
  };

  const next = (e: FormEvent) => {
    e.preventDefault();
    const error = validate();
    setStepError(error);
    if (error) return;
    if (last) save.mutate();
    else setStep(step + 1);
  };

  return (
    <Shell>
      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Fortschritt">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => i < step && setStep(i)}
              className="block w-full text-left disabled:cursor-default"
              aria-current={i === step ? 'step' : undefined}
            >
              <div className={`h-1 rounded-full ${i <= step ? 'bg-cobalt' : 'bg-line'}`} />
              <div className={`mt-2 flex items-center gap-1.5 text-[12px] ${i <= step ? 'text-ink' : 'text-mute'}`}>
                {i < step ? <Check className="size-3.5 text-cobalt" /> : <span className="tabular">{i + 1}</span>}
                <span className="truncate">{s.title}</span>
              </div>
            </button>
          </li>
        ))}
      </ol>

      <form onSubmit={next} className="panel p-6 sm:p-8" noValidate>
        {step === 0 && !editing && (
          <p className="mb-5 text-[13px] text-ink-soft">
            Willkommen bei Altbau. Drei kurze Fragen, damit Pitches und E-Mails klingen, als hättest du sie selbst geschrieben.
          </p>
        )}
        <h1 className="text-[20px] font-semibold tracking-[-0.01em]">{current.title}</h1>
        <p className="mt-1 mb-6 max-w-[56ch] text-[13px] text-ink-soft">{current.intro}</p>

        <div key={step} className="rise-in space-y-4">
          {current.fields.map((f) => (
            <div key={f.key}>
              <label className="label" htmlFor={f.key}>
                {f.label}
                {f.required && <span className="text-heat-hot"> *</span>}
              </label>
              {f.multiline ? (
                <textarea
                  id={f.key}
                  className="field min-h-[72px] resize-y py-2 leading-relaxed"
                  placeholder={f.placeholder}
                  value={profile[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : (
                <input
                  id={f.key}
                  type={f.type ?? 'text'}
                  className="field"
                  placeholder={f.placeholder}
                  value={profile[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  autoFocus={f === current.fields[0]}
                />
              )}
              {f.hint && <p className="mt-1 text-[12px] text-mute">{f.hint}</p>}
            </div>
          ))}

          {last && (
            <fieldset>
              <legend className="label">Wie sollen die Texte klingen?</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {TONES.map((t) => (
                  <label
                    key={t.value}
                    className={`cursor-pointer rounded-md border p-3 transition-colors ${
                      profile.tone === t.value ? 'border-cobalt bg-cobalt-soft' : 'border-line hover:border-ink-soft/40'
                    }`}
                  >
                    <input type="radio" name="tone" value={t.value} checked={profile.tone === t.value} onChange={() => set('tone', t.value)} className="sr-only" />
                    <div className="text-[13px] font-medium">{t.label}</div>
                    <div className="mt-1 text-[12px] leading-snug text-ink-soft">{t.example}</div>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {last && <Preview profile={profile} />}
        </div>

        {(stepError || save.error) && <div className="mt-5"><ErrorNote message={stepError ?? save.error!.message} /></div>}

        <div className="mt-7 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => { setStepError(null); setStep(step - 1); }}>
              <ArrowLeft className="size-4" /> Zurück
            </button>
          ) : editing ? (
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/einstellungen')}>Abbrechen</button>
          ) : <span />}
          <button className="btn btn-primary h-10 px-5" disabled={save.isPending}>
            {save.isPending && <Spinner />}
            {last ? 'Profil speichern' : 'Weiter'}
          </button>
        </div>
      </form>
      <p className="mt-4 text-[12px] text-mute">Alles lässt sich später unter Einstellungen ändern. Die Angaben werden lokal gespeichert und nur beim Erstellen eines Pitches an die gewählte KI übermittelt.</p>
    </Shell>
  );
}
