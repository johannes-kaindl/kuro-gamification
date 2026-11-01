/**
 * Layout-Messung des Chats am Handy (Welle 29, nach dem Muster von settings-assistant `scripts/chat-layout.ts`): Mobil-Emulation 390 × 844 (Faktor 2)
 * ohne und mit der Höhe einer iOS-Tastatur (336 pt), Standardtheme hell und dunkel, Bild und Maße je Zustand. Gemessen wird an der Sache, nicht am DOM:
 * Abstand der Knopfreihe zum unteren Rand, Zeilen Antwort im Verlauf, Tippflächen von Neu, Verlauf, Neu laden und Senden, Überdeckung (Kontextzeile,
 * Modellzeile, Knopfreihe, Eingabe) und die Mittellinie von Modellzeile und Knopfreihe.
 *
 * Der Treiber startet KEINE Instanz: er hängt sich an die laufende Zweitinstanz auf `--port` (Profil und Vault wie im GUI-Smoke, `docs/SMOKE.md`),
 * schaltet die Mobil-Emulation ein, misst und schaltet sie wieder aus. Die reguläre Instanz (9222) fasst er nie an.
 *
 * ```bash
 * UD=/tmp/obs-test-<kürzel>; lsof -nP -iTCP:<PORT> -sTCP:LISTEN        # frei?
 * npm run build && OBSIDIAN_PLUGIN_DIR="$STAGING_VAULTS_DIR/kuro-gamification/.obsidian/plugins/kuro-gamification" npm run deploy
 * /Applications/Obsidian.app/Contents/MacOS/Obsidian --user-data-dir="$UD" --remote-debugging-port=<PORT> &      # PID merken
 * python3 ~/.claude/hooks/obsidian-cdp-lock.py acquire --label kuro-gamification --intent "chat-layout <tag>" --exclusive focus --port <PORT> --ttl 300
 * npm run chat-layout -- --port <PORT> --tag nachher [--out /tmp/kuro-w29]
 * python3 ~/.claude/hooks/obsidian-cdp-lock.py release
 * ```
 *
 * Grenze: die Emulation verkleinert den Viewport um die Tastaturhöhe; sie ersetzt weder das Verhalten von WKWebView noch die Schublade von Obsidian Mobile
 * am Gerät.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { argv, exit } from 'node:process';

import { Cdp, attachTo, bereiteInstanzVor, requireVisible } from '../../tools/obsidian-cdp/cdp.js';
import { startLlmStub } from '../../tools/obsidian-cdp/llm-stub.js';
import { capture } from '../../tools/obsidian-cdp/shot.js';

const PLUGIN_ID = 'kuro-gamification';
const VIEW_TYPE = 'kuro-status-view';
const FAKE_MODEL = 'local-model';
const BREITE = 390;
const HOEHE = 844;
/** iOS-Tastatur mit Vorschlagsleiste, iPhone 6,1 Zoll, hochkant. */
const TASTATUR = 336;

const q = (s: string): string => JSON.stringify(s);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const ANTWORT = [
  'Heute stehen vier Aufgaben an, zwei davon sind schon erledigt. Das reicht für einen guten Anfang, auch wenn sich der Rest zäh anfühlt.',
  '',
  'Wenn du magst, fang mit der kleinsten an: die Steuerunterlagen sortieren dauert zehn Minuten und nimmt den Druck vom Nachmittag.',
  '',
  'Danach hast du schon drei von vier. Ich zähle mit.',
].join('\n');

