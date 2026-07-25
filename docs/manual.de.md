# Kuro Gamification verwenden

Ein Plugin, das deinem Daily-Driving leise XP, Level und kleine Belohnungen hinzufügt — ohne dich zu nerven, ohne Streaks, die dich für einen verpassten Tag bestrafen, ohne Push-Spam.

Das ist **kein Produktivitäts-Trick**, der dich zu mehr Output zwingen soll. Es ist eine **freundliche Spiegelung**: du siehst, was du gemacht hast, in einer Sprache, die ein bisschen Spaß macht. Und du kriegst ab und zu eine Mini-Belohnung dafür, dass du am Leben bist.

> [!info]+ Worauf das Plugin gebaut ist
> Auf ADHS- und ASS-tauglichen Mechaniken. Konkret: kein hartes Bestrafen, alles transparent berechnet, jedes Feature einzeln deaktivierbar.

## Was es macht (3 Sätze)

- **XP** für jede abgehakte Checkbox in deinen Daily-Notes (Default: 2 XP). Pro Tagesabschluss-Schwelle (50/75/90 %) gibt's einen Bonus.
- **Level 1–10** mit Titeln von `SIGNAL LOST` bis `K U R O`. Ab Level 2 kriegst du **Loot-Drops** — kleine Belohnungen wie „Lieblings-Tee aufsetzen" oder „Spaziergang 45 Min".
- **Streaks** mit **Freeze-Tokens**: 2 freie Skip-Tage pro Monat, damit ein verpasster Tag deinen Lauf nicht zerstört.

## Schnellstart (3 Klicks)

1. Klick auf das **Terminal-Icon** in der linken Ribbon-Leiste — die **Kuro Status**-Sidebar öffnet sich rechts
2. Hake in deiner heutigen Daily-Note eine Checkbox ab
3. Schau in die Sidebar — die XP sind drin. Wenn du Level 2 erreichst, klick **🎲 Loot einlösen**

> [!tip] Sidebar weg, Plugin trotzdem nutzen?
> `Cmd+P` → „Status-Codeblock einfügen" — fügt einen ```kuro-status```-Block ein, der den gleichen Status inline rendert.

## Was triggert XP?

| Quelle | XP | Wo konfiguriert |
|---|---|---|
| Pro abgehakte `- [x]`-Checkbox | 2 (Default) | Settings → ⚡ XP-Quellen |
| 50 % der Tages-Checkboxen abgehakt | +10 (zusätzlich) | ↑ |
| 75 % der Tages-Checkboxen abgehakt | +20 (statt +10) | ↑ |
| 90 % der Tages-Checkboxen abgehakt | +30 (statt +20) | ↑ |
| Habit-Toggle im Frontmatter (z. B. `qigong: true`) | konfigurierbar pro Habit | Settings → 🎯 Habits |
| Pomodoros ≥ Schwelle (z. B. `pomodoros: 4`) | +10 (Default) | Settings → ⚡ XP-Quellen |
| Weekly-Review (`review_done: true`) | +50 | Settings → 📅 Weekly |
| Weekly-Planung (`planung_done: true`) | +30 | Settings → 📅 Weekly |
| Streak-Bonus (3+ Tage qualifiziert) | 5/10/15/20 XP/Tag (Staffel) | Settings → 🔥 Streaks |
| Manuell vergebene XP | beliebig | Command „XP manuell anpassen…" |

## Wie ich Habits anlege

1. Settings → Kuro Gamification → 🎯 Habits → „Habit hinzufügen"
2. **Frontmatter-Key:** `qigong` (oder was du im Daily-Note-Frontmatter setzen willst)
3. **Anzeigename:** `🧘 Qi Gong`
4. **XP:** `10`
5. Im Daily-Note-Frontmatter setzen: `qigong: true` an Tagen, an denen du es gemacht hast

> [!example]+ Beispiel — Frontmatter mit Habits
> ```yaml
> ---
> type: 📅 Tagesnotiz
> status: 2-aktiv ✏️
> date: 2026-04-24
> energie_heute: 7
> tagesmodus: hoch
> qigong: true
> peloton: false
> draussen: true
> pomodoros: 4
> ---
> ```
> Das gibt: 10 (Qi Gong) + 0 (Peloton aus) + 10 (Draußen) + 10 (Pomodoro-Bonus) = 30 XP zusätzlich zu den Checkboxen.

