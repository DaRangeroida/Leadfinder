
export type LeadStatus =
  | 'neu'
  | 'geprueft'
  | 'kontaktiert'
  | 'verhandlung'
  | 'abgeschlossen'
  | 'verworfen';

export const PIPELINE: LeadStatus[] = ['neu', 'geprueft', 'kontaktiert', 'verhandlung', 'abgeschlossen'];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  neu: 'Neu',
  geprueft: 'Geprüft',
  kontaktiert: 'Kontaktiert',
  verhandlung: 'In Verhandlung',
  abgeschlossen: 'Abgeschlossen',
  verworfen: 'Verworfen',
};

export type Severity = 'kritisch' | 'hoch' | 'mittel' | 'niedrig';

export type PainCategory =
  | 'erreichbarkeit'
  | 'mobile'
  | 'sicherheit'
  | 'aktualitaet'
  | 'technik'
  | 'performance'
  | 'sichtbarkeit'
  | 'recht'
  | 'conversion';

export const CATEGORY_LABELS: Record<PainCategory, string> = {
  erreichbarkeit: 'Erreichbarkeit',
  mobile: 'Mobile Optimierung',
  sicherheit: 'Sicherheit & Protokolle',
  aktualitaet: 'Aktualität',
  technik: 'Technischer Stand',
  performance: 'Ladezeit',
  sichtbarkeit: 'Google-Sichtbarkeit',
  recht: 'Rechtliches',
  conversion: 'Kundenanfragen',
};

export interface PainPoint {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  category: PainCategory;
  weight: number;
  lever: string;
  fix: string;
}

export type Doctype = 'html5' | 'xhtml' | 'html4' | 'none';

export interface EraHint {
  source: string;
  year: number;
}

export interface AuditFacts {
  requestedUrl: string;
  finalUrl: string | null;
  reachable: boolean;
  statusCode: number | null;
  error: string | null;

  https: boolean;
  httpRedirectsToHttps: boolean | null;
  certValid: boolean | null;
  certExpiresAt: string | null;
  certDaysLeft: number | null;

  ttfbMs: number | null;
  loadTimeMs: number | null;
  htmlBytes: number | null;
  compressed: boolean | null;
  scriptCount: number;
  stylesheetCount: number;

  hasViewport: boolean;
  viewportContent: string | null;
  mediaQueryCount: number;
  fixedWidthLayout: boolean;

  copyrightYear: number | null;
  lastModified: string | null;

  doctype: Doctype;
  generator: string | null;
  cms: string | null;
  cmsVersion: string | null;
  siteBuilder: string | null;
  jqueryVersion: string | null;
  bootstrapVersion: string | null;
  legacyTags: string[];
  usesFlash: boolean;
  usesFrames: boolean;
  tableLayout: boolean;
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
  hasImpressum: boolean;
  hasDatenschutz: boolean;
  externalGoogleFonts: boolean;

  estimatedEra: number | null;
  eraHints: EraHint[];
  pagesChecked: string[];
}

export type AuditStatus = 'pending' | 'scanning' | 'done' | 'error';

export interface Lead {
  id: number;
  name: string;
  industry: string;
  category: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
  distanceKm: number | null;
  phone: string | null;
  email: string | null;
  foundPhones: string[];
  foundEmails: string[];
  website: string;
  domain: string;
  source: string;
  status: LeadStatus;
  notes: string;
  score: number | null;
  summary: string | null;
  painPoints: PainPoint[];
  audit: AuditFacts | null;
  auditStatus: AuditStatus;
  auditError: string | null;
  scannedAt: string | null;
  createdAt: string;
  updatedAt: string;
  jobId: number | null;
}

export type LeadListItem = Omit<Lead, 'audit' | 'notes' | 'foundPhones' | 'foundEmails'>;

export type JobStatus = 'queued' | 'discovering' | 'auditing' | 'done' | 'error';

export interface SearchJob {
  id: number;
  industry: string;
  industryLabel: string;
  location: string;
  radiusKm: number;
  limit: number;
  status: JobStatus;
  total: number;
  processed: number;
  found: number;
  skipped: number;
  error: string | null;
  centerLat: number | null;
  centerLon: number | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface JobLogEntry {
  at: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export type JobEvent =
  | { type: 'job'; job: SearchJob }
  | { type: 'lead'; lead: LeadListItem }
  | { type: 'log'; entry: JobLogEntry };

export interface PitchTalkingPoint {
  title: string;
  argument: string;
  solution: string;
}

export interface Pitch {
  mode: 'ki' | 'vorlage';
  createdAt: string;
  opener: string;
  talkingPoints: PitchTalkingPoint[];
  offer: string;
  objections: { objection: string; answer: string }[];
  callScript: string[];
  email: { subject: string; body: string };
  provider?: AiProvider;
}

export type AiProvider = 'gemini' | 'claude';

export interface SenderProfile {
  name: string;
  company: string;
  role: string;
  email: string;
  phone: string;
  website: string;
  city: string;
  services: string;
  usp: string;
  offer: string;
  priceHint: string;
  tone: 'freundlich' | 'sachlich' | 'locker';
}

export const EMPTY_PROFILE: SenderProfile = {
  name: '',
  company: '',
  role: '',
  email: '',
  phone: '',
  website: '',
  city: '',
  services: '',
  usp: '',
  offer: 'kostenloser 20-minütiger Website-Check per Video oder vor Ort',
  priceHint: '',
  tone: 'freundlich',
};

export function profileComplete(p: SenderProfile | null): boolean {
  return !!p && !!p.name.trim() && !!p.company.trim() && (!!p.email.trim() || !!p.phone.trim());
}

export interface Stats {
  total: number;
  hot: number;
  avgScore: number | null;
  scanning: number;
  byStatus: Record<LeadStatus, number>;
}

export interface IndustryOption {
  key: string;
  label: string;
}

export interface Meta {
  industries: IndustryOption[];
  claudeEnabled: boolean;
  geminiEnabled: boolean;
  geminiModel: string;
  aiProvider: AiProvider;
  aiReady: boolean;
  profile: SenderProfile;
  onboarded: boolean;
  placesEnabled: boolean;
  auditConcurrency: number;
}

export interface LeadFilterOptions {
  industries: string[];
  cities: string[];
}

export interface CreateJobInput {
  industry: string;
  location: string;
  radiusKm: number;
  limit: number;
}

export interface CreateLeadInput {
  url: string;
  name?: string;
  industry?: string;
  city?: string;
}

export function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0049')) return `0${digits.slice(4)}`;
  if (digits.startsWith('49') && phone.trim().startsWith('+')) return `0${digits.slice(2)}`;
  return digits;
}

export function uniquePhones(phones: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const phone of phones) {
    if (!phone) continue;
    const key = phoneKey(phone);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(phone);
  }
  return result;
}

export function scoreTier(score: number | null): 'akut' | 'lohnend' | 'gering' | 'offen' {
  if (score == null) return 'offen';
  if (score >= 70) return 'akut';
  if (score >= 40) return 'lohnend';
  return 'gering';
}

export const TIER_LABELS = {
  akut: 'Akuter Relaunch-Bedarf',
  lohnend: 'Lohnender Lead',
  gering: 'Geringer Bedarf',
  offen: 'Noch nicht geprüft',
} as const;