interface Box { x: number; y: number; w: number; h: number; bottom: number }
interface Messung {
  zustand: string;
  viewport: [number, number];
  isMobile: boolean;
  chat: Box | null; log: Box | null; zeilenhoehe: number; logZeilen: number;
  kontext: Box | null; modellzeile: Box | null; eingabe: Box | null; knopfreihe: Box | null; senden: Box | null; neu: Box | null; verlauf: Box | null; neuLaden: Box | null; statuszeile: Box | null;
  statustext: string;
  /** Verdeckt eine Zeile die andere? Paare der Reihe nach, ein Treffer = Überdeckung > 2 px in beiden Achsen. */
  ueberdeckungen: string[];
  tiefster: number; abstandUnten: number;
  /** Abstand der Mittellinien von Modellzeile und Knopfreihe (gleiche Zeile: Soll unter 1 bei Doppelzeile, sonst 'getrennt'). */
  reihenfolge: string[];
  modellzeileSichtbar: boolean;
  tippflaechen: string[];
}

const MESS_JS = `
  const root = document.querySelector(".workspace-leaf-content[data-type='${VIEW_TYPE}']") || document;
  const r = (sel) => { const el = root.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); if (b.width === 0 && b.height === 0) return null; return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), bottom: +b.bottom.toFixed(1) }; };
  const log = root.querySelector(".okit-chat-log");
  const body = root.querySelector(".okit-stream-body") || log;
  const cs = body ? getComputedStyle(body) : null;
  let lh = cs ? parseFloat(cs.lineHeight) : NaN; if (!Number.isFinite(lh)) lh = cs ? parseFloat(cs.fontSize) * 1.5 : 20;
  const lb = log ? log.getBoundingClientRect() : null;
  const teile = {
    kontext: r(".kuro-chat-context"), modellzeile: r(".okit-model-bar"), eingabe: r(".okit-chat-input"),
    knopfreihe: r(".okit-chat-buttons-start") || r(".okit-chat-buttons"), senden: r(".okit-chat-send"), neu: r(".okit-chat-new"),
    verlauf: r(".okit-chat-archive"), neuLaden: r(".okit-model-bar-refresh"), statuszeile: r(".okit-chat-statusbar"),
  };
  const namen = [["Kontext", "kontext"], ["Modellzeile", "modellzeile"], ["Eingabe", "eingabe"], ["Knopfreihe", "knopfreihe"], ["Statuszeile", "statuszeile"], ["Senden", "senden"]];
  const paare = [];
  const lage = namen.map(([n, k]) => [n, teile[k]]).filter(([, b]) => b);
  for (let i = 0; i < lage.length; i++) for (let j = i + 1; j < lage.length; j++) {
    const a = lage[i][1], b = lage[j][1];
    if (lage[i][0] === "Knopfreihe" && lage[j][0] === "Senden") continue;
    const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), dy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
    if (dx > 2 && dy > 2) paare.push(lage[i][0] + "/" + lage[j][0] + " " + dx.toFixed(0) + "x" + dy.toFixed(0));
  }
  const reihe = [["Kontext", teile.kontext], ["Verlauf", r(".okit-chat-log")], ["Modellzeile", teile.modellzeile], ["Eingabe", teile.eingabe], ["Knopfreihe", teile.knopfreihe], ["Statuszeile", teile.statuszeile]]
    .filter(([, b]) => b).sort((a, b) => a[1].y - b[1].y).map(([n, b]) => n + "@" + Math.round(b.y));
  const unten = Object.values(teile).filter(Boolean).map((b) => b.bottom);
  const tiefster = unten.length ? Math.max(...unten) : 0;
  const bar = root.querySelector(".okit-model-bar");
  const sichtbar = bar ? getComputedStyle(bar).visibility !== "hidden" && bar.getBoundingClientRect().height > 0 : false;
  const flaeche = ([n, k]) => teile[k] ? n + " " + teile[k].w + "x" + teile[k].h : n + " —";
  return {
    viewport: [innerWidth, innerHeight], isMobile: document.body.classList.contains("is-mobile"),
    chat: r(".okit-chat"), log: r(".okit-chat-log"), zeilenhoehe: +lh.toFixed(2), logZeilen: lb ? +(lb.height / lh).toFixed(1) : 0,
    ...teile, statustext: (root.querySelector(".okit-chat-status")?.textContent || "").trim(),
    ueberdeckungen: paare, tiefster, abstandUnten: +(innerHeight - tiefster).toFixed(1), reihenfolge: reihe,
    modellzeileSichtbar: sichtbar,
    tippflaechen: [["Neu", "neu"], ["Verlauf", "verlauf"], ["Neu laden", "neuLaden"], ["Senden", "senden"]].map(flaeche),
  };
`;

