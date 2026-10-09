import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');

const envFile = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

function int(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  port: int(process.env.PORT, 4000),
  host: process.env.HOST || '127.0.0.1',
  databasePath: path.resolve(ROOT_DIR, process.env.DATABASE_PATH || './data/altbau.db'),
  auditConcurrency: Math.min(int(process.env.AUDIT_CONCURRENCY, 4), 16),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
  osmContact: process.env.OSM_CONTACT_EMAIL || '',
  clientDist: path.join(ROOT_DIR, 'client', 'dist'),
};

export const BOT_USER_AGENT = `AltbauLeadFinder/1.0${config.osmContact ? ` (${config.osmContact})` : ''}`;

export const AUDIT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 AltbauAudit/1.0';
