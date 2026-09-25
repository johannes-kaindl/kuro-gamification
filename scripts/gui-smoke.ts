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
 * ⚠️ **Zuerst prüfen, wer sonst an Obsidian hängt.** Obsidian ist Single-Instance — ein
 * `quit` trifft die Instanz, an der möglicherweise eine andere Session arbeitet, und zerstört
 * deren Zustand. Der eigene Lauf ist danach sauber grün; der Schaden entsteht woanders und
 * fällt nicht auf.
 *
 * ```bash
 * lsof -nP -iTCP:9222 -sTCP:LISTEN >/dev/null && echo "läuft bereits — NICHT beenden"
 * ```
 *
 * Hört der Port schon, dann **mitnutzen statt neu starten**: ein eigenes Fenster per
 * `vault-open` über IPC öffnen, dann `attachTo("workspace", port, vault)` — der Vault-Name
 * wählt, nicht die Reihenfolge. ⚠️ Die Port-Prüfung ersetzt die Frage nicht: sie zeigt aktive
 * CDP-Treiber, aber nicht, wer ein Fenster offen hält oder auf den Port wartet.
 *
 * Erst wenn nichts läuft — oder nach Absprache mit dem, der es benutzt — gilt das Rezept unten.
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
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { cwd } from 'node:process';

import { Cdp, attachTo, pollUntil, requireVisible } from '../../tools/obsidian-cdp/cdp.js';
import { buildHerkunft, requireEigenerBuild } from '../../tools/obsidian-cdp/vault.js';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';

const PLUGIN_ID = 'kuro-gamification';
const VIEW_TYPE = 'kuro-status-view';
/** Fester Test-Endpunkt — kein echter Nutzer konfiguriert exakt diese lokale Test-URL als
 *  einzigen Chat-Endpunkt. Dient als Marker fuer einen liegen gebliebenen Smoke-Rest. */
const SMOKE_ENDPOINT_URL = 'http://127.0.0.1:1234';

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
  await setSetting(cdp, 'chatEndpoints', [{ url: SMOKE_ENDPOINT_URL }]);
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


/* -------------------------------------------- 9 · Markdown, Kontext-Sync, Manager */

const MANAGER_PLUGIN_ID = 'llm-endpoint-manager';
const MANAGER_DEFAULT_MODEL = 'smoke-manager-modell';

/** Fake-Chat-Endpunkt: streamt eine Antwort mit Markdown und merkt sich Anfragen und Modell.
 *  CORS ist Pflicht — der Renderer läuft unter app://obsidian.md, ohne die Header sieht der
 *  Server die Anfrage nie (gemessen 2026-09-15 in lingotuner, dort dieselbe Bauart). */
interface FakeChat { url: string; close: () => Promise<void>; calls: () => number; lastModel: () => string | null }
async function startFakeChat(): Promise<FakeChat> {
  let calls = 0;
  let lastModel: string | null = null;
  const server: Server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.url?.includes('/v1/models') === true) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: MANAGER_DEFAULT_MODEL, object: 'model' }] }));
      return;
    }
    if (req.method === 'POST' && req.url?.includes('/v1/chat/completions') === true) {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString('utf8'); });
      req.on('end', () => {
        calls += 1;
        try { lastModel = ((JSON.parse(body) as { model?: unknown }).model as string | undefined) ?? null; } catch { lastModel = null; }
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        for (const stueck of ['Antwort mit **Fettung**', '\n\n', '- eins\n- zwei']) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: stueck }, finish_reason: null }] })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      });
      return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => { server.close(() => { resolve(); }); }),
    calls: () => calls,
    lastModel: () => lastModel,
  };
}

