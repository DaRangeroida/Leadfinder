import { BOT_USER_AGENT, config } from '../config.ts';
import { errorMessage, haversineKm, normalizeWebsite, sleep } from '../util.ts';
import type { IndustryPreset } from './industries.ts';

export interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
}

export interface Candidate {
  name: string;
  category: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
  distanceKm: number | null;
  phone: string | null;
  email: string | null;
  website: string;
  domain: string;
  source: 'osm' | 'google';
}

type Log = (message: string, level?: 'info' | 'warn' | 'error') => void;

export async function geocode(location: string): Promise<GeoPoint> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', location);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('accept-language', 'de');
  const res = await fetch(url, {
    headers: { 'User-Agent': BOT_USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Ortssuche fehlgeschlagen (HTTP ${res.status})`);
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!data.length) throw new Error(`Ort „${location}“ wurde nicht gefunden. Versuche z. B. „Köln“ oder „80331 München“.`);
  return { lat: Number(data[0].lat), lon: Number(data[0].lon), label: data[0].display_name };
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function buildOverpassQuery(industry: IndustryPreset, center: GeoPoint, radiusKm: number): string {
  const radius = Math.round(radiusKm * 1000);
  const statements = industry.osm
    .map((filter) => `  nwr${filter}[~"^(website|contact:website|url)$"~"."](around:${radius},${center.lat},${center.lon});`)
    .join('\n');
  return `[out:json][timeout:90];\n(\n${statements}\n);\nout center tags 1500;`;
}

async function queryOverpass(query: string, log: Log): Promise<OverpassElement[]> {
  let lastError: unknown;
  for (let round = 0; round < 2; round++) {
    if (round > 0) {
      log('Alle OpenStreetMap-Server ausgelastet, neuer Versuch in 5 Sekunden …', 'warn');
      await sleep(5_000);
    }
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'User-Agent': BOT_USER_AGENT,
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(100_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { elements: OverpassElement[] };
        return data.elements ?? [];
      } catch (error) {
        lastError = error;
        log(`OpenStreetMap-Server ${new URL(endpoint).host} antwortet nicht (${errorMessage(error)}).`, 'warn');
      }
    }
  }
  throw new Error(`OpenStreetMap ist gerade nicht erreichbar (${errorMessage(lastError)}). Bitte in ein paar Minuten erneut versuchen.`);
}

const OSM_CATEGORY_DE: Record<string, string> = {
  dentist: 'Zahnarztpraxis',
  doctors: 'Arztpraxis',
  physiotherapist: 'Physiotherapie',
  restaurant: 'Restaurant',
  cafe: 'Café',
  bar: 'Bar',
  pub: 'Kneipe',
  biergarten: 'Biergarten',
  hotel: 'Hotel',
  guest_house: 'Pension',
  motel: 'Motel',
  apartment: 'Ferienwohnung',
  bakery: 'Bäckerei',
  pastry: 'Konditorei',
  confectionery: 'Confiserie',
  hairdresser: 'Friseur',
  beauty: 'Kosmetikstudio',
  cosmetics: 'Kosmetik',
  massage: 'Massage',
  fitness_centre: 'Fitnessstudio',
  lawyer: 'Rechtsanwalt',
  tax_advisor: 'Steuerberatung',
  accountant: 'Buchhaltung',
  estate_agent: 'Immobilienmakler',
  car_repair: 'Kfz-Werkstatt',
  car: 'Autohaus',
  electrician: 'Elektriker',
  plumber: 'Sanitär',
  hvac: 'Heizung und Klima',
  heating_engineer: 'Heizungsbau',
  painter: 'Malerbetrieb',
  roofer: 'Dachdecker',
  carpenter: 'Zimmerei',
  joiner: 'Tischlerei',
  cabinet_maker: 'Schreinerei',
  metal_construction: 'Metallbau',
  gardener: 'Garten- und Landschaftsbau',
  tiler: 'Fliesenleger',
  stonemason: 'Steinmetz',
  glaziery: 'Glaserei',
  locksmith: 'Schlüsseldienst',
  optician: 'Optiker',
  photographer: 'Fotograf',
  tailor: 'Schneiderei',
  shoemaker: 'Schuhmacher',
  butcher: 'Metzgerei',
  window_construction: 'Fensterbau',
  plasterer: 'Stuckateur',
  floorer: 'Bodenleger',
  builder: 'Bauunternehmen',
};

function osmCategory(tags: Record<string, string>): string | null {
  for (const key of ['craft', 'healthcare', 'amenity', 'shop', 'office', 'tourism', 'leisure']) {
    const value = tags[key];
    if (value && value !== 'yes') return OSM_CATEGORY_DE[value] ?? value.replace(/_/g, ' ');
  }
  return null;
}

async function discoverOsm(industry: IndustryPreset, center: GeoPoint, radiusKm: number, log: Log): Promise<Candidate[]> {
  const elements = await queryOverpass(buildOverpassQuery(industry, center, radiusKm), log);
  const candidates: Candidate[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags.name || tags['brand'] || tags['operator'];
    const site = normalizeWebsite(tags.website || tags['contact:website'] || tags.url);
    if (!name || !site) continue;
    const lat = el.lat ?? el.center?.lat ?? null;
    const lon = el.lon ?? el.center?.lon ?? null;
    const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
    candidates.push({
      name,
      category: osmCategory(tags),
      address: street || null,
      postcode: tags['addr:postcode'] || null,
      city: tags['addr:city'] || null,
      lat,
      lon,
      distanceKm: lat != null && lon != null ? haversineKm(center.lat, center.lon, lat, lon) : null,
      phone: tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null,
      email: tags.email || tags['contact:email'] || null,
      website: site.url,
      domain: site.domain,
      source: 'osm',
    });
  }
  return candidates;
}

interface PlacesResponse {
  places?: {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    websiteUri?: string;
    nationalPhoneNumber?: string;
    location?: { latitude: number; longitude: number };
    primaryTypeDisplayName?: { text: string };
    addressComponents?: { longText: string; types: string[] }[];
  }[];
  nextPageToken?: string;
}

async function discoverGoogle(
  industry: IndustryPreset,
  location: string,
  center: GeoPoint,
  radiusKm: number,
  limit: number,
): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3 && candidates.length < limit; page++) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.googlePlacesApiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.location,places.primaryTypeDisplayName,places.addressComponents,nextPageToken',
      },
      body: JSON.stringify({
        textQuery: `${industry.query} in ${location}`,
        languageCode: 'de',
        pageSize: 20,
        pageToken,
        locationBias: {
          circle: {
            center: { latitude: center.lat, longitude: center.lon },
            radius: Math.min(radiusKm * 1000, 50_000),
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Google Places: HTTP ${res.status} ${await res.text().catch(() => '')}`.trim());
    const data = (await res.json()) as PlacesResponse;
    for (const place of data.places ?? []) {
      const site = normalizeWebsite(place.websiteUri);
      if (!site || !place.displayName?.text) continue;
      const component = (type: string) => place.addressComponents?.find((c) => c.types.includes(type))?.longText ?? null;
      const lat = place.location?.latitude ?? null;
      const lon = place.location?.longitude ?? null;
      const distanceKm = lat != null && lon != null ? haversineKm(center.lat, center.lon, lat, lon) : null;
      if (distanceKm != null && distanceKm > radiusKm * 1.2) continue;
      const street = [component('route'), component('street_number')].filter(Boolean).join(' ');
      candidates.push({
        name: place.displayName.text,
        category: place.primaryTypeDisplayName?.text ?? null,
        address: street || place.formattedAddress || null,
        postcode: component('postal_code'),
        city: component('locality'),
        lat,
        lon,
        distanceKm,
        phone: place.nationalPhoneNumber ?? null,
        email: null,
        website: site.url,
        domain: site.domain,
        source: 'google',
      });
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return candidates;
}

export async function discover(
  industry: IndustryPreset,
  location: string,
  center: GeoPoint,
  radiusKm: number,
  limit: number,
  log: Log,
): Promise<Candidate[]> {
  const all: Candidate[] = [];

  try {
    const osm = await discoverOsm(industry, center, radiusKm, log);
    log(`OpenStreetMap: ${osm.length} Einträge mit Website gefunden.`);
    all.push(...osm);
  } catch (error) {
    if (!config.googlePlacesApiKey) throw error;
    log(errorMessage(error), 'warn');
  }

  if (config.googlePlacesApiKey) {
    try {
      const google = await discoverGoogle(industry, location, center, radiusKm, limit);
      log(`Google Places: ${google.length} Einträge mit Website gefunden.`);
      all.push(...google);
    } catch (error) {
      log(errorMessage(error), 'warn');
    }
  }

  const byDomain = new Map<string, Candidate & { count: number }>();
  for (const c of all) {
    const existing = byDomain.get(c.domain);
    if (existing) {
      existing.count++;
      existing.phone ??= c.phone;
      existing.email ??= c.email;
      existing.address ??= c.address;
      existing.postcode ??= c.postcode;
      existing.city ??= c.city;
    } else {
      byDomain.set(c.domain, { ...c, count: 1 });
    }
  }
  const unique = [...byDomain.values()];
  const chains = unique.filter((c) => c.count >= 4);
  if (chains.length) log(`${chains.length} Filialketten übersprungen (z. B. ${chains[0].domain}).`);

  return unique
    .filter((c) => c.count < 4)
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, limit)
    .map(({ count: _count, ...c }) => c);
}
