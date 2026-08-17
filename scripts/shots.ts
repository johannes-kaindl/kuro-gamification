/**
 * README-Bebilderung — nimmt die Bilder aus `docs/images/README.md` (dem Aufnahme-Vertrag)
 * gegen ein **laufendes** Obsidian auf.
 *
 * Die Brücke, die Aufnahme-Primitive und der Vault-Bau kommen zentral aus
 * `../tools/obsidian-cdp/`; im Repo liegt nur das Rezept — welches Bild was zeigt — und
 * das Fixture unter `docs/images/fixture/`.
 *
 * ## Ablauf
 *
 * ```bash
 * npm run build
 * npm run shots -- --setup          # baut den Aufnahme-Vault aus dem Fixture
 * osascript -e 'quit app "Obsidian"'
 * open -a Obsidian --args --remote-debugging-port=9222
 * #   … den Aufnahme-Vault öffnen, beim ersten Mal dem Vault-Autor vertrauen
 * npm run shots                     # alle Bilder
 * npm run shots -- --only chat.png  # eines
 * ```
 *
 * ## Zwei Festlegungen, die im Vertrag begründet stehen
 *
 * 1. **Der Spielstand wird nicht gesetzt.** Level, XP und Streak rechnet Kuro aus den
 *    Daily Notes des Fixtures — `make-dailies.mjs` erzeugt sie relativ zu HEUTE, damit
 *    das Bild nicht den Aufnahmetag dokumentiert. Was im Panel steht, hat das Plugin
 *    ausgerechnet.
 * 2. **Der Chat-Verlauf wird gesetzt, der Rest nicht.** Ein Modell liefert bei jedem Lauf
 *    anderen Text; zwei Aufnahmen sollen dasselbe Bild ergeben. Gesetzt sind nur die
 *    Nachrichten — gerendert wird über den echten Pfad (`chatSession` → `renderChat()`),
 *    und Kontext-Ausklapper, Merkzettel und Layout sind damit echt.
 *
 * Typen: `tsconfig.scripts.json` (im `gate` über `npm run typecheck:scripts`).
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { cwd, env, exit, argv as processArgv } from 'node:process';

import {
  type Cdp,
  attachTo,
  closeExtraLeaves,
  openExisting,
  pollUntil,
  reopenNote,
  setAppConfig,
} from '../../tools/obsidian-cdp/cdp.js';
import { type Rect, boxOf, capture, setWindowSize, withMetrics, writeShot } from '../../tools/obsidian-cdp/shot.js';
import { buildVault, stagingVaultDir } from '../../tools/obsidian-cdp/vault.js';
import { DEFAULT_HABITS_EN } from '../src/data/default-habits';

const REPO_NAME = 'kuro-gamification';
const PLUGIN_ID = 'kuro-gamification';
const VIEW_TYPE = 'kuro-status-view';
const OUT_DIR = 'docs/images';
const CAPTURE_WIDTH = 1200;
const THUMB_WIDTH = 380;
/** Feste Fenstergröße: zwei Läufe auf verschiedenen Displays sollen dieselben Bilder ergeben. */
const FENSTER = { breite: 1440, hoehe: 900 };
/** Breite der rechten Seitenleiste in CSS-Pixeln — fest, damit die ASCII-Box nicht umbricht. */
const SIDEBAR_BREITE = 420;

const argv = processArgv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};

const VIEW_EL = `document.querySelector(".workspace-leaf-content[data-type='${VIEW_TYPE}']")`;

interface Shot {
  name: string;
  /** Klasse nach dem Bild-Standard — steuert, ob ein Vorschaubild entsteht. */
  klasse: 'hero' | 'feature' | 'detail';
  /** Stellt den Zustand her und liefert den Ausschnitt (null = nicht aufnehmbar). */
  run(cdp: Cdp): Promise<Rect | null>;
}

/* ------------------------------------------------------------------ Helfer */



/** Die rechte Seitenleiste aufklappen, auf die Zielbreite bringen und die ERREICHTE
 *  Breite zurückgeben.
 *
 *  Nachprüfen statt nur warten: `setSize` wirkt asynchron und im ersten Aufruf direkt nach
 *  dem Aufklappen gar nicht. Beim ersten Lauf blieb die Leiste bei ~300 px, und die
 *  ASCII-Box war im Hero-Bild rechts abgeschnitten — ein Ruhe-Kriterium hätte das nicht
 *  gefangen, denn der falsche Wert war sofort stabil. */
