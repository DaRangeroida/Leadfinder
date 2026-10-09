import tls from 'node:tls';
import { AUDIT_USER_AGENT } from '../config.ts';
import { errorMessage } from '../util.ts';

const MAX_BYTES = 3 * 1024 * 1024;

export interface FetchedPage {
  ok: boolean;
  status: number;
  url: string;
  html: string;
  headers: Headers;
  ttfbMs: number;
  totalMs: number;
  bytes: number;
}

export class FetchError extends Error {
  code: string | null;
  constructor(message: string, code: string | null) {
    super(message);
    this.code = code;
  }
}

const CERT_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_NOT_YET_VALID',
  'CERT_UNTRUSTED',
]);

export function isCertError(error: unknown): boolean {
  return error instanceof FetchError && error.code != null && CERT_ERROR_CODES.has(error.code);
}

function causeCode(error: unknown): string | null {
  let current = error as { code?: string; cause?: unknown } | undefined;
  for (let depth = 0; current && depth < 4; depth++) {
    if (typeof current.code === 'string') return current.code;
    current = current.cause as typeof current;
  }
  return null;
}

function detectCharset(contentType: string | null, head: Uint8Array): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const sniff = new TextDecoder('latin1').decode(head.subarray(0, 4096));
  const fromMeta = sniff.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  return (fromMeta ?? 'utf-8').toLowerCase();
}

function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

async function readCapped(res: Response): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    if (size >= MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function fetchPage(url: string, timeoutMs = 15_000): Promise<FetchedPage> {
  const start = performance.now();
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': AUDIT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.6',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const code = causeCode(error);
    const name = (error as Error)?.name;
    if (name === 'TimeoutError') throw new FetchError(`Zeitüberschreitung nach ${timeoutMs / 1000} s`, 'TIMEOUT');
    throw new FetchError(errorMessage(error), code);
  }
  const ttfbMs = performance.now() - start;
  const bytes = await readCapped(res);
  const totalMs = performance.now() - start;
  const html = decode(bytes, detectCharset(res.headers.get('content-type'), bytes));
  return { ok: res.ok, status: res.status, url: res.url || url, html, headers: res.headers, ttfbMs, totalMs, bytes: bytes.byteLength };
}

export async function checkHttpRedirect(host: string): Promise<boolean | null> {
  try {
    const res = await fetch(`http://${host}/`, {
      redirect: 'manual',
      headers: { 'User-Agent': AUDIT_USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });
    await res.body?.cancel();
    if (res.status >= 300 && res.status < 400) {
      return (res.headers.get('location') ?? '').toLowerCase().startsWith('https://');
    }
    return false;
  } catch {
    return null;
  }
}

export interface CertInfo {
  valid: boolean | null;
  expiresAt: string | null;
  daysLeft: number | null;
}

export function checkCertificate(host: string): Promise<CertInfo> {
  return new Promise((resolve) => {
    const done = (info: CertInfo) => {
      socket.destroy();
      resolve(info);
    };
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 8_000 }, () => {
      const cert = socket.getPeerCertificate();
      if (!cert || !cert.valid_to) return done({ valid: socket.authorized, expiresAt: null, daysLeft: null });
      const expires = new Date(cert.valid_to);
      done({
        valid: socket.authorized,
        expiresAt: expires.toISOString(),
        daysLeft: Math.floor((expires.getTime() - Date.now()) / 86_400_000),
      });
    });
    socket.on('timeout', () => done({ valid: null, expiresAt: null, daysLeft: null }));
    socket.on('error', () => done({ valid: null, expiresAt: null, daysLeft: null }));
  });
}
