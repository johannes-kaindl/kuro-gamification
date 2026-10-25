# GUI-Smoke — kuro-gamification

Prüfung gegen ein **laufendes** Obsidian. Unit-Tests decken das Regelwerk der Engines und
die Datenbrücken ab, aber nicht das Settings-Rendering, nicht das Flexbox-Layout der
Seitenleiste und nicht den View-Lebenszyklus — genau dort saßen die drei Funde vom
12.08.2026, und alle drei waren für 362 grüne Tests unsichtbar.

Automatisiert seit **17.08.2026**: `npm run smoke:gui` (CDP-Treiber `scripts/gui-smoke.ts`,
CORE-TEST-02 b). Die Brücke kommt zentral aus `../tools/obsidian-cdp/` und wird importiert,
nicht vendored.

## Vorbereitung

Der Lauf gehört in eine **Zweitinstanz** mit eigenem Profil und eigenem Port; die reguläre Instanz (9222) wird weder genutzt noch beendet, ein Quit träfe die Sitzungen anderer. Der Port ist Pflicht (`--port`), der Treiber hat keinen Default und bricht ohne ihn mit Exit 2 ab. Das vollständige Rezept steht im Kopf von `scripts/gui-smoke.ts` (Profil, `.asar` der regulären Instanz, `obsidian.json` mit dem Staging-Vault und `"language":"en"`, Lock je Port). Vertrauensdialog und Restricted Mode eines frischen Profils erledigt der Treiber selbst (`bereiteInstanzVor`, nur im Staging-Vault `kuro-gamification`).

```bash
UD=/tmp/obs-test-kuro-gamification; mkdir -p "$UD"
lsof -nP -iTCP:9401 -sTCP:LISTEN && echo "Port belegt — anderen nehmen"
OBSIDIAN_PLUGIN_DIR="$STAGING_VAULTS_DIR/kuro-gamification/.obsidian/plugins/kuro-gamification" npm run deploy
/Applications/Obsidian.app/Contents/MacOS/Obsidian --user-data-dir="$UD" --remote-debugging-port=9401 &
python3 ~/.claude/hooks/obsidian-cdp-lock.py acquire --label kuro-gamification --intent "GUI-Smoke :9401" --exclusive focus --port 9401 --ttl 300
npm run smoke:gui -- --port 9401
python3 ~/.claude/hooks/obsidian-cdp-lock.py release
```

Zwei Schalter: `--echtes-modell` fährt den Punkt `stream/echter-endpunkt-liefert-tokens-einzeln` gegen ein geladenes Modell (ohne ihn ist er übersprungen, LM-Regel Welle 21: kein Lauf lässt ein Modell rechnen). `--folge-gegenprobe` hängt einen Beobachter an den Chat-Log, der nach jeder Änderung ans Ende scrollt; dann muss genau `stream/folge-regel-respektiert-hochscrollen` rot werden (gemessen 2026-10-14: scrollTop 0 → 140/160/160). Ctrl-C räumt über das Abbruch-Modul der Brücke auf (Einstellungen zurück, Bilanz, Exit 130).

Die letzte Zeile zählt in vier Zuständen (grün · rot · übersprungen · nichts gemessen) gegen die Soll-Liste `PUNKTE`. **Übersprungen** ist nur, was nicht messbar ist (der Ton). **Nichts gemessen** ist, wo der Gegenstand nicht erreicht wurde (kein Modell geladen für `stream/echter-endpunkt`, Oberfläche nicht gefunden, Messung abgebrochen) und setzt wie Rot Exit 1. Abbruch vor der Messung ist Exit 2.

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
| 9b · Chat-Fenster und Modellzeile | Modellzeile (Dropdown aus den Modellen des Endpunkts, Wechsel erreicht die nächste Anfrage, Sperre im Lauf) · Escape bricht ab · Fehlerzeile mit Begründung des Servers bei HTTP-Fehler · „merk dir“ geht nicht ans Modell · Linkschutz (**bekannter Befund, rot**, s. u.) | — |
| 9c · Zwei Blätter, je ein Chat | zwei Blätter (`workspace.duplicateLeaf`), Frage in A, Frage in B, Chat-Schalter in den Einstellungen aus und an: jedes Blatt behält seine eigene Runde (Welle 27, Variante B) | — (neu in Welle 27) |

