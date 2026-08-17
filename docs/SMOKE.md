# GUI-Smoke — kuro-gamification

Prüfung gegen ein **laufendes** Obsidian. Unit-Tests decken das Regelwerk der Engines und
die Datenbrücken ab, aber nicht das Settings-Rendering, nicht das Flexbox-Layout der
Seitenleiste und nicht den View-Lebenszyklus — genau dort saßen die drei Funde vom
12.08.2026, und alle drei waren für 362 grüne Tests unsichtbar.

Automatisiert seit **17.08.2026**: `npm run smoke:gui` (CDP-Treiber `scripts/gui-smoke.ts`,
CORE-TEST-02 b). Die Brücke kommt zentral aus `../tools/obsidian-cdp/` und wird importiert,
nicht vendored.

## Vorbereitung

Obsidian muss mit offenem Debug-Port laufen — der einzige Handgriff, der Handarbeit bleibt:

```bash
osascript -e 'quit app "Obsidian"'
open -a Obsidian --args --remote-debugging-port=9222
OBSIDIAN_PLUGIN_DIR="<vault>/.obsidian/plugins/kuro-gamification" npm run deploy
npm run smoke:gui -- --vault <vault-name>
```

Der Treiber lädt das Plugin selbst neu (`disablePlugin`/`enablePlugin`) — ohne das misst er
den zuletzt geladenen Stand und meldet ihn als Ergebnis für den gerade gebauten.

## Was der Treiber prüft

| Abschnitt | Prüfpunkte | Deckt Checklisten-Schritt |
|---|---|---|
| 1 · Aus-Zustand | Ansicht vorhanden · keine Tab-Leiste · Werkzeugleiste unverändert | 1 |
| 2 · Chat einschalten | Schalter **speichert** (über `setControlValue`, nicht am Zustand vorbei) · Wert steht in `data.json` auf Platte · Tab-Leiste erscheint ohne Sidebar-Neuaufbau (`syncChatUI`) | 2 |
| 3 · Einrichtungs-Hinweis | Hinweis erscheint bei leerer Endpunkt-Liste · nennt Sektion **und** Beispieladresse | 2 |
| 4 · Layout | Eingabezeile bleibt im sichtbaren Bereich · Log scrollt intern | 6 |
| 5 · Kontext | Ausklapper vorhanden · **Settings-Vorschau und Ausklapper zeigen dasselbe** | 10 |
| 6 · Sprache | Platzhalter englisch · kein Text aus der deutschen Tabelle im Chat-Panel | 12 |
| 7 · Destruktive Knöpfe | destruktiv markierte Knöpfe vorhanden · farblich abgesetzt (computed style, nicht Klasse) | 13 |

**Bewusst nicht automatisiert** — steht im Protokoll als `übersprungen`, damit die Lücke
nicht wie Abdeckung aussieht:

- **Schritt 11, der Ton.** Ob sich Kuros Antworten richtig anfühlen, ist keine mechanisch
  entscheidbare Frage. Das bleibt die Hand-Runde und ist der eigentliche Prüfstein.
- **Streaming, Abbruch, Fehlertext bei totem Endpunkt** (Schritte 4, 6, 7). Braucht einen
  echten Modell-Lauf; der Treiber würde sonst ein LLM messen, nicht das Plugin.

Der Sprach-Prüfpunkt vergleicht gegen die **echten** Tabellen (`src/i18n/{de,en}.ts` werden
in den Treiber gebündelt), nicht gegen kopierte Zeichenketten — sonst prüft der Smoke einen
eingefrorenen Stand.

## Aufräumen

Der Lauf nimmt einen Schnappschuss von `data.settings`, schreibt ihn im `finally` zurück
und **verifiziert das Ergebnis gegen die Datei auf Platte** (`byte-gleich` / `ABWEICHUNG`
im Protokoll). Der Chat-Verlauf wird ohnehin nicht persistiert, also nur im Speicher
geleert. Trotzdem gilt: vor einem Lauf im produktiven Vault `data.json` sichern — das
`finally` läuft bei Ctrl-C oder einem Absturz des Node-Prozesses nicht mehr.

## Durchläufe

### 2026-08-17 · Erster Lauf · Obsidian 1.13.7 · Plugin 1.1.0 (Stand `6114aef`)

**16/16 grün.** Vault-Einstellungen nach dem Lauf identisch zum Vorwert.

**Gegenprobe** — zweimal gefahren, jeweils den echten historischen Fix ausgebaut, deployt,
Plugin neu geladen:

| Ausgebaut | Ergebnis | Bewertung |
|---|---|---|
| `height:100%` + `overflow:hidden` an `.kuro-view-root` (der Layout-Fix aus `3baba37`) | **14/16** — nur `layout/eingabezeile-sichtbar` (Eingabezeile bei 4854px, Seitenleiste endet bei 475px) und `layout/log-scrollt-intern` rot | genau das historische Symptom |
| `case 'enableChat'` in `SettingsTab.setControlValue` (der Speicher-Bug aus `8b29dd6`) | **14/16** — nur `ein/schalter-speichert` und `ein/schalter-ueberlebt-neustart` rot | genau der historische Defekt, Folge-Abschnitte blieben grün |

### 2026-08-17 · Zwei Mängel im Treiber, die erst die Gegenprobe zeigte

1. **Ein beweglicher Referenzrahmen macht einen Prüfpunkt blind.** Die erste Fassung von
   `layout/eingabezeile-sichtbar` verglich die Unterkante der Eingabezeile mit der des
   **Chat-Bodys** — und der wächst im Defektfall mit dem Verlauf mit. Der Vergleich war
   damit trivial wahr und blieb mit ausgebautem Fix grün. Gemessen wird jetzt gegen den
   Sidebar-Container, der eine feste Höhe hat. Verwandt mit „Prüfpunkt ohne Gegenstand",
   aber eine eigene Sorte: der Gegenstand ist da, nur der Maßstab bewegt sich mit ihm.
2. **Ein bequemer Fallback verhinderte den Fensterwechsel.** Der Knopf-Prüfpunkt suchte
   `".modal.mod-settings" || document.body`. Ab Obsidian 1.13 sind die Einstellungen ein
   **eigenes Fenster**; im Hauptfenster fand der Fallback dann die Knöpfe der Oberfläche,
   meldete „0 destruktive" und las sich wie ein Plugin-Defekt. Ohne Fallback liefert die
   Messung `null`, und der Treiber verbindet sich per `attachTo("settings", …)` auf das
   richtige Fenster — dort sind es 6 Knöpfe, farblich klar abgesetzt.

Beides ist der Grund, warum ein grüner Smoke ohne Gegenprobe nichts beweist: **beide
Mängel hätten dauerhaft grün gemeldet.**
