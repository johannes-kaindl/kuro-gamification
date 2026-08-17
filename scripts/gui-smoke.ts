/**
 * GUI-Smoke-Treiber — fährt die mechanisch entscheidbaren Punkte der Handover-Checkliste
 * gegen ein **laufendes** Obsidian statt von Hand.
 *
 * Warum getrackt (CORE-TEST-02 b): Die drei Funde vom 12.08.2026 — der nie speichernde
 * `enableChat`-Schalter, die aus dem Bild scrollende Eingabezeile, der stumme
 * Einrichtungs-Hinweis — waren allesamt für 362 grüne Unit-Tests unsichtbar, weil sie in
 * der Naht zwischen Plugin und Obsidian liegen: Settings-Rendering, Flexbox-Layout,
 * View-Lebenszyklus. Ein Treiber, der nur im Scratchpad liegt, ist beim nächsten Mal
 * wieder Handarbeit.
 *
 * Was er **nicht** prüft: den Ton (Schritt 11 der Checkliste). Ob sich Kuros Antworten
 * richtig anfühlen, ist keine mechanisch entscheidbare Frage — dafür bleibt die Hand-Runde.
 * Der Lauf sagt das ausdrücklich, statt die Lücke wie Abdeckung aussehen zu lassen.
 *
 * ## Voraussetzung
 *
 * Obsidian muss mit offenem Debug-Port laufen (der einzige Handgriff, der Handarbeit
 * bleibt — die App muss dafür neu gestartet werden):
 *
 * ```bash
 * osascript -e 'quit app "Obsidian"'
 * open -a Obsidian --args --remote-debugging-port=9222
 * ```
 *
 * Dann, mit deployter Plugin-Version (`npm run deploy`):
 *
 * ```bash
 * npm run smoke:gui
 * npm run smoke:gui -- --port 9222 --vault 10_Pallas
 * ```
 *
 * Typen: `tsconfig.scripts.json` (im `gate` über `npm run typecheck:scripts`). Es setzt
 * `lib: ["ES2022", "DOM"]` und `types: ["node"]` — der Treiber redet mit einem fremden
 * Renderer (Obsidians `app`, CDP-Antworten), braucht also DOM-Typen für die Ausdrücke,
 * die dort laufen, plus `lib.dom` für `WebSocket`. Die Datei trägt bewusst keine
 * Kommentare: biome liest `.json` strikt und bricht an ihnen ab.
 */

import { execFileSync } from 'node:child_process';

import { Cdp, attachTo, pollUntil, requireVisible } from '../../tools/obsidian-cdp/cdp.js';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';

const PLUGIN_ID = 'kuro-gamification';
const VIEW_TYPE = 'kuro-status-view';

/* ---------------------------------------------------------------- Protokoll */

interface Check {
  name: string;
  passed: boolean;
  detail: string;
}

const results: Check[] = [];

function record(name: string, passed: boolean, detail: string): void {
  results.push({ name, passed, detail });
  console.log(`${passed ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Was der Lauf bewusst NICHT misst. Steht im Protokoll, damit eine Lücke nicht wie
 *  Abdeckung aussieht — ein stillschweigend ausgelassener Punkt liest sich hinterher
 *  wie ein grüner. */
const uebersprungen: string[] = [];

function skipped(name: string, reason: string): void {
  uebersprungen.push(name);
  console.log(`  – ${name} — übersprungen: ${reason}`);
}

/* ------------------------------------------------------------------ Helfer */

/** Eine Einstellung des Prüflings setzen. Kuro hält seinen Zustand in `data.settings`
 *  (nicht in `plugin.settings` wie die Kit-Brücke annimmt) und schreibt über `persist()`
 *  — deshalb ein eigener Helfer statt `setPluginSetting`. */
async function setSetting(cdp: Cdp, key: string, value: unknown): Promise<void> {
  await cdp.evaluate(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    p.data.settings[${JSON.stringify(key)}] = ${JSON.stringify(value)};
    await p.persist();
    await new Promise((r) => setTimeout(r, 250));
    return true;
  `);
}

/** Sidebar von Grund auf neu bauen. `onOpen()` liest Sprache und `enableChat` **einmal**
 *  beim Bau der Tab-Leiste — wer nur eine Einstellung umstellt und dann misst, misst den
 *  alten Baum. */