async function messe(cdp: Cdp, zustand: string): Promise<Messung> {
  const m = await cdp.evaluate<Omit<Messung, 'zustand'>>(MESS_JS);
  return { zustand, ...m };
}

function kurz(m: Messung): string {
  const b = (x: Box | null): string => (x ? `${x.y}–${x.bottom}` : '—');
  return [
    `${m.zustand}: Viewport ${m.viewport.join('×')} mobil ${String(m.isMobile)}`,
    `  Abstand Knopfreihe/Eingabe zum unteren Rand ${m.abstandUnten} px (tiefstes Element bis ${m.tiefster}; Chat ${b(m.chat)})`,
    `  Antwortbereich ${m.log?.h ?? '—'} px = ${m.logZeilen} Zeilen à ${m.zeilenhoehe} px`,
    `  Kontext ${b(m.kontext)} · Modellzeile ${b(m.modellzeile)} (sichtbar ${String(m.modellzeileSichtbar)}) · Eingabe ${b(m.eingabe)} · Knopfreihe ${b(m.knopfreihe)} · Statuszeile „${m.statustext}“ ${b(m.statuszeile)}`,
    `  Tippflächen (Breite×Höhe px): ${m.tippflaechen.join(' · ')}`,
    `  Überdeckungen: ${m.ueberdeckungen.length === 0 ? 'keine' : m.ueberdeckungen.join('; ')}`,
    `  Reihenfolge von oben: ${m.reihenfolge.join(' > ')}`,
  ].join('\n');
}

