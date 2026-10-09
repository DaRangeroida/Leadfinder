import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { analyzeHtml } from '../src/audit/analyze.ts';
import { auditWebsite } from '../src/audit/index.ts';

const OLD_SITE = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html><head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1" />
<meta name="generator" content="Microsoft FrontPage 5.0" />
<title>Willkommen</title>
<script src="/js/jquery-1.4.2.min.js"></script>
<style>body { width: 960px; margin: 0 auto; } #wrapper { width: 960px; }</style>
</head><body bgcolor="#ffffff">
<table width="960" border="0" cellpadding="0"><tr><td bgcolor="#003366"><table><tr><td>
<font face="Arial" size="4"><center>Malerbetrieb M\xfcller</center></font>
<marquee>Jetzt neu: Fassadenanstrich!</marquee>
<img src="spacer.gif" width="1" /><img src="a.jpg" /><img src="b.jpg" /><img src="c.jpg" />
<p>Telefon: 0951 / 123 456</p><p>info@maler-mueller.de</p>
</td></tr></table></td></tr></table>
<div>&copy; 2009 Malerbetrieb M\xfcller</div>
</body></html>`;

const MODERN_SITE = `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tischlerei Schmidt – Möbel nach Maß in Bamberg</title>
<meta name="description" content="Maßmöbel, Küchen und Innenausbau aus unserer Meisterwerkstatt in Bamberg.">
<meta property="og:title" content="Tischlerei Schmidt">
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/style.css">
<script type="application/ld+json">{"@type":"LocalBusiness"}</script>
</head><body>
<header><h1>Möbel nach Maß</h1><a href="tel:+49951123456">Anrufen</a></header>
<main><img src="werkstatt.avif" alt="Werkstatt" loading="lazy">
<form><input type="email"><textarea></textarea></form></main>
<footer>© ${new Date().getFullYear()} Tischlerei Schmidt · <a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a></footer>
</body></html>`;

const MODERN_CSS = `:root{--brand:#234} .grid{display:grid} @media (max-width: 720px){.grid{display:block}}`;

let server: http.Server;
let base = '';

before(async () => {
  server = http.createServer((req, res) => {
    const host = req.headers.host ?? '';
    const modern = host.startsWith('127.0.0.1');
    if (req.url === '/style.css') {
      res.writeHead(200, { 'Content-Type': 'text/css' });
      return res.end(MODERN_CSS);
    }
    if (req.url === '/impressum') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<html><body>Tischlerei Schmidt, Tel. 0951 123456, E-Mail: hallo@tischlerei-schmidt.de</body></html>');
    }
    if (modern) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(MODERN_SITE);
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(Buffer.from(OLD_SITE, 'latin1'));
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = String((server.address() as AddressInfo).port);
});

after(() => server.close());

test('veraltete Seite erhält einen hohen Redesign-Score', async () => {
  const result = await auditWebsite(`http://localhost:${base}/`);
  const ids = result.painPoints.map((p) => p.id);

  assert.equal(result.audit.reachable, true);
  assert.equal(result.audit.https, false);
  assert.equal(result.audit.hasViewport, false);
  assert.equal(result.audit.copyrightYear, 2009);
  assert.equal(result.audit.jqueryVersion, '1.4.2');
  assert.equal(result.audit.doctype, 'xhtml');
  assert.ok(result.audit.tableLayout, 'Tabellen-Layout erkannt');
  assert.ok(result.audit.estimatedEra! <= 2010, `Ära ${result.audit.estimatedEra}`);
  for (const id of ['no-viewport', 'no-https', 'old-copyright', 'table-layout', 'legacy-html', 'old-jquery', 'no-impressum']) {
    assert.ok(ids.includes(id), `Pain Point ${id} fehlt (${ids.join(', ')})`);
  }
  assert.ok(result.score >= 90, `Score ${result.score}`);
  assert.ok(result.foundEmails.includes('info@maler-mueller.de'));
  assert.ok(result.foundPhones.length > 0);
});

test('moderne Seite erhält einen niedrigen Redesign-Score', async () => {
  const result = await auditWebsite(`http://127.0.0.1:${base}/`);
  const ids = result.painPoints.map((p) => p.id);

  assert.equal(result.audit.hasViewport, true);
  assert.ok(result.audit.mediaQueryCount > 0);
  assert.equal(result.audit.hasImpressum, true);
  assert.ok(!ids.includes('no-viewport') && !ids.includes('not-responsive') && !ids.includes('old-copyright'));
  assert.ok(ids.includes('no-https'));
  assert.ok(result.score <= 30, `Score ${result.score}: ${ids.join(', ')}`);
  assert.ok(result.foundEmails.includes('hallo@tischlerei-schmidt.de'));
});

test('Bot-Schutz gilt nicht als „nicht erreichbar“', async () => {
  const blocked = http.createServer((_req, res) => {
    res.writeHead(403, { Server: 'cloudflare', 'Content-Type': 'text/html' });
    res.end('<html><body>Just a moment...</body></html>');
  });
  await new Promise<void>((resolve) => blocked.listen(0, resolve));
  const port = (blocked.address() as AddressInfo).port;
  try {
    await assert.rejects(auditWebsite(`http://localhost:${port}/`), /blockiert automatisierte Prüfungen \(Cloudflare-Schutz\)/);
  } finally {
    blocked.close();
  }
});

test('Ziffern im CMS-Namen werden nicht als Version gelesen', () => {
  const typo3 = analyzeHtml('<html><head><meta name="generator" content="TYPO3 CMS"></head><body></body></html>', 'https://a.de/');
  assert.equal(typo3.cms, 'TYPO3');
  assert.equal(typo3.cmsVersion, null);
  const wp = analyzeHtml('<html><head><meta name="generator" content="WordPress 4.9.8"></head><body></body></html>', 'https://a.de/');
  assert.equal(wp.cmsVersion, '4.9.8');
});

test('nicht erreichbare Seite wird als Lead mit Fehler bewertet', async () => {
  const result = await auditWebsite('http://localhost:1/');
  assert.equal(result.audit.reachable, false);
  assert.equal(result.painPoints[0].id, 'unreachable');
  assert.equal(result.score, 85);
});