async function rebuildSidebar(cdp: Cdp): Promise<void> {
  await cdp.evaluate(`
    for (const leaf of app.workspace.getLeavesOfType(${JSON.stringify(VIEW_TYPE)})) leaf.detach();
    await new Promise((r) => setTimeout(r, 300));
    await app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}].activateSidebar();
    await new Promise((r) => setTimeout(r, 700));
    return true;
  `);
}

/** Die Kuro-Ansicht im DOM. Als Ausdruck, weil jeder Prüfpunkt von ihr ausgeht. */
const VIEW_EL = `document.querySelector(".workspace-leaf-content[data-type='${VIEW_TYPE}']")`;

/* ---------------------------------------------------- 1 · Aus-Zustand */

async function sektionAus(cdp: Cdp): Promise<void> {
  await setSetting(cdp, 'enableChat', false);
  await rebuildSidebar(cdp);

  // Erst die Existenz der Ansicht belegen, dann eine Eigenschaft prüfen: ein Vergleich
  // gegen ein nicht vorhandenes Element wird sonst ausgerechnet im Defektfall grün.
  const da = await pollUntil<boolean>(cdp, `return Boolean(${VIEW_EL});`, 10_000);
  if (!da) {
    record('aus/ansicht-vorhanden', false, 'Kuro-Ansicht ist nach activateSidebar nicht im DOM');
    return;
  }
  record('aus/ansicht-vorhanden', true, 'Seitenleiste offen');

  const befund = await cdp.evaluate<{ tabbar: number; chatbody: number; toolbar: number }>(`
    const view = ${VIEW_EL};
    return {
      tabbar: view.querySelectorAll(".kuro-tabbar").length,
      chatbody: view.querySelectorAll(".kuro-chat-body").length,
      toolbar: view.querySelectorAll(".kuro-toolbar").length,
    };
  `);
  record(
    'aus/keine-tab-leiste',
    befund.tabbar === 0 && befund.chatbody === 0,
    `tabbar=${befund.tabbar}, chat-body=${befund.chatbody} (beide 0 erwartet)`,
  );
  record(
    'aus/status-unveraendert',
    befund.toolbar === 1,
    `Werkzeugleiste ${befund.toolbar}× — die Ansicht sieht aus wie ohne Chat`,
  );
}

/* --------------------------------- 2 · Einschalten (Regression 12.08.) */

async function sektionEinschalten(cdp: Cdp): Promise<void> {
  // Der Bug vom 12.08. saß NICHT im Zustand, sondern in der Datenbrücke des Settings-Tabs:
  // `setControlValue` hatte für 'enableChat' keinen `case` und fiel auf `default: return`.
  // Deshalb wird hier genau dieser Weg gegangen — ein direktes Setzen von
  // `data.settings.enableChat` würde den Defekt nicht berühren und grün melden.
  const ueberBruecke = await cdp.evaluate<{ ok: boolean; grund?: string; wert?: unknown }>(`
    if (!app.setting) return { ok: false, grund: "app.setting fehlt" };
    await app.setting.open();
    await app.setting.openTabById(${JSON.stringify(PLUGIN_ID)});
    await new Promise((r) => setTimeout(r, 500));
    const tab = app.setting.activeTab;
    if (!tab || typeof tab.setControlValue !== "function") {
      return { ok: false, grund: "Settings-Tab bietet kein setControlValue" };
    }
    await tab.setControlValue("enableChat", true);
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, wert: app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}].data.settings.enableChat };
  `);

  if (!ueberBruecke.ok) {
    skipped('ein/schalter-speichert', ueberBruecke.grund ?? 'unbekannt');
    await setSetting(cdp, 'enableChat', true);
  } else {
    record(
      'ein/schalter-speichert',
      ueberBruecke.wert === true,
      `setControlValue("enableChat", true) → data.settings.enableChat = ${JSON.stringify(ueberBruecke.wert)}`,
    );

    // Zweite Hälfte desselben Defekts: der Wert stand im Speicher, überlebte aber keinen
    // Neustart. Gemessen wird deshalb die Datei auf Platte, nicht das Objekt.
    const aufPlatte = await cdp.evaluate<boolean | null>(`
      const pfad = app.vault.configDir + "/plugins/${PLUGIN_ID}/data.json";
      const roh = await app.vault.adapter.read(pfad);
      const daten = JSON.parse(roh);
      return daten?.settings?.enableChat ?? null;
    `);
    record(
      'ein/schalter-ueberlebt-neustart',
      aufPlatte === true,
      `data.json auf Platte: enableChat = ${JSON.stringify(aufPlatte)}`,
    );
  }

  await cdp.evaluate(`app.setting.close?.(); return true;`);

  // Zustand nach der MESSUNG herstellen, nicht davor: die folgenden Abschnitte prüfen
  // Layout, Kontext und Sprache und brauchen dafür einen eingeschalteten Chat. Ohne das
  // reißt ein Defekt im Schalter alle späteren Punkte mit rot — ein Prüfprotokoll, das
  // einen Fehler siebenfach meldet, sagt nicht mehr, wo er sitzt.
  await setSetting(cdp, 'enableChat', true);

  // Die Tab-Leiste muss **ohne** Neuaufbau der Seitenleiste erscheinen: `onOpen()` liest
  // `enableChat` nur einmal, deshalb gibt es `syncChatUI()`. Ohne den Aufruf bliebe eine
  // schon offene Seitenleiste stumm bis zum Schließen und Neuöffnen.
  await cdp.evaluate(`
    app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}].syncChatUI();
    await new Promise((r) => setTimeout(r, 600));
    return true;
  `);
  const tabs = await cdp.evaluate<string[]>(`
    const view = ${VIEW_EL};
    return view ? [...view.querySelectorAll(".kuro-tab")].map((b) => b.textContent.trim()) : [];
  `);
  record(
    'ein/tab-leiste-ohne-neuaufbau',
    tabs.length === 2,
    `Tabs sichtbar: ${tabs.length ? tabs.join(' · ') : '(keine)'} — syncChatUI ohne Sidebar-Neustart`,
  );
}