/** Fake `llm-endpoint-manager`-API. `findEndpointManager` prüft nur die FORM (version 1 +
 *  alle Methoden), keine Herkunft. `config.model` trägt bewusst NICHT das Standardmodell:
 *  der echte Manager setzt es zusätzlich zu `defaultModel`, und wer `config.model` statt
 *  `result.model` sendet, überschreibt eine getroffene Modellwahl (lingotuner-Befund C1). Ein
 *  abweichender Wert macht diesen Fehler sichtbar. */
async function installFakeManager(cdp: Cdp, url: string): Promise<void> {
  await cdp.evaluate(`
    if (!("__smokeVorherManager" in window)) {
      window.__smokeVorherManager = app.plugins.plugins[${JSON.stringify(MANAGER_PLUGIN_ID)}] ?? null;
    }
    const ep = { id: "fake-ep", label: "Fake Endpoint", url: ${JSON.stringify(url)}, provider: "openai", capabilities: ["chat"], defaultModel: ${JSON.stringify(MANAGER_DEFAULT_MODEL)}, enabled: true, hasSecret: false };
    const res = { id: ep.id, label: ep.label, config: { url: ${JSON.stringify(url)}, model: "config-model-darf-nicht-gesendet-werden" }, defaultModel: ${JSON.stringify(MANAGER_DEFAULT_MODEL)} };
    app.plugins.plugins[${JSON.stringify(MANAGER_PLUGIN_ID)}] = { api: {
      version: 1,
      list: () => [ep],
      get: (id) => (id === ep.id ? ep : null),
      resolve: async () => res,
      materialize: async (id) => (id === ep.id ? res : { error: "not-found" }),
      models: async () => [${JSON.stringify(MANAGER_DEFAULT_MODEL)}],
      importEndpoints: async () => ({ added: [], merged: [], skipped: [] }),
      on: () => (() => {}),
    } };
    return true;
  `);
}

/** Stellt den vorgefundenen Registry-Eintrag wieder her, statt ihn zu löschen (im Renderer
 *  geparkt, weil ein Plugin-Objekt keine CDP-Rundreise überlebt). Idempotent. */
async function removeFakeManager(cdp: Cdp): Promise<void> {
  await cdp.evaluate(`
    if ("__smokeVorherManager" in window) {
      const vorher = window.__smokeVorherManager;
      if (vorher === null) delete app.plugins.plugins[${JSON.stringify(MANAGER_PLUGIN_ID)}];
      else app.plugins.plugins[${JSON.stringify(MANAGER_PLUGIN_ID)}] = vorher;
      delete window.__smokeVorherManager;
    } else {
      delete app.plugins.plugins[${JSON.stringify(MANAGER_PLUGIN_ID)}];
    }
    return true;
  `);
}

