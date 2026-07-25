# Kuro Gamification anpassen

Das Plugin kommt mit eingebauten Loot-Belohnungen und Lore-Fragmenten — aber du musst die nicht behalten. Wenn du lieber gemütliche Cottagecore-Belohnungen statt Cyberpunk-Drops willst, oder ruhigen Klartext statt gotischer Level-Titel: Du kannst alles austauschen, ohne eine einzige Zeile Quellcode anzufassen. Dafür gibt es ein JSON-„Pack".

> [!info] Kein Druck
> Anpassen ist vollständig optional. Die Standardwerte funktionieren prima. Diese Anleitung ist für den Moment, wenn du das Plugin mehr nach *dir* klingen lassen möchtest.

---

## 1. Was du anpassen kannst

Es gibt zwei Dinge, die du ersetzen kannst:

- **Loot-Belohnungen** — die kleinen Treats, die du bei jedem Drop bekommst (z. B. „Lieblingstee aufsetzen", „10-Minuten-Spaziergang"). Aufgeteilt in fünf Stufen: `common`, `rare`, `epic`, `legendary`, `mythic`.
- **Lore-Fragmente** — die kurzen Flavor-Texte, die beim Aufsteigen von Level 1 auf 10 erscheinen.

Alles andere — XP-Werte, Streak-Logik, dein Fortschritt — wird durch einen Pack-Import niemals verändert.

---

## 2. Das Pack-Format

Ein Pack ist ein schlichtes JSON-Objekt namens `KuroPack`. Hier ein kommentiertes Minimalbeispiel:

```json
{
  "kuroPack": 1,
  "name": "Cozy Cottage",
  "loot": {
    "common": [
      { "name": "Kräutertee kochen", "cat": "Selbstfürsorge" },
      { "name": "5 Min. Fenster aufmachen", "cat": "Bewegung" }
    ],
    "rare": [
      { "name": "20-Minuten-Spaziergang draußen", "cat": "Bewegung" }
    ]
  },
  "lore": [
    { "level": 1, "title": "ERSTES LICHT", "text": "Du hast die Augen aufgemacht.\nDas zählt schon." },
    { "level": 2, "title": "KLEINE SCHRITTE", "text": "Eine Sache erledigt.\nDas reicht." }
  ]
}
```

**Felder im Überblick:**

| Feld | Typ | Pflicht | Hinweise |
|---|---|---|---|
| `kuroPack` | number | ja | Format-Version — immer `1` |
| `name` | string | nein | Kurzes Label, das in der UI angezeigt wird |
| `loot` | object | nein | Keys: `common` `rare` `epic` `legendary` `mythic` |
| `loot[tier]` | array | — | Jedes Element: `{ "name": string, "cat": string }` |
| `lore` | array | nein | Jedes Element: `{ "level": number, "title": string, "text": string }` |

**Zwei wichtige Regeln:**

1. **Loot-Stufen, die du weglässt, behalten ihre eingebauten Standardwerte.** Wenn du nur `"legendary"` und `"mythic"` angibst, bleiben die anderen drei Stufen unverändert.
2. **Lore ersetzt alle Standard-Lore auf einmal.** Wenn du `"lore"` angibst, sollte es jeden Level von 1 bis 10 abdecken — je ein Objekt pro Level; unvollständige Abdeckung ist erlaubt, aber Level ohne Fragment zeigen nichts an. Wenn du nur den Loot ändern willst, lass den `"lore"`-Key einfach weg.

---

## 3. Pack mit einem LLM generieren

Der einfachste Weg, ein Pack zu erstellen, ist ein LLM (Claude, ChatGPT oder ein anderes) darum zu bitten. Kopiere den Prompt unten, trage dein Theme am Ende ein, und schick ihn ab.

> [!note] Der Prompt ist auf Englisch
> Das ist Absicht — der Prompt beschreibt ein festes JSON-Schema und funktioniert in Englisch am zuverlässigsten mit allen LLMs.

````text
You are generating a customization "pack" for the Obsidian plugin **Kuro Gamification**.
Output ONLY a single valid JSON object — no prose, no markdown fences — matching exactly:

{
  "kuroPack": 1,
  "name": "<short theme name>",
  "lore": [
    { "level": 1, "title": "<ALL-CAPS short title>", "text": "<2-4 short lines, use \n between lines>" }
    // ... one object for EACH level 1 through 10 ...
  ],
  "loot": {
    "common":    [ { "name": "<reward doable in <=30 min>", "cat": "<short category>" } /* >=5 items */ ],
    "rare":      [ /* >=5 items */ ],
    "epic":      [ /* >=5 items */ ],
    "legendary": [ /* >=5 items */ ],
    "mythic":    [ /* >=5 items */ ]
  }
}

Rules:
- "lore" MUST cover every level 1..10 (one object each), or omit "lore" entirely.
- Allowed loot tier keys: common, rare, epic, legendary, mythic. Omit a tier to keep its built-in rewards.
- THEME: <describe your theme — e.g. "cozy cottagecore", "deep-space sci-fi", "calm and plain, no fiction">.
- Rewards must be low-pressure and neurodivergence-friendly: no obligations, no guilt, no streak pressure.
- Return ONLY the JSON object.
````

> [!tip] Nur Lore oder nur Loot
> Sag dem LLM, nur den `"lore"`-Key (für reine Lore-Packs) oder nur den `"loot"`-Key (für reine Loot-Packs) einzuschließen und den anderen wegzulassen — das Pack bleibt gültig.

---

## 4. Importieren

Es gibt zwei Wege, den Import-Dialog zu öffnen:

- **Einstellungen → 📚 Packs → Pack importieren**
- **Command Palette** (`Cmd+P` / `Ctrl+P`) → `Import loot/lore pack (JSON)…`

Sobald der Dialog offen ist:

1. **JSON direkt einfügen** — paste einfach dein JSON in den Editor, oder
2. **Fertiges Pack als Datei wählen** — klick **Datei wählen…** und such eine `.json`-Datei aus. Zwei fertige Packs liegen im `packs/`-Ordner des Repos: `gothic-lore.kuro.json` (Gothic-Cyberpunk) und `cozy-lore.kuro.json` (gemütlich). Der ruhige Klartext-Stil ist bereits der Werks-Standard und braucht keinen Import.

Das Plugin prüft das JSON, bevor es irgendetwas anwendet. Wenn etwas nicht stimmt, siehst du eine klare Fehlermeldung, die zeigt, was fehlt oder falsch ist. Deine XP, dein Level und dein Fortschritt werden durch einen Import niemals verändert.

Importierte Packs landen in der **Pack-Bibliothek** (Einstellungen → 📚 Packs). Dort siehst du, welches Pack pro Sektion (Lore/Loot) aktiv ist, kannst zwischen mehreren installierten Packs wechseln, einzelne löschen und pro Sektion auf den Factory-Default zurück.

---

## 5. Pack teilen und sichern

Um dein aktuelles Loot und deine Lore als teilbares Pack zu exportieren:

**Command Palette → `Export current loot/lore as a pack (JSON)`**

Das liefert dir ein JSON-Objekt, das du als Datei speichern, mit anderen teilen oder als Backup behalten kannst. Andere importieren es auf genau demselben Weg — JSON einfügen, fertig.