function flag(name: string): string | undefined {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

async function haenge(port: number): Promise<Cdp> {
  for (let i = 0; i < 40; i++) {
    const cdp = await attachTo('workspace', port, PLUGIN_ID).catch(() => null);
    if (cdp) return cdp;
    await sleep(1000);
  }
  throw new Error(`Kein Obsidian-Fenster für Vault "${PLUGIN_ID}" auf Port ${port}.`);
}

async function main(): Promise<void> {
  const port = Number(flag('--port'));
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('--port <1024-65535> ist Pflicht (9222 gehört der regulären Instanz).');
  const tag = flag('--tag') ?? 'lauf';
  const out = flag('--out') ?? '/tmp/kuro-w29';
  mkdirSync(out, { recursive: true });

  const stub = await startLlmStub({ models: [FAKE_MODEL], standard: { text: ANTWORT, teile: 2, model: FAKE_MODEL } });
  let cdp: Cdp | null = null;
  const messungen: Messung[] = [];
  const setze = async (c: Cdp): Promise<void> => {
    await c.evaluate(`
      const p = app.plugins.plugins[${q(PLUGIN_ID)}];
      p.data.settings.enableChat = true;
      p.data.settings.chatEndpoints = [{ url: ${q(stub.url)}, model: ${q(FAKE_MODEL)} }];
      p.data.settings.chatChoice = {};
      p.data.settings.chatKeep = 20;
      p.llm.invalidate();
      await p.persist();
      return true;
    `);
  };
  try {
    cdp = await haenge(port);
    await sleep(1500);
    await bereiteInstanzVor(cdp, { pluginIds: [PLUGIN_ID], nurVault: PLUGIN_ID, sprache: 'en' });
    await setze(cdp);

    // Mobil-Emulation: lädt Obsidian neu (der Aufruf endet mit „Execution context was destroyed“), danach neu anhängen.
    await cdp.evaluate(`app.emulateMobile(true); return true;`).catch(() => undefined);
    try { cdp.close(); } catch { /* Kontext schon weg */ }
    await sleep(4000);
    cdp = await haenge(port);
    await requireVisible(cdp);
    await bereiteInstanzVor(cdp, { pluginIds: [PLUGIN_ID], nurVault: PLUGIN_ID, sprache: 'en' });
    await setze(cdp);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: BREITE, height: HOEHE, deviceScaleFactor: 2, mobile: true });
    await sleep(1200);
    if (!(await cdp.evaluate<boolean>(`return document.body.classList.contains("is-mobile");`))) throw new Error('is-mobile nach emulateMobile(true) nicht gesetzt');

    // Seitenleiste mit dem Chat-Tab öffnen, eine Runde führen.
    await cdp.evaluate(`
      for (const l of app.workspace.getLeavesOfType(${q(VIEW_TYPE)})) l.detach();
      await app.plugins.plugins[${q(PLUGIN_ID)}].activateSidebar();
      await new Promise((r) => setTimeout(r, 900));
      const v = document.querySelector(".workspace-leaf-content[data-type='${VIEW_TYPE}']");
      const tabs = v ? [...v.querySelectorAll(".okit-hub-tab")] : [];
      if (tabs[1]) tabs[1].click();
      await new Promise((r) => setTimeout(r, 500));
      return true;
    `);
    const da = await cdp.evaluate<boolean>(`for (let i = 0; i < 40 && !document.querySelector(".okit-chat-input"); i++) await new Promise((r) => setTimeout(r, 250)); return !!document.querySelector(".okit-chat-input");`);
    if (!da) throw new Error('Chat-Ansicht öffnet sich nicht (kein .okit-chat-input)');
    await cdp.evaluate(`
      const input = document.querySelector(".okit-chat-input"); input.value = "Was steht heute an?";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector(".okit-chat-send").click(); return true;
    `);
    const fertig = await cdp.evaluate<boolean>(`for (let i = 0; i < 80; i++) { const a = app.plugins.plugins[${q(PLUGIN_ID)}].chatHistory.entries.filter((x) => x.kind === "assistant"); const l = a[a.length - 1]; if (l && l.state !== "streaming") break; await new Promise((r) => setTimeout(r, 250)); } await new Promise((r) => setTimeout(r, 800)); return !!document.querySelector(".okit-chat-turn.is-assistant");`);
    if (!fertig) throw new Error('die Antwort kam nicht zustande');

    for (const [schema, name] of [['moonstone', 'hell'], ['obsidian', 'dunkel']] as const) {
      await cdp.evaluate(`app.vault.setConfig("theme", ${q(schema)}); app.updateTheme(); app.workspace.trigger("css-change"); await new Promise((r) => setTimeout(r, 600)); return true;`);
      for (const mitTastatur of [false, true]) {
        const hoehe = mitTastatur ? HOEHE - TASTATUR : HOEHE;
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: BREITE, height: hoehe, deviceScaleFactor: 2, mobile: true });
        await cdp.evaluate(mitTastatur ? `document.querySelector(".okit-chat-input")?.focus(); return true;` : `document.activeElement?.blur?.(); return true;`);
        await sleep(900);
        const zustand = `${tag}-${name}-${mitTastatur ? 'tastatur' : 'ohne'}`;
        const m = await messe(cdp, zustand);
        messungen.push(m);
        console.log(kurz(m));
        const pfad = join(out, `${zustand}.png`);
        writeFileSync(pfad, await capture(cdp, undefined, 1));
        console.log(`  Bild ${pfad}`);
      }
    }
    writeFileSync(join(out, `${tag}-messung.json`), JSON.stringify(messungen, null, 2));
  } finally {
    if (cdp) {
      await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => undefined);
      // Das Profil behält die Emulation (localStorage): zurückstellen, sonst startet der nächste Lauf mobil.
      await cdp.evaluate(`app.vault.setConfig("theme", "moonstone"); app.emulateMobile(false); return true;`).catch(() => undefined);
      await sleep(1500);
      cdp.close();
    }
    await stub.stop().catch(() => undefined);
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  exit(1);
});
