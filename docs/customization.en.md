# Customizing Kuro Gamification

The plugin ships with built-in loot rewards and lore fragments, but you don't have to keep them. If you'd rather have cozy cottagecore rewards instead of cyberpunk loot drops, or calm plain text instead of gothic level titles, you can swap everything out without touching any source code — just import a JSON "pack".

> [!info] No pressure
> Customizing is entirely optional. The defaults work fine. This guide is here when you feel like making the plugin feel more *you*.

---

## 1. What you can customize

There are two things you can replace:

- **Loot rewards** — the small treats you unlock at each drop (e.g. "Make your favourite tea", "10-minute walk"). Organized into five tiers: `common`, `rare`, `epic`, `legendary`, `mythic`.
- **Lore fragments** — the short flavour texts that appear as you level up from 1 to 10.

Everything else — XP values, streak logic, your progress — is never touched by a pack import.

---

## 2. The pack format

A pack is a plain JSON object called a `KuroPack`. Here is a minimal annotated example:

```json
{
  "kuroPack": 1,
  "name": "Cozy Cottage",
  "loot": {
    "common": [
      { "name": "Brew a herbal tea", "cat": "Self-care" },
      { "name": "Open a window for 5 min", "cat": "Movement" }
    ],
    "rare": [
      { "name": "Take a 20-min walk outside", "cat": "Movement" }
    ]
  },
  "lore": [
    { "level": 1, "title": "FIRST LIGHT", "text": "You opened your eyes.\nThat already counts." },
    { "level": 2, "title": "SMALL STEPS", "text": "One thing done.\nIt is enough." }
  ]
}
```

**Field reference:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `kuroPack` | number | yes | Format version — always `1` |
| `name` | string | no | Short label shown in the UI |
| `loot` | object | no | Keys: `common` `rare` `epic` `legendary` `mythic` |
| `loot[tier]` | array | — | Each item: `{ "name": string, "cat": string }` |
| `lore` | array | no | Each item: `{ "level": number, "title": string, "text": string }` |

**Two important rules:**

1. **Loot tiers you omit keep their built-in defaults.** If you only include `"legendary"` and `"mythic"`, the other three tiers stay as they are.
2. **Lore replaces all default lore wholesale.** If you include `"lore"`, it should cover every level 1–10 — one object per level; incomplete coverage is allowed, but levels without a fragment will show nothing. If you only want to change loot, omit the `"lore"` key entirely.

---

## 3. Generate a pack with an LLM

The easiest way to create a pack is to ask an LLM (Claude, ChatGPT, or any other) to generate one for you. Copy the prompt below, fill in your theme at the bottom, and paste it.

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

> [!tip] Lore-only or loot-only pack
> Tell the LLM to include just the `"lore"` key (for lore only) or just the `"loot"` key (for loot only) and omit the other — the pack is still valid.

---

## 4. Import it

There are two ways to open the import dialog:

- **Settings → 📚 Packs → Import a pack**
- **Command palette** (`Cmd+P` / `Ctrl+P`) → `Import loot/lore pack (JSON)…`

Once the dialog is open:

1. **Paste your JSON** directly into the editor, or
2. **Pick a ready-made pack as a file** — click **Choose file…** and select a `.json` file. Two ready-made packs ship in the repo's `packs/` folder: `gothic-lore.kuro.json` (gothic-cyberpunk) and `cozy-lore.kuro.json` (cozy). The calm plain-language style is already the factory default and needs no import.

The plugin validates the JSON before applying anything. If there's a problem, you'll get a clear error message pointing to what's wrong. Your XP, level, and progress are never modified by an import.

Imported packs land in the **pack library** (Settings → 📚 Packs). There you can see which pack is active per section (lore/loot), switch between several installed packs, delete individual ones, and reset a section to the factory default.

---

## 5. Share and back up your pack

To export your current loot and lore as a shareable pack:

**Command palette → `Export current loot/lore as a pack (JSON)`**

This gives you a JSON object you can save to a file, share with others, or keep as a backup. Anyone else can import it the same way — paste it in the import dialog and they're done.
