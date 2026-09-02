# GUI-Smoke — kuro-gamification

Prüfung gegen ein **laufendes** Obsidian. Unit-Tests decken das Regelwerk der Engines und
die Datenbrücken ab, aber nicht das Settings-Rendering, nicht das Flexbox-Layout der
Seitenleiste und nicht den View-Lebenszyklus — genau dort saßen die drei Funde vom
12.08.2026, und alle drei waren für 362 grüne Tests unsichtbar.

Automatisiert seit **17.08.2026**: `npm run smoke:gui` (CDP-Treiber `scripts/gui-smoke.ts`,
CORE-TEST-02 b). Die Brücke kommt zentral aus `../tools/obsidian-cdp/` und wird importiert,
nicht vendored.

## Vorbereitung

⚠️ **Zuerst prüfen, wer sonst an Obsidian hängt.** Obsidian ist Single-Instance — ein
`quit` trifft die Instanz, an der möglicherweise eine andere Session arbeitet, und zerstört
deren Zustand. Der eigene Lauf ist danach sauber grün; der Schaden entsteht woanders und
fällt nicht auf.

```bash
lsof -nP -iTCP:9222 -sTCP:LISTEN >/dev/null && echo "läuft bereits — NICHT beenden"
```

Hört der Port schon, dann **mitnutzen statt neu starten**: ein eigenes Fenster per
`vault-open` über IPC öffnen, dann `attachTo("workspace", port, vault)` — der Vault-Name
wählt, nicht die Reihenfolge. ⚠️ Die Port-Prüfung ersetzt die Frage nicht: sie zeigt aktive
CDP-Treiber, aber nicht, wer ein Fenster offen hält oder auf den Port wartet.

Erst wenn nichts läuft — oder nach Absprache mit dem, der es benutzt — gilt das Rezept unten.

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

### 2026-09-02 · Bestätigungslauf nach dem Vendor-Nachzug · Plugin 1.4.0 (Stand `71e1a3a`)

**20/20 grün**, 2 übersprungen (`ton/stimmt-der-ton`, `stream/zeichenweise` — beide bleiben
Hand-Runde). Einstellungen nach dem Lauf byte-gleich zum Vorwert. Anlass war der Umbau des
Vendorings auf zwei Quellen (`code-kit@0.5.0` + `obsidian-kit@0.29.0`); berührt war die
Render-Oberfläche über `endpoint-list.ts`, dessen `globalModel`/`emptyModelLabel` von Pflicht
auf optional gelockert wurden — für einen Konsumenten **mit** globalem Modell verhaltensgleich,
und genau das bestätigt der Lauf.

**`styles.css` wird jetzt mitgeprüft.** Der zentrale `requireEigenerBuild` kennt nur `main.js`,
`npm run deploy` kopiert aber beides. Dieser Treiber misst an mehreren Stellen **gerendertes
CSS** — `layout/log-scrollt-intern` (`scrollHeight > clientHeight`, der Flexbox-Gotcha aus
REGISTRY § LLM-Chat-Panel-UI) und `destruktiv/farblich-abgesetzt` über `getComputedStyle`. Ein
altes Stylesheet neben frischer `main.js` erzeugt dort denselben unbelegten Stand, den der
Guard eine Zeile höher gerade ausgeschlossen hat — und er erschiene als **Plugin**-Befund, nicht
als Deploy-Fehler. Übernommen aus `json_viewer` (`4c32757`), dort aus `local-image-generator`
(`e6fbb53`).

Gegenprobe, alle drei Ausgänge einzeln provoziert:

| Zustand im Vault | `buildHerkunft` | Verhalten |
|---|---|---|
| unverändert | `deployt` | Lauf geht durch |
| Kommentar angehängt (16.166 statt 16.144 Bytes) | `fremd` | Abbruch mit beiden Größen |
| Datei entfernt | `fehlt` | Abbruch mit Pfad |

### 2026-09-02 · Die eigentliche Abnahme des Herkunfts-Guards: ein Lauf gegen ein FREMDES Fenster

Die Gegenproben vom Vormittag (manipuliertes `main.js` → Abbruch) belegen, dass
`requireEigenerBuild` **funktioniert**. Sie belegen **nicht**, dass der Prüfgegenstand aus der
laufenden Instanz kommt — genau die Korrektur, wegen der dieser Treiber vom Muster im
Brücken-README abweicht. Dafür braucht es einen Lauf, der an ein fremdes Fenster andockt:

```
npm run smoke:gui -- --vault koda-agent
→ Abbruch: Im Vault liegt keine main.js:
  $STAGING_VAULTS_DIR/koda-agent/.obsidian/plugins/kuro-gamification/main.js
```

Der Pfad trägt **`koda-agent`** (hier gekürzt — der Lauf zeigt ihn absolut), nicht `kuro-gamification`. Ein Check gegen
`stagingVaultDir(PLUGIN_ID)` hätte hier die gültige `main.js` im *eigenen* Staging-Vault
geprüft und wäre **grün durchgelaufen**, obwohl der Lauf gegen ein fremdes Fenster ging — also
genau der Fall, für den der Guard gebaut wurde. *Verfahren angeregt von der `llm-lab`-Session,
die es am selben Tag unabhängig fuhr; hier nachgemessen, nicht übernommen.*

### 2026-09-02 · Was die Warteschlange am CDP-Lock gekostet hat

Der Lauf stand rund zweieinhalb Stunden aus, weil der Lock durchgehend von anderen Sessions
gehalten wurde (`paperless-storage` → `koda-agent` → `obsidian-transmute` → `json_viewer` →
`llm-lab` → `obsidian-transmute` → `koda-agent`). Zwei praktische Lehren:

- **`acquire` pollen, nicht `status`.** Wer den freien Zustand *sieht* und dann greift, verliert
  gegen den, der ununterbrochen greift — hier zweimal passiert, einmal binnen 30 Sekunden.
- **Der Guard hätte den Lauf durchgelassen** (`PROTECTED_KINDS["focus"] = {quit, focus}`, das
  Kommando matcht nur `ACCESS_PATTERN`) — trotzdem wäre er falsch gewesen: `clickReal` reißt ein
  Fenster nach vorn und zerstört genau die fremde Messung, die ein `focus`-Lock schützt. Der
  Guard sieht das nicht, weil der Aufruf im gebündelten Treiber steckt und nicht im
  Kommandotext. **Text-Matching kann Absicht nicht prüfen; die Zurückhaltung muss von der
  Session kommen.**
