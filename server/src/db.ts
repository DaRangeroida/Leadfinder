import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';
import { EMPTY_PROFILE, type SenderProfile } from '../../shared/types.ts';
import type {
  AuditFacts,
  AuditStatus,
  JobStatus,
  Lead,
  LeadFilterOptions,
  LeadListItem,
  LeadStatus,
  PainPoint,
  Pitch,
  SearchJob,
  Stats,
} from '../../shared/types.ts';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new DatabaseSync(config.databasePath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  industry TEXT NOT NULL,
  industry_label TEXT NOT NULL,
  location TEXT NOT NULL,
  radius_km REAL NOT NULL,
  max_results INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  found INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  center_lat REAL,
  center_lon REAL,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  category TEXT,
  address TEXT,
  postcode TEXT,
  city TEXT,
  lat REAL,
  lon REAL,
  distance_km REAL,
  phone TEXT,
  email TEXT,
  found_phones TEXT NOT NULL DEFAULT '[]',
  found_emails TEXT NOT NULL DEFAULT '[]',
  website TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'neu',
  notes TEXT NOT NULL DEFAULT '',
  score INTEGER,
  summary TEXT,
  pain_points TEXT NOT NULL DEFAULT '[]',
  audit TEXT,
  audit_status TEXT NOT NULL DEFAULT 'pending',
  audit_error TEXT,
  scanned_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_job ON leads(job_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pitches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

db.exec(`
UPDATE leads SET audit_status = 'pending' WHERE audit_status = 'scanning';
UPDATE jobs SET status = 'error', error = 'Server wurde während der Suche neu gestartet', finished_at = datetime('now')
  WHERE status IN ('queued', 'discovering', 'auditing');
`);

const now = () => new Date().toISOString();

type Row = Record<string, unknown>;

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toLead(row: Row): Lead {
  return {
    id: Number(row.id),
    name: String(row.name),
    industry: String(row.industry),
    category: (row.category as string) ?? null,
    address: (row.address as string) ?? null,
    postcode: (row.postcode as string) ?? null,
    city: (row.city as string) ?? null,
    lat: (row.lat as number) ?? null,
    lon: (row.lon as number) ?? null,
    distanceKm: (row.distance_km as number) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    foundPhones: parseJson<string[]>(row.found_phones, []),
    foundEmails: parseJson<string[]>(row.found_emails, []),
    website: String(row.website),
    domain: String(row.domain),
    source: String(row.source),
    status: row.status as LeadStatus,
    notes: String(row.notes ?? ''),
    score: row.score == null ? null : Number(row.score),
    summary: (row.summary as string) ?? null,
    painPoints: parseJson<PainPoint[]>(row.pain_points, []),
    audit: parseJson<AuditFacts | null>(row.audit, null),
    auditStatus: row.audit_status as AuditStatus,
    auditError: (row.audit_error as string) ?? null,
    scannedAt: (row.scanned_at as string) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    jobId: row.job_id == null ? null : Number(row.job_id),  };
}

export function toListItem(lead: Lead): LeadListItem {
  const { audit: _a, notes: _n, foundPhones: _p, foundEmails: _e, ...rest } = lead;
  return rest;
}

function toJob(row: Row): SearchJob {
  return {
    id: Number(row.id),
    industry: String(row.industry),
    industryLabel: String(row.industry_label),
    location: String(row.location),
    radiusKm: Number(row.radius_km),
    limit: Number(row.max_results),
    status: row.status as JobStatus,
    total: Number(row.total),
    processed: Number(row.processed),
    found: Number(row.found),
    skipped: Number(row.skipped),
    error: (row.error as string) ?? null,
    centerLat: (row.center_lat as number) ?? null,
    centerLon: (row.center_lon as number) ?? null,
    createdAt: String(row.created_at),
    finishedAt: (row.finished_at as string) ?? null,
  };
}

export interface NewLead {
  name: string;
  industry: string;
  category?: string | null;
  address?: string | null;
  postcode?: string | null;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
  distanceKm?: number | null;
  phone?: string | null;
  email?: string | null;
  website: string;
  domain: string;
  source: string;
  jobId?: number | null;
}

export function insertLead(input: NewLead): Lead | null {
  const ts = now();
  const result = db
    .prepare(
      `INSERT INTO leads (name, industry, category, address, postcode, city, lat, lon, distance_km, phone, email,
        website, domain, source, created_at, updated_at, job_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(domain) DO NOTHING`,
    )
    .run(
      input.name,
      input.industry,
      input.category ?? null,
      input.address ?? null,
      input.postcode ?? null,
      input.city ?? null,
      input.lat ?? null,
      input.lon ?? null,
      input.distanceKm ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.website,
      input.domain,
      input.source,
      ts,
      ts,
      input.jobId ?? null,
    );
  if (result.changes === 0) return null;
  return getLead(Number(result.lastInsertRowid));
}

export function findLeadByDomain(domain: string): Lead | null {
  const row = db.prepare('SELECT * FROM leads WHERE domain = ?').get(domain) as Row | undefined;
  return row ? toLead(row) : null;
}

export function getLead(id: number): Lead | null {
  const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Row | undefined;
  return row ? toLead(row) : null;
}

export interface LeadQuery {
  q?: string;
  industry?: string;
  city?: string;
  status?: string;
  minScore?: number;
  maxScore?: number;
  jobId?: number;
  hideUnreachable?: boolean;
  sort?: 'score' | 'name' | 'updated' | 'distance';
  dir?: 'asc' | 'desc';
}

export function listLeads(query: LeadQuery): LeadListItem[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.q) {
    where.push('(name LIKE ? OR domain LIKE ? OR city LIKE ?)');
    const like = `%${query.q}%`;
    params.push(like, like, like);
  }
  if (query.industry) {
    where.push('industry = ?');
    params.push(query.industry);
  }
  if (query.city) {
    where.push('city = ?');
    params.push(query.city);
  }
  if (query.status) {
    where.push('status = ?');
    params.push(query.status);
  } else {
    where.push("status != 'verworfen'");
  }
  if (query.minScore != null) {
    where.push('score >= ?');
    params.push(query.minScore);
  }
  if (query.maxScore != null) {
    where.push('score <= ?');
    params.push(query.maxScore);
  }
  if (query.jobId != null) {
    where.push('job_id = ?');
    params.push(query.jobId);
  }
  if (query.hideUnreachable) {
    where.push(`audit_status != 'error' AND pain_points NOT LIKE '%"id":"unreachable"%'`);
  }
  const columns = { score: 'score', name: 'name COLLATE NOCASE', updated: 'updated_at', distance: 'distance_km' };
  const column = columns[query.sort ?? 'score'] ?? 'score';
  const dir = query.dir === 'asc' ? 'ASC' : 'DESC';
  const sql = `SELECT id, name, industry, category, address, postcode, city, lat, lon, distance_km, phone, email,
      website, domain, source, status, score, summary, pain_points, audit_status, audit_error, scanned_at,
      created_at, updated_at, job_id
    FROM leads ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${column} IS NULL, ${column} ${dir}, id DESC
    LIMIT 2000`;
  const rows = db.prepare(sql).all(...params) as Row[];
  return rows.map((row) => toListItem(toLead(row)));
}

export function updateLead(
  id: number,
  patch: Partial<{
    status: LeadStatus;
    notes: string;
    name: string;
    phone: string | null;
    email: string | null;
  }>,
): Lead | null {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    params.push(value as string | null);
  }
  if (sets.length) {
    sets.push('updated_at = ?');
    params.push(now(), id);
    db.prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  return getLead(id);
}

export function setAuditStatus(id: number, status: AuditStatus, error: string | null = null) {
  db.prepare('UPDATE leads SET audit_status = ?, audit_error = ?, updated_at = ? WHERE id = ?').run(
    status,
    error,
    now(),
    id,
  );
}

export function markAuditFailed(id: number, error: string) {
  db.prepare(
    `UPDATE leads SET audit_status = 'error', audit_error = ?, score = NULL, summary = NULL, pain_points = '[]', audit = NULL,
      scanned_at = ?, updated_at = ? WHERE id = ?`,
  ).run(error, now(), now(), id);
}

export function saveAudit(
  id: number,
  result: {
    audit: AuditFacts;
    score: number;
    summary: string;
    painPoints: PainPoint[];
    foundPhones: string[];
    foundEmails: string[];
  },
) {
  const lead = getLead(id);
  if (!lead) return null;
  const ts = now();
  const phone = lead.phone ?? result.foundPhones[0] ?? null;
  const email = lead.email ?? result.foundEmails[0] ?? null;
  const status = lead.status === 'neu' ? 'geprueft' : lead.status;
  db.prepare(
    `UPDATE leads SET audit = ?, score = ?, summary = ?, pain_points = ?, found_phones = ?, found_emails = ?,
      phone = ?, email = ?, status = ?, audit_status = 'done', audit_error = NULL, scanned_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    JSON.stringify(result.audit),
    result.score,
    result.summary,
    JSON.stringify(result.painPoints),
    JSON.stringify(result.foundPhones),
    JSON.stringify(result.foundEmails),
    phone,
    email,
    status,
    ts,
    ts,
    id,
  );
  return getLead(id);
}

export function deleteLead(id: number): boolean {
  return db.prepare('DELETE FROM leads WHERE id = ?').run(id).changes > 0;
}

export function pendingLeadIds(): number[] {
  return (db.prepare("SELECT id FROM leads WHERE audit_status = 'pending' ORDER BY id").all() as Row[]).map((r) =>
    Number(r.id),
  );
}

export function filterOptions(): LeadFilterOptions {
  const industries = db
    .prepare('SELECT DISTINCT industry FROM leads WHERE industry IS NOT NULL ORDER BY industry COLLATE NOCASE')
    .all() as Row[];
  const cities = db
    .prepare("SELECT DISTINCT city FROM leads WHERE city IS NOT NULL AND city != '' ORDER BY city COLLATE NOCASE")
    .all() as Row[];
  return {
    industries: industries.map((r) => String(r.industry)),
    cities: cities.map((r) => String(r.city)),
  };
}

export function stats(): Stats {
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN score >= 70 THEN 1 ELSE 0 END) AS hot,
        AVG(score) AS avg,
        SUM(CASE WHEN audit_status IN ('pending', 'scanning') THEN 1 ELSE 0 END) AS scanning
       FROM leads WHERE status != 'verworfen'`,
    )
    .get() as Row;
  const byStatusRows = db.prepare('SELECT status, COUNT(*) AS n FROM leads GROUP BY status').all() as Row[];
  const byStatus: Stats['byStatus'] = {
    neu: 0,
    geprueft: 0,
    kontaktiert: 0,
    verhandlung: 0,
    abgeschlossen: 0,
    verworfen: 0,
  };
  for (const row of byStatusRows) byStatus[row.status as LeadStatus] = Number(row.n);
  return {
    total: Number(totals.total ?? 0),
    hot: Number(totals.hot ?? 0),
    avgScore: totals.avg == null ? null : Math.round(Number(totals.avg)),
    scanning: Number(totals.scanning ?? 0),
    byStatus,
  };
}

export function createJob(input: {
  industry: string;
  industryLabel: string;
  location: string;
  radiusKm: number;
  limit: number;
}): SearchJob {
  const result = db
    .prepare(
      `INSERT INTO jobs (industry, industry_label, location, radius_km, max_results, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(input.industry, input.industryLabel, input.location, input.radiusKm, input.limit, now());
  return getJob(Number(result.lastInsertRowid))!;
}

export function getJob(id: number): SearchJob | null {
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Row | undefined;
  return row ? toJob(row) : null;
}

export function listJobs(): SearchJob[] {
  return (db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT 200').all() as Row[]).map(toJob);
}

export function updateJob(
  id: number,
  patch: Partial<{
    status: JobStatus;
    total: number;
    processed: number;
    found: number;
    skipped: number;
    error: string | null;
    center_lat: number;
    center_lon: number;
    finished_at: string;
  }>,
): SearchJob {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length) {
    db.prepare(`UPDATE jobs SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`).run(
      ...entries.map(([, v]) => v as string | number | null),
      id,
    );
  }
  return getJob(id)!;
}

export function incrementJobProcessed(id: number): SearchJob {
  db.prepare('UPDATE jobs SET processed = processed + 1 WHERE id = ?').run(id);
  return getJob(id)!;
}

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as Row | undefined;
  return row ? String(row.value) : null;
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function getProfile(): SenderProfile | null {
  const raw = getSetting('profile');
  return raw ? { ...EMPTY_PROFILE, ...parseJson<Partial<SenderProfile>>(raw, {}) } : null;
}

export function saveProfile(profile: SenderProfile) {
  setSetting('profile', JSON.stringify(profile));
}

export function savePitch(leadId: number, pitch: Pitch) {
  db.prepare('INSERT INTO pitches (lead_id, content, created_at) VALUES (?, ?, ?)').run(
    leadId,
    JSON.stringify(pitch),
    pitch.createdAt,
  );
}

export function latestPitch(leadId: number): Pitch | null {
  const row = db
    .prepare('SELECT content FROM pitches WHERE lead_id = ? ORDER BY id DESC LIMIT 1')
    .get(leadId) as Row | undefined;
  return row ? parseJson<Pitch | null>(row.content, null) : null;
}
