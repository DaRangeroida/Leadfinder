<div align="center">

# Altbau

**Find local businesses with outdated websites and prepare the sales conversation.**

Node.js · React · SQLite · Gemini or Claude

</div>

---

> **Built for Germany.** Altbau targets German businesses and German law. The interface, the audit findings and all generated pitches are written in German. The checks reflect German requirements (imprint, privacy policy, GDPR, Google Fonts rulings), and the outreach advice follows German competition law (§ 7 UWG). It does not currently support other languages or legal systems.

---

## How it works

| Step | What happens |
| --- | --- |
| **1. Search** | Pick an industry, a place and a radius. Altbau collects matching businesses with a website from OpenStreetMap. |
| **2. Audit** | Every website is loaded and checked against about 30 criteria: mobile layout, HTTPS, copyright year, technology age, load time, imprint and more. |
| **3. Score** | Each lead gets a redesign score from 1 to 100 and a list of concrete weaknesses. A high score means the relaunch is urgent. |
| **4. Sell** | In the dashboard you filter leads, track status and notes, and generate a call guide with arguments and a follow-up email at the click of a button. |

---

## Setup

**Requirement:** [Node.js](https://nodejs.org) 22.13 or newer

```bash
npm install
cp .env.example .env
npm run dev
```

Then open **http://localhost:5173**. On first start, a short onboarding asks for your name, company and contact details so the pitches can use them.

### Configuration in `.env`

| Variable | Required | Purpose |
| --- | :---: | --- |
| `GEMINI_API_KEY` | – | Gemini writes the pitches. Free key from [Google AI Studio](https://aistudio.google.com/apikey). |
| `GEMINI_MODEL` | – | Gemini model, defaults to `gemini-flash-latest` |
| `ANTHROPIC_API_KEY` | – | Use Claude for the pitches instead |
| `GOOGLE_PLACES_API_KEY` | – | Adds Google Places results to the search |
| `OSM_CONTACT_EMAIL` | – | Contact address sent with OpenStreetMap requests |
| `PORT` | – | Server port, defaults to `4000` |
| `AUDIT_CONCURRENCY` | – | How many websites are checked in parallel, defaults to `4` |

Everything except the AI works without an API key. Pitches then come from a built-in template. You can switch between Gemini and Claude at any time under **Settings**.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development with automatic reload |
| `npm run build && npm start` | Production build at http://localhost:4000 |
| `npm test -w server` | Tests for the website audit |
| `npm run typecheck` | TypeScript check |

---

## Project structure

```
client/          React interface
  pages/         Leads, lead detail, search, search runs, settings, onboarding
  components/    Score display, audit checklist, pitch panel, layout
server/          API server
  routes/        Endpoints for leads, search runs and settings
  discovery/     Business search via OpenStreetMap and Google Places
  audit/         Website audit and score calculation
  pitch/         Pitch via Gemini, Claude or template
shared/          Shared types
```

---

## Security and data

- The server only listens on your own machine and rejects requests from other devices and from other websites.
- API keys belong in `.env` only. That file and the database in `data/` are excluded from Git. Do not share them.
- All leads, notes and your profile are stored locally in `data/altbau.db`. Lead data and your profile are only sent to the selected AI when you generate a pitch.
- Websites behind bot protection are skipped, not bypassed.
- Under German law (§ 7 UWG), advertising emails to businesses without prior consent are not allowed. Use the follow-up email only after a conversation.
- OpenStreetMap data is available under the [ODbL](https://www.openstreetmap.org/copyright).
