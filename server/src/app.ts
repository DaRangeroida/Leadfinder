import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config.ts';
import { errorHandler, jsonWrites, localOnly } from './http.ts';
import { jobsRouter } from './routes/jobs.ts';
import { leadsRouter } from './routes/leads.ts';
import { settingsRouter } from './routes/settings.ts';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(localOnly);
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  api.use(jsonWrites);
  api.use(settingsRouter);
  api.use('/leads', leadsRouter);
  api.use('/jobs', jobsRouter);
  api.use((_req, res) => {
    res.status(404).json({ error: 'Unbekannter API-Endpunkt.' });
  });
  app.use('/api', api);

  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
