import type { AuditFacts, PainPoint } from '../../../shared/types.ts';

export function scoreAudit(facts: AuditFacts): { score: number; painPoints: PainPoint[]; summary: string } {
  const points: PainPoint[] = [];
  const add = (p: PainPoint) => points.push(p);
  const year = new Date().getFullYear();

  if (!facts.reachable) {
    add({
      id: 'unreachable',
      title: 'Website nicht erreichbar',
      detail: facts.error ? `Beim Aufruf trat ein Fehler auf: ${facts.error}` : 'Die Seite lieferte keine verwertbare Antwort.',
      severity: 'kritisch',
      category: 'erreichbarkeit',
      weight: 85,
      lever: 'Wer die Firma googelt und auf eine Fehlerseite trifft, ruft beim nächsten Anbieter an – jeder Tag kostet Anfragen.',
      fix: 'Neuaufsetzen auf zuverlässigem Hosting mit Monitoring, damit die Seite dauerhaft erreichbar bleibt.',
    });
    return finalize(points);
  }

  if (!facts.hasViewport) {
    add({
      id: 'no-viewport',
      title: 'Nicht mobile-ready',
      detail: 'Es fehlt das Viewport-Tag – Smartphones zeigen die Desktop-Version winzig verkleinert an.',
      severity: 'kritisch',
      category: 'mobile',
      weight: facts.fixedWidthLayout ? 30 : 25,
      lever: 'Rund zwei Drittel der Besucher kommen per Smartphone. Wer zoomen und wischen muss, springt nach Sekunden ab – und Google bewertet seit dem Mobile-First-Index genau diese Mobilversion.',
      fix: 'Responsives Layout, das sich jedem Bildschirm anpasst, mit großen Buttons zum Anrufen und Anfragen.',
    });
  } else if (
    facts.mediaQueryCount === 0 &&
    !facts.modernSignals.includes('Modernes JS-Framework') &&
    !facts.modernSignals.includes('Moderner Website-Builder')
  ) {
    add({
      id: 'not-responsive',
      title: 'Mobil verzerrt',
      detail: facts.fixedWidthLayout
        ? 'Viewport ist gesetzt, aber das Layout hat eine feste Desktop-Breite und keine Breakpoints.'
        : 'Viewport ist gesetzt, aber das Stylesheet enthält keine Breakpoints für kleine Bildschirme.',
      severity: 'hoch',
      category: 'mobile',
      weight: facts.fixedWidthLayout ? 18 : 12,
      lever: 'Auf dem Handy rutschen Inhalte aus dem Bild oder werden gequetscht – das wirkt unprofessionell, obwohl der Betrieb es nicht ist.',
      fix: 'Mobile-First-Layout mit sauberen Breakpoints, getestet auf gängigen Smartphones.',
    });
  }
  if (facts.viewportContent && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(facts.viewportContent)) {
    add({
      id: 'zoom-blocked',
      title: 'Zoomen gesperrt',
      detail: 'Das Viewport-Tag verhindert das Vergrößern per Fingergeste.',
      severity: 'niedrig',
      category: 'mobile',
      weight: 2,
      lever: 'Ältere Kunden mit Sehschwäche können Texte nicht vergrößern – gerade bei lokaler Stammkundschaft ein Problem.',
      fix: 'Barrierearme Typografie mit ausreichender Schriftgröße und freiem Zoom.',
    });
  }

  if (!facts.https) {
    add({
      id: 'no-https',
      title: 'Keine HTTPS-Verschlüsselung',
      detail: facts.certValid === false
        ? 'HTTPS ist eingerichtet, aber das Zertifikat ist ungültig – die Seite läuft nur unverschlüsselt.'
        : 'Die Seite ist nur über unverschlüsseltes HTTP erreichbar.',
      severity: 'kritisch',
      category: 'sicherheit',
      weight: 20,
      lever: 'Chrome und Safari zeigen „Nicht sicher“ in der Adresszeile. Viele brechen genau dort ab – besonders bei Kontaktformularen.',
      fix: 'Kostenloses SSL-Zertifikat mit automatischer Verlängerung und erzwungener HTTPS-Weiterleitung.',
    });
  } else {
    if (facts.certValid === false) {
      add({
        id: 'cert-invalid',
        title: 'SSL-Zertifikat ungültig',
        detail: 'Das Zertifikat ist abgelaufen oder passt nicht zur Domain – Browser zeigen eine Warnseite.',
        severity: 'kritisch',
        category: 'sicherheit',
        weight: 22,
        lever: 'Eine rote Browser-Warnung „Diese Verbindung ist nicht sicher“ schreckt praktisch jeden Besucher ab.',
        fix: 'Gültiges Zertifikat mit automatischer Erneuerung einrichten.',
      });
    } else if (facts.certDaysLeft != null && facts.certDaysLeft < 14) {
      add({
        id: 'cert-expiring',
        title: `SSL-Zertifikat läuft in ${Math.max(facts.certDaysLeft, 0)} Tagen ab`,
        detail: 'Ohne Verlängerung erscheint bald eine Sicherheitswarnung.',
        severity: 'mittel',
        category: 'sicherheit',
        weight: 5,
        lever: 'Ein abgelaufenes Zertifikat macht die Seite über Nacht unbenutzbar.',
        fix: 'Automatische Zertifikatsverlängerung über das Hosting.',
      });
    }
    if (facts.httpRedirectsToHttps === false) {
      add({
        id: 'no-https-redirect',
        title: 'Keine Weiterleitung auf HTTPS',
        detail: 'Die unverschlüsselte Variante wird weiterhin ausgeliefert.',
        severity: 'mittel',
        category: 'sicherheit',
        weight: 5,
        lever: 'Wer die Adresse ohne https eintippt, landet auf der „Nicht sicher“-Version.',
        fix: 'Serverseitige 301-Weiterleitung und HSTS.',
      });
    }
  }

  if (facts.copyrightYear != null) {
    const age = year - facts.copyrightYear;
    if (age >= 2) {
      const old = age >= 5;
      add({
        id: 'old-copyright',
        title: `Copyright von ${facts.copyrightYear}`,
        detail: `Der Copyright-Hinweis ist ${age} Jahre alt – ein deutliches Zeichen, dass die Seite nicht gepflegt wird.`,
        severity: old ? 'hoch' : 'mittel',
        category: 'aktualitaet',
        weight: old ? 15 : 8,
        lever: `Besucher schließen von der Website auf den Betrieb: Ein Stand von ${facts.copyrightYear} wirkt, als gäbe es die Firma vielleicht gar nicht mehr.`,
        fix: 'Pflegeleichtes CMS, in dem Inhalte, Öffnungszeiten und News in Minuten aktualisiert sind.',
      });
    }
  }
  if (facts.estimatedEra != null && year - facts.estimatedEra >= 7) {
    const veryOld = facts.estimatedEra <= 2012;
    add({
      id: 'old-era',
      title: `Technik-Stand ca. ${facts.estimatedEra}`,
      detail: `Aus ${facts.eraHints.length} technischen Merkmalen geschätzt (${facts.eraHints
        .slice(0, 3)
        .map((h) => h.source)
        .join(', ')}).`,
      severity: veryOld ? 'hoch' : 'mittel',
      category: 'aktualitaet',
      weight: veryOld ? 12 : 7,
      lever: 'Design und Technik sehen so alt aus, wie sie sind – Kunden vergleichen mit modernen Mitbewerbern ein paar Klicks weiter.',
      fix: 'Zeitgemäßes Design mit klarer Bildsprache, das den Betrieb so hochwertig zeigt, wie er arbeitet.',
    });
  }

  if (facts.usesFlash) {
    add({
      id: 'flash',
      title: 'Flash-Inhalte',
      detail: 'Die Seite bindet Flash ein – seit 2021 zeigt kein Browser diese Inhalte mehr an.',
      severity: 'kritisch',
      category: 'technik',
      weight: 15,
      lever: 'Besucher sehen leere Flächen oder Fehlermeldungen statt Inhalten.',
      fix: 'Inhalte in modernes HTML, Bilder und Video überführen.',
    });
  }
  if (facts.usesFrames) {
    add({
      id: 'frames',
      title: 'Frame-basierte Seite',
      detail: 'Die Seite nutzt <frameset>/<frame> – eine Technik aus den 1990ern.',
      severity: 'hoch',
      category: 'technik',
      weight: 12,
      lever: 'Google kann Frame-Inhalte kaum zuordnen, Links auf Unterseiten funktionieren nicht richtig.',
      fix: 'Neuaufbau mit eigener URL je Seite.',
    });
  }
  if (facts.tableLayout) {
    add({
      id: 'table-layout',
      title: 'Tabellen-Layout aus den 2000ern',
      detail: 'Das Seitenlayout ist mit verschachtelten HTML-Tabellen gebaut.',
      severity: 'hoch',
      category: 'technik',
      weight: 10,
      lever: 'Tabellen-Layouts lassen sich nicht an Smartphones anpassen und sind schwer zu pflegen.',
      fix: 'Modernes, semantisches HTML mit flexiblem CSS-Layout.',
    });
  }
  if (facts.legacyTags.length) {
    add({
      id: 'legacy-html',
      title: 'Veraltetes HTML',
      detail: `Gefunden: ${facts.legacyTags.join(', ')}.`,
      severity: 'mittel',
      category: 'technik',
      weight: 6,
      lever: 'Veraltete Auszeichnungen werden von Browsern nur noch geduldet und sehen je nach Gerät unterschiedlich aus.',
      fix: 'Sauberer, standardkonformer Code.',
    });
  }
  if (facts.doctype === 'xhtml' || facts.doctype === 'html4' || facts.doctype === 'none') {
    add({
      id: 'old-doctype',
      title: facts.doctype === 'none' ? 'Kein HTML-Standard deklariert' : `Veralteter Standard (${facts.doctype === 'xhtml' ? 'XHTML' : 'HTML 4'})`,
      detail: 'Die Seite ist nicht nach HTML5 aufgebaut.',
      severity: 'mittel',
      category: 'technik',
      weight: 5,
      lever: 'Ohne HTML5 fehlen Grundlagen für Mobilgeräte, Barrierefreiheit und Suchmaschinen.',
      fix: 'Aufbau nach aktuellem HTML-Standard.',
    });
  }
  if (facts.jqueryVersion) {
    const [major, minor] = facts.jqueryVersion.split('.').map(Number);
    if (major < 3 || (major === 3 && minor < 5)) {
      add({
        id: 'old-jquery',
        title: `Veraltete JavaScript-Bibliothek (jQuery ${facts.jqueryVersion})`,
        detail: 'jQuery-Versionen vor 3.5 haben öffentlich bekannte Sicherheitslücken (XSS).',
        severity: major < 2 ? 'hoch' : 'mittel',
        category: 'technik',
        weight: major < 2 ? 8 : 5,
        lever: 'Bekannte Lücken werden automatisiert ausgenutzt – im schlimmsten Fall verteilt die Seite Schadcode an Kunden.',
        fix: 'Schlanker, aktueller Code ohne veraltete Bibliotheken.',
      });
    }
  }
  if (facts.cms && facts.cmsVersion) {
    const major = Number(facts.cmsVersion.split('.')[0]);
    const outdated =
      (facts.cms === 'WordPress' && major < 6) ||
      (facts.cms === 'Joomla' && major < 4) ||
      (facts.cms === 'TYPO3' && major < 11) ||
      (facts.cms === 'Drupal' && major < 10);
    if (outdated) {
      add({
        id: 'old-cms',
        title: `Veraltetes CMS (${facts.cms} ${facts.cmsVersion})`,
        detail: 'Diese Version erhält keine Sicherheitsupdates mehr.',
        severity: 'hoch',
        category: 'technik',
        weight: 10,
        lever: 'Veraltete CMS-Versionen sind das Haupteinfallstor für gehackte Firmenseiten – mit Spam, Weiterleitungen und Google-Warnungen.',
        fix: 'Aktuelles, gewartetes System mit automatischen Sicherheitsupdates.',
      });
    }
  }
  if (facts.siteBuilder) {
    const ancient = /FrontPage|NetObjects|Dreamweaver|WebSite X5/.test(facts.siteBuilder);
    add({
      id: 'site-builder',
      title: ancient ? `Erstellt mit ${facts.siteBuilder}` : `Baukasten-Website (${facts.siteBuilder})`,
      detail: ancient
        ? 'Das Erstellungsprogramm wird seit Jahren nicht mehr weiterentwickelt.'
        : 'Baukasten-Seiten sind schnell gebaut, stoßen aber bei Design, Ladezeit und Google-Optimierung an Grenzen.',
      severity: ancient ? 'hoch' : 'niedrig',
      category: 'technik',
      weight: ancient ? 10 : 3,
      lever: 'Die Seite sieht aus wie viele andere – und hebt den Betrieb nicht von der Konkurrenz ab.',
      fix: 'Individuelles Design mit voller Kontrolle über Inhalte und Technik.',
    });
  }

  if (facts.loadTimeMs != null) {
    const seconds = (facts.loadTimeMs / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 });
    if (facts.loadTimeMs > 2500) {
      add({
        id: 'slow',
        title: `Langsame Ladezeit (${seconds} s)`,
        detail: 'Allein das HTML-Dokument braucht so lange; Bilder und Skripte kommen noch dazu.',
        severity: 'hoch',
        category: 'performance',
        weight: 10,
        lever: 'Schon ab drei Sekunden Ladezeit verliert eine Seite mobil über die Hälfte der Besucher.',
        fix: 'Schnelles Hosting, optimierte Bilder und Caching – Ladezeiten unter einer Sekunde.',
      });
    } else if (facts.loadTimeMs > 1200) {
      add({
        id: 'sluggish',
        title: `Träge Server-Antwort (${seconds} s)`,
        detail: 'Das HTML-Dokument lädt spürbar langsam.',
        severity: 'mittel',
        category: 'performance',
        weight: 5,
        lever: 'Jede Sekunde Wartezeit senkt die Anfragequote messbar.',
        fix: 'Performance-optimiertes Hosting und schlanker Code.',
      });
    }
  }
  if (facts.htmlBytes != null && facts.htmlBytes > 400_000) {
    add({
      id: 'heavy',
      title: `Aufgeblähte Seite (${Math.round(facts.htmlBytes / 1024)} KB HTML)`,
      detail: 'Das HTML allein ist sehr groß, oft durch eingebettete Bilder oder Baukasten-Code.',
      severity: 'niedrig',
      category: 'performance',
      weight: 3,
      lever: 'Im Mobilfunknetz lädt die Seite spürbar länger.',
      fix: 'Schlanker Code und ausgelagerte, optimierte Medien.',
    });
  }
  if (facts.compressed === false) {
    add({
      id: 'no-compression',
      title: 'Keine Komprimierung',
      detail: 'Der Server liefert Inhalte ohne gzip/Brotli aus.',
      severity: 'niedrig',
      category: 'performance',
      weight: 3,
      lever: 'Unnötig große Datenmengen verlangsamen jeden Seitenaufruf.',
      fix: 'Moderne Server-Konfiguration mit Komprimierung und HTTP/2.',
    });
  }

  if (!facts.title || facts.title.length < 10) {
    add({
      id: 'no-title',
      title: facts.title ? 'Nichtssagender Seitentitel' : 'Kein Seitentitel',
      detail: facts.title ? `Der Titel lautet nur „${facts.title}“.` : 'Das <title>-Element fehlt.',
      severity: 'mittel',
      category: 'sichtbarkeit',
      weight: 4,
      lever: 'Der Seitentitel ist die Überschrift in den Google-Ergebnissen – ohne ihn klickt kaum jemand.',
      fix: 'Suchmaschinenoptimierte Titel mit Leistung und Ort („Zahnarzt in Köln-Ehrenfeld“).',
    });
  }
  if (!facts.metaDescription) {
    add({
      id: 'no-description',
      title: 'Keine Meta-Beschreibung',
      detail: 'Google zeigt einen zufälligen Textausschnitt statt einer überzeugenden Kurzbeschreibung.',
      severity: 'mittel',
      category: 'sichtbarkeit',
      weight: 4,
      lever: 'Das Suchergebnis wirbt nicht für den Betrieb – Mitbewerber mit gepflegtem Snippet bekommen den Klick.',
      fix: 'Individuelle Meta-Beschreibungen für jede Seite.',
    });
  }
  if (facts.h1Count === 0) {
    add({
      id: 'no-h1',
      title: 'Keine Hauptüberschrift',
      detail: 'Die Seite hat keine <h1>-Überschrift.',
      severity: 'niedrig',
      category: 'sichtbarkeit',
      weight: 2,
      lever: 'Suchmaschinen erkennen schlechter, worum es auf der Seite geht.',
      fix: 'Klare Überschriftenstruktur.',
    });
  }
  if (facts.imgCount >= 3 && facts.imgWithoutAlt / facts.imgCount > 0.5) {
    add({
      id: 'missing-alt',
      title: 'Bilder ohne Beschreibung',
      detail: `${facts.imgWithoutAlt} von ${facts.imgCount} Bildern fehlt ein Alternativtext.`,
      severity: 'niedrig',
      category: 'sichtbarkeit',
      weight: 2,
      lever: 'Die Bilder erscheinen nicht in der Google-Bildersuche und sind für Screenreader unsichtbar.',
      fix: 'Barrierefreie, beschriftete Bilder.',
    });
  }
  if (!facts.hasStructuredData) {
    add({
      id: 'no-structured-data',
      title: 'Keine strukturierten Daten',
      detail: 'Es fehlen LocalBusiness-Angaben (Öffnungszeiten, Adresse, Bewertungen) im Schema.org-Format.',
      severity: 'niedrig',
      category: 'sichtbarkeit',
      weight: 2,
      lever: 'Google kann Öffnungszeiten und Kontaktdaten nicht direkt im Suchergebnis anzeigen.',
      fix: 'Schema.org-Auszeichnung für lokale Unternehmen.',
    });
  }
  if (!facts.hasOpenGraph) {
    add({
      id: 'no-og',
      title: 'Keine Vorschau beim Teilen',
      detail: 'Es fehlen Open-Graph-Angaben für WhatsApp, Facebook & Co.',
      severity: 'niedrig',
      category: 'sichtbarkeit',
      weight: 2,
      lever: 'Wird die Seite per WhatsApp empfohlen, erscheint nur ein nackter Link statt einer ansprechenden Vorschau.',
      fix: 'Vorschaubild und Beschreibung für soziale Netzwerke.',
    });
  }
  if (!facts.hasFavicon) {
    add({
      id: 'no-favicon',
      title: 'Kein Favicon',
      detail: 'Im Browser-Tab und in Lesezeichen erscheint kein Logo.',
      severity: 'niedrig',
      category: 'sichtbarkeit',
      weight: 2,
      lever: 'Ein kleines Detail, das aber sofort unfertig wirkt.',
      fix: 'Favicon und App-Icons im Corporate Design.',
    });
  }

  if (!facts.hasImpressum) {
    add({
      id: 'no-impressum',
      title: 'Kein Impressum auffindbar',
      detail: 'Auf der Startseite ist kein Link zum Impressum zu finden.',
      severity: 'hoch',
      category: 'recht',
      weight: 8,
      lever: 'Ein fehlendes oder schwer auffindbares Impressum ist ein klassischer Abmahngrund.',
      fix: 'Rechtssichere Pflichtseiten, von jeder Unterseite aus erreichbar.',
    });
  }
  if (!facts.hasDatenschutz) {
    add({
      id: 'no-privacy',
      title: 'Keine Datenschutzerklärung verlinkt',
      detail: 'Auf der Startseite ist kein Link zur Datenschutzerklärung zu finden.',
      severity: 'hoch',
      category: 'recht',
      weight: 6,
      lever: 'Die DSGVO verlangt eine leicht erreichbare Datenschutzerklärung – sonst drohen Abmahnungen.',
      fix: 'DSGVO-konforme Datenschutzerklärung und Cookie-Einwilligung.',
    });
  }
  if (facts.externalGoogleFonts) {
    add({
      id: 'google-fonts',
      title: 'Google Fonts extern eingebunden',
      detail: 'Schriften werden direkt von Google-Servern geladen und übertragen dabei die IP-Adresse.',
      severity: 'mittel',
      category: 'recht',
      weight: 5,
      lever: 'Seit dem Urteil des LG München (2022) wurden tausende Betriebe genau dafür abgemahnt.',
      fix: 'Schriften lokal hosten – datenschutzkonform und schneller.',
    });
  }

  if (!facts.hasTelLink) {
    add({
      id: 'no-tel-link',
      title: 'Telefonnummer nicht antippbar',
      detail: 'Es gibt keinen tel:-Link – mobil muss die Nummer abgetippt werden.',
      severity: 'mittel',
      category: 'conversion',
      weight: 4,
      lever: 'Der Anruf ist für lokale Betriebe die wichtigste Anfrage – jede Hürde kostet Aufträge.',
      fix: 'Gut sichtbarer Anruf-Button, mobil immer im Griff.',
    });
  }
  if (!facts.hasContactForm) {
    add({
      id: 'no-contact-form',
      title: 'Kein Kontaktformular',
      detail: 'Auf der Startseite gibt es keine Möglichkeit, direkt eine Anfrage zu senden.',
      severity: 'niedrig',
      category: 'conversion',
      weight: 3,
      lever: 'Viele Kunden melden sich lieber abends per Formular als tagsüber per Telefon.',
      fix: 'Kurzes Anfrageformular mit klaren Feldern – auch für Terminwünsche.',
    });
  }

  return finalize(points);
}

const SEVERITY_ORDER = { kritisch: 0, hoch: 1, mittel: 2, niedrig: 3 } as const;

function finalize(points: PainPoint[]) {
  points.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.weight - a.weight);
  const raw = points.reduce((sum, p) => sum + p.weight, 0);
  const score = Math.max(1, Math.min(100, Math.round(raw)));
  return { score, painPoints: points, summary: summarize(score, points) };
}

function summarize(score: number, points: PainPoint[]): string {
  const top = points.slice(0, 3).map((p) => p.title);
  if (!top.length) return 'Technisch solide Seite – kaum Ansatzpunkte für einen Relaunch.';
  const lead = score >= 70 ? 'Akuter Relaunch-Bedarf' : score >= 40 ? 'Lohnender Relaunch-Kandidat' : 'Geringer Handlungsbedarf';
  return `${lead}: ${top.join(', ')}.`;
}