## Streaks — und warum sie nicht weh tun

Ein Tag „qualifiziert" für deinen Streak, wenn du ≥ 50 % der Checkboxen in der Daily abgehakt hast (Schwelle in Settings änderbar).

- **3-6 Tage:** +5 XP/Tag Bonus
- **7-13 Tage:** +10 XP/Tag
- **14-29 Tage:** +15 XP/Tag
- **30+ Tage:** +20 XP/Tag

**Freeze-Tokens** (Default: 2 pro Monat) absorbieren Lücken-Tage. Vergisst du einen Tag, läuft der Streak weiter — solange ein Token verfügbar ist. Tokens regenerieren sich am 1. jedes Monats automatisch.

> [!tip]+ Streak-Tracking nervt dich?
> Settings → 🔥 Streaks → „Streak-Tracking aktiv" → off. Streaks verschwinden komplett aus der Sidebar, kein Bonus mehr, kein Druck.

## Loot-Drops — was ist das?

Ab Level 2 kriegst du **1 Drop pro Level**. Ein Drop ist eine Mini-Belohnung aus dem Default-Pool (oder deinem eigenen):

- **Common:** Tee, Atmen, Pflanze gießen, Strecken
- **Rare:** lange Dusche, Spaziergang, ein Kapitel lesen
- **Epic:** komplettes Frühstück, Mood-Board, lange Wanne, Park-Bank
- **Legendary:** Wellness-Tag, Tagestrip, neues Hobby
- **Mythic:** 24h-Vault-Detox, spontaner Tagestrip, Großprojekt anfangen

Wenn ein Drop verfügbar ist, zeigt die Sidebar **3 Optionen**. Diese drei bleiben **stabil** — du kannst nicht „neu rollen" für bessere Optionen. Wähle eine, klick **🎲 Loot einlösen** → Bestätigung als Notice.

> [!tip] Eigene Loot-Liste statt Default-Pool?
> Siehe das [Anpassungs-Handbuch](customization.de.md) für das Pack-Format, einen fertigen LLM-Prompt und den Import-/Export-Dialog.

## Pack-Import und -Export

Du kannst die Standard-Loot-Belohnungen und Lore-Fragmente durch ein eigenes JSON-„Pack" ersetzen — ohne eine Zeile Quellcode anzufassen.

**Pack importieren:**
- Einstellungen → 📚 Packs → **Pack importieren**, oder
- `Cmd+P` → „Loot-/Lore-Pack importieren (JSON)…"

Im Dialog: füge dein JSON direkt ein, oder klick **Datei wählen…** und wähle eine `.json`-Datei. Zwei fertige Packs liegen im `packs/`-Ordner des Repos — `gothic-lore.kuro.json` (Gothic-Cyberpunk) und `cozy-lore.kuro.json` (gemütlich); lade eins herunter und importier es. Das Plugin prüft vor dem Anwenden — dein XP und Fortschritt werden nie angetastet.

Importierte Packs landen in der **Pack-Bibliothek** (Einstellungen → 📚 Packs). Dort siehst du, welches Pack pro Sektion (Lore/Loot) aktiv ist, kannst zwischen mehreren installierten Packs wechseln, einzelne löschen und pro Sektion auf den Factory-Default zurück.

**Aktuelles Pack exportieren:**
- Einstellungen → 📚 Packs → in der Zeile **Lore**, **Loot** oder **Habits** → **Datei exportieren** (oder **Kopieren**), oder
- `Cmd+P` → „Aktuelles Loot/Lore als Pack exportieren (JSON)"

Das liefert dir ein JSON-Objekt mit deinem aktuellen Loot und deiner Lore, das du speichern, teilen oder als Backup behalten kannst.

Die vollständige Pack-Format-Referenz und einen LLM-Prompt, der ein thematisches Pack generiert, findest du im [Anpassungs-Handbuch](customization.de.md).

## Lore-Fragmente