async function sektionMarkdown(cdp: Cdp): Promise<void> {
  await setSetting(cdp, 'chatEndpoints', [{ url: SMOKE_ENDPOINT_URL }]);
  await rebuildSidebar(cdp);
  await oeffneChatTab(cdp);

  // (a) Fertige Antwort: Fettung und Liste müssen als Elemente da sein, nicht als Sternchen.
  await cdp.evaluate(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    p.chatSession.reset();
    p.chatSession.append({ role: "user", text: "eine *Frage*" });
    p.chatSession.append({ role: "assistant", text: "Das ist **fett**.\\n\\n- eins\\n- zwei" });
    p.syncChat();
    return true;
  `);
  const fertig = await pollUntil<{ strong: number; li: number; frageRoh: boolean; ws: string } | null>(
    cdp,
    `const v = ${VIEW_EL};
     const md = v?.querySelector(".kuro-chat-assistant .kuro-chat-md");
     if (!md || md.querySelectorAll("li").length < 2) return null;
     const frage = v.querySelector(".kuro-chat-user .kuro-chat-text");
     return { strong: md.querySelectorAll("strong").length, li: md.querySelectorAll("li").length,
              frageRoh: frage?.textContent === "eine *Frage*" && !frage.querySelector("em"),
              ws: getComputedStyle(md).whiteSpace };`,
    6000,
  );
  record(
    'markdown/fertige-antwort-gerendert',
    fertig !== null && fertig.strong === 1 && fertig.li === 2,
    fertig === null ? 'kein gerendertes Markdown im Chat' : `${fertig.strong}× <strong>, ${fertig.li}× <li>, white-space ${fertig.ws}`,
  );
  record(
    'markdown/eigene-frage-bleibt-rohtext',
    fertig?.frageRoh === true,
    fertig?.frageRoh === true ? 'Sternchen der Frage unverändert' : 'Frage wurde gerendert oder fehlt',
  );

  // (b) Stream: ein abgeschlossener Absatz wird gerendert, der laufende bleibt Rohtext.
  const stream = await cdp.evaluate<{ block: number; strong: number; tail: string } | null>(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    p.chatSession.reset();
    p.chatSession.streaming = "";
    p.syncChat();
    await new Promise((r) => setTimeout(r, 300));
    const leaf = app.workspace.getLeavesOfType(${JSON.stringify(VIEW_TYPE)})[0];
    leaf.view.appendChatToken("Erster **Absatz**\\n\\nZwei");
    await new Promise((r) => setTimeout(r, 600));
    const v = ${VIEW_EL};
    const c = v?.querySelector(".kuro-chat-stream-content");
    const out = c ? { block: c.querySelectorAll(".okit-stream-block").length,
      strong: c.querySelectorAll(".okit-stream-block strong").length,
      tail: c.querySelector(".okit-stream-tail")?.textContent ?? "" } : null;
    p.chatSession.streaming = null;
    p.chatSession.reset();
    p.syncChat();
    return out;
  `);
  record(
    'markdown/stream-abgeschlossener-absatz-gerendert',
    stream !== null && stream.block === 1 && stream.strong === 1 && stream.tail === 'Zwei',
    stream === null ? 'keine laufende Zeile im Chat' : `${stream.block} Block, ${stream.strong}× <strong>, Tail „${stream.tail}“`,
  );
}