async function breiteSicherstellen(cdp: Cdp, versuche = 6): Promise<number> {
  let breite = 0;
  for (let i = 0; i < versuche; i++) {
    breite = await cdp.evaluate<number>(`
      const rechts = app.workspace.rightSplit;
      if (rechts) { rechts.expand?.(); rechts.setSize?.(${SIDEBAR_BREITE}); }
      await new Promise((r) => setTimeout(r, 350));
      const el = document.querySelector(".workspace-leaf-content[data-type='${VIEW_TYPE}']");
      return el ? Math.round(el.getBoundingClientRect().width) : 0;
    `);
    if (Math.abs(breite - SIDEBAR_BREITE) <= 20) return breite;
  }
  return breite;
}

/** Kuros Oberfläche auf Englisch stellen.
 *
 *  Bewusst NICHT Obsidians App-Sprache (`localStorage["language"]`): die gilt app-weit
 *  für jeden Vault, verlangt einen Neustart und bliebe nach der Aufnahme im Arbeits-Vault
 *  des Maintainers stehen. Alle Ausschnitte hier zeigen Kuros eigenes DOM; Obsidians
 *  Rahmen ist in keinem davon lesbar. Der Settings-Ausschnitt endet deshalb am
 *  Tab-Inhalt, nicht am Fenster. */
async function spracheEnglisch(cdp: Cdp): Promise<void> {
  // Die Starter-Habits werden beim ersten Start aus OBSIDIANS UI-Sprache geseedet, nicht
  // aus Kuros `language`. Auf einer deutschen Obsidian-Installation standen deshalb im
  // ersten Aufnahme-Lauf deutsche Habit-Labels in einem sonst englischen Einstellungs-Bild
  // (gemessen 2026-08-17). Sie werden hier mitgezogen — aus der echten Tabelle importiert,
  // damit das Rezept nicht gegen kopierte Zeichenketten läuft.
  await cdp.evaluate(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    p.data.settings.language = "en";
    p.data.settings.habits = ${JSON.stringify(DEFAULT_HABITS_EN)};
    await p.persist();
    return true;
  `);
}

/** Die Kuro-Seitenleiste öffnen und auf einen frisch gerechneten Stand bringen. */
async function sidebarBereit(cdp: Cdp): Promise<boolean> {
  await cdp.send('Page.bringToFront');
  await cdp.evaluate(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    for (const leaf of app.workspace.getLeavesOfType(${JSON.stringify(VIEW_TYPE)})) leaf.detach();
    await new Promise((r) => setTimeout(r, 200));
    await p.activateSidebar();
    // Aufklappen und feste Breite: der Aufnahme-Vault startet ohne workspace.json, und
    // ohne Backlinks/Outline ist die rechte Seitenleiste dort EINGEKLAPPT. Der erste Lauf
    // lieferte ein Hero-Bild ganz ohne das Panel — der Lauf meldete Erfolg, das Motiv war
    // verfehlt. Die Breite ist gesetzt, damit die ASCII-Box nicht umbricht.
    const rechts = app.workspace.rightSplit;
    if (rechts) {
      rechts.expand?.();
      rechts.setSize?.(${SIDEBAR_BREITE});
    }
    await p.refreshStatus(true);
    await new Promise((r) => setTimeout(r, 800));
    return true;
  `);
  // Die erreichte Breite NACHPRÜFEN, nicht nur auf Ruhe warten: `setSize` wirkt
  // asynchron und im ersten Aufruf nach dem Aufklappen gar nicht — beim ersten Lauf blieb
  // die Leiste bei ~300 px, und die ASCII-Box war im Hero-Bild rechts abgeschnitten. Ein
  // Ruhe-Kriterium allein hätte das nicht gefangen: der falsche Wert war sofort stabil.
  const breite = await breiteSicherstellen(cdp);
  if (breite < SIDEBAR_BREITE - 20) {
    console.log(`      · Seitenleiste blieb bei ${breite}px statt ${SIDEBAR_BREITE}px — Box kann umbrechen`);
  }
  // Auf den INHALT warten, nicht auf die Ansicht: die Leaf steht sofort, die ASCII-Box
  // erst nach dem Vault-Durchlauf. Ein Bild dazwischen zeigt einen leeren Kasten.
  const da = await pollUntil<boolean>(
    cdp,
    `const pre = ${VIEW_EL}?.querySelector(".kuro-status");
     return Boolean(pre && pre.textContent.trim().length > 40);`,
    20_000,
    400,
  );
  if (!da) console.log('      · Statuspanel blieb leer — rechnet Kuro über die Daily Notes?');
  return Boolean(da);
}

