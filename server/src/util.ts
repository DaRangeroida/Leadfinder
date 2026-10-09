export async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const NON_BUSINESS_DOMAINS = [
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'xing.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'tiktok.com',
  'google.com',
  'goo.gl',
  'g.page',
  'business.site',
  'yelp.com',
  'tripadvisor.com',
  'tripadvisor.de',
  'gelbeseiten.de',
  'dasoertliche.de',
  'meinestadt.de',
  'wa.me',
  'linktr.ee',
  'booking.com',
  'jameda.de',
  'doctolib.de',
  'lieferando.de',
];

export interface NormalizedSite {
  url: string;
  domain: string;
}

export function normalizeWebsite(raw: string | null | undefined): NormalizedSite | null {
  if (!raw) return null;
  let value = raw.trim().split(/[\s;,]+/)[0];
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (!host.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  const domain = host.replace(/^www\./, '');
  if (NON_BUSINESS_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return null;
  return { url: `${parsed.protocol}//${parsed.host}/`, domain };
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
    if (cause?.code) return `${error.message} (${cause.code})`;
    return error.message;
  }
  return String(error);
}
