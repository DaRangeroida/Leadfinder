import { Check, Minus, X } from 'lucide-react';
import { CATEGORY_LABELS, type AuditFacts, type PainCategory } from '../../../shared/types.ts';

interface AuditCheck {
  category: PainCategory;
  label: string;
  ok: boolean | null;
  value: string;
}

const yesNo = (v: boolean) => (v ? 'Ja' : 'Nein');
const seconds = (ms: number | null) => (ms == null ? '–' : `${(ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} s`);

export function buildChecks(f: AuditFacts): AuditCheck[] {
  const year = new Date().getFullYear();
  const responsive = f.hasViewport && (f.mediaQueryCount > 0 || f.modernSignals.includes('Modernes JS-Framework'));
  return [
    { category: 'mobile', label: 'Viewport-Tag', ok: f.hasViewport, value: f.viewportContent ?? 'fehlt' },
    { category: 'mobile', label: 'Responsive Breakpoints', ok: responsive, value: `${f.mediaQueryCount} Media Queries` },
    { category: 'mobile', label: 'Flexible Seitenbreite', ok: !f.fixedWidthLayout, value: f.fixedWidthLayout ? 'feste Pixelbreite' : 'flexibel' },

    { category: 'sicherheit', label: 'HTTPS', ok: f.https, value: f.https ? 'verschlüsselt' : 'nur HTTP' },
    {
      category: 'sicherheit',
      label: 'SSL-Zertifikat',
      ok: f.certValid,
      value: f.certValid == null ? 'nicht geprüft' : f.certValid ? `gültig${f.certDaysLeft != null ? `, noch ${f.certDaysLeft} Tage` : ''}` : 'ungültig',
    },
    { category: 'sicherheit', label: 'Weiterleitung HTTP auf HTTPS', ok: f.httpRedirectsToHttps, value: f.httpRedirectsToHttps == null ? '–' : yesNo(f.httpRedirectsToHttps) },

    {
      category: 'aktualitaet',
      label: 'Copyright-Jahr',
      ok: f.copyrightYear == null ? null : year - f.copyrightYear < 2,
      value: f.copyrightYear ? String(f.copyrightYear) : 'kein Hinweis',
    },
    {
      category: 'aktualitaet',
      label: 'Geschätzter Technik-Stand',
      ok: f.estimatedEra == null ? null : year - f.estimatedEra < 5,
      value: f.estimatedEra ? `ca. ${f.estimatedEra}` : 'nicht bestimmbar',
    },

    { category: 'technik', label: 'HTML-Standard', ok: f.doctype === 'html5', value: { html5: 'HTML5', xhtml: 'XHTML', html4: 'HTML 4', none: 'kein Doctype' }[f.doctype] },
    { category: 'technik', label: 'CMS / System', ok: null, value: f.cms ? `${f.cms} ${f.cmsVersion ?? ''}`.trim() : f.siteBuilder ?? f.generator ?? 'nicht erkannt' },
    { category: 'technik', label: 'jQuery', ok: f.jqueryVersion ? !/^(1|2)\.|^3\.[0-4]\b/.test(f.jqueryVersion) : null, value: f.jqueryVersion ?? 'nicht verwendet' },
    { category: 'technik', label: 'Flash oder Frames', ok: !f.usesFlash && !f.usesFrames, value: f.usesFlash ? 'Flash' : f.usesFrames ? 'Frames' : 'nein' },
    { category: 'technik', label: 'Tabellen-Layout', ok: !f.tableLayout, value: yesNo(f.tableLayout) },
    { category: 'technik', label: 'Veraltete HTML-Tags', ok: f.legacyTags.length === 0, value: f.legacyTags.join(', ') || 'keine' },

    { category: 'performance', label: 'Ladezeit HTML', ok: f.loadTimeMs == null ? null : f.loadTimeMs <= 1200, value: seconds(f.loadTimeMs) },
    { category: 'performance', label: 'Server-Antwort (TTFB)', ok: f.ttfbMs == null ? null : f.ttfbMs <= 800, value: seconds(f.ttfbMs) },
    { category: 'performance', label: 'HTML-Größe', ok: f.htmlBytes == null ? null : f.htmlBytes <= 400_000, value: f.htmlBytes == null ? '–' : `${Math.round(f.htmlBytes / 1024)} KB` },
    { category: 'performance', label: 'Komprimierung', ok: f.compressed, value: f.compressed == null ? '–' : yesNo(f.compressed) },

    { category: 'sichtbarkeit', label: 'Seitentitel', ok: !!f.title && f.title.length >= 10, value: f.title ?? 'fehlt' },
    { category: 'sichtbarkeit', label: 'Meta-Beschreibung', ok: !!f.metaDescription, value: f.metaDescription ? `${f.metaDescription.length} Zeichen` : 'fehlt' },
    { category: 'sichtbarkeit', label: 'H1-Überschrift', ok: f.h1Count > 0, value: String(f.h1Count) },
    { category: 'sichtbarkeit', label: 'Alt-Texte', ok: f.imgCount === 0 || f.imgWithoutAlt / f.imgCount <= 0.5, value: `${f.imgCount - f.imgWithoutAlt} von ${f.imgCount} Bildern` },
    { category: 'sichtbarkeit', label: 'Strukturierte Daten', ok: f.hasStructuredData, value: yesNo(f.hasStructuredData) },
    { category: 'sichtbarkeit', label: 'Teilen-Vorschau (Open Graph)', ok: f.hasOpenGraph, value: yesNo(f.hasOpenGraph) },
    { category: 'sichtbarkeit', label: 'Favicon', ok: f.hasFavicon, value: yesNo(f.hasFavicon) },

    { category: 'recht', label: 'Impressum verlinkt', ok: f.hasImpressum, value: yesNo(f.hasImpressum) },
    { category: 'recht', label: 'Datenschutzerklärung verlinkt', ok: f.hasDatenschutz, value: yesNo(f.hasDatenschutz) },
    { category: 'recht', label: 'Google Fonts lokal', ok: !f.externalGoogleFonts, value: f.externalGoogleFonts ? 'extern geladen' : 'ja oder nicht genutzt' },

    { category: 'conversion', label: 'Telefon antippbar', ok: f.hasTelLink, value: yesNo(f.hasTelLink) },
    { category: 'conversion', label: 'Kontaktformular', ok: f.hasContactForm, value: yesNo(f.hasContactForm) },
  ];
}

export function AuditChecks({ facts }: { facts: AuditFacts }) {
  const checks = buildChecks(facts);
  const categories = [...new Set(checks.map((c) => c.category))];
  return (
    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
      {categories.map((category) => {
        const items = checks.filter((c) => c.category === category);
        const failed = items.filter((c) => c.ok === false).length;
        return (
          <section key={category}>
            <h3 className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold">
              {CATEGORY_LABELS[category]}
              <span className={`text-[12px] font-normal tabular ${failed ? 'text-heat-hot' : 'text-ok'}`}>
                {failed ? `${failed} offen` : 'in Ordnung'}
              </span>
            </h3>
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {items.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5 py-1.5 text-[12.5px]">
                  <span className="mt-0.5 shrink-0">
                    {c.ok === true ? (
                      <Check className="size-3.5 text-ok" aria-label="bestanden" />
                    ) : c.ok === false ? (
                      <X className="size-3.5 text-heat-hot" aria-label="nicht bestanden" />
                    ) : (
                      <Minus className="size-3.5 text-mute" aria-label="neutral" />
                    )}
                  </span>
                  <span className="shrink-0 text-ink-soft">{c.label}</span>
                  <span className="ml-auto min-w-0 truncate text-right text-ink" title={c.value}>{c.value}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