async function sektionKontextSync(cdp: Cdp): Promise<void> {
  // Der Regress: refreshStatus las die Tagesnotiz neu, der offene Chat-Tab zeigte weiter den
  // alten Stand. Gemessen wird die sichtbare Zeile nach einer echten Änderung der Notiz.
  await setSetting(cdp, 'chatDailyContext', 'tasks');
  await rebuildSidebar(cdp);
  await oeffneChatTab(cdp);
  const lauf = await cdp.evaluate<{ vorher: string; nachher: string } | { fehler: string }>(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const path = p.data.settings.dailyFolder + "/" + d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + ".md";
    const adapter = app.vault.adapter;
    const existierte = await adapter.exists(path);
    const original = existierte ? await adapter.read(path) : null;
    const zeile = () => ${VIEW_EL}?.querySelector(".kuro-chat-context-summary")?.textContent ?? "";
    try {
      await adapter.write(path, "- [ ] smoke-eins\\n");
      await p.refreshStatus(true);
      await new Promise((r) => setTimeout(r, 300));
      const vorher = zeile();
      await adapter.write(path, "- [ ] smoke-eins\\n- [ ] smoke-zwei\\n- [ ] smoke-drei\\n");
      await p.refreshStatus(true);
      await new Promise((r) => setTimeout(r, 300));
      return { vorher, nachher: zeile() };
    } catch (e) {
      return { fehler: String(e) };
    } finally {
      if (existierte) await adapter.write(path, original);
      else await adapter.remove(path);
      await p.refreshStatus(true);
    }
  `);
  if ('fehler' in lauf) {
    record('kontext/zeile-folgt-der-notiz', false, lauf.fehler);
    return;
  }
  const zahl = (text: string): number | null => {
    const m = /\d+/.exec(text);
    return m ? Number(m[0]) : null;
  };
  record(
    'kontext/zeile-folgt-der-notiz',
    zahl(lauf.vorher) === 1 && zahl(lauf.nachher) === 3,
    `„${lauf.vorher}“ → „${lauf.nachher}“ (ohne den Chat-Tab neu zu öffnen)`,
  );
}

async function sektionManager(cdp: Cdp): Promise<void> {
  const fake = await startFakeChat();
  try {
    await installFakeManager(cdp, fake.url);
    // Die lokale Liste zeigt bewusst auf einen toten Port: würde sie befragt, käme kein Aufruf
    // am Fake-Server an.
    await setSetting(cdp, 'chatEndpoints', [{ url: 'http://127.0.0.1:9' }]);
    await setSetting(cdp, 'chatChoice', {});
    await rebuildSidebar(cdp);
    await oeffneChatTab(cdp);

    // Einstellungen: mit Manager statt des lokalen Listen-Editors der Manager-Abschnitt.
    // Modal (< 1.13) oder eigenes Fenster (≥ 1.13) — wie in sektionKontext.
    await cdp.evaluate(`
      await app.setting.open();
      await app.setting.openTabById(${JSON.stringify(PLUGIN_ID)});
      await new Promise((r) => setTimeout(r, 900));
      return true;
    `);
    const settingsText = async (): Promise<string | null> => {
      const imModal = await cdp.evaluate<string | null>(`
        const m = document.querySelector(".modal.mod-settings");
        return m ? m.textContent : null;
      `);
      if (imModal !== null && imModal.includes('Kuro')) return imModal;
      const fenster = await attachTo('settings', PORT);
      if (!fenster) return null;
      const text = await fenster.evaluate<string | null>(`return document.body ? document.body.textContent : null;`);
      fenster.close();
      return text;
    };
    const text = await settingsText();
    await cdp.evaluate(`app.setting.close?.(); return true;`);
    const zeigtManager = text !== null && (text.includes(de['src.managed']) || text.includes(en['src.managed']));
    record(
      'manager/einstellungen-zeigen-den-manager-abschnitt',
      zeigtManager,
      text === null ? 'Einstellungen nicht lesbar' : zeigtManager ? '„Endpunkte kommen vom LLM Endpoint Manager“ sichtbar' : 'Abschnitt fehlt',
    );

    await cdp.evaluate(`
      const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
      p.chatSession.reset();
      await p.askKuro("Hallo");
      return true;
    `);
    const gerendert = await pollUntil<boolean>(
      cdp,
      `return Boolean(${VIEW_EL}?.querySelector(".kuro-chat-assistant .kuro-chat-md strong"));`,
      8000,
    ).catch(() => false);
    record(
      'manager/lauf-nutzt-den-manager-endpunkt',
      fake.calls() === 1,
      `${fake.calls()} Anfrage(n) am Fake-Server, obwohl die lokale Liste auf einen toten Port zeigt`,
    );
    record(
      'manager/modell-kommt-aus-defaultModel-nicht-aus-config',
      fake.lastModel() === MANAGER_DEFAULT_MODEL,
      `gesendet: ${fake.lastModel() ?? 'nichts'}`,
    );
    record(
      'manager/antwort-ist-gerendertes-markdown',
      gerendert === true,
      gerendert === true ? '<strong> im fertigen Eintrag' : 'kein <strong> im Chat nach dem Lauf',
    );

    // Manager weg → lokale Liste wie zuvor.
    await removeFakeManager(cdp);
    await setSetting(cdp, 'chatEndpoints', [{ url: fake.url }]);
    await cdp.evaluate(`
      const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
      p.endpointResolver.invalidate();
      p.chatSession.reset();
      await p.askKuro("Nochmal");
      return true;
    `);
    record(
      'manager/ohne-manager-laeuft-die-lokale-liste',
      fake.calls() === 2,
      `${fake.calls()} Anfragen insgesamt am Fake-Server`,
    );
  } finally {
    await removeFakeManager(cdp);
    await fake.close();
  }
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


/**
 * Abschnitt 8 — Herkunfts-Panel.
 *
 * Warum das hier steht und nicht in den Unit-Tests: die Abbildung Zustand → Klasse
 * ist dort belegt (tests/settings-source-panel.test.ts), aber NICHT, dass die Zeilen
 * im echten Einstellungs-Tab ankommen. Genau diese Sorte Anzeige kann grün sein, ohne
 * ihren Gegenstand je berührt zu haben (_docs/LESSONS.md 2026-08-30).
 */
async function sektionHerkunft(cdp: Cdp): Promise<void> {
  await cdp.evaluate(`
    app.setting.open();
    app.setting.openTabById(${JSON.stringify(PLUGIN_ID)});
    await new Promise((r) => setTimeout(r, 900));
    return true;
  `);

  const messen = (wurzel: string) => `
    const root = ${wurzel};
    if (!root) return null;
    const rows = Array.from(root.querySelectorAll('.kuro-src-row'));
    if (rows.length === 0) return null;
    const stati = Array.from(root.querySelectorAll('.kuro-src-status'));
    return {
      zeilen: rows.length,
      mitGenauEinerKlasse: stati.filter((el) => {
        const treffer = ['is-ok', 'is-warning', 'is-error'].filter((k) => el.classList.contains(k));
        return treffer.length === 1;
      }).length,
      mitLabel: stati.filter((el) => !!el.getAttribute('aria-label')).length,
      status: stati.length,
      texte: Array.from(root.querySelectorAll('.kuro-src-detail')).map((el) => el.textContent).join(' | '),
      namen: Array.from(root.querySelectorAll('.kuro-src-name')).map((el) => el.textContent),
    };
  `;

  interface Panel {
    zeilen: number;
    mitGenauEinerKlasse: number;
    mitLabel: number;
    status: number;
    texte: string;
    namen: string[];
  }

  let mess = await pollUntil<Panel>(cdp, messen('document.querySelector(".modal.mod-settings")'), 3000);
  let quelle = 'Modal im Hauptfenster';
  let fenster: Cdp | null = null;

  if (!mess) {
    fenster = await attachTo('settings', PORT);
    if (fenster) {
      mess = await pollUntil<Panel>(fenster, messen('document.body'), 6000);
      quelle = 'eigenes Einstellungen-Fenster (Obsidian ≥ 1.13)';
    }
  }

  if (!mess) {
    skipped('herkunft/panel-vorhanden', 'Einstellungen-DOM nicht erreichbar');
  } else {
    // Erst den Gegenstand belegen: alle folgenden Punkte wären über null Zeilen grün.
    record(
      'herkunft/panel-vorhanden',
      mess.zeilen === 4,
      `${quelle}: ${mess.zeilen} Zeilen (${mess.namen.join(', ')})`,
    );
    record(
      'herkunft/genau-eine-zustandsklasse',
      mess.status > 0 && mess.mitGenauEinerKlasse === mess.status,
      `${mess.mitGenauEinerKlasse}/${mess.status} mit genau einer aus is-ok/is-warning/is-error`,
    );
    record(
      'herkunft/aria-label',
      mess.status > 0 && mess.mitLabel === mess.status,
      `${mess.mitLabel}/${mess.status} mit aria-label (WCAG 1.4.1: Farbe nie allein)`,
    );
    record(
      'herkunft/kein-roher-code',
      !/src\.reason\./.test(mess.texte),
      mess.texte.slice(0, 110),
    );
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
  // Die `ungeklaert`-Warnung gehört in die Abschlusszeile, nicht nur nach oben ins
  // Protokoll: wer eine Runde fährt, liest die letzte Zeile — und ein Lauf, dessen
  // Herkunft ungeprüft blieb, darf nicht aussehen wie einer, der belegt ist.
  let herkunftsWarnung: string | null = null;

  // Dieselbe Aufraeumarbeit wie im `finally` unten — als eigene Funktion, damit der
  // SIGINT/SIGTERM-Handler sie aufrufen kann, ohne Code zu duplizieren. Ein Ctrl-C mitten
  // im Lauf ueberspringt das `finally` NICHT (try/catch-Semantik), sondern beendet den
  // Node-Prozess sofort — ohne eigenen Handler bleiben die umgestellten Settings
  // (`enableChat`, `chatEndpoints`, `language`) im Smoke-Zustand stehen.
  const cleanupState = async (): Promise<void> => {
    await removeFakeManager(cdp).catch(() => undefined);
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
      console.log(
        zurueck
          ? 'Einstellungen zurückgeschrieben — byte-gleich zum Vorwert.'
          : '⚠️  ABWEICHUNG beim Zurückschreiben der Einstellungen — data.json prüfen!',
      );
    }
  };

  let signalCleanupRunning = false;
  const onAbortSignal = (signal: NodeJS.Signals) => {
    if (signalCleanupRunning) return;
    signalCleanupRunning = true;
    void (async () => {
      console.log(`\n\nAbbruch durch ${signal} — raeume Smoke-Zustand auf...`);
      await cleanupState();
      cdp.close();
      process.exit(130);
    })();
  };
  process.on('SIGINT', onAbortSignal);
  process.on('SIGTERM', onAbortSignal);

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

    const vaultInfo = await cdp.evaluate<{ name: string; basePath: string; configDir: string }>(`
      return {
        name: app.vault.getName(),
        basePath: app.vault.adapter.basePath,
        configDir: app.vault.configDir,
      };
    `);
    console.log(`Vault: ${vaultInfo.name}\n`);

    // Läuft dieser Lauf gegen den eigenen Stand? Die Frage, gegen die `manifest.version`
    // eine Zeile weiter unten strukturell blind ist: Store-Build und Repo-Build tragen
    // dieselbe Nummer. Am 2026-08-30 standen dachweit 69 von 150 grünen Prüfpunkten auf
    // einem Build, der nicht belegt der Repo-Stand war — dieser Treiber war einer davon
    // (16/16 am 28.08. gegen die Store-Installation 1.3.0).
    //
    // Der Pfad kommt aus der LAUFENDEN Instanz, nicht aus `stagingVaultDir(PLUGIN_ID)`.
    // Das ist der Unterschied zum Muster in `tools/obsidian-cdp/README.md` und er ist
    // load-bearing: der Fehllauf lief gegen `10_Pallas`, und ein Check gegen den
    // Staging-Pfad hätte eine ganz andere Datei geprüft — also genau den Fall nicht
    // gesehen, für den er gebaut ist. Geprüft wird, was gemessen wird.
    const pluginDir = join(vaultInfo.basePath, vaultInfo.configDir, 'plugins', PLUGIN_ID);
    requireEigenerBuild(
      join(pluginDir, 'main.js'),
      // Der Vergleichsstand muss frisch sein — `npm run deploy` baut ihn direkt davor.
      // Ohne ihn bleibt nur die billige Aussage (Store-Suffix ja/nein).
      join(cwd(), 'main.js'),
      (meldung) => {
        herkunftsWarnung = meldung;
        console.warn(meldung);
      },
    );

    // Dieselbe Frage für `styles.css`, denn der zentrale Guard kennt nur `main.js` —
    // `npm run deploy` kopiert aber beides. Dieser Treiber misst an mehreren Stellen
    // **gerendertes CSS**: das Chat-Log muss intern scrollen (`scrollHeight > clientHeight`,
    // der Flexbox-Gotcha aus REGISTRY § LLM-Chat-Panel-UI) und Knopf-/Status-Klassen werden
    // über `getComputedStyle` beurteilt. Ein altes Stylesheet neben frischer `main.js`
    // erzeugt dort genau den unbelegten Stand, den der Guard eine Zeile höher gerade
    // ausgeschlossen hat — und er erschiene als Plugin-Befund, nicht als Deploy-Fehler.
    // Übernommen aus json_viewer/scripts/gui-smoke.ts (`4c32757`), dort aus
    // local-image-generator (`e6fbb53`), via REGISTRY § Testing.
    const cssHerkunft = buildHerkunft(join(pluginDir, 'styles.css'), join(cwd(), 'styles.css'));
    if (cssHerkunft.art === 'fehlt') {
      throw new Error(`Im Vault liegt kein styles.css: ${cssHerkunft.pfad}\nZuerst deployen.`);
    }
    if (cssHerkunft.art === 'fremd') {
      const z = (n: number) => n.toLocaleString('de-DE');
      throw new Error(
        `Das styles.css im Vault ist nicht der gebaute Repo-Stand: ${cssHerkunft.pfad}\n` +
        `  im Vault: ${z(cssHerkunft.bytes)} Bytes\n` +
        `  gebaut:   ${z(cssHerkunft.erwarteteBytes)} Bytes\n` +
        'Dieser Lauf misst gerendertes CSS. Zuerst deployen, dann erneut laufen.',
      );
    }

    // Das Plugin NEU LADEN, bevor irgendetwas gemessen wird: `npm run deploy` ersetzt nur
    // die Dateien, die laufende Instanz behält den alten Code im Speicher. Ohne diesen
    // Schritt misst der Smoke den zuletzt geladenen Stand und meldet ihn als Ergebnis für
    // den gerade gebauten — genau so läuft eine kaputte Version grün durch.
    const plugin = await cdp.evaluate<{ ok: boolean; version?: string; aufPlatte?: string }>(`
      const id = ${JSON.stringify(PLUGIN_ID)};
      if (app.plugins.plugins[id]) {
        await app.plugins.disablePlugin(id);
        await new Promise((r) => setTimeout(r, 500));
      }
      await app.plugins.enablePlugin(id);
      await new Promise((r) => setTimeout(r, 1200));
      const p = app.plugins.plugins[id];
      if (!p) return { ok: false };
      // Die Platte getrennt lesen — s. Kommentar unten, warum das nicht dasselbe ist.
      let aufPlatte;
      try {
        const pfad = app.vault.configDir + "/plugins/" + id + "/manifest.json";
        aufPlatte = JSON.parse(await app.vault.adapter.read(pfad)).version;
      } catch { aufPlatte = undefined; }
      return { ok: true, version: p.manifest.version, aufPlatte };
    `);
    if (!plugin.ok) throw new Error(`Plugin ${PLUGIN_ID} ist nicht aktiv. Erst \`npm run deploy\`.`);

    // Zwei Versionen, und sie können auseinanderlaufen — gemessen am 2026-09-02 in genau
    // diesem Vault: Speicher 1.3.0, Platte 1.4.0. `enablePlugin` lädt den CODE neu, das
    // MANIFEST nicht; das liest Obsidian beim Vault-Start. `app.plugins.manifests[id]`
    // sagt dasselbe Alte (beide gegengemessen).
    //
    // Warum das hier steht und nicht bloß kosmetisch ist: die Zeile sah aus wie eine
    // Aussage über die gemessene Datei und war eine über den App-Start. Der Herkunfts-
    // Guard oben prüft `main.js` per sha1 und ist davon unberührt — die Versionszeile ist
    // die dritte Blindstelle derselben Familie und darf nicht als Beleg gelesen werden.
    console.log(`Plugin-Version — Obsidians Speicher: ${plugin.version} · manifest.json auf Platte: ${plugin.aufPlatte ?? 'nicht lesbar'}`);
    if (plugin.aufPlatte !== undefined && plugin.aufPlatte !== plugin.version) {
      console.log(
        '  (Divergenz: Obsidian hat das Manifest beim Vault-Start gelesen und lädt es bei ' +
          'enablePlugin nicht neu. Der gemessene CODE ist trotzdem der deployte — das belegt ' +
          'der sha1-Vergleich oben, nicht diese Nummer.)',
      );
    }
    console.log('');

    // `chatEndpoints === [{ url: SMOKE_ENDPOINT_URL }]` ist eine feste Test-Konfiguration —
    // kein echter Nutzer konfiguriert exakt diese lokale Adresse als einzigen Endpunkt. Ein
    // Rest aus einem per SIGINT/SIGTERM abgebrochenen frueheren Lauf ist daran erkennbar,
    // BEVOR dieser Lauf `vorwert` erfasst — sonst wuerde der Rest als "vorheriger Stand"
    // mitgesnapshotted und am Laufende wiederhergestellt statt entfernt.
    const leftoverEndpoint = await cdp.evaluate<boolean>(`
      const eps = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}].data.settings.chatEndpoints ?? [];
      return eps.length === 1 && eps[0]?.url === ${JSON.stringify(SMOKE_ENDPOINT_URL)};
    `);
    record(
      'vor/kein-liegen-gebliebener-endpunkt',
      !leftoverEndpoint,
      leftoverEndpoint
        ? `Test-Endpunkt ${SMOKE_ENDPOINT_URL} gefunden und entfernt — vermutlich Ctrl-C/Crash im vorigen Lauf vor dessen Aufraeumen; dieser Lauf faehrt normal weiter`
        : 'kein Rest in den Settings',
    );
    if (leftoverEndpoint) {
      await cdp.evaluate(`
        const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
        p.data.settings.chatEndpoints = [];
        await p.persist();
        return true;
      `);
    }

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
    console.log('── 8 · Herkunfts-Panel');
    await sektionHerkunft(cdp);
    console.log('');

    console.log('── 9 · Markdown im Chat');
    await sektionMarkdown(cdp);
    console.log('');
    console.log('── 10 · Kontextzeile folgt der Tagesnotiz');
    await sektionKontextSync(cdp);
    console.log('');
    console.log('── 11 · Endpunkte vom Manager');
    await sektionManager(cdp);
    console.log('');

    console.log('── Nicht mechanisch prüfbar (bleibt Hand-Runde)');
    skipped('ton/stimmt-der-ton', 'Schritt 11 der Checkliste — ob sich Antworten richtig anfühlen, ist keine Messung');
    skipped('stream/zeichenweise', 'braucht einen echten Endpunkt-Lauf; Abbruch und Fehlertext ebenso');
    console.log('');
  } finally {
    // Aufräumen darf nie am Ergebnis hängen: auch ein abgebrochener Lauf gibt den Vault
    // so zurück, wie er ihn vorgefunden hat. Der Chat-Verlauf wird bewusst nicht
    // persistiert, muss also nur im Speicher geleert werden. Dieselbe Funktion wie der
    // SIGINT/SIGTERM-Handler oben — kein Doppelcode.
    process.off('SIGINT', onAbortSignal);
    process.off('SIGTERM', onAbortSignal);
    await cleanupState();
    cdp.close();
  }

  // Die Abschlusszeile trägt mit, worüber der Lauf lief UND was er nicht deckt: wer nur
  // den Exit-Code liest, schlägt keine Dokumentation daneben auf (CORE-TEST-03).
  const failed = results.filter((check) => !check.passed);
  const lueckeed = uebersprungen.length
    ? ` · ${uebersprungen.length} übersprungen (${uebersprungen.join(', ')}) — NICHT geprüft`
    : '';
  console.log(`\n${results.length - failed.length}/${results.length} grün${lueckeed}`);
  if (herkunftsWarnung !== null) {
    console.log('⚠️  Herkunft des gemessenen Builds ungeprüft — s. Warnung oben.');
  }
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
