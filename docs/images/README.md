# Aufnahme-Vertrag — README-Bilder

Dieser Ordner hält die Bilder, die `README.md` und `README.de.md` einbetten. Diese Datei ist
der **Vertrag** dafür: welche Bilder es gibt, was jedes zeigen muss, in welcher Klasse es
steht — und wie man sie reproduzierbar neu aufnimmt.

Geprüft wird das automatisch: `npm run shots:check` (Workspace-Werkzeug `readme_lint.py`)
gleicht **Vertrag ↔ Dateien ↔ README-Einbettungen** in alle Richtungen ab. Ein Eintrag ohne
Datei, eine Datei ohne Eintrag und eine Einbettung ohne Vertragszeile sind je ein Befund.

## Die Bilder

| Datei | Klasse | referenziert von | muss zeigen |
|---|---|---|---|
| `hero.svg` | — | README (EN+DE), ganz oben | Das gezeichnete Banner. Kein Screenshot, bleibt von Hand gepflegt. |
| `hero.png` | feature | README (EN+DE), § Features | Das ganze Fenster: eine gewöhnliche Notiz links, das Kuro-Panel rechts. Die ASCII-Box **vollständig** — Level, Titel, Gesamt-XP, Fortschrittsbalken, Streak mit Freeze-Tokens, heutiger Stand. Darunter Loot-Box und Lore-Fragment. |
| `chat.png` | feature | README (EN+DE), § Companion chat | Dasselbe Fenster mit geöffnetem Chat-Tab: Tab-Leiste (Status · Chat), Modellzeile („Chat“ mit Modell-Dropdown), Kontext-Ausklapper („Kuro currently sees …"), ein Gespräch aus acht Nachrichten mit den Namen „You“ an den Fragen und „Kuro“ an den Antworten (die Fläche unter dem Gespräch darf nicht leer stehen, `readme_lint` misst Weißraum), Eingabefeld mit „Send“ und „New“ **am unteren Rand**. |
| `status-block.png` | feature | README (EN+DE), § Status code block | Der `kuro-status`-Codeblock, wie er in einer gewöhnlichen Notiz rendert — mit erklärendem Text darüber und dem Lore-Callout darunter. |
| `loot-redeem.png` | feature | README (EN+DE), § Features | Der Einlös-Dialog: drei Signale mit Tier-Symbol und Kategorie, Abbrechen/Einlösen. |
| `settings.png` | detail | README (EN+DE), § Configuration — als 380-px-Vorschau aus `thumbs/`, verlinkt auf die Vollauflösung | Der Einstellungs-Tab **ganz**, alle vierzehn Abschnitte von „General" bis „About". Zu hoch für eine Inline-Einbettung (H/B 7.0) — deshalb Vorschau mit Bildunterschrift. |

## Reproduzieren

Aufgenommen wird in einer **Zweitinstanz** mit eigenem Profil und eigenem Port; die reguläre Instanz (9222) wird nie angefasst und nie beendet. Der Port ist Pflicht (`--port` oder `SHOTS_PORT`, Wert dieses Rezepts: 9401), es gibt keinen Standardport. Das Rezept steht im Kopf von `scripts/shots.ts` (Profil, `.asar`, `obsidian.json` mit dem Vault und `"language":"en"`, Lock je Port).

```bash
npm run build
npm run shots -- --setup        # baut den Aufnahme-Vault aus docs/images/fixture/
UD=/tmp/obs-test-kuro-gamification; mkdir -p "$UD"
lsof -nP -iTCP:9401 -sTCP:LISTEN && echo "Port belegt — anderen nehmen"
/Applications/Obsidian.app/Contents/MacOS/Obsidian --user-data-dir="$UD" --remote-debugging-port=9401 &
#   … beim ersten Mal dem Vault-Autor vertrauen (Vault: STAGING_VAULTS_DIR/kuro-gamification)
npm run shots -- --port 9401    # alle Bilder
npm run shots -- --port 9401 --only chat.png
npm run shots:check             # Vertrag ↔ Dateien ↔ README
```

Der Vault entsteht unter `$STAGING_VAULTS_DIR/kuro-gamification` — die Variable ist Pflicht;
ein fest eingebauter Pfad wäre für jeden außer einer Person falsch (und `check-no-abs-paths`
verbietet ihn zu Recht).

## Was der Lauf voraussetzt

- **Ein laufendes Obsidian mit offenem Debug-Port**, im Aufnahme-Vault. Kein LM Studio: der
  Chat-Verlauf wird gesetzt, nicht generiert (s. u.), und die Modellzeile fragt einen LLM-Stub der Brücke mit zwei Modellnamen (`kuro-demo`), nie einen echten Server.
- **Sonst nichts.** Kein Modell, kein Server, keine Zugangsdaten.
- **Obsidians Oberfläche auf Englisch, bevor `--setup` läuft** (`obsidian.json` `"language": "en"` und `localStorage["language"]`). Der erste Plugin-Start übernimmt die Obsidian-Sprache als Kuro-Sprache; in einer deutschen Instanz zeigt der Einstellungs-Tab trotz `language = "en"` im Rezept deutsche Texte (gemessen 2026-10-10).
- **Höhe des Einstellungs-Bilds:** `settingsBild` simuliert höchstens 7600 px; mit 14 Abschnitten reichen die früheren 6000 nicht mehr und das Bild endet in Leere vor „Notes“.

## Zwei Festlegungen, die das Ergebnis bestimmen

**1. Der Spielstand wird nicht gesetzt — er wird gerechnet.** `fixture/make-dailies.mjs`
erzeugt vierzehn Daily Notes relativ zu **heute**, mit Checkboxen und Habit-Frontmatter.
Level, Gesamt-XP, Streak und Tagesstand im Bild hat Kuro daraus selbst ausgerechnet; kein
Wert im Treiber ist gesetzt. Feste Datumsangaben wären am Tag nach dem Commit eine
abgerissene Streak — das Bild dokumentierte dann den Aufnahmetag statt das Plugin.

**2. Der Chat-Verlauf wird gesetzt, gerendert wird echt.** Die acht Nachrichten in `chat.png` stehen im Rezept als `chat-history`-Daten. Ein Modell liefert bei jedem Lauf anderen Text, und zwei Aufnahmen sollen dasselbe Bild ergeben. Gesetzt sind nur die Nachrichten (`plugin.chatHistory`, danach `syncChatUI()`) — der Weg dorthin ist der Produktionspfad (das Kit-Fenster bekommt sie als `initial`), und Modellzeile, Kontext-Ausklapper und Layout im Bild sind damit echt.

## Was der Treiber am Wirt ändert (und warum)

| Eingriff | Grund |
|---|---|
| Kuros `language` auf `en` **und** die Starter-Habits auf die englische Menge | Die Habits werden beim ersten Start aus **Obsidians** UI-Sprache geseedet, nicht aus Kuros. Auf einer deutschen Installation standen im ersten Lauf deutsche Habit-Labels in einem sonst englischen Einstellungs-Bild. |
| `propertiesInDocument: "hidden"` zur Laufzeit | Ein laufendes Obsidian überschreibt die Fixture-Datei aus dem Speicher. Ohne das steht Obsidians Properties-Zeile („Eigenschaft hinzufügen") deutsch im Bild. |
| Rechte Seitenleiste aufklappen, Breite 420 px | Der Aufnahme-Vault startet ohne `workspace.json`, und ohne Backlinks/Outline ist die rechte Leiste **eingeklappt** — das erste Hero-Bild zeigte das Panel gar nicht. Die feste Breite verhindert, dass die ASCII-Box umbricht. |
| Statusleiste per `<style>` ausblenden | Sie schwebt über der rechten Seitenleiste und gehört dem Wirt, nicht dem Plugin. |

Nichts davon wird zurückgestellt: der Aufnahme-Vault ist Wegwerfware und wird bei jedem
`--setup` neu gebaut. Im Arbeits-Vault des Maintainers läuft der Treiber nicht.

## Bekannte Bedingung: `status-block.png` mit `--only` aufnehmen

Im **Sammellauf** schlägt dieser eine Shot sporadisch fehl (etwa jeder zweite Lauf), mit
`npm run shots -- --only status-block.png` läuft er zuverlässig. Die Ursache ist gemessen,
nicht vermutet — der Treiber gibt sie bei jedem Fehlschlag aus:

```
· {"datei":"Welcome.md","bloecke":1,"sichtbar":0,"modale":0,"blaetter":1,"preview":1}
```

Der einzige gerenderte Kuro-Block liegt dann in der **unsichtbaren CodeMirror-Quelltext-
ansicht** (0×0); die sichtbare Lesemodus-Ansicht trägt gar keinen. Obsidian hält sie im
Cache und baut den Codeblock beim Wiedereintritt nicht neu auf. Drei Gegenmittel sind im
Rezept und reichen einzeln nicht: erneutes Öffnen, `reopenNote`, `previewMode.rerender(true)`.

Das ist die Betriebsbedingung „ein Bild pro Obsidian-Start", die der Skill `readme-shots`
beschreibt — hier trifft sie genau einen Shot. Das Bild selbst ist davon nicht betroffen:
es entsteht vollständig oder gar nicht, ein halbes gibt es nicht.

## Bewusst nicht im Vertrag

- **Ein Bild vom Streaming.** Ein halb eingelaufener Satz ist ein Zustand, kein Motiv, und
  bräuchte ein laufendes Modell — womit die Aufnahme von einer Umgebung abhinge, die es
  beim Leser nicht gibt.
- **Das Onboarding-Modal.** Es erscheint genau einmal pro Installation; ein Bild davon
  altert mit dem ersten Textwechsel, ohne dass es jemandem auffällt.