/** Ausschnitt auf die Seitenleiste, an der Fensterkante gekappt.
 *
 *  Zwei Quellen, ein Ausschnitt: der Blatt-Container liefert die richtige Breite (seine
 *  Kante liegt außen), die Fensterhöhe die richtige Untergrenze. Und Obsidians
 *  Statusleiste schwebt über der rechten Sidebar — sie gehört dem Wirt, nicht dem
 *  Plugin, und wird für die Aufnahme ausgeblendet. */
async function sidebarBox(cdp: Cdp): Promise<Rect | null> {
  await cdp.evaluate(`
    if (!document.getElementById("kuro-shot-style")) {
      const s = document.createElement("style");
      s.id = "kuro-shot-style";
      s.textContent = ".status-bar { display: none !important; }";
      document.head.appendChild(s);
    }
    await new Promise((r) => setTimeout(r, 200));
    return true;
  `);
  return boxOf(cdp, `.workspace-leaf-content[data-type='${VIEW_TYPE}']`, 0);
}

/* ------------------------------------------------------------------- Shots */

const SHOTS: Shot[] = [
  {
    // Das Motiv, das das Plugin erklärt: links eine gewöhnliche Notiz, rechts das Panel.
    // Ein Ausschnitt nur auf die Seitenleiste wäre hochformatig (die `feature`-Klasse
    // erlaubt H/B ≤ 1.6) und ließe offen, wo das Ding überhaupt sitzt.
    name: 'hero.png',
    klasse: 'feature',
    async run(cdp) {
      await setAppConfig(cdp, 'livePreview', true);
      if (!(await openExisting(cdp, 'Projects/Acme site relaunch.md', 'preview'))) return null;
      await closeExtraLeaves(cdp);
      if (!(await sidebarBereit(cdp))) return null;
      await sidebarBox(cdp);
      // Ganzes Fenster ohne Clip: `.app-container` schließt die Titelleiste aus und
      // liefert am Rand einen Streifen Wirt-Hintergrund.
      return null2rect(await boxOf(cdp, '.app-container'));
    },
  },
  {
    // Der Companion-Chat. Gesetzter Verlauf (s. Kopfkommentar), echtes Rendering.
    name: 'chat.png',
    klasse: 'feature',
    async run(cdp) {
      await cdp.evaluate(`
        const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
        p.data.settings.enableChat = true;
        p.data.settings.chatEndpoints = [{ url: "http://localhost:1234" }];
        p.data.settings.kuroNotes = ["No streak reminders, please.", "Mornings are for deep work."];
        await p.persist();
        return true;
      `);
      if (!(await sidebarBereit(cdp))) return null;
      await cdp.evaluate(`
        const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
        p.chatSession.reset();
        p.chatSession.append({ role: "user", text: "I have three things left today and no idea where to start." });
        p.chatSession.append({ role: "assistant", text: "Then don't pick the biggest one. Take the task you could finish in ten minutes and let the panel show you the progress — momentum first, order later.\\n\\nWhich of the three is the smallest?" });
        p.chatSession.append({ role: "user", text: "Booking the venue, probably." });
        p.chatSession.append({ role: "assistant", text: "Start there. The other two are still there afterwards, and you will have moved." });
        for (const leaf of app.workspace.getLeavesOfType(${JSON.stringify(VIEW_TYPE)})) leaf.view.renderChat?.();
        await new Promise((r) => setTimeout(r, 300));
        const view = ${VIEW_EL};
        const tabs = view ? [...view.querySelectorAll(".kuro-tab")] : [];
        if (tabs[1]) tabs[1].click();
        await new Promise((r) => setTimeout(r, 500));
        return true;
      `);
      const da = await pollUntil<boolean>(
        cdp,
        `const log = ${VIEW_EL}?.querySelector(".kuro-chat-log");
         return Boolean(log && log.textContent.length > 80);`,
        8000,
      );
      if (!da) return null;
      // Das ganze Fenster, nicht nur die Leiste: der Ausschnitt allein kam auf H/B 2.7
      // und sprengte die `feature`-Grenze von 1.6 — und ein hochkantiger Streifen lässt
      // offen, wo der Chat im Fenster sitzt. Die Notiz daneben erklärt das Plugin besser.
      await sidebarBox(cdp);
      return boxOf(cdp, '.app-container');
    },
  },
  {
    // Der Loot-Dialog. Die Auswahl ist deterministisch (LootEngine seedet aus dem Tag),
    // zwei Läufe am selben Tag zeigen also dasselbe.
    name: 'loot-redeem.png',
    klasse: 'feature',
    async run(cdp) {
      if (!(await sidebarBereit(cdp))) return null;
      await cdp.evaluate(`
        for (const el of document.querySelectorAll(".modal-container")) el.remove();
        app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}].openRedeemModal();
        await new Promise((r) => setTimeout(r, 700));
        return true;
      `);
      const da = await pollUntil<boolean>(
        cdp,
        `const m = document.querySelector(".modal-container .modal");
         return Boolean(m && m.getBoundingClientRect().width > 100);`,
        8000,
      );
      if (!da) return null;
      return boxOf(cdp, '.modal-container .modal', 0);
    },
  },
  {
    // Der `kuro-status`-Codeblock, wie er in einer gewöhnlichen Notiz rendert — das
    // zweite Gesicht des Plugins neben der Seitenleiste.
    name: 'status-block.png',
    klasse: 'feature',
    async run(cdp) {
      await cdp.evaluate(`
        for (const el of document.querySelectorAll(".modal-container")) el.remove();
        return true;
      `);
      await setAppConfig(cdp, 'livePreview', true);
      // Zur Laufzeit, nicht per Fixture-Datei: ein laufendes Obsidian hält seine
      // Konfiguration im Speicher und schreibt sie zurück. Ohne das stand Obsidians
      // Properties-Zeile („Eigenschaft hinzufügen") deutsch im sonst englischen Bild.
      await setAppConfig(cdp, 'propertiesInDocument', 'hidden');
      // NEU öffnen, nicht nur öffnen: steht Welcome.md vom vorigen Lauf noch als aktive
      // Datei, tut `openExisting` nichts — der Block bleibt dann als 0×0-Element im DOM
      // stehen und der Lauf meldet „Zustand kam nicht zustande". Gemessen 2026-08-17:
      // mit `--only` ging der Shot durch, im Sammellauf reproduzierbar nicht.
      if (!(await openExisting(cdp, 'Welcome.md', 'preview'))) return null;
      await reopenNote(cdp, 'Welcome.md', 'preview');
      await closeExtraLeaves(cdp);
      // Die Lesemodus-Ansicht ERZWUNGEN neu rendern. Obsidian hält sie im Cache: im
      // Sammellauf lag der einzige gerenderte Kuro-Block danach in der unsichtbaren
      // CodeMirror-Quelltextansicht (0×0), die sichtbare Preview trug gar keinen — der
      // Lauf meldete "Zustand kam nicht zustande", während er mit --only durchlief.
      // Weder erneutes Öffnen noch reopenNote lösen das; previewMode.rerender(true) tut es.
      await cdp.evaluate(`
        await app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}].refreshStatus(true);
        const leaf = app.workspace.getMostRecentLeaf(app.workspace.rootSplit);
        leaf?.view?.previewMode?.rerender?.(true);
        await new Promise((r) => setTimeout(r, 900));
        return true;
      `);
      // Live Preview rendert einen Codeblock in `.cm-preview-code-block`, NICHT in
      // `.markdown-preview-view` — der erste Lauf wartete deshalb im leeren Container und
      // meldete „Zustand kam nicht zustande", während der Block daneben fertig stand.
      const da = await pollUntil<boolean>(
        cdp,
        `const treffer = [...document.querySelectorAll(".block-language-kuro-status pre.kuro-status")]
           .filter((e) => e.getBoundingClientRect().width > 1);
         return treffer.length > 0 && treffer[0].textContent.trim().length > 40;`,
        15_000,
        400,
      );
      if (!da) {
        // Bei Fehlschlag den Zustand nennen, nicht nur „kam nicht zustande": diese Zeile
        // ersetzt das Raten. Sie steht hier, weil genau dieser Shot im Sammellauf anders
        // ausgeht als mit `--only` — und die Ursache am Zustand hängt, den seine
        // Vorgänger hinterlassen.
        const zustand = await cdp.evaluate<string>(`
          const alle = document.querySelectorAll(".block-language-kuro-status pre.kuro-status");
          const sicht = [...alle].filter((e) => e.getBoundingClientRect().width > 1);
          return JSON.stringify({
            datei: app.workspace.getActiveFile()?.path ?? null,
            bloecke: alle.length,
            sichtbar: sicht.length,
            modale: document.querySelectorAll(".modal-container").length,
            blaetter: app.workspace.getLeavesOfType("markdown").length,
            preview: document.querySelectorAll(".markdown-preview-view").length,
          });
        `);
        console.log(`      · ${zustand}`);
        return null;
      }
      // Zwei Fallen in einem Ausschnitt:
      // (1) Der Rahmen gehört zum LESEmodus. `openExisting(…, "preview")` öffnet die Notiz
      //     dort; `.markdown-source-view .cm-content` ist dann zwar im DOM, aber unsichtbar
      //     — `boxOf` nimmt nur sichtbare Treffer und lieferte `null`. Der Lauf meldete
      //     „Zustand kam nicht zustande", obwohl der Block fertig dastand.
      // (2) Die HÖHE darf nicht vom Sizer kommen: der trägt die Scroll-Höhe der Notiz,
      //     nicht die ihres Inhalts. Das erste Bild war 2811 px hoch und darunter zu zwei
      //     Dritteln leer — und bestand mit H/B 2.34 keine Klassengrenze mehr. Das letzte
      //     sichtbare Kind entscheidet, nicht der Container.
      return cdp.evaluate<Rect | null>(`
        const sizer = [...document.querySelectorAll(".markdown-preview-view .markdown-preview-sizer")]
          .find((e) => e.getBoundingClientRect().width > 1);
        if (!sizer) return null;
        const r = sizer.getBoundingClientRect();
        const kinder = [...sizer.children].filter((e) => e.getBoundingClientRect().height > 0);
        const letztes = kinder[kinder.length - 1];
        if (!letztes) return null;
        const unten = letztes.getBoundingClientRect().bottom;
        return { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: unten - r.y + 16 };
      `);
    },
  },
];