/* --------------------------------------- 3 · Einrichtungs-Hinweis */

async function sektionSetupHinweis(cdp: Cdp): Promise<void> {
  await setSetting(cdp, 'chatEndpoints', []);
  await rebuildSidebar(cdp);
  await oeffneChatTab(cdp);

  const hinweis = await pollUntil<string>(
    cdp,
    `const el = ${VIEW_EL}?.querySelector(".kuro-chat-body .kuro-empty");
     return el ? el.textContent.trim() : null;`,
    8000,
  );
  if (!hinweis) {
    record('setup/hinweis-erscheint', false, 'kein .kuro-empty im Chat-Tab bei leerer Endpunkt-Liste');
    return;
  }
  record('setup/hinweis-erscheint', true, `${hinweis.slice(0, 60)}…`);

  // Der Fund vom 12.08.: der Hinweis sagte nur „Endpunkt und Modell eintragen" und ließ
  // offen, wo. Geprüft wird deshalb der Inhalt, nicht die Anwesenheit.
  record(
    'setup/hinweis-nennt-ort-und-beispiel',
    hinweis.includes('localhost:1234') && /Endpunkte|Endpoints/.test(hinweis),
    'Hinweis nennt die Sektion und eine Beispieladresse',
  );
}

async function oeffneChatTab(cdp: Cdp): Promise<void> {
  await cdp.evaluate(`
    const view = ${VIEW_EL};
    const tabs = view ? [...view.querySelectorAll(".kuro-tab")] : [];
    if (tabs[1]) tabs[1].click();
    await new Promise((r) => setTimeout(r, 400));
    return true;
  `);
}

/* ------------------------------- 4 · Layout (Regression 12.08.) */

