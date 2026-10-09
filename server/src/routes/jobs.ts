import { Router } from 'express';
import type { CreateJobInput, JobEvent } from '../../../shared/types.ts';
import * as db from '../db.ts';
import { HttpError, idParam, optionalString } from '../http.ts';
import { jobLog, startSearchJob, subscribe } from '../jobs.ts';

function requireJob(id: number) {
  const job = db.getJob(id);
  if (!job) throw new HttpError(404, 'Suchlauf nicht gefunden.');
  return job;
}

export const jobsRouter = Router();

jobsRouter.get('/', (_req, res) => {
  res.json(db.listJobs());
});

jobsRouter.post('/', (req, res) => {
  const body = req.body as Partial<CreateJobInput>;
  const industry = optionalString(body.industry);
  const location = optionalString(body.location);
  if (!industry) throw new HttpError(400, 'Bitte eine Branche wählen oder eingeben.');
  if (!location) throw new HttpError(400, 'Bitte einen Ort oder eine PLZ eingeben.');
  const radiusKm = Math.min(Math.max(Number(body.radiusKm) || 10, 1), 50);
  const limit = Math.min(Math.max(Math.round(Number(body.limit) || 25), 1), 200);
  res.status(201).json(startSearchJob({ industry, location, radiusKm, limit }));
});

jobsRouter.get('/:id', (req, res) => {
  const job = requireJob(idParam(req));
  res.json({ job, log: jobLog(job.id) });
});

jobsRouter.get('/:id/events', (req, res) => {
  const job = requireJob(idParam(req));
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event: JobEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  send({ type: 'job', job });
  for (const entry of jobLog(job.id)) send({ type: 'log', entry });

  const unsubscribe = subscribe(job.id, send);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
