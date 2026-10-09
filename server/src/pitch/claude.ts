import Anthropic from '@anthropic-ai/sdk';
import type { Lead, Pitch } from '../../../shared/types.ts';
import { config } from '../config.ts';
import { getProfile } from '../db.ts';
import { SYSTEM_PROMPT, userMessage } from './prompt.ts';

const client = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;

export const claudeEnabled = client != null;

const text = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) });

const object = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

const PITCH_SCHEMA = object({
  opener: text('Gesprächseinstieg fürs Telefonat, 3–4 Sätze'),
  talkingPoints: {
    type: 'array',
    items: object({
      title: text(),
      argument: text('Was die Schwachstelle den Inhaber an Besuchern oder Anfragen kostet'),
      solution: text('Wie ein Relaunch das löst'),
    }),
  },
  offer: text('Konkreter Relaunch-Vorschlag mit unverbindlichem Einstiegsangebot'),
  objections: { type: 'array', items: object({ objection: text(), answer: text() }) },
  callScript: { type: 'array', items: text(), description: 'Gesprächsleitfaden in Schritten' },
  email: object({ subject: text(), body: text() }),
});

async function claudeJson<T>(system: string, user: string, schema: object): Promise<T> {
  if (!client) throw new Error('Kein Anthropic-API-Key konfiguriert.');
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: user }],
  } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
  if (response.stop_reason === 'refusal') throw new Error('Claude hat die Anfrage abgelehnt.');
  if (response.stop_reason === 'max_tokens') throw new Error('Die Claude-Antwort wurde abgeschnitten.');
  const output = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return JSON.parse(output) as T;
}

export async function buildClaudePitch(lead: Lead): Promise<Pitch> {
  const parsed = await claudeJson<Omit<Pitch, 'mode' | 'createdAt'>>(SYSTEM_PROMPT, userMessage(lead, getProfile()), PITCH_SCHEMA);
  return { ...parsed, mode: 'ki', provider: 'claude', createdAt: new Date().toISOString() };
}