Beim Erreichen jedes neuen Levels schaltest du ein **narrative Fragment** frei — 10 kurze Texte, eines pro Level. Sie tauchen automatisch als Spoiler-Callout in der Sidebar auf, sobald du das jeweilige Level erreichst. Der eingebaute Standard ist **ruhig und in Klartext**; importier das Gothic-Cyberpunk- oder Cozy-Pack (oder dein eigenes), um den Ton zu ändern.

Befehl `Cmd+P` → „Aktuelles Lore-Fragment zeigen" zeigt das aktuelle Fragment in einem Modal.

## Was kann ich abschalten?

Alles. Wirklich alles. In Settings → Kuro Gamification:

| Was nervt? | Aus stellen |
|---|---|
| Sidebar nervt | „Sidebar-View aktiv" → off |
| Loot-Drops fühlen sich gezwungen an | „Loot-Drops aktiv" → off |
| Lore stört | „Lore-Reveal aktiv" → off |
| Streaks setzen unter Druck | „Streak-Tracking aktiv" → off |
| Habits sind nervig | „XP aus Habits" → off, oder einzelne Habits löschen |
| Notice-Toasts beim Loot-Einlösen | „Aktions-Notices" → off |
| Animationen flackern zu viel | „Animationen reduzieren" → on |
| Status-Bar-Indikator unten | „Status-Bar-Anzeige" → off (default ist eh aus) |

## Wenn die XP nicht mehr stimmen

- **Manuell anpassen:** `Cmd+P` → „XP manuell anpassen…" — gib eine Differenz (positiv oder negativ) und einen Grund ein
- **Verbose-Modus** anschalten in Settings → 🎮 Allgemein → „Verbose-Status (Aufschlüsselung)" — dann zeigt die Sidebar genau, woher jede XP kommt
- **Komplett zurücksetzen:** `Cmd+P` → „Alle Daten zurücksetzen…" — Doppel-Bestätigung erforderlich. Setzt nur Plugin-Daten zurück, **deine Daily-Notes bleiben unangetastet**

## Daten exportieren / sichern

`Cmd+P` → „Plugin-Daten exportieren (JSON)" → Modal mit dem kompletten State (Settings + Drops + Adjustments + Lore-Unlocks). Per Klipboard rauskopieren, wo immer du willst. Import via „Plugin-Daten importieren (JSON)".

## Performance

- Keine Polling-Loops. Plugin reagiert nur auf `vault.modify` (debounced 800ms)
- Daily-Notes werden via `cachedRead` gelesen (kein Disk-I/O wenn Cache warm)
- Keine Netzwerk-Requests. Nichts verlässt deinen Vault

## Bekannte Eigenheiten

- **Mid-night-Refresh** läuft einmal pro Session. Wenn du Obsidian die ganze Nacht offen hast, refresht der Status um 00:00:05. Wenn nicht — beim nächsten Öffnen.
- Die CRT-Phosphor-Optik ist ein **separates Snippet**, kein Plugin-Inhalt — siehe [Ästhetik-CSS](aesthetic-css.de.md) für das CSS und die Installationsanleitung.

## Wenn etwas nicht funktioniert

| Symptom | Lösung |
|---|---|
| Sidebar zeigt „Noch keine Daten" | Daily-Folder-Pfad in Settings → 📁 Pfade auf deinen eigenen Daily-Notes-Ordner setzen. Beim ersten Start aus dem Core-Plugin „Tägliche Notizen" übernommen; ist dort nichts gesetzt, bleibt das Feld leer. |
| XP-Counter steigt nicht | Settings → ⚡ XP-Quellen → „XP aus Checkboxen" muss on sein. Logs checken via Settings → 🛠 Erweitert → Log-Level: debug → Console öffnen (`Cmd+Opt+I`) |
| Loot-Drop kommt nicht | Levels prüfen — Loot startet erst ab Level 2 (200 XP). |
| Lore-Fragment fehlt | Settings → 📜 Lore → „Lore-Reveal aktiv" muss on sein |
| Plugin lädt nicht | Devtools-Console öffnen (`Cmd+Opt+I`), nach `[kuro]`-Errors suchen |