async function sektionLayout(cdp: Cdp): Promise<void> {
  // Der teuerste Fund des Hand-Smokes: die Log-Box wuchs mit der Unterhaltung, statt
  // intern zu scrollen — Eingabezeile und Abbrechen-Knopf rutschten bei langen Antworten
  // aus dem Bild. Gemessen wird der Effekt (liegt die Eingabezeile im sichtbaren
  // Bereich?), nicht die Ursache (`min-height:0` gesetzt?) — die Klasse war auch im
  // Defektfall vorhanden.
  await setSetting(cdp, 'chatEndpoints', [{ url: 'http://127.0.0.1:1234' }]);
  await rebuildSidebar(cdp);
  await oeffneChatTab(cdp);

  const gefuellt = await cdp.evaluate<boolean>(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    p.chatSession.reset();
    for (let i = 0; i < 30; i++) {
      p.chatSession.append({
        role: i % 2 === 0 ? "user" : "assistant",
        text: "Zeile " + i + " — " + "Lorem ipsum dolor sit amet, consetetur sadipscing elitr. ".repeat(4),
      });
    }
    for (const leaf of app.workspace.getLeavesOfType(${JSON.stringify(VIEW_TYPE)})) {
      leaf.view.renderChat?.();
    }
    await new Promise((r) => setTimeout(r, 600));
    return true;
  `);
  if (!gefuellt) {
    record('layout/verlauf-gefuellt', false, 'Chat-Verlauf ließ sich nicht befüllen');
    return;
  }

  // Der Bezugsrahmen ist die **Seitenleiste**, nicht der Chat-Body: im Defektfall wächst
  // der Body mit dem Verlauf mit, ein Vergleich `inputBottom <= bodyBottom` wäre dann
  // trivial wahr und ausgerechnet beim echten Fehler grün. Gemessen am 2026-08-17 — die
  // erste Fassung dieses Punktes blieb mit ausgebautem Fix grün, und zwar aus genau
  // diesem Grund. Der Container hat feste Höhe; wer aus ihm herausragt, ist unerreichbar.
  const mass = await cdp.evaluate<{
    ok: boolean;
    grund?: string;
    inputBottom?: number;
    containerBottom?: number;
    scrollHeight?: number;
    clientHeight?: number;
  }>(`
    const view = ${VIEW_EL};
    if (!view) return { ok: false, grund: "keine Kuro-Ansicht" };
    const body = view.querySelector(".kuro-chat-body");
    if (!body) return { ok: false, grund: "kein .kuro-chat-body" };
    const log = body.querySelector(".kuro-chat-log");
    const row = body.querySelector(".kuro-chat-inputrow");
    if (!log || !row) return { ok: false, grund: "Log oder Eingabezeile fehlt" };
    return {
      ok: true,
      inputBottom: row.getBoundingClientRect().bottom,
      containerBottom: view.getBoundingClientRect().bottom,
      scrollHeight: log.scrollHeight,
      clientHeight: log.clientHeight,
    };
  `);
  if (!mass.ok) {
    record('layout/eingabezeile-sichtbar', false, mass.grund ?? 'Messung nicht möglich');
    return;
  }

  const toleranz = 2;
  record(
    'layout/eingabezeile-sichtbar',
    (mass.inputBottom ?? 0) <= (mass.containerBottom ?? 0) + toleranz,
    `Eingabezeile endet bei ${Math.round(mass.inputBottom ?? 0)}px, Seitenleiste bei ${Math.round(mass.containerBottom ?? 0)}px`,
  );
  record(
    'layout/log-scrollt-intern',
    (mass.scrollHeight ?? 0) > (mass.clientHeight ?? 0),
    `Log: scrollHeight ${Math.round(mass.scrollHeight ?? 0)} > clientHeight ${Math.round(mass.clientHeight ?? 0)}`,
  );
}

/* ------------------------------------------ 5 · Kontext-Ausklapper */

async function sektionKontext(cdp: Cdp): Promise<void> {
  // „Vorschau nie nachbauen" ist eine tragende Entscheidung: Settings-Vorschau,
  // Chat-Ausklapper und Prompt rufen dieselbe `renderDailyExtract`. Eine zweite
  // Formatierung würde driften und beruhigend etwas anderes zeigen, als gesendet wird.
  // Geprüft wird die Gleichheit der beiden **sichtbaren** Stellen.
  await oeffneChatTab(cdp);
  const ausklapper = await pollUntil<string>(
    cdp,
    `const el = ${VIEW_EL}?.querySelector(".kuro-chat-context .kuro-chat-context-body");
     return el ? el.textContent : null;`,
    8000,
  );
  if (ausklapper === null) {
    skipped('kontext/vorschau-gleich-ausklapper', 'kein Kontext-Ausklapper im Chat-Tab');
    return;
  }
  record('kontext/ausklapper-vorhanden', true, `${ausklapper.trim().length} Zeichen`);

  // Die Settings sind ab Obsidian 1.13 ein eigenes Fenster: `openTabById` gelingt, das
  // Modal-DOM im Workspace-Fenster bleibt aber leer. Beide Fälle offen halten und aus der
  // Sache ableiten, welcher vorliegt — nie über den (lokalisierten) Fenstertitel.
  await cdp.evaluate(`
    await app.setting.open();
    await app.setting.openTabById(${JSON.stringify(PLUGIN_ID)});
    await new Promise((r) => setTimeout(r, 700));
    return true;
  `);

  const imHauptfenster = await cdp.evaluate<string | null>(`
    const box = document.querySelector(".modal.mod-settings .kuro-context-preview");
    return box ? box.textContent : null;
  `);

  let vorschau = imHauptfenster;
  let quelle = 'Modal im Hauptfenster';
  if (vorschau === null) {
    const fenster = await attachTo('settings', PORT);
    if (fenster) {
      vorschau = await fenster.evaluate<string | null>(`
        const box = document.querySelector(".kuro-context-preview");
        return box ? box.textContent : null;
      `);
      quelle = 'eigenes Einstellungen-Fenster (Obsidian ≥ 1.13)';
      fenster.close();
    }
  }

  await cdp.evaluate(`app.setting.close?.(); return true;`);

  if (vorschau === null) {
    skipped(
      'kontext/vorschau-gleich-ausklapper',
      'Vorschau-Box in den Einstellungen nicht gefunden (weder Modal noch eigenes Fenster)',
    );
    return;
  }
  record(
    'kontext/vorschau-gleich-ausklapper',
    vorschau.trim() === ausklapper.trim(),
    `${quelle}: ${vorschau.trim() === ausklapper.trim() ? 'identisch' : 'ABWEICHUNG'}`,
  );
}

/* ---------------------------------------------- 6 · Sprache (Schritt 12) */

async function sektionSprache(cdp: Cdp): Promise<void> {
  await setSetting(cdp, 'language', 'en');
  await rebuildSidebar(cdp);
  await oeffneChatTab(cdp);

  const sichtbar = await pollUntil<{ texte: string[]; platzhalter: string }>(
    cdp,
    `const body = ${VIEW_EL}?.querySelector(".kuro-chat-body");
     if (!body) return null;
     const input = body.querySelector(".kuro-chat-input");
     return {
       texte: [...body.querySelectorAll("button, summary, h3, p, span")]
         .map((el) => el.textContent.trim()).filter(Boolean),
       platzhalter: input ? input.getAttribute("placeholder") : "",
     };`,
    8000,
  );
  if (!sichtbar) {
    record('sprache/chat-ui-englisch', false, 'Chat-Panel nicht messbar');
    return;
  }

  record(
    'sprache/platzhalter-englisch',
    sichtbar.platzhalter === en['chat.placeholder'],
    `Platzhalter: "${sichtbar.platzhalter}" (erwartet "${en['chat.placeholder']}")`,
  );

  // Der eigentliche Wert dieses Punktes: nicht „ist etwas englisch", sondern „steht
  // irgendwo noch ein deutscher String". Verglichen wird gegen die echten Tabellen, nicht
  // gegen kopierte Zeichenketten — sonst prüft der Smoke einen eingefrorenen Stand.
  const deutscheWerte = new Set(
    Object.keys(de)
      .filter((k) => de[k] !== en[k] && typeof de[k] === 'string' && de[k].length > 2)
      .map((k) => de[k] as string),
  );
  const reste = sichtbar.texte.filter((text) => deutscheWerte.has(text));
  record(
    'sprache/keine-deutschen-reste',
    reste.length === 0,
    reste.length === 0
      ? `${sichtbar.texte.length} sichtbare Texte, keiner aus der deutschen Tabelle`
      : `deutsche Reste: ${reste.join(' | ')}`,
  );
}

/* ------------------------------ 7 · Destruktive Knöpfe (Schritt 13) */

async function sektionDestruktiv(cdp: Cdp): Promise<void> {
  await cdp.evaluate(`
    await app.setting.open();
    await app.setting.openTabById(${JSON.stringify(PLUGIN_ID)});
    await new Promise((r) => setTimeout(r, 900));
    return true;
  `);

  // Zwei Wurzeln, ein Grund: bis Obsidian 1.12 stehen die Einstellungen als Modal IM
  // Workspace-Fenster, ab 1.13 sind sie ein eigenes Fenster ohne Workspace. Ein Fallback
  // auf `document.body` im Hauptfenster wäre bequem und falsch — er findet dort die
  // Knöpfe der Oberfläche, meldet „0 destruktive" und sieht aus wie ein Plugin-Defekt.
  // Gemessen am 2026-08-17: genau so lief dieser Punkt beim ersten Lauf rot.
  const messen = (wurzelAusdruck: string): string => `
    const wurzel = ${wurzelAusdruck};
    if (!wurzel) return null;
    const knoepfe = [...wurzel.querySelectorAll("button")];
    if (knoepfe.length === 0) return null;
    const auffaellig = knoepfe.filter(
      (b) => b.classList.contains("mod-warning") || b.classList.contains("mod-destructive"),
    );
    const normal = knoepfe.find(
      (b) => !b.classList.contains("mod-warning")
        && !b.classList.contains("mod-destructive")
        && !b.classList.contains("mod-cta")
        && b.textContent.trim().length > 0,
    );
    const farbe = (el) => {
      const s = getComputedStyle(el);
      return s.backgroundColor + " / " + s.color;
    };
    return {
      gesamt: knoepfe.length,
      auffaellig: auffaellig.map((b) => ({ text: b.textContent.trim(), farbe: farbe(b) })),
      normal: normal ? { text: normal.textContent.trim(), farbe: farbe(normal) } : null,
    };
  `;

  interface Messung {
    gesamt: number;
    auffaellig: { text: string; farbe: string }[];
    normal: { text: string; farbe: string } | null;
  }

  let mess = await pollUntil<Messung>(cdp, messen('document.querySelector(".modal.mod-settings")'), 3000);
  let quelle = 'Modal im Hauptfenster';
  let fenster: Cdp | null = null;

  if (!mess) {
    fenster = await attachTo('settings', PORT);
    if (fenster) {
      mess = await pollUntil<Messung>(fenster, messen('document.body'), 6000);
      quelle = 'eigenes Einstellungen-Fenster (Obsidian ≥ 1.13)';
    }
  }

  if (!mess) {
    skipped('destruktiv/knoepfe-abgesetzt', 'Einstellungen-DOM nicht erreichbar');
  } else {
    // Erst den Gegenstand belegen: ein Farbvergleich gegen null Knöpfe wäre grün.
    record(
      'destruktiv/knoepfe-vorhanden',
      mess.auffaellig.length >= 2,
      `${quelle}: ${mess.auffaellig.length} destruktiv markierte Knöpfe (${mess.auffaellig
        .map((b) => b.text)
        .join(', ') || 'keine'})`,
    );
    if (mess.auffaellig.length > 0 && mess.normal) {
      const abweichend = mess.auffaellig.filter((b) => b.farbe !== mess?.normal?.farbe);
      record(
        'destruktiv/farblich-abgesetzt',
        abweichend.length === mess.auffaellig.length,
        `destruktiv: ${mess.auffaellig[0]?.farbe} · normal ("${mess.normal.text}"): ${mess.normal.farbe}`,
      );
    } else {
      skipped('destruktiv/farblich-abgesetzt', 'kein Vergleichsknopf ohne Sonderklasse gefunden');
    }
  }

  fenster?.close();
  await cdp.evaluate(`app.setting.close?.(); return true;`);
}

/* -------------------------------------------------------------------- main */

let PORT = 9222;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    return index === -1 ? undefined : argv[index + 1];
  };
  PORT = Number(flag('port') ?? 9222);
  const vault = flag('vault');

  console.log(`GUI-Smoke — Obsidian auf Port ${PORT}`);
  const cdp = await attachTo('workspace', PORT, vault);
  if (!cdp) {
    throw new Error(
      `Kein Obsidian-Fenster mit Workspace auf Port ${PORT}${vault ? ` (Vault "${vault}")` : ''}. ` +
        'Läuft die App mit --remote-debugging-port?',
    );
  }

  // Außerhalb des try, damit das `finally` auch nach einem Abbruch mitten im Lauf
  // zurückschreibt — ein Schnappschuss der GANZEN Einstellungen, nicht einzelner Felder:
  // die Abschnitte stellen um, was sie brauchen, und die Wiederherstellung darf nicht
  // daran hängen, dass jeder von ihnen sauber zu Ende läuft.
  let vorwert: string | null = null;

  try {
    if (process.platform === 'darwin') {
      try {
        execFileSync('osascript', ['-e', 'tell application "Obsidian" to activate']);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch {
        console.log('  (Hinweis: `osascript activate` schlug fehl — Fenster ggf. von Hand nach vorn holen)');
      }
    }
    await requireVisible(cdp);

    const name = await cdp.evaluate<string>('return app.vault.getName();');
    console.log(`Vault: ${name}\n`);

    // Das Plugin NEU LADEN, bevor irgendetwas gemessen wird: `npm run deploy` ersetzt nur
    // die Dateien, die laufende Instanz behält den alten Code im Speicher. Ohne diesen
    // Schritt misst der Smoke den zuletzt geladenen Stand und meldet ihn als Ergebnis für
    // den gerade gebauten — genau so läuft eine kaputte Version grün durch.
    const plugin = await cdp.evaluate<{ ok: boolean; version?: string }>(`
      const id = ${JSON.stringify(PLUGIN_ID)};
      if (app.plugins.plugins[id]) {
        await app.plugins.disablePlugin(id);
        await new Promise((r) => setTimeout(r, 500));
      }
      await app.plugins.enablePlugin(id);
      await new Promise((r) => setTimeout(r, 1200));
      const p = app.plugins.plugins[id];
      return p ? { ok: true, version: p.manifest.version } : { ok: false };
    `);
    if (!plugin.ok) throw new Error(`Plugin ${PLUGIN_ID} ist nicht aktiv. Erst \`npm run deploy\`.`);
    console.log(`Plugin-Version im Vault: ${plugin.version}\n`);

    vorwert = await cdp.evaluate<string>(`
      return JSON.stringify(app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}].data.settings);
    `);

    console.log('── 1 · Aus-Zustand');
    await sektionAus(cdp);
    console.log('');
    console.log('── 2 · Chat einschalten');
    await sektionEinschalten(cdp);
    console.log('');
    console.log('── 3 · Einrichtungs-Hinweis');
    await sektionSetupHinweis(cdp);
    console.log('');
    console.log('── 4 · Layout unter langem Verlauf');
    await sektionLayout(cdp);
    console.log('');
    console.log('── 5 · Kontext-Ausklapper');
    await sektionKontext(cdp);
    console.log('');
    console.log('── 6 · Sprache');
    await sektionSprache(cdp);
    console.log('');
    console.log('── 7 · Destruktive Knöpfe');
    await sektionDestruktiv(cdp);
    console.log('');

    console.log('── Nicht mechanisch prüfbar (bleibt Hand-Runde)');
    skipped('ton/stimmt-der-ton', 'Schritt 11 der Checkliste — ob sich Antworten richtig anfühlen, ist keine Messung');
    skipped('stream/zeichenweise', 'braucht einen echten Endpunkt-Lauf; Abbruch und Fehlertext ebenso');
    console.log('');
  } finally {
    // Aufräumen darf nie am Ergebnis hängen: auch ein abgebrochener Lauf gibt den Vault
    // so zurück, wie er ihn vorgefunden hat. Der Chat-Verlauf wird bewusst nicht
    // persistiert, muss also nur im Speicher geleert werden.
    if (vorwert !== null) {
      const zurueck = await cdp
        .evaluate<boolean>(`
          const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
          p.data.settings = JSON.parse(${JSON.stringify(vorwert)});
          p.chatSession.reset();
          await p.persist();
          for (const leaf of app.workspace.getLeavesOfType(${JSON.stringify(VIEW_TYPE)})) leaf.detach();
          await new Promise((r) => setTimeout(r, 300));
          await p.activateSidebar();
          const pfad = app.vault.configDir + "/plugins/${PLUGIN_ID}/data.json";
          const roh = await app.vault.adapter.read(pfad);
          return JSON.stringify(JSON.parse(roh).settings) === ${JSON.stringify(vorwert)};
        `)
        .catch(() => false);
      // Das Ergebnis des Zurückschreibens gehört ins Protokoll, nicht ins Vertrauen.
      console.log(
        zurueck
          ? 'Einstellungen zurückgeschrieben — byte-gleich zum Vorwert.'
          : '⚠️  ABWEICHUNG beim Zurückschreiben der Einstellungen — data.json prüfen!',
      );
    }
    cdp.close();
  }

  // Die Abschlusszeile trägt mit, worüber der Lauf lief UND was er nicht deckt: wer nur
  // den Exit-Code liest, schlägt keine Dokumentation daneben auf (CORE-TEST-03).
  const failed = results.filter((check) => !check.passed);
  const lueckeed = uebersprungen.length
    ? ` · ${uebersprungen.length} übersprungen (${uebersprungen.join(', ')}) — NICHT geprüft`
    : '';
  console.log(`\n${results.length - failed.length}/${results.length} grün${lueckeed}`);
  if (failed.length > 0) {
    console.log('Rot:');
    for (const check of failed) console.log(`  - ${check.name}: ${check.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(`\nAbbruch: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