**Bewusst nicht automatisiert** — steht im Protokoll als `übersprungen` (der Ton) bzw. `nichts gemessen` (ohne geladenes Modell), damit die Lücke
nicht wie Abdeckung aussieht:

- **Schritt 11, der Ton.** Ob sich Kuros Antworten richtig anfühlen, ist keine mechanisch
  entscheidbare Frage. Das bleibt die Hand-Runde und ist der eigentliche Prüfstein.
- **Streaming, Abbruch und Fehlertext gegen ein echtes Modell** (Schritte 4, 6, 7). Der Treiber fährt sie gegen einen LLM-Stub (Abschnitte 9b, 16, 17); ein echtes Modell rechnet nur mit `--echtes-modell`, sonst würde der Treiber ein LLM messen, nicht das Plugin.

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

### 2026-10-24 · Welle 26: Chat-Fenster und Modellzeile aus dem Kit (Plugin 1.15.0 → 1.16.0, Obsidian 1.14.5)

**Baseline am Stand `2189874`:** 55 grün · 0 rot · 5 übersprungen · 0 nichts gemessen von 60 Punkten. **Nach dem Umbau:** 62 grün · 1 rot · 5 übersprungen · 0 nichts gemessen von 68 Punkten (113 s). Die fünf übersprungenen sind dieselben (echter Endpunkt ohne `--echtes-modell`, zwei Denkblock-Opt-outs, Erreichbarkeits-Gegenprobe in dieser Lage nicht anwendbar, Ton).

Der Treiber bedient das Fenster wie ein Nutzer (tippt ins `.okit-chat-input`, klickt `.okit-chat-send`, „Neu“ ist `.okit-chat-new`); Verläufe für Layout, Markdown und Bild entstehen als `chat-history`-Daten über `syncChatUI()`, nicht über ein Test-API am Plugin. Sieben Punkte sind neu (`setup/wechselt-nach-eintrag-in-den-chat`, `chat/merk-dir-geht-nicht-ans-modell`, `chat/escape-bricht-ab`, `chat/fehlerzeile-bei-http-fehler`, `chat/linkschutz-skript-schemata`, drei unter `modellzeile/`).

**Der rote Punkt ist ein bekannter Befund, kein Fehler dieses Umbaus.** Eine Antwort mit sechs Links, am echten Fenster gemessen: `javascript:` und `data:` verlieren ihr `href`, `obsidian://`, `file://` und `app://` behalten es, `https` bleibt. Dieselbe Probe am Tag 1.15.0 (altes Panel, `neutralizeModelMarkdown` + `MarkdownRenderer.render`) liefert dasselbe Ergebnis: der Stand ist unverändert. Der Punkt bleibt rot, bis der Kit-Task „Linkschutz in Modellantworten“ (Welle 27) den Schutz im Fenster hat.

**Gegenprobe (Mutanten):** drei Fehler gleichzeitig eingebaut (`disabled: () => false` in der Modellzeile, `refresh()` ohne Zustandswechsel, `handleChatCommand` immer `false`) → genau `modellzeile/gesperrt-waehrend-des-laufs`, `setup/wechselt-nach-eintrag-in-den-chat` und `chat/merk-dir-geht-nicht-ans-modell` wurden rot (59 grün · 4 rot, der vierte ist der bekannte Linkschutz), sonst nichts. Der erste Versuch scheiterte am Typcheck des Mutanten; `requireEigenerBuild` brach den Lauf ab, statt einen alten Build zu messen.
