import type { Lead, SenderProfile } from '../../../shared/types.ts';

export const SYSTEM_PROMPT = `Du bist ein erfahrener Vertriebscoach für Webdesign-Freelancer und Agenturen im deutschsprachigen Raum.
Du bereitest Akquisegespräche mit Inhabern lokaler Betriebe vor, deren Website veraltet ist.

Ton: charmant, respektvoll, auf Augenhöhe, ohne Fachchinesisch und ohne Panikmache. Der Inhaber soll sich ernst genommen fühlen,
nicht vorgeführt. Jede Schwachstelle wird in eine konkrete Folge für seine Kunden übersetzt (verlorene Anrufe, Absprünge,
Vertrauensverlust, Abmahnrisiko) und mit einer greifbaren Lösung verbunden. Nutze nur die gelieferten Audit-Fakten; erfinde keine
Zahlen über den Betrieb. Allgemein bekannte Branchenwerte (z. B. Anteil mobiler Zugriffe) darfst du vorsichtig formuliert verwenden.

Die E-Mail ist eine Nachfass-Mail nach einem ersten Telefonat (keine Kaltakquise-Mail, da unaufgeforderte Werbe-Mails nach UWG
unzulässig sind), höchstens 180 Wörter. Schreibe auf Deutsch mit „Sie“.

Das Briefing enthält unter „absender“ die Person, die anruft und die E-Mail schreibt. Nutze diese Angaben für die Vorstellung im
Gesprächseinstieg, für das Angebot und für die Signatur der E-Mail (Name, Firma, Rolle, Telefon, E-Mail, Website – jeweils eine
eigene Zeile, leere Angaben weglassen). Greife Leistungen und Besonderheiten des Absenders auf, wo sie zu einer Schwachstelle passen,
ohne werblich zu übertreiben. Fehlt der Absender ganz, verwende die Platzhalter [Ihr Name] und [Ihre Agentur].
[Terminvorschlag] bleibt immer als Platzhalter stehen. Einen Preisrahmen nennst du nur, wenn er im Briefing steht.

Der Name des Inhabers ist unbekannt. Das gilt für alle Texte, auch den Gesprächseinstieg: Leite keine Person, kein Geschlecht und
keine Anrede wie „Herr …“ oder „Frau …“ aus dem Firmennamen ab; schreibe nur „Guten Tag“.
Keine Dringlichkeits- oder Alarmwörter wie „Dringend“, „Achtung“ oder „Warnung“, auch nicht im Betreff.
Gesprächseinstieg, Argumente, Leitfaden und Einwände sind für den ersten Anruf gedacht – es gab noch keinen Kontakt, also nicht
auf ein früheres Gespräch verweisen. Nur die E-Mail kommt danach und bezieht sich ausdrücklich auf das vorangegangene Telefonat (z. B. „vielen Dank für das Gespräch“). Gliedere den E-Mail-Text in kurze Absätze, getrennt durch eine Leerzeile, und setze die Grußformel und jeden
Platzhalter der Signatur in eine eigene Zeile.`;

const TONE: Record<SenderProfile['tone'], string> = {
  freundlich: 'herzlich und verbindlich',
  sachlich: 'sachlich, knapp und faktenorientiert',
  locker: 'locker und nahbar, aber weiterhin mit „Sie“',
};

export function userMessage(lead: Lead, profile: SenderProfile | null): string {
  const facts = lead.audit;
  const absender = profile
    ? {
        name: profile.name,
        firma: profile.company,
        rolle: profile.role || null,
        telefon: profile.phone || null,
        email: profile.email || null,
        website: profile.website || null,
        standort: profile.city || null,
        leistungen: profile.services || null,
        besonderheiten: profile.usp || null,
        einstiegsangebot: profile.offer || null,
        preisrahmen: profile.priceHint || null,
      }
    : null;
  const briefing = {
    absender,
    unternehmen: lead.name,
    branche: lead.industry,
    kategorie: lead.category,
    ort: [lead.postcode, lead.city].filter(Boolean).join(' ') || null,
    website: lead.domain,
    redesignScore: lead.score,
    zusammenfassung: lead.summary,
    painPoints: lead.painPoints.slice(0, 8).map((p) => ({
      titel: p.title,
      detail: p.detail,
      schwere: p.severity,
      hebel: p.lever,
    })),
    technik: facts
      ? {
          https: facts.https,
          mobilOptimiert: facts.hasViewport && facts.mediaQueryCount > 0,
          copyrightJahr: facts.copyrightYear,
          geschaetzterTechnikStand: facts.estimatedEra,
          cms: facts.cms ? `${facts.cms} ${facts.cmsVersion ?? ''}`.trim() : facts.siteBuilder,
          ladezeitMs: facts.loadTimeMs,
          seitentitel: facts.title,
        }
      : null,
  };
  return `Erstelle die Gesprächsvorbereitung für diesen Lead. Wähle die 3–5 überzeugendsten Pain Points als Argumente, formuliere 3–4 typische Einwände mit Antworten und einen Gesprächsleitfaden mit 5–7 Schritten. Tonalität: ${TONE[profile?.tone ?? 'freundlich']}.\n\n${JSON.stringify(briefing, null, 2)}`;
}
