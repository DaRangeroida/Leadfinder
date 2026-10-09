import type { AiProvider } from '../../../shared/types.ts';
import { getSetting } from '../db.ts';
import { claudeEnabled } from './claude.ts';
import { geminiEnabled } from './gemini.ts';

export function aiProvider(): AiProvider {
  return getSetting('aiProvider') === 'claude' ? 'claude' : 'gemini';
}

export function providerReady(provider: AiProvider): boolean {
  return provider === 'claude' ? claudeEnabled : geminiEnabled;
}
