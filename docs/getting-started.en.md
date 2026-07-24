# Getting Started — Kuro Gamification

> [🇩🇪 Deutsche Version](getting-started.de.md)

Kuro Gamification adds quiet XP, levels, and small rewards to your Obsidian daily notes — without nagging you, without streaks that punish a missed day, without push spam. This guide gets you to your first reward in under five minutes.

---

## 1. Install

### Via Obsidian Community Plugins (planned)

The plugin is not yet listed in the community catalogue. For now, use the manual install below.

### Manual install

1. Copy `main.js`, `manifest.json`, and `styles.css` into:
   ```
   <your-vault>/.obsidian/plugins/kuro-gamification/
   ```
2. In Obsidian: **Settings → Community plugins → Reload plugins**
3. Toggle **Kuro Gamification** on

> [!tip] Optional CRT aesthetic
> Copy `kuro-gamification.css` from `assets/` into `<vault>/.obsidian/snippets/`, then enable it under **Settings → Appearance → CSS Snippets**. This adds the gothic-cyberpunk phosphor-green look. The plugin works fine without it.

---

## 2. Point it at your daily notes

The plugin needs to know where you keep your daily notes and what date format your filenames use.

**Settings → Kuro Gamification → 📁 Paths**

| Setting | Default | What to set it to |
|---|---|---|
| Daily notes folder | _(empty — seeded from the core "Daily notes" plugin on first launch)_ | Your actual daily notes folder (e.g. `Journal/Daily`) |
| Date format | `YYYY-MM-DD` | The date pattern in your file names |

> [!warning] Set the folder
> On first launch the plugin picks up the folder from Obsidian's core **"Daily notes"** plugin, if you use it. If nothing is set there, the field stays **empty** — and the sidebar shows "No data yet" until you enter your daily notes folder here.

---

## 3. Earn your first XP

1. Open today's daily note
2. Tick any checkbox — e.g. `- [x] Morning routine`
3. Click the **terminal icon** in the left ribbon → the **Kuro Status** sidebar opens on the right
4. Watch the XP appear (the sidebar refreshes automatically within ~1 second)

> [!tip] No sidebar? No problem.
> `Cmd+P` (or `Ctrl+P`) → **"Kuro: Insert Status Code Block"** — inserts a ` ```kuro-status ` block that renders inline in any note.
>
> Or trigger a manual recalculate: `Cmd+P` → **"Kuro: Refresh Status"**.

Each ticked checkbox earns 2 XP by default. Completing 50 %, 75 %, or 90 % of your day's checkboxes adds a bonus (+10 / +20 / +30 XP). Level 2 starts at 200 XP.

---

## 4. Your first loot at Level 2

Once you reach Level 2, the sidebar shows a **Loot available** section with three options — small, concrete rewards from the default pool (things like "Make your favourite tea", "15-minute walk", "Read one chapter").

These three options are **stable**: they stay until you choose one. There is no "re-roll for better picks" mechanic — that kind of variable-reward pressure is intentional to avoid.

Click **🎲 Redeem loot** → pick one → a confirmation notice appears. You earn one drop per level, so the next one comes when you hit Level 3.

> [!info] What's in the pool?
> The built-in pool has 50+ rewards across five tiers: Common, Rare, Epic, Legendary, Mythic. You'll see higher tiers at higher levels.

---

## 5. Make it yours

By default you get calm plain-language lore and a loot pool in your language — a neutral starting point. You can replace either by importing a JSON "pack". Two ready-made packs live in the repo's **`packs/` folder**: `gothic-lore.kuro.json` (gothic-cyberpunk) and `cozy-lore.kuro.json` (cozy). Download one and pick it via "Choose file…" in the import dialog.

See [Customization — loot/lore packs & LLM prompts](customization.en.md) for the full guide, including a ready-to-paste LLM prompt that generates a pack in any theme you describe.

---

## 6. No pressure

Everything that could feel like an obligation is **off by default** or can be turned off individually:

- Streak tracking? **Settings → 🔥 Streaks → off**
- Loot drops? **Settings → 📊 Level & Loot → off**
- Lore fragments? **Settings → 📜 Lore → off**
- Status bar indicator? Already off by default
- Toast notifications? Off individually

Freeze tokens (2 per month by default) absorb missed streak days — a gap does not collapse your run. For the full reasoning behind these choices, see the [Design Philosophy](philosophy.en.md).
