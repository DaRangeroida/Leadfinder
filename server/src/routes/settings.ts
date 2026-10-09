import { Router } from 'express';
import { EMPTY_PROFILE, profileComplete, type Meta, type SenderProfile } from '../../../shared/types.ts';
import { config } from '../config.ts';
import * as db from '../db.ts';
import { INDUSTRIES } from '../discovery/industries.ts';
import { HttpError } from '../http.ts';
import { aiProvider, claudeEnabled, geminiEnabled, providerReady } from '../pitch/index.ts';

const PROFILE_TEXT_FIELDS = ['name', 'company', 'role', 'email', 'phone', 'website', 'city', 'services', 'usp', 'offer', 'priceHint'] as const;

function meta(): Meta {
  const provider = aiProvider();
  const profile = db.getProfile();
  return {
    industries: INDUSTRIES.map(({ key, label }) => ({ key, label })),
    claudeEnabled,
    geminiEnabled,
    geminiModel: config.geminiModel,
    aiProvider: provider,
    aiReady: providerReady(provider),
    profile: profile ?? EMPTY_PROFILE,
    onboarded: profileComplete(profile),
    placesEnabled: !!config.googlePlacesApiKey,
    auditConcurrency: config.auditConcurrency,
  };
}

function parseProfile(body: Partial<Record<keyof SenderProfile, unknown>>): SenderProfile {
  const profile: SenderProfile = { ...EMPTY_PROFILE };
  for (const key of PROFILE_TEXT_FIELDS) {
    const value = body[key];
    if (value != null && typeof value !== 'string') throw new HttpError(400, `Feld „${key}“ muss Text sein.`);
    profile[key] = (value ?? '').trim().slice(0, 600);
  }
  profile.tone = body.tone === 'sachlich' || body.tone === 'locker' ? body.tone : 'freundlich';
  if (!profileComplete(profile)) {
    throw new HttpError(400, 'Bitte mindestens deinen Namen, deine Firma und eine E-Mail-Adresse oder Telefonnummer angeben.');
  }
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    throw new HttpError(400, 'Die E-Mail-Adresse sieht nicht gültig aus.');
  }
  return profile;
}

export const settingsRouter = Router();

settingsRouter.get('/meta', (_req, res) => {
  res.json(meta());
});

settingsRouter.get('/stats', (_req, res) => {
  res.json(db.stats());
});

settingsRouter.put('/settings', (req, res) => {
  const provider = req.body?.aiProvider;
  if (provider !== 'gemini' && provider !== 'claude') throw new HttpError(400, 'aiProvider muss „gemini“ oder „claude“ sein.');
  db.setSetting('aiProvider', provider);
  res.json(meta());
});

settingsRouter.put('/profile', (req, res) => {
  db.saveProfile(parseProfile(req.body ?? {}));
  res.json(meta());
});
