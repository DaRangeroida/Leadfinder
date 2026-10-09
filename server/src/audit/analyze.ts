import * as cheerio from 'cheerio';
import type { Doctype, EraHint } from '../../../shared/types.ts';

type $Root = cheerio.CheerioAPI;

export interface HtmlFindings {
  doctype: Doctype;
  hasViewport: boolean;
  viewportContent: string | null;
  inlineCss: string;
  stylesheetUrls: string[];
  mediaAttrQueries: number;
  scriptCount: number;
  stylesheetCount: number;
  copyrightYear: number | null;
  generator: string | null;
  cms: string | null;
  cmsVersion: string | null;
  siteBuilder: string | null;
  jqueryVersion: string | null;
  bootstrapVersion: string | null;
  fontAwesomeMajor: number | null;
  legacyTags: string[];
  usesFlash: boolean;
  usesFrames: boolean;
  tableLayout: boolean;
  ieConditionals: boolean;
  modernSignals: string[];
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  imgCount: number;
  imgWithoutAlt: number;
  hasFavicon: boolean;
  hasOpenGraph: boolean;
  hasStructuredData: boolean;
  lang: string | null;
  hasTelLink: boolean;
  hasContactForm: boolean;
  impressumUrl: string | null;
  kontaktUrl: string | null;
  hasDatenschutz: boolean;
  externalGoogleFonts: boolean;
  fixedWidthInHtml: boolean;
}

function detectDoctype(html: string): Doctype {
  const match = html.slice(0, 1500).match(/<!doctype\s+([^>]*)>/i);
  if (!match) return 'none';
  const decl = match[1].toLowerCase();
  if (decl.includes('xhtml')) return 'xhtml';
  if (decl.includes('html 4') || decl.includes('//dtd html')) return 'html4';
  return 'html5';
}

const COPYRIGHT_RE =
  /(?:©|\(c\)|copyright)[^0-9]{0,60}?((?:19|20)\d{2})(?:\s*(?:-|–|—|\/|bis)\s*((?:19|20)\d{2}))?/gi;

export function findCopyrightYear(text: string): number | null {
  const current = new Date().getFullYear();
  let best: number | null = null;
  for (const match of text.matchAll(COPYRIGHT_RE)) {
    for (const group of [match[1], match[2]]) {
      const year = group ? Number(group) : NaN;
      if (year >= 1995 && year <= current && (best == null || year > best)) best = year;
    }
  }
  return best;
}

