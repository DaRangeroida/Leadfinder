import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider, Lead, Pitch, SenderProfile } from '../../../shared/types.ts';
import { getProfile } from '../db.ts';
import { errorMessage } from '../util.ts';
import { buildClaudePitch } from './claude.ts';
import { buildGeminiPitch } from './gemini.ts';
import { aiProvider, providerReady } from './provider.ts';
import { buildTemplatePitch } from './template.ts';

export { claudeEnabled } from './claude.ts';
export { geminiEnabled } from './gemini.ts';
export { aiProvider, providerReady };

type PitchResult = { pitch: Pitch; warning: string | null };

const PROVIDER_LABEL: Record<AiProvider, string> = { gemini: 'Gemini', claude: 'Claude' };
const PROVIDER_KEY: Record<AiProvider, string> = { gemini: 'GEMINI_API_KEY', claude: 'ANTHROPIC_API_KEY' };

function explain(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'Der Anthropic-API-Key ist ungültig.';
  if (error instanceof Anthropic.RateLimitError) return 'Das Claude-Kontingent ist gerade ausgeschöpft.';
  if (error instanceof Anthropic.APIConnectionError) return 'Claude ist nicht erreichbar.';
  return errorMessage(error);
}

function personalize(pitch: Pitch, profile: SenderProfile | null): Pitch {
  if (!profile) return pitch;
  const values: [string, string][] = [
    ['[Ihr Name]', profile.name],
    ['[Ihre Agentur]', profile.company],
    ['[Telefon]', profile.phone],
    ['[E-Mail]', profile.email],
    ['[Website]', profile.website],
  ];
  const replace = (text: string) => values.reduce((out, [placeholder, value]) => (value ? out.split(placeholder).join(value) : out), text);
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return replace(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
    return value;
  };
  return walk(pitch) as Pitch;
}

async function createPitch(lead: Lead, mode: 'auto' | 'vorlage'): Promise<PitchResult> {
  if (mode === 'vorlage') return { pitch: buildTemplatePitch(lead), warning: null };

  const provider = aiProvider();
  if (!providerReady(provider)) {
    return {
      pitch: buildTemplatePitch(lead),
      warning: `${PROVIDER_LABEL[provider]} ist als KI gewählt, aber ${PROVIDER_KEY[provider]} fehlt in der .env. Der Pitch wurde aus der Vorlage erstellt.`,
    };
  }

  try {
    const pitch = provider === 'gemini' ? await buildGeminiPitch(lead) : await buildClaudePitch(lead);
    return { pitch, warning: null };
  } catch (error) {
    const reason = explain(error);
    console.warn(`[pitch] ${PROVIDER_LABEL[provider]} fehlgeschlagen:`, reason);
    return { pitch: buildTemplatePitch(lead), warning: `${reason} Der Pitch wurde aus der Vorlage erstellt.` };
  }
}

export async function generatePitch(lead: Lead, mode: 'auto' | 'vorlage'): Promise<PitchResult> {
  const result = await createPitch(lead, mode);
  return { ...result, pitch: personalize(result.pitch, getProfile()) };
}
