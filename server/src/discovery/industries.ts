import type { IndustryOption } from '../../../shared/types.ts';

export interface IndustryPreset extends IndustryOption {
  osm: string[];
  query: string;
}

export const INDUSTRIES: IndustryPreset[] = [
  { key: 'handwerk', label: 'Handwerk', osm: ['["craft"]'], query: 'Handwerksbetrieb' },
  { key: 'elektro', label: 'Elektriker', osm: ['["craft"="electrician"]'], query: 'Elektriker' },
  {
    key: 'sanitaer',
    label: 'Sanitär & Heizung',
    osm: ['["craft"~"^(plumber|hvac|heating_engineer)$"]'],
    query: 'Sanitär Heizung',
  },
  { key: 'maler', label: 'Maler & Lackierer', osm: ['["craft"="painter"]'], query: 'Malerbetrieb' },
  { key: 'dachdecker', label: 'Dachdecker', osm: ['["craft"="roofer"]'], query: 'Dachdecker' },
  { key: 'tischler', label: 'Tischler & Schreiner', osm: ['["craft"~"^(carpenter|joiner|cabinet_maker)$"]'], query: 'Tischlerei' },
  { key: 'kfz', label: 'Kfz-Werkstätten', osm: ['["shop"="car_repair"]', '["craft"="car_repair"]'], query: 'Autowerkstatt' },
  { key: 'zahnaerzte', label: 'Zahnärzte', osm: ['["amenity"="dentist"]', '["healthcare"="dentist"]'], query: 'Zahnarzt' },
  { key: 'aerzte', label: 'Arztpraxen', osm: ['["amenity"="doctors"]'], query: 'Arztpraxis' },
  { key: 'physio', label: 'Physiotherapie', osm: ['["healthcare"="physiotherapist"]'], query: 'Physiotherapie' },
  {
    key: 'gastronomie',
    label: 'Gastronomie',
    osm: ['["amenity"~"^(restaurant|cafe|bar|pub|biergarten)$"]'],
    query: 'Restaurant',
  },
  { key: 'hotels', label: 'Hotels & Pensionen', osm: ['["tourism"~"^(hotel|guest_house|motel|apartment)$"]'], query: 'Hotel' },
  { key: 'baeckereien', label: 'Bäckereien', osm: ['["shop"~"^(bakery|pastry|confectionery)$"]'], query: 'Bäckerei' },
  { key: 'friseure', label: 'Friseure', osm: ['["shop"="hairdresser"]'], query: 'Friseur' },
  { key: 'kosmetik', label: 'Kosmetik & Beauty', osm: ['["shop"~"^(beauty|cosmetics|massage)$"]'], query: 'Kosmetikstudio' },
  { key: 'fitness', label: 'Fitnessstudios', osm: ['["leisure"="fitness_centre"]'], query: 'Fitnessstudio' },
  { key: 'anwaelte', label: 'Rechtsanwälte', osm: ['["office"="lawyer"]'], query: 'Rechtsanwalt' },
  {
    key: 'steuerberater',
    label: 'Steuerberater',
    osm: ['["office"~"^(tax_advisor|accountant)$"]'],
    query: 'Steuerberater',
  },
  { key: 'immobilien', label: 'Immobilienmakler', osm: ['["office"="estate_agent"]'], query: 'Immobilienmakler' },
  { key: 'autohaus', label: 'Autohäuser', osm: ['["shop"="car"]'], query: 'Autohaus' },
];

function escapeOverpassRegex(value: string): string {
  return value.replace(/[\\.^$|?*+()[\]{}"]/g, (c) => `\\${c}`);
}

export function resolveIndustry(input: string): IndustryPreset {
  const trimmed = input.trim();
  const preset = INDUSTRIES.find(
    (i) => i.key === trimmed.toLowerCase() || i.label.toLowerCase() === trimmed.toLowerCase(),
  );
  if (preset) return preset;
  const term = escapeOverpassRegex(trimmed);
  return {
    key: trimmed.toLowerCase(),
    label: trimmed,
    osm: [`["name"~"${term}",i]`, `["description"~"${term}",i]`],
    query: trimmed,
  };
}
