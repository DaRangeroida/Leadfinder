import { Router, type Request } from 'express';
import { STATUS_LABELS, type CreateLeadInput, type LeadStatus } from '../../../shared/types.ts';
import * as db from '../db.ts';
import { HttpError, idParam, optionalNumber, optionalString } from '../http.ts';
import { auditInBackground } from '../jobs.ts';
import { generatePitch } from '../pitch/index.ts';
import { normalizeWebsite } from '../util.ts';

const CSV_HEADER = ['Unternehmen', 'Branche', 'Adresse', 'PLZ', 'Ort', 'Telefon', 'E-Mail', 'Website', 'Score', 'Status', 'Pain Points'];

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function requireLead(req: Request) {
  const lead = db.getLead(idParam(req));
  if (!lead) throw new HttpError(404, 'Lead nicht gefunden.');
  return lead;
}

export const leadsRouter = Router();

leadsRouter.get('/', (req, res) => {
  const sort = optionalString(req.query.sort);
  res.json(
    db.listLeads({
      q: optionalString(req.query.q),
      industry: optionalString(req.query.industry),
      city: optionalString(req.query.city),
      status: optionalString(req.query.status),
      minScore: optionalNumber(req.query.minScore),
      maxScore: optionalNumber(req.query.maxScore),
      jobId: optionalNumber(req.query.jobId),
      hideUnreachable: req.query.hideUnreachable === '1',
      sort: sort === 'name' || sort === 'updated' || sort === 'distance' ? sort : 'score',
      dir: req.query.dir === 'asc' ? 'asc' : 'desc',
    }),
  );
});

leadsRouter.get('/filters', (_req, res) => {
  res.json(db.filterOptions());
});

leadsRouter.get('/export.csv', (req, res) => {
  const leads = db.listLeads({ status: optionalString(req.query.status), minScore: optionalNumber(req.query.minScore) });
  const rows = leads.map((l) =>
    [l.name, l.industry, l.address, l.postcode, l.city, l.phone, l.email, l.website, l.score, STATUS_LABELS[l.status], l.painPoints.map((p) => p.title).join('; ')]
      .map(csvCell)
      .join(';'),
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="altbau-leads-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`﻿${[CSV_HEADER.map(csvCell).join(';'), ...rows].join('\r\n')}`);
});

leadsRouter.post('/', (req, res) => {
  const body = req.body as CreateLeadInput;
  const site = normalizeWebsite(body?.url);
  if (!site) throw new HttpError(400, 'Bitte eine gültige Website-Adresse angeben, z. B. „baeckerei-muster.de“.');
  const existing = db.findLeadByDomain(site.domain);
  if (existing) throw new HttpError(409, `${site.domain} ist bereits als Lead „${existing.name}“ erfasst.`);
  const lead = db.insertLead({
    name: optionalString(body.name) ?? site.domain,
    industry: optionalString(body.industry) ?? 'Manuell hinzugefügt',
    city: optionalString(body.city) ?? null,
    website: site.url,
    domain: site.domain,
    source: 'manuell',
  })!;
  auditInBackground(lead.id);
  res.status(201).json(db.getLead(lead.id));
});

leadsRouter.get('/:id', (req, res) => {
  res.json(requireLead(req));
});

leadsRouter.patch('/:id', (req, res) => {
  const lead = requireLead(req);
  const body = req.body as { status?: LeadStatus; notes?: string; name?: string; phone?: string | null; email?: string | null };
  if (body.status && !(body.status in STATUS_LABELS)) throw new HttpError(400, 'Unbekannter Status.');
  if (body.notes != null && typeof body.notes !== 'string') throw new HttpError(400, 'Notizen müssen Text sein.');
  res.json(
    db.updateLead(lead.id, {
      status: body.status,
      notes: body.notes?.slice(0, 20_000),
      name: optionalString(body.name),
      phone: body.phone === undefined ? undefined : optionalString(body.phone) ?? null,
      email: body.email === undefined ? undefined : optionalString(body.email) ?? null,
    }),
  );
});

leadsRouter.delete('/:id', (req, res) => {
  if (!db.deleteLead(idParam(req))) throw new HttpError(404, 'Lead nicht gefunden.');
  res.status(204).end();
});

leadsRouter.post('/:id/rescan', (req, res) => {
  const lead = requireLead(req);
  auditInBackground(lead.id);
  res.status(202).json(db.getLead(lead.id));
});

leadsRouter.get('/:id/pitch', (req, res) => {
  const lead = requireLead(req);
  res.json({ pitch: db.latestPitch(lead.id), warning: null });
});

leadsRouter.post('/:id/pitch', async (req, res) => {
  const lead = requireLead(req);
  if (lead.auditStatus !== 'done') throw new HttpError(409, 'Der Pitch braucht ein abgeschlossenes Audit. Bitte warte, bis die Prüfung fertig ist.');
  const result = await generatePitch(lead, req.body?.mode === 'vorlage' ? 'vorlage' : 'auto');
  db.savePitch(lead.id, result.pitch);
  res.json(result);
});