/** `boxOf` liefert `Rect | null`; ein Shot, dessen Ausschnitt fehlt, ist nicht aufnehmbar. */
function null2rect(box: Rect | null): Rect | null {
  return box;
}

/* ------------------------------------------------- Einstellungen (eigenes Fenster) */

/**
 * Der Einstellungs-Tab. Ab Obsidian 1.13 ist das ein **eigenes Fenster** ohne Workspace —
 * über die Sache wählen (`attachTo("settings")`), nie über den lokalisierten Titel.
 *
 * Der Ausschnitt endet am Tab-INHALT, nicht am Fenster: die Kategorien-Spalte links
 * gehört Obsidian und trägt dessen Sprache. Und die Höhe kommt vom letzten Kind, nicht
 * vom Container — im simulierten hohen Fenster ist der Container so hoch wie die
 * Simulation, und der Rest wäre ein Streifen Leere.
 */
async function settingsBild(cdp: Cdp, port: number, outDir: string): Promise<string> {
  await cdp.evaluate(`
    await app.setting.open();
    await app.setting.openTabById(${JSON.stringify(PLUGIN_ID)});
    await new Promise((r) => setTimeout(r, 900));
    return true;
  `);

  const fenster = (await attachTo('settings', port)) ?? cdp;
  try {
    const hoehe = await pollUntil<number>(
      fenster,
      `const c = document.querySelector(".vertical-tab-content");
       return c && c.scrollHeight > 200 ? c.scrollHeight : null;`,
      8000,
    );
    if (!hoehe) return 'settings.png — Einstellungs-Inhalt nicht gefunden';

    // Erst messen, dann so hoch simulieren: eine feste Simulationshöhe schneidet einen
    // langen Tab ab und füllt den Rest schwarz.
    const png = await withMetrics(fenster, 1200, Math.min(hoehe + 80, 6000), async () => {
      await new Promise((r) => setTimeout(r, 600));
      const box = await fenster.evaluate<Rect | null>(`
        const c = document.querySelector(".vertical-tab-content");
        if (!c) return null;
        const r = c.getBoundingClientRect();
        const kinder = [...c.children].filter((e) => e.getBoundingClientRect().height > 0);
        const letztes = kinder[kinder.length - 1];
        const unten = letztes ? letztes.getBoundingClientRect().bottom : r.bottom;
        return { x: r.x, y: r.y, width: r.width, height: Math.max(200, unten - r.y + 16) };
      `);
      if (!box) return null;
      return capture(fenster, box);
    });
    if (!png) return 'settings.png — Ausschnitt kam nicht zustande';

    return await writeShot(fenster, 'settings.png', png, {
      outDir,
      captureWidth: CAPTURE_WIDTH,
      thumbWidth: THUMB_WIDTH,
      thumb: true,
    });
  } finally {
    if (fenster !== cdp) fenster.close();
    await cdp.evaluate(`app.setting.close?.(); return true;`).catch(() => undefined);
  }
}

