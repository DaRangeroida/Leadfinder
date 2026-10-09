import { uniquePhones, type AuditFacts, type PainPoint } from '../../../shared/types.ts';
import { errorMessage } from '../util.ts';
import { analyzeCss, analyzeHtml, estimateEra, extractContacts } from './analyze.ts';
import { checkCertificate, checkHttpRedirect, fetchPage, FetchError, isCertError, type FetchedPage } from './fetcher.ts';
import { scoreAudit } from './scoring.ts';

export interface AuditResult {
  audit: AuditFacts;
  score: number;
  summary: string;
  painPoints: PainPoint[];
  foundPhones: string[];
  foundEmails: string[];
}

function emptyFacts(requestedUrl: string): AuditFacts {
  return {
    requestedUrl,
    finalUrl: null,
    reachable: false,
    statusCode: null,
    error: null,
    https: false,
    httpRedirectsToHttps: null,
    certValid: null,
    certExpiresAt: null,
    certDaysLeft: null,
    ttfbMs: null,
    loadTimeMs: null,
    htmlBytes: null,
    compressed: null,
    scriptCount: 0,
    stylesheetCount: 0,
    hasViewport: false,
    viewportContent: null,
    mediaQueryCount: 0,
    fixedWidthLayout: false,
    copyrightYear: null,
    lastModified: null,
    doctype: 'none',
    generator: null,
    cms: null,
    cmsVersion: null,
    siteBuilder: null,
    jqueryVersion: null,
    bootstrapVersion: null,
    legacyTags: [],
    usesFlash: false,
    usesFrames: false,
    tableLayout: false,
    modernSignals: [],
    title: null,
    metaDescription: null,
    h1Count: 0,
    imgCount: 0,
    imgWithoutAlt: 0,
    hasFavicon: false,
    hasOpenGraph: false,
    hasStructuredData: false,
    lang: null,
    hasTelLink: false,
    hasContactForm: false,
    hasImpressum: false,
    hasDatenschutz: false,
    externalGoogleFonts: false,
    estimatedEra: null,
    eraHints: [],
    pagesChecked: [],
  };
}

async function loadHomepage(host: string, facts: AuditFacts): Promise<FetchedPage | null> {
  let httpsError: unknown = null;
  try {
    const page = await fetchPage(`https://${host}/`);
    if (page.status < 500) return page;
    httpsError = new FetchError(`HTTP ${page.status}`, null);
  } catch (error) {
    httpsError = error;
    if (isCertError(error)) facts.certValid = false;
  }
  try {
    const page = await fetchPage(`http://${host}/`);
    if (page.status < 500) return page;
    facts.error = `Server antwortet mit HTTP ${page.status}`;
    facts.statusCode = page.status;
    return null;
  } catch (error) {
    facts.error = errorMessage(httpsError ?? error);
    return null;
  }
}

