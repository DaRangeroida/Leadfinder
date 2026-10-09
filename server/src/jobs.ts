import { EventEmitter } from 'node:events';
import type { JobEvent, JobLogEntry, LeadListItem, SearchJob } from '../../shared/types.ts';
import { auditWebsite } from './audit/index.ts';
import { config } from './config.ts';
import * as db from './db.ts';
import { discover, geocode } from './discovery/index.ts';
import { resolveIndustry } from './discovery/industries.ts';
import { errorMessage, runPool } from './util.ts';

const bus = new EventEmitter();
bus.setMaxListeners(200);

const logs = new Map<number, JobLogEntry[]>();

export function jobLog(jobId: number): JobLogEntry[] {
  return logs.get(jobId) ?? [];
}

function emit(jobId: number, event: JobEvent) {
  bus.emit(`job:${jobId}`, event);
}

export function subscribe(jobId: number, listener: (event: JobEvent) => void): () => void {
  bus.on(`job:${jobId}`, listener);
  return () => bus.off(`job:${jobId}`, listener);
}

function log(jobId: number, message: string, level: JobLogEntry['level'] = 'info') {
  const entry: JobLogEntry = { at: new Date().toISOString(), level, message };
  const list = logs.get(jobId) ?? [];
  list.push(entry);
  if (list.length > 300) list.shift();
  logs.set(jobId, list);
  emit(jobId, { type: 'log', entry });
}

function publishJob(job: SearchJob) {
  emit(job.id, { type: 'job', job });
}

function publishLead(jobId: number | null, lead: LeadListItem) {
  if (jobId != null) emit(jobId, { type: 'lead', lead });
}

const scanning = new Set<number>();

export async function auditLead(leadId: number): Promise<void> {
  if (scanning.has(leadId)) return;
  const lead = db.getLead(leadId);
  if (!lead) return;
  scanning.add(leadId);
  db.setAuditStatus(leadId, 'scanning');
  publishLead(lead.jobId, db.toListItem(db.getLead(leadId)!));
  try {
    const result = await auditWebsite(lead.website);
    const saved = db.saveAudit(leadId, result);
    if (saved) publishLead(saved.jobId, db.toListItem(saved));
  } catch (error) {
    db.markAuditFailed(leadId, errorMessage(error));
    const failed = db.getLead(leadId);
    if (failed) publishLead(failed.jobId, db.toListItem(failed));
  } finally {
    scanning.delete(leadId);
  }
}

export function auditInBackground(leadId: number) {
  db.setAuditStatus(leadId, 'scanning');
  void auditLead(leadId);
}

export function startSearchJob(input: { industry: string; location: string; radiusKm: number; limit: number }): SearchJob {
  const industry = resolveIndustry(input.industry);
  const job = db.createJob({
    industry: industry.key,
    industryLabel: industry.label,
    location: input.location.trim(),
    radiusKm: input.radiusKm,
    limit: input.limit,
  });
  void runSearchJob(job.id).catch((error) => {
    log(job.id, errorMessage(error), 'error');
    publishJob(db.updateJob(job.id, { status: 'error', error: errorMessage(error), finished_at: new Date().toISOString() }));
  });
  return job;
}

async function runSearchJob(jobId: number) {
  const job = db.getJob(jobId)!;
  const industry = resolveIndustry(job.industryLabel);

  publishJob(db.updateJob(jobId, { status: 'discovering' }));
  log(jobId, `Suche Standort „${job.location}“ …`);
  const center = await geocode(job.location);
  publishJob(db.updateJob(jobId, { center_lat: center.lat, center_lon: center.lon }));
  log(jobId, `Standort gefunden: ${center.label}`);

  log(jobId, `Sammle ${industry.label} im Umkreis von ${job.radiusKm} km …`);
  const candidates = await discover(industry, job.location, center, job.radiusKm, job.limit, (m, level) => log(jobId, m, level));

  const fallbackCity = center.label.split(',').map((part) => part.trim()).find((part) => part && !/^\d+$/.test(part)) ?? job.location;

  const newLeadIds: number[] = [];
  let skipped = 0;
  for (const c of candidates) {
    const lead = db.insertLead({ ...c, city: c.city ?? fallbackCity, industry: industry.label, jobId });
    if (!lead) {
      skipped++;
      continue;
    }
    newLeadIds.push(lead.id);
    publishLead(jobId, db.toListItem(lead));
  }
  if (skipped) log(jobId, `${skipped} Unternehmen sind bereits als Lead erfasst und wurden übersprungen.`);

  if (!newLeadIds.length) {
    log(jobId, candidates.length ? 'Keine neuen Leads in diesem Gebiet.' : 'Keine Unternehmen mit Website gefunden. Vergrößere den Radius oder wähle eine andere Branche.', 'warn');
    publishJob(db.updateJob(jobId, { status: 'done', found: 0, skipped, total: 0, finished_at: new Date().toISOString() }));
    return;
  }

  publishJob(db.updateJob(jobId, { status: 'auditing', found: newLeadIds.length, total: newLeadIds.length, skipped }));
  log(jobId, `${newLeadIds.length} neue Websites werden geprüft (${config.auditConcurrency} parallel) …`);

  for (const id of newLeadIds) db.setAuditStatus(id, 'pending');
  await runPool(newLeadIds, config.auditConcurrency, async (leadId) => {
    await auditLead(leadId);
    publishJob(db.incrementJobProcessed(jobId));
  });

  const finished = db.updateJob(jobId, { status: 'done', finished_at: new Date().toISOString() });
  const hot = db.listLeads({ jobId, minScore: 70 }).length;
  log(jobId, `Fertig: ${finished.found} Leads geprüft, davon ${hot} mit akutem Relaunch-Bedarf.`);
  publishJob(finished);
}

export function resumePendingAudits() {
  const ids = db.pendingLeadIds();
  if (!ids.length) return;
  console.log(`[audit] ${ids.length} ausstehende Prüfungen werden fortgesetzt.`);
  void runPool(ids, config.auditConcurrency, auditLead);
}
