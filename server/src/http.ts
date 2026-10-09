import type { NextFunction, Request, Response } from 'express';
import { config } from './config.ts';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function idParam(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Ungültige ID.');
  return id;
}

export function optionalNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function localOnly(req: Request, res: Response, next: NextFunction) {
  const host = (req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase();
  if (!LOCAL_HOSTS.has(host) && host !== config.host) {
    res.status(403).json({ error: 'Zugriff nur über localhost erlaubt.' });
    return;
  }
  next();
}

export function jsonWrites(req: Request, res: Response, next: NextFunction) {
  const safe = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  if (!safe && !(req.headers['content-type'] ?? '').startsWith('application/json')) {
    res.status(415).json({ error: 'Anfragen müssen als JSON gesendet werden.' });
    return;
  }
  next();
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Interner Serverfehler. Details stehen im Server-Log.' });
}
