# Erste Schritte — Kuro Gamification

> [🇬🇧 English version](getting-started.en.md)

Kuro Gamification fügt deinen Obsidian-Daily-Notes leise XP, Level und kleine Belohnungen hinzu — ohne dich zu nerven, ohne Streaks, die dich für einen verpassten Tag bestrafen, ohne Push-Spam. Diese Anleitung bringt dich in unter fünf Minuten zur ersten Belohnung.

---

## 1. Installation

### Via Obsidian Community Plugins (geplant)

Das Plugin ist noch nicht im Community-Katalog gelistet. Nutze vorerst die manuelle Installation.

### Manuelle Installation

1. Kopiere `main.js`, `manifest.json` und `styles.css` in:
   ```
   <dein-vault>/.obsidian/plugins/kuro-gamification/
   ```
2. In Obsidian: **Settings → Community-Plugins → Plugins neu laden**
3. **Kuro Gamification** aktivieren

> [!tip] Optionale CRT-Ästhetik
> Kopiere `kuro-gamification.css` aus `assets/` nach `<vault>/.obsidian/snippets/`, dann unter **Settings → Appearance → CSS-Snippets** aktivieren. Das fügt die Gothic-Cyberpunk-Phosphor-Optik hinzu. Das Plugin funktioniert auch ohne das Snippet.

---

## 2. Auf deine Daily-Notes zeigen

Das Plugin muss wissen, wo du deine Daily-Notes aufbewahrst und welches Datumsformat deine Dateinamen verwenden.

**Settings → Kuro Gamification → 📁 Pfade**

| Einstellung | Standard | Was du einstellen solltest |
|---|---|---|
| Daily-Notes-Ordner | _(leer — beim ersten Start aus dem Core-Plugin „Tägliche Notizen" übernommen)_ | Deinen tatsächlichen Daily-Notes-Ordner (z. B. `Journal/Daily`) |
| Datumsformat | `YYYY-MM-DD` | Das Datumsmuster in deinen Dateinamen |

> [!warning] Ordner setzen
> Beim ersten Start übernimmt das Plugin den Ordner aus dem Core-Plugin **„Tägliche Notizen"**, falls du es nutzt. Ist dort nichts gesetzt, bleibt das Feld **leer** — und die Sidebar zeigt „Noch keine Daten", bis du hier deinen Daily-Notes-Ordner einträgst.

---

## 3. Erste XP verdienen

1. Öffne deine heutige Daily-Note
2. Hake eine Checkbox ab — z. B. `- [x] Morgenroutine`
3. Klick auf das **Terminal-Icon** in der linken Ribbon-Leiste → die **Kuro Status**-Sidebar öffnet sich rechts
4. Schau zu, wie die XP erscheinen (die Sidebar refresht automatisch binnen ~1 Sekunde)

> [!tip] Keine Sidebar? Kein Problem.
> `Cmd+P` (oder `Ctrl+P`) → **„Status-Codeblock einfügen"** — fügt einen ` ```kuro-status `-Block ein, der in jeder Note inline rendert.
>
> Oder manuell neu berechnen: `Cmd+P` → **„Status neu berechnen"**.

Jede abgehakte Checkbox bringt standardmäßig 2 XP. Das Abschließen von 50 %, 75 % oder 90 % der Tages-Checkboxen gibt einen Bonus (+10 / +20 / +30 XP). Level 2 beginnt bei 200 XP.

---

## 4. Erster Loot bei Level 2

Sobald du Level 2 erreichst, zeigt die Sidebar einen **Loot verfügbar**-Bereich mit drei Optionen — kleine, konkrete Belohnungen aus dem Standard-Pool (z. B. „Lieblingstee aufsetzen", „15-Minuten-Spaziergang", „Ein Kapitel lesen").

Diese drei Optionen sind **stabil**: Sie bleiben sichtbar, bis du eine auswählst. Es gibt kein „Neu laden für bessere Optionen"-Mechanismus — genau diese Art von variablem Belohnungsdruck soll bewusst vermieden werden.

Klick **🎲 Loot einlösen** → eine Option wählen → eine Bestätigungs-Notice erscheint. Du bekommst einen Drop pro Level, der nächste kommt also mit Level 3.

> [!info] Was ist im Pool?
> Der eingebaute Pool hat 50+ Belohnungen in fünf Tiers: Common, Rare, Epic, Legendary, Mythic. Höhere Tiers erscheinen bei höheren Leveln.

---

## 5. Mach es zu deinem

Standardmäßig kommt ruhige Klartext-Lore und ein Loot-Pool in deiner Sprache — ein neutraler Ausgangspunkt. Du kannst beides durch alles ersetzen, indem du ein JSON-„Pack" importierst. Zwei fertige Packs liegen im **`packs/`-Ordner des Repos**: `gothic-lore.kuro.json` (Gothic-Cyberpunk) und `cozy-lore.kuro.json` (gemütlich). Lade eins herunter und wähle es beim Import über „Datei wählen…".

Siehe [Anpassung — Loot/Lore-Packs & LLM-Prompts](customization.de.md) für die vollständige Anleitung, einschließlich eines fertigen LLM-Prompts, der ein Pack in jedem von dir beschriebenen Thema generiert.

---

## 6. Kein Druck

Alles, was sich wie eine Verpflichtung anfühlen könnte, ist **standardmäßig ausgeschaltet** oder kann einzeln deaktiviert werden:

- Streak-Tracking? **Settings → 🔥 Streaks → aus**
- Loot-Drops? **Settings → 📊 Level & Loot → aus**
- Lore-Fragmente? **Settings → 📜 Lore → aus**
- Status-Bar-Indikator? Ist bereits standardmäßig aus
- Toast-Benachrichtigungen? Einzeln abschaltbar

Freeze-Tokens (standardmäßig 2 pro Monat) absorbieren verpasste Streak-Tage — eine Lücke bricht deinen Lauf nicht. Die vollständige Begründung hinter diesen Entscheidungen findest du in der [Design-Philosophie](philosophy.de.md).