function detectCms($: $Root, html: string): { generator: string | null; cms: string | null; version: string | null; builder: string | null } {
  const generator = $('meta[name="generator" i]').attr('content')?.trim() || null;
  const lower = html.toLowerCase();
  let cms: string | null = null;
  let version: string | null = null;
  let builder: string | null = null;

  const gen = generator?.toLowerCase() ?? '';
  const genVersion = generator?.replace(/typo3|x5|1&1/gi, '').match(/\b(\d+(?:\.\d+){0,2})\b/)?.[1] ?? null;

  if (gen.includes('wordpress') || lower.includes('/wp-content/') || lower.includes('/wp-includes/')) {
    cms = 'WordPress';
    version = gen.includes('wordpress') ? genVersion : (html.match(/wp-(?:includes|content)[^"']*\?ver=(\d+\.\d+(?:\.\d+)?)/)?.[1] ?? null);
  } else if (gen.includes('joomla') || lower.includes('/media/jui/') || lower.includes('/components/com_')) {
    cms = 'Joomla';
    version = genVersion;
  } else if (gen.includes('typo3') || lower.includes('typo3temp/') || lower.includes('/typo3conf/')) {
    cms = 'TYPO3';
    version = genVersion;
  } else if (gen.includes('drupal') || lower.includes('/sites/default/files/')) {
    cms = 'Drupal';
    version = genVersion;
  } else if (gen.includes('contao')) {
    cms = 'Contao';
    version = genVersion;
  } else if (gen.includes('shopware') || lower.includes('shopware')) {
    cms = 'Shopware';
  }

  if (lower.includes('jimdo') || gen.includes('jimdo')) builder = 'Jimdo';
  else if (lower.includes('wix.com') || lower.includes('wixstatic.com')) builder = 'Wix';
  else if (lower.includes('squarespace')) builder = 'Squarespace';
  else if (lower.includes('webnode')) builder = 'Webnode';
  else if (gen.includes('ionos') || gen.includes('1&1') || lower.includes('mywebsite') || gen.includes('sitebuilder')) builder = 'IONOS / 1&1 Baukasten';
  else if (gen.includes('strato')) builder = 'STRATO Baukasten';
  else if (gen.includes('frontpage')) builder = 'Microsoft FrontPage';
  else if (gen.includes('netobjects')) builder = 'NetObjects Fusion';
  else if (gen.includes('dreamweaver')) builder = 'Dreamweaver';
  else if (gen.includes('website x5')) builder = 'WebSite X5';

  return { generator, cms, version, builder };
}

function scriptVersions(html: string) {
  const jquery =
    html.match(/jquery[.-]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i)?.[1] ??
    html.match(/ajax\.googleapis\.com\/ajax\/libs\/jquery\/(\d+\.\d+(?:\.\d+)?)/i)?.[1] ??
    html.match(/jquery(?:\.min)?\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i)?.[1] ??
    null;
  const bootstrap =
    html.match(/bootstrap(?:@|\/|[.-])(\d)\.\d+(?:\.\d+)?/i)?.[1] ??
    html.match(/bootstrap(?:\.min)?\.(?:css|js)\?ver=(\d)\./i)?.[1] ??
    null;
  const fa =
    html.match(/font-?awesome(?:\/|@|[.-])(\d)\.\d/i)?.[1] ?? (html.match(/fontawesome-free@?(\d)/i)?.[1] ?? null);
  return { jquery, bootstrap, fontAwesomeMajor: fa ? Number(fa) : null };
}

function isTableLayout($: $Root): boolean {
  const layoutTables = $('table[width], table[bgcolor], td[bgcolor], td[background], table[cellpadding][border="0"]').length;
  const nested = $('table table').length;
  return layoutTables >= 2 || nested >= 1;
}

const SUBPAGE_PATTERNS = {
  impressum: /impressum|imprint|legal-notice|anbieterkennzeichnung/i,
  kontakt: /kontakt|contact|anfahrt/i,
  datenschutz: /datenschutz|privacy|dsgvo/i,
};

const FONT_HOSTS = /fonts\.googleapis|use\.typekit|fonts\.bunny|fontawesome|cdnjs\.cloudflare\.com\/ajax\/libs\/font/i;

function findLink($: $Root, pattern: RegExp, baseUrl: string): string | null {
  let found: string | null = null;
  $('a[href]').each((_, el) => {
    if (found) return;
    const href = $(el).attr('href') ?? '';
    const text = $(el).text();
    if (!pattern.test(href) && !pattern.test(text)) return;
    if (/^(mailto|tel|javascript):/i.test(href)) return;
    const url = URL.parse(href, baseUrl);
    if (url?.protocol.startsWith('http')) found = url.toString();
  });
  return found;
}

export function analyzeHtml(html: string, baseUrl: string): HtmlFindings {
  const $ = cheerio.load(html);
  const lower = html.toLowerCase();

  const viewport = $('meta[name="viewport" i]').attr('content')?.trim() || null;
  const inlineCss = $('style')
    .map((_, el) => $(el).text())
    .get()
    .join('\n');

  const stylesheetUrls: string[] = [];
  let mediaAttrQueries = 0;
  $('link[rel~="stylesheet" i][href]').each((_, el) => {
    if (/\((?:max|min)-width/i.test($(el).attr('media') ?? '')) mediaAttrQueries++;
    const url = URL.parse($(el).attr('href')!, baseUrl);
    if (!url || !url.protocol.startsWith('http') || FONT_HOSTS.test(url.href)) return;
    stylesheetUrls.push(url.toString());
  });

  const bodyText = $('body').text().replace(/\s+/g, ' ');
  const footerText = $('footer, #footer, .footer, [class*="footer"], [id*="footer"]').text().replace(/\s+/g, ' ');
  const copyrightYear = findCopyrightYear(footerText) ?? findCopyrightYear(bodyText) ?? findCopyrightYear(html.replace(/&copy;/gi, '©'));

  const legacyTags: string[] = [];
  for (const tag of ['font', 'center', 'marquee', 'blink', 'frameset', 'applet', 'basefont', 'big', 'tt']) {
    if ($(tag).length) legacyTags.push(`<${tag}>`);
  }
  if (/\bspacer\.gif\b|\btransparent\.gif\b|\bpixel\.gif\b/i.test(html)) legacyTags.push('Spacer-GIFs');

  const usesFlash =
    /\.swf\b/i.test(html) || $('object[type*="flash"], embed[type*="flash"]').length > 0 || lower.includes('swfobject');
  const usesFrames = $('frameset, frame').length > 0;

  const cmsInfo = detectCms($, html);
  const versions = scriptVersions(html);

  const modernSignals: string[] = [];
  if ($('img[loading="lazy"], iframe[loading="lazy"]').length) modernSignals.push('Lazy Loading');
  if ($('picture source, img[srcset]').length) modernSignals.push('Responsive Bilder');
  if (/\.(webp|avif)\b/i.test(html)) modernSignals.push('WebP/AVIF-Bilder');
  if (/display\s*:\s*grid/i.test(inlineCss)) modernSignals.push('CSS Grid');
  if (/--[a-z0-9-]+\s*:/i.test(inlineCss)) modernSignals.push('CSS-Variablen');
  if ($('script[type="module"]').length) modernSignals.push('ES-Module');
  if (/_next\/|__nuxt|data-reactroot|ng-version|data-v-[0-9a-f]{6,}|astro-/i.test(html)) modernSignals.push('Modernes JS-Framework');
  if (/website-files\.com|data-wf-page|framerusercontent\.com/i.test(html)) modernSignals.push('Moderner Website-Builder');

  const images = $('img');
  let imgWithoutAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt == null || !alt.trim()) imgWithoutAlt++;
  });

  const hasFavicon = $('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel="apple-touch-icon" i]').length > 0;

  return {
    doctype: detectDoctype(html),
    hasViewport: !!viewport,
    viewportContent: viewport,
    inlineCss,
    stylesheetUrls: stylesheetUrls.slice(0, 6),
    mediaAttrQueries,
    scriptCount: $('script[src]').length,
    stylesheetCount: $('link[rel~="stylesheet" i]').length,
    copyrightYear,
    generator: cmsInfo.generator,
    cms: cmsInfo.cms,
    cmsVersion: cmsInfo.version,
    siteBuilder: cmsInfo.builder,
    jqueryVersion: versions.jquery,
    bootstrapVersion: versions.bootstrap,
    fontAwesomeMajor: versions.fontAwesomeMajor,
    legacyTags,
    usesFlash,
    usesFrames,
    tableLayout: isTableLayout($),
    ieConditionals: /<!--\[if\s+(lt\s+|lte\s+|gt\s+)?ie/i.test(html) || $('meta[http-equiv="X-UA-Compatible" i]').length > 0,
    modernSignals,
    title: $('title').first().text().trim() || null,
    metaDescription: $('meta[name="description" i]').attr('content')?.trim() || null,
    h1Count: $('h1').length,
    imgCount: images.length,
    imgWithoutAlt,
    hasFavicon,
    hasOpenGraph: $('meta[property^="og:"]').length > 0,
    hasStructuredData: $('script[type="application/ld+json"]').length > 0 || $('[itemtype*="schema.org"]').length > 0,
    lang: $('html').attr('lang')?.trim() || null,
    hasTelLink: $('a[href^="tel:" i]').length > 0,
    hasContactForm: $('form').filter((_, el) => $(el).find('textarea, input[type="email"]').length > 0).length > 0,
    impressumUrl: findLink($, SUBPAGE_PATTERNS.impressum, baseUrl),
    kontaktUrl: findLink($, SUBPAGE_PATTERNS.kontakt, baseUrl),
    hasDatenschutz: findLink($, SUBPAGE_PATTERNS.datenschutz, baseUrl) != null,
    externalGoogleFonts: /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(html),
    fixedWidthInHtml:
      $('body[width], table[width="100%"]').length === 0 &&
      $('table[width], div[style*="width"]')
        .toArray()
        .some((el) => /\b(7[5-9]\d|[89]\d\d|1[0-2]\d\d)(px)?\b/.test(($(el).attr('width') ?? '') + ($(el).attr('style') ?? ''))),
  };
}

export function analyzeCss(css: string) {
  const mediaQueryCount = (css.match(/@media[^{]*\((?:max|min)-width/gi) ?? []).length;
  const fixedWidth =
    /(?:body|html|#(?:wrapper|container|page|main|site|content)|\.(?:wrapper|container|page|site))\s*\{[^}]*?(?<![-\w])width\s*:\s*(7[5-9]\d|[89]\d\d|1[0-2]\d\d)px/i.test(
      css,
    );
  const modern: string[] = [];
  if (/display\s*:\s*grid/i.test(css)) modern.push('CSS Grid');
  if (/display\s*:\s*flex/i.test(css)) modern.push('Flexbox');
  if (/var\(--/i.test(css)) modern.push('CSS-Variablen');
  return { mediaQueryCount, fixedWidth, modern };
}

const EMAIL_RE = /(?<![a-z0-9._%+-])[a-z][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(?:\+49|0049|\(0\d{2,5}\)|\b0\d{2,5})[\s/().-]*\d[\d\s/().-]{4,16}\d/g;

export function extractContacts(html: string): { emails: string[]; phones: string[] } {
  const $ = cheerio.load(html);
  const emails = new Set<string>();
  const phones = new Set<string>();

  $('a[href^="mailto:" i]').each((_, el) => {
    const address = decodeURIComponent(($(el).attr('href') ?? '').slice(7).split('?')[0]).trim().toLowerCase();
    if (address.includes('@')) emails.add(address);
  });
  $('a[href^="tel:" i]').each((_, el) => {
    const number = ($(el).attr('href') ?? '').slice(4).trim();
    if (number.replace(/\D/g, '').length >= 6) phones.add(decodeURIComponent(number));
  });

  $('script, style, noscript').remove();
  $('body *').append(' ');
  const text = $('body').text().replace(/\s+/g, ' ').replace(/\s*\[at\]\s*|\s*\(at\)\s*/gi, '@');
  for (const match of text.match(EMAIL_RE) ?? []) {
    const address = match.toLowerCase();
    if (/\.(png|jpe?g|gif|svg|webp)$/.test(address) || /sentry|example\.|wixpress|domain\.de/.test(address)) continue;
    emails.add(address);
  }
  for (const match of text.matchAll(PHONE_RE)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) continue;
    if (/fax/i.test(text.slice(Math.max(0, match.index - 14), match.index))) continue;
    phones.add(match[0].trim());
  }
  return { emails: [...emails].slice(0, 6), phones: [...phones].slice(0, 6) };
}

function versionYear(version: string | null, table: [number, number, number][]): number | null {
  if (!version) return null;
  const [major, minor = 0] = version.split('.').map(Number);
  let year: number | null = null;
  for (const [maj, min, y] of table) {
    if (major > maj || (major === maj && minor >= min)) year = y;
  }
  return year;
}

const JQUERY_YEARS: [number, number, number][] = [
  [1, 0, 2006], [1, 3, 2009], [1, 5, 2011], [1, 7, 2011], [1, 8, 2012], [1, 9, 2013], [1, 11, 2014], [1, 12, 2016],
  [2, 0, 2013], [2, 2, 2015], [3, 0, 2016], [3, 3, 2018], [3, 5, 2020], [3, 6, 2021], [3, 7, 2023],
];
const WORDPRESS_YEARS: [number, number, number][] = [
  [2, 0, 2005], [2, 5, 2008], [3, 0, 2010], [3, 3, 2011], [3, 5, 2012], [3, 8, 2013], [4, 0, 2014], [4, 3, 2015],
  [4, 5, 2016], [4, 7, 2016], [4, 9, 2017], [5, 0, 2018], [5, 3, 2019], [5, 6, 2020], [5, 9, 2022], [6, 0, 2022],
  [6, 2, 2023], [6, 5, 2024], [6, 7, 2024], [6, 8, 2025],
];
const JOOMLA_YEARS: [number, number, number][] = [[1, 0, 2005], [1, 5, 2008], [2, 5, 2012], [3, 0, 2012], [3, 5, 2016], [3, 9, 2018], [4, 0, 2021], [5, 0, 2023]];
const TYPO3_YEARS: [number, number, number][] = [[4, 0, 2006], [4, 5, 2011], [6, 0, 2012], [6, 2, 2014], [7, 0, 2015], [8, 0, 2016], [9, 0, 2018], [10, 0, 2020], [11, 0, 2021], [12, 0, 2022], [13, 0, 2024]];

export function estimateEra(input: {
  findings: HtmlFindings;
  hasViewport: boolean;
  mediaQueryCount: number;
  modernCss: string[];
}): { era: number | null; hints: EraHint[] } {
  const f = input.findings;
  const hints: (EraHint & { weight: number })[] = [];
  const add = (source: string, year: number | null, weight = 1) => {
    if (year) hints.push({ source, year, weight });
  };

  add(`Copyright-Hinweis ${f.copyrightYear}`, f.copyrightYear, 2);
  add(`jQuery ${f.jqueryVersion}`, versionYear(f.jqueryVersion, JQUERY_YEARS));
  if (f.bootstrapVersion) add(`Bootstrap ${f.bootstrapVersion}`, { '2': 2012, '3': 2015, '4': 2019, '5': 2022 }[f.bootstrapVersion] ?? null);
  if (f.fontAwesomeMajor) add(`Font Awesome ${f.fontAwesomeMajor}`, { 3: 2013, 4: 2016, 5: 2019, 6: 2022 }[f.fontAwesomeMajor] ?? null);
  if (f.cms === 'WordPress') add(`WordPress ${f.cmsVersion}`, versionYear(f.cmsVersion, WORDPRESS_YEARS), 1.5);
  if (f.cms === 'Joomla') add(`Joomla ${f.cmsVersion}`, versionYear(f.cmsVersion, JOOMLA_YEARS), 1.5);
  if (f.cms === 'TYPO3') add(`TYPO3 ${f.cmsVersion}`, versionYear(f.cmsVersion, TYPO3_YEARS), 1.5);
  if (f.doctype === 'xhtml') add('XHTML-Doctype', 2008);
  if (f.doctype === 'html4') add('HTML-4-Doctype', 2004);
  if (f.doctype === 'none') add('Kein Doctype', 2003);
  if (f.usesFlash) add('Flash-Inhalte', 2008, 1.5);
  if (f.usesFrames) add('Frames', 2002, 1.5);
  if (f.legacyTags.length) add(`Veraltete Tags (${f.legacyTags.slice(0, 2).join(', ')})`, 2005);
  if (f.tableLayout) add('Tabellen-Layout', 2006);
  if (f.ieConditionals) add('Internet-Explorer-Weichen', 2012);
  if (f.siteBuilder && /FrontPage|NetObjects|Dreamweaver/.test(f.siteBuilder)) add(f.siteBuilder, 2006, 1.5);
  if (!input.hasViewport) add('Kein Viewport-Tag', 2011);
  else if (input.mediaQueryCount > 0) add('Responsive Breakpoints', 2016, 0.5);
  if (f.modernSignals.includes('Lazy Loading')) add('Natives Lazy Loading', 2021);
  if (f.modernSignals.includes('WebP/AVIF-Bilder')) add('WebP/AVIF-Bilder', 2021);
  if (f.modernSignals.includes('Modernes JS-Framework')) add('Modernes JS-Framework', 2021);
  if (f.modernSignals.includes('Moderner Website-Builder')) add('Moderner Website-Builder', 2021);
  if (input.modernCss.includes('CSS Grid') || f.modernSignals.includes('CSS Grid')) add('CSS Grid', 2019, 0.5);

  if (!hints.length) return { era: null, hints: [] };
  const totalWeight = hints.reduce((sum, h) => sum + h.weight, 0);
  const era = Math.round(hints.reduce((sum, h) => sum + h.year * h.weight, 0) / totalWeight);
  return {
    era: Math.min(era, new Date().getFullYear()),
    hints: hints.map(({ source, year }) => ({ source, year })),
  };
}
