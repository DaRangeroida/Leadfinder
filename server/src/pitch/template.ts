import type { Lead, Pitch, PainPoint, SenderProfile } from '../../../shared/types.ts';
import { getProfile } from '../db.ts';

function pick<T>(items: T[], seed: number): T {
  return items[seed % items.length];
}

function compliment(lead: Lead): string {
  const where = lead.city ? `in ${lead.city}` : 'in der Region';
  return pick(
    [
      `Ihr Betrieb hat ${where} offensichtlich einen guten Namen – genau deshalb ist mir Ihre Website aufgefallen.`,
      `Sie sind ${where} gut sichtbar, das sieht man schon an Ihrem Eintrag bei Google und auf der Karte.`,
      `Ich schaue mir regelmäßig an, wie sich ${lead.industry} ${where} online präsentieren – Ihr Betrieb ist mir dabei positiv aufgefallen.`,
    ],
    lead.id,
  );
}

function signature(profile: SenderProfile | null): string {
  if (!profile) return '[Ihr Name]\n[Ihre Agentur]\n[Telefon]';
  const company = profile.role ? `${profile.role}, ${profile.company}` : profile.company;
  return [profile.name, company, profile.phone, profile.email, profile.website].filter(Boolean).join('\n');
}

const lowerFirst =(s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const stripDot = (s: string) => s.replace(/\.$/, '');

function painHeadline(points: PainPoint[]): string {
  const ids = new Set(points.map((p) => p.id));
  if (ids.has('unreachable')) return 'dass Ihre Website gerade nicht erreichbar ist';
  if (ids.has('no-viewport') || ids.has('not-responsive')) return 'dass Ihre Seite auf dem Smartphone nicht richtig dargestellt wird';
  if (ids.has('no-https') || ids.has('cert-invalid')) return 'dass Browser Ihre Seite als „Nicht sicher“ markieren';
  if (ids.has('old-copyright') || ids.has('old-era')) return 'dass Ihre Seite technisch ein paar Jahre hinter Ihrem Betrieb zurückliegt';
  return 'dass Ihre Website Ihnen mehr Anfragen bringen könnte, als sie es heute tut';
}

export function buildTemplatePitch(lead: Lead, profile: SenderProfile | null = getProfile()): Pitch {
  const points = lead.painPoints.slice(0, 5);
  const headline = painHeadline(points);
  const top = points[0];

  const opener =
    `Guten Tag, hier ist [Ihr Name] von [Ihre Agentur]. ${compliment(lead)} ` +
    `Beim Durchklicken ist mir allerdings aufgefallen, ${headline}. ` +
    `Haben Sie zwei Minuten? Ich zeige Ihnen kurz, was ich gesehen habe – ganz unverbindlich.`;

  const talkingPoints = points.map((p) => ({ title: p.title, argument: p.lever, solution: p.fix }));

  const fixes = (points.some((p) => p.severity === 'kritisch' || p.severity === 'hoch')
    ? points.filter((p) => p.severity === 'kritisch' || p.severity === 'hoch')
    : points
  ).map((p) => lowerFirst(stripDot(p.fix)));
  const offer =
    (fixes.length
      ? `Ein Relaunch für ${lead.name} setzt genau bei diesen Punkten an – konkret: ${fixes.slice(0, 3).join('; ')}. `
      : `Ein Relaunch bringt Design, Technik und Inhalte von ${lead.name} auf den aktuellen Stand. `) +
    `Dazu kommt ein Pflegezugang, mit dem Sie Texte, Bilder und Öffnungszeiten selbst ändern. ` +
    `Als Einstieg biete ich Ihnen an: ${stripDot(profile?.offer || 'einen kostenlosen 20-minütigen Website-Check vor Ort oder per Video')}.` +
    (profile?.priceHint ? ` Zur Orientierung: ${stripDot(profile.priceHint)}.` : '');

  const objections = [
    {
      objection: 'Unsere Kunden kommen sowieso über Empfehlungen.',
      answer:
        'Genau die schauen sich vor dem Anruf Ihre Website an. Wer empfohlen wird und dann auf eine veraltete Seite trifft, zweifelt – eine moderne Seite bestätigt die Empfehlung.',
    },
    {
      objection: 'Dafür haben wir gerade keine Zeit.',
      answer:
        'Verständlich. Deshalb übernehme ich Texte, Bilder und Technik weitgehend selbst – von Ihnen brauche ich etwa zwei Stunden für Abstimmung und Freigabe.',
    },
    {
      objection: 'Das ist uns zu teuer.',
      answer:
        'Rechnen wir es kurz zurück: Wenn die neue Seite nur einen zusätzlichen Auftrag pro Monat bringt, hat sie sich meist innerhalb eines Jahres bezahlt. Auf Wunsch geht es auch in Etappen.',
    },
    {
      objection: 'Wir haben schon jemanden, der sich darum kümmert.',
      answer:
        'Prima, dann ist der Check einfach eine zweite Meinung. Die Punkte, die ich gefunden habe, kann Ihr Dienstleister auch direkt umsetzen.',
    },
  ];

  const callScript = [
    'Vorstellen, Bezug zum Betrieb herstellen (Ort, Branche, Empfehlung).',
    `Beobachtung schildern: ${top ? top.title : 'Website wirkt nicht mehr zeitgemäß'} – als Frage formulieren („Wussten Sie, dass …?“).`,
    'Gemeinsam die Seite auf dem eigenen Smartphone öffnen lassen – der Effekt überzeugt mehr als jedes Argument.',
    'Zwei bis drei weitere Punkte aus der Analyse nennen, jeweils mit Folge für Kunden.',
    'Kostenlosen Website-Check anbieten und konkreten Termin vorschlagen.',
    'Zusammenfassen, E-Mail mit den Ergebnissen ankündigen (Einwilligung einholen).',
  ];

  const bulletList = points
    .slice(0, 4)
    .map((p) => `• ${p.title}: ${p.lever}`)
    .join('\n');

  const email = {
    subject: `Ihre Website ${lead.domain} – ${points.length} Punkte aus unserem Gespräch`,
    body:
      `Guten Tag,\n\n` +
      `vielen Dank für das nette Gespräch. Wie besprochen hier die Punkte, die mir bei ${lead.domain} aufgefallen sind:\n\n` +
      `${bulletList || '• Die Seite wirkt nicht mehr zeitgemäß.'}\n\n` +
      `Die gute Nachricht: All das lässt sich mit einem Relaunch in wenigen Wochen beheben – und Ihre Website arbeitet danach wieder für Sie statt gegen Sie.\n\n` +
      `Gern zeige ich Ihnen in einem kostenlosen 20-minütigen Termin, wie das konkret für ${lead.name} aussehen könnte. Passt Ihnen [Terminvorschlag]?\n\n` +
      `Viele Grüße\n${signature(profile)}`,
  };

  return {
    mode: 'vorlage',
    createdAt: new Date().toISOString(),
    opener,
    talkingPoints,
    offer,
    objections,
    callScript,
    email,
  };
}
