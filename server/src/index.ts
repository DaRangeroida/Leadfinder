import { createApp } from './app.ts';
import { config } from './config.ts';
import { resumePendingAudits } from './jobs.ts';
import { aiProvider, providerReady } from './pitch/index.ts';

createApp().listen(config.port, config.host, () => {
  const provider = aiProvider();
  console.log(`Altbau läuft auf http://localhost:${config.port}`);
  console.log(`KI für Pitches: ${provider} (${providerReady(provider) ? 'Key vorhanden' : 'kein Key, Vorlagen-Engine aktiv'})`);
  resumePendingAudits();
});