/* -------------------------------------------------------------------- main */

async function main(): Promise<void> {
  const repoRoot = cwd();
  const outDir = join(repoRoot, OUT_DIR);

  if (argv.includes('--list')) {
    for (const s of SHOTS) console.log(`  ${s.klasse.padEnd(8)} ${s.name}`);
    console.log('  detail   settings.png');
    return;
  }

  if (argv.includes('--setup')) {
    const vaultDir = stagingVaultDir(REPO_NAME);
    console.log(`Aufnahme-Vault: ${vaultDir}`);
    for (const zeile of buildVault({
      repoRoot,
      vaultDir,
      fixtureDir: join(repoRoot, 'docs/images/fixture'),
      generator: 'make-dailies.mjs',
      pluginId: PLUGIN_ID,
    })) {
      console.log(`  ${zeile}`);
    }
    console.log(
      '\n⚠️  Lief Obsidian während dieses Setups, muss es JETZT neu starten. --setup hat\n' +
      '   Notizen, Layout und Plugin-Einstellungen ersetzt; ein laufendes Obsidian hält den\n' +
      '   alten Stand im Speicher und schreibt ihn zurück.\n' +
      '\nObsidian mit offenem Debug-Port starten und diesen Vault öffnen:\n' +
      "  osascript -e 'quit app \"Obsidian\"'\n" +
      '  open -a Obsidian --args --remote-debugging-port=9222\n' +
      'Beim ersten Mal fragt Obsidian, ob es dem Vault-Autor vertraut — bestätigen, sonst\n' +
      'läuft das Plugin nicht und jedes Bild zeigt einen leeren Kasten.',
    );
    return;
  }

  const port = Number(flag('--port') ?? env.SHOTS_PORT ?? 9222);
  const nur = flag('--only');

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const cdp = await attachTo('workspace', port, REPO_NAME);
  if (!cdp) {
    throw new Error(
      `Kein Obsidian-Fenster mit dem Vault "${REPO_NAME}" auf Port ${port}.\n` +
      'Erst `npm run shots -- --setup`, dann Obsidian mit dem Aufnahme-Vault starten.',
    );
  }
  console.log(`Verbunden auf Port ${port}.\n`);
  await cdp.mitschnitt((zeile) => console.log(`      » ${zeile}`));

  await cdp.send('Page.bringToFront');
  await new Promise((r) => setTimeout(r, 2500));

  const groesse = await setWindowSize(cdp, FENSTER.breite, FENSTER.hoehe);
  if (!groesse) console.log('  · Fenstergröße ließ sich nicht setzen — Ausschnitte können abweichen');
  await spracheEnglisch(cdp);

  let ok = 0;
  let fehlend = 0;

  for (const shot of SHOTS) {
    if (nur && shot.name !== nur) continue;
    try {
      const box = await shot.run(cdp);
      const png = box ? await capture(cdp, box) : null;
      if (!png) {
        console.log(`  ✗ ${shot.name} — Zustand kam nicht zustande`);
        fehlend++;
        continue;
      }
      console.log(`  ✓ ${await writeShot(cdp, shot.name, png, {
        outDir,
        captureWidth: CAPTURE_WIDTH,
        thumbWidth: THUMB_WIDTH,
        thumb: shot.klasse === 'detail',
      })}`);
      ok++;
    } catch (err) {
      console.log(`  ✗ ${shot.name} — ${(err as Error).message}`);
      fehlend++;
    }
  }

  if (!nur || nur === 'settings.png') {
    const zeile = await settingsBild(cdp, port, outDir);
    console.log(zeile.includes('nicht') ? `  ✗ ${zeile}` : `  ✓ ${zeile}`);
    if (zeile.includes('nicht')) fehlend++;
    else ok++;
  }

  cdp.close();
  console.log(`\n${ok} Bild(er) geschrieben, ${fehlend} offen.`);
  if (fehlend) exit(1);
}

main().catch((err: Error) => {
  console.error(err.message);
  exit(1);
});
