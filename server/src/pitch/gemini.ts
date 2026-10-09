import type { Lead, Pitch } from '../../../shared/types.ts';
import { config } from '../config.ts';
import { getProfile } from '../db.ts';
import { sleep } from '../util.ts';
import { SYSTEM_PROMPT, userMessage } from './prompt.ts';

export const geminiEnabled = !!config.geminiApiKey;

const str = { type: 'STRING' };
const obj = (properties: Record<string, unknown>) => ({ type: 'OBJECT', properties, required: Object.keys(properties) });

const PITCH_SCHEMA = obj({
  opener: str,
  talkingPoints: { type: 'ARRAY', items: obj({ title: str, argument: str, solution: str }) },
  offer: str,
  objections: { type: 'ARRAY', items: obj({ objection: str, answer: str }) },
  callScript: { type: 'ARRAY', items: str },
  email: obj({ subject: str, body: str }),
});

async function geminiJson<T>(system: string, user: string, schema: object): Promise<T> {
  if (!geminiEnabled) throw new Error('Kein Gemini-API-Key konfiguriert.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });
  const send = () =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiApiKey },
      body,
      signal: AbortSignal.timeout(120_000),
    });

  let res = await send();
  if (res.status === 503) {
    await sleep(3_000);
    res = await send();
  }

  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (res.status === 400 || res.status === 403) throw new Error(`Gemini lehnt die Anfrage ab: ${detail?.error?.message ?? `HTTP ${res.status}`}`);
    if (res.status === 404) throw new Error(`Das Gemini-Modell „${config.geminiModel}“ gibt es nicht. Prüfe GEMINI_MODEL.`);
    if (res.status === 429) throw new Error('Das Gemini-Kontingent ist gerade ausgeschöpft.');
    if (res.status === 503) throw new Error('Gemini ist gerade überlastet. Bitte gleich noch einmal versuchen.');
    throw new Error(`Gemini ist nicht erreichbar (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  };
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') throw new Error('Die Gemini-Antwort wurde abgeschnitten.');
  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error(`Gemini hat keinen Text geliefert (${candidate?.finishReason ?? 'ohne Grund'}).`);
  return JSON.parse(text) as T;
}

export async function buildGeminiPitch(lead: Lead): Promise<Pitch> {
  const parsed = await geminiJson<Omit<Pitch, 'mode' | 'createdAt'>>(SYSTEM_PROMPT, userMessage(lead, getProfile()), PITCH_SCHEMA);
  if (!parsed.opener || !parsed.email?.body) throw new Error('Die Gemini-Antwort ist unvollständig.');
  return { ...parsed, mode: 'ki', provider: 'gemini', createdAt: new Date().toISOString() };
}