export async function auditWebsite(website: string): Promise<AuditResult> {
  const facts = emptyFacts(website);
  const host = new URL(website).host;

  const page = await loadHomepage(host, facts);
  if (page && [401, 403, 429].includes(page.status)) {
    const shield = page.headers.get('server')?.toLowerCase().includes('cloudflare') ? ' (Cloudflare-Schutz)' : '';
    throw new Error(`Die Website blockiert automatisierte Prüfungen${shield}, HTTP ${page.status}. Bitte im Browser manuell ansehen.`);
  }
  if (!page || page.status >= 400 || page.html.trim().length < 50) {
    if (page) {
      facts.statusCode = page.status;
      facts.error = page.status >= 400 ? `Server antwortet mit HTTP ${page.status}` : 'Die Seite ist leer.';
    }
    const scored = scoreAudit(facts);
    return { audit: facts, ...scored, foundPhones: [], foundEmails: [] };
  }

  const finalUrl = new URL(page.url);
  facts.reachable = true;
  facts.finalUrl = page.url;
  facts.statusCode = page.status;
  facts.https = finalUrl.protocol === 'https:';
  facts.ttfbMs = Math.round(page.ttfbMs);
  facts.loadTimeMs = Math.round(page.totalMs);
  facts.htmlBytes = page.bytes;
  const encoding = page.headers.get('content-encoding');
  facts.compressed = encoding ? /gzip|br|deflate|zstd/i.test(encoding) : false;
  facts.lastModified = page.headers.get('last-modified');
  facts.pagesChecked.push(page.url);

  const [cert, redirect] = await Promise.all([
    facts.https || facts.certValid === false ? checkCertificate(finalUrl.hostname) : Promise.resolve(null),
    facts.https ? checkHttpRedirect(finalUrl.host) : Promise.resolve(null),
  ]);
  if (cert) {
    facts.certValid = facts.certValid === false ? false : cert.valid;
    facts.certExpiresAt = cert.expiresAt;
    facts.certDaysLeft = cert.daysLeft;
  }
  facts.httpRedirectsToHttps = redirect;

  const findings = analyzeHtml(page.html, page.url);

  const cssTexts = await Promise.all(
    findings.stylesheetUrls.map(async (url) => {
      try {
        const res = await fetchPage(url, 8_000);
        return res.ok ? res.html.slice(0, 1_000_000) : '';
      } catch {
        return '';
      }
    }),
  );
  const css = analyzeCss([findings.inlineCss, ...cssTexts].join('\n'));

  const contacts = extractContacts(page.html);
  const subpages = [findings.impressumUrl, findings.kontaktUrl].filter(
    (url, i, all): url is string => !!url && all.indexOf(url) === i,
  );
  for (const url of subpages) {
    const sub = await fetchPage(url, 10_000).catch(() => null);
    if (!sub?.ok) continue;
    facts.pagesChecked.push(sub.url);
    const found = extractContacts(sub.html);
    contacts.emails.push(...found.emails);
    contacts.phones.push(...found.phones);
  }

  facts.doctype = findings.doctype;
  facts.hasViewport = findings.hasViewport;
  facts.viewportContent = findings.viewportContent;
  facts.mediaQueryCount = css.mediaQueryCount + findings.mediaAttrQueries;
  facts.fixedWidthLayout = (css.fixedWidth || findings.fixedWidthInHtml) && facts.mediaQueryCount === 0;
  facts.scriptCount = findings.scriptCount;
  facts.stylesheetCount = findings.stylesheetCount;
  facts.copyrightYear = findings.copyrightYear;
  facts.generator = findings.generator;
  facts.cms = findings.cms;
  facts.cmsVersion = findings.cmsVersion;
  facts.siteBuilder = findings.siteBuilder;
  facts.jqueryVersion = findings.jqueryVersion;
  facts.bootstrapVersion = findings.bootstrapVersion;
  facts.legacyTags = findings.legacyTags;
  facts.usesFlash = findings.usesFlash;
  facts.usesFrames = findings.usesFrames;
  facts.tableLayout = findings.tableLayout;
  facts.modernSignals = [...new Set([...findings.modernSignals, ...css.modern])];
  facts.title = findings.title;
  facts.metaDescription = findings.metaDescription;
  facts.h1Count = findings.h1Count;
  facts.imgCount = findings.imgCount;
  facts.imgWithoutAlt = findings.imgWithoutAlt;
  facts.hasFavicon = findings.hasFavicon;
  facts.hasOpenGraph = findings.hasOpenGraph;
  facts.hasStructuredData = findings.hasStructuredData;
  facts.lang = findings.lang;
  facts.hasTelLink = findings.hasTelLink;
  facts.hasContactForm = findings.hasContactForm;
  facts.hasImpressum = findings.impressumUrl != null;
  facts.hasDatenschutz = findings.hasDatenschutz;
  facts.externalGoogleFonts = findings.externalGoogleFonts;

  const era = estimateEra({
    findings,
    hasViewport: findings.hasViewport,
    mediaQueryCount: css.mediaQueryCount,
    modernCss: css.modern,
  });
  facts.estimatedEra = era.era;
  facts.eraHints = era.hints;

  const scored = scoreAudit(facts);
  return {
    audit: facts,
    ...scored,
    foundPhones: uniquePhones(contacts.phones).slice(0, 4),
    foundEmails: [...new Set(contacts.emails)].slice(0, 6),
  };
}
