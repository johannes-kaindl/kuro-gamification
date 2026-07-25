# Using Kuro Gamification

> [🇩🇪 Deutsches Handbuch](manual.de.md)

A plugin that quietly adds XP, levels, and small rewards to your daily-driving — without annoying you, without streaks that punish a missed day, without push spam.

This is **not a productivity trick** designed to force you to produce more output. It is a **friendly mirror**: you see what you did, in a language that is a little fun. And you get a small reward now and then just for being alive.

> [!info]+ What this plugin is built on
> ADHD- and autism-friendly mechanics. Specifically: no hard punishment, everything transparently calculated, every feature individually disableable.

## What it does (3 sentences)

- **XP** for every ticked checkbox in your daily notes (default: 2 XP). Completion bonuses at 50 / 75 / 90 % of the day's checkboxes.
- **Levels 1–10** with titles from `SIGNAL LOST` to `K U R O`. From Level 2 onwards you get **loot drops** — small rewards like "Make your favourite tea" or "45-minute walk".
- **Streaks** with **freeze tokens**: 2 free skip-days per month, so a missed day doesn't destroy your run.

## Quick start (3 clicks)

1. Click the **terminal icon** in the left ribbon — the **Kuro Status** sidebar opens on the right
2. Tick a checkbox in today's daily note
3. Check the sidebar — the XP is in. When you reach Level 2, click **🎲 Redeem loot**

> [!tip] Sidebar gone, plugin still useful?
> `Cmd+P` → "Insert status code block" — inserts a ` ```kuro-status ` block that renders the same status inline.

## What triggers XP?

| Source | XP | Where to configure |
|---|---|---|
| Per ticked `- [x]` checkbox | 2 (default) | Settings → ⚡ XP Sources |
| 50 % of the day's checkboxes ticked | +10 (additional) | ↑ |
| 75 % of the day's checkboxes ticked | +20 (replaces +10) | ↑ |
| 90 % of the day's checkboxes ticked | +30 (replaces +20) | ↑ |
| Habit toggle in frontmatter (e.g. `qigong: true`) | configurable per habit | Settings → 🎯 Habits |
| Pomodoros ≥ threshold (e.g. `pomodoros: 4`) | +10 (default) | Settings → ⚡ XP Sources |
| Weekly review (`review_done: true`) | +50 | Settings → 📅 Weekly |
| Weekly planning (`planung_done: true`) | +30 | Settings → 📅 Weekly |
| Streak bonus (3+ qualifying days) | 5/10/15/20 XP/day (tiered) | Settings → 🔥 Streaks |
| Manually added XP | any amount | Command "Adjust XP manually…" |

## How to set up habits

1. Settings → Kuro Gamification → 🎯 Habits → "Add habit"
2. **Frontmatter key:** `qigong` (or whatever you want to set in the daily note frontmatter)
3. **Display name:** `🧘 Qi Gong`
4. **XP:** `10`
5. In the daily note frontmatter: set `qigong: true` on days you did it

> [!example]+ Example — frontmatter with habits
> ```yaml
> ---
> type: 📅 Daily note
> status: 2-active ✏️
> date: 2026-04-24
> energy_today: 7
> day_mode: high
> qigong: true
> peloton: false
> outdoors: true
> pomodoros: 4
> ---
> ```
> This gives: 10 (Qi Gong) + 0 (Peloton off) + 10 (Outdoors) + 10 (Pomodoro bonus) = 30 XP on top of checkboxes.

## Streaks — and why they don't hurt

A day "qualifies" for your streak when you've ticked ≥ 50 % of the day's checkboxes (threshold adjustable in Settings).

- **3–6 days:** +5 XP/day bonus
- **7–13 days:** +10 XP/day
- **14–29 days:** +15 XP/day
- **30+ days:** +20 XP/day

**Freeze tokens** (default: 2 per month) absorb gap days. If you miss a day, the streak continues — as long as a token is available. Tokens regenerate automatically on the 1st of each month.

> [!tip]+ Streak tracking bothering you?
> Settings → 🔥 Streaks → "Streak tracking active" → off. Streaks disappear completely from the sidebar: no bonus, no pressure.

## Loot drops — what are they?

From Level 2 onwards you get **1 drop per level**. A drop is a small reward from the default pool (or your own custom pool):

- **Common:** Tea, breathing, water a plant, stretch
- **Rare:** long shower, walk, read a chapter
- **Epic:** full breakfast, mood board, long bath, park bench
- **Legendary:** wellness day, day trip, new hobby
- **Mythic:** 24h vault detox, spontaneous day trip, start a big project

When a drop is available, the sidebar shows **3 options**. These three stay **stable** — you cannot "re-roll for better options". Choose one, click **🎲 Redeem loot** → confirmation notice appears.

> [!tip] Want a custom loot list instead of the default pool?
> See the [Customization guide](customization.en.md) for the pack format, a ready-to-paste LLM prompt, and the import/export dialog.

## Pack import and export

You can replace the default loot rewards and lore fragments with a custom JSON "pack" — without editing any source code.

**Import a pack:**
- Settings → 📚 Packs → **Import a pack**, or
- `Cmd+P` → "Import loot/lore pack (JSON)…"

In the dialog: paste your JSON directly, or click **Choose file…** and pick a `.json` pack. Two ready-made packs ship in the repo's `packs/` folder — `gothic-lore.kuro.json` (gothic-cyberpunk) and `cozy-lore.kuro.json` (cozy); download one and import it. The plugin validates before applying — your XP and progress are never touched.

Imported packs land in the **pack library** (Settings → 📚 Packs). There you can see which pack is active per section (lore/loot), switch between several installed packs, delete individual ones, and reset a section to the factory default.

**Export your current pack:**
- Settings → 📚 Packs → in the **Lore**, **Loot**, or **Habits** row → **Export to file** (or **Copy**), or
- `Cmd+P` → "Export current loot/lore as a pack (JSON)"

This gives you a JSON object covering your current loot and lore that you can save, share, or use as a backup.

For the full pack format reference and an LLM prompt that generates a themed pack, see [Customization — loot/lore packs & LLM prompts](customization.en.md).

## Lore fragments

When you reach each new level you unlock a **narrative fragment** — 10 short texts, one per level. They appear automatically as a spoiler callout in the sidebar when you reach the relevant level. The built-in default is **calm and plain-language**; import the gothic-cyberpunk or cozy pack (or your own) to change the tone.

`Cmd+P` → "Show current lore fragment" shows the current fragment in a modal.

You can replace the default lore with your own by importing a pack — see the [Customization guide](customization.en.md).

## What can I turn off?

Everything. Literally everything. In Settings → Kuro Gamification:

| What's bothering you? | How to turn it off |
|---|---|
| Sidebar is intrusive | "Sidebar view active" → off |
| Loot drops feel forced | "Loot drops active" → off |
| Lore is distracting | "Lore reveal active" → off |
| Streaks create pressure | "Streak tracking active" → off |
| Habits are annoying | "XP from habits" → off, or delete individual habits |
| Notice toasts on loot redemption | "Action notices" → off |
| Animations flicker too much | "Reduce animations" → on |
| Status bar indicator at the bottom | "Status bar display" → off (already off by default) |

## When the XP looks wrong

- **Adjust manually:** `Cmd+P` → "Adjust XP manually…" — enter a difference (positive or negative) and a reason
- **Turn on verbose mode:** Settings → 🎮 General → "Verbose breakdown" — the sidebar then shows exactly where each XP came from
- **Full reset:** `Cmd+P` → "Reset all data…" — requires double confirmation. Resets only plugin data, **your daily notes are untouched**

## Export / backup data

`Cmd+P` → "Export plugin data (JSON)" → modal with the complete state (settings + drops + adjustments + lore unlocks). Copy to clipboard, paste wherever you need it. Import via "Import plugin data (JSON)".

## Performance

- No polling loops. The plugin only reacts to `vault.modify` (debounced 800 ms)
- Daily notes are read via `cachedRead` (no disk I/O when the cache is warm)
- No network requests. Nothing leaves your vault

## Known quirks

- **Mid-night refresh** runs once per session. If you leave Obsidian open all night, the status refreshes at 00:00:05. If not — on the next open.
- The CRT phosphor aesthetic is a **separate snippet**, not plugin content — see [Aesthetic CSS](aesthetic-css.en.md) for the CSS and install instructions.

## Troubleshooting

| Symptom | Solution |
|---|---|
| Sidebar shows "No data yet" | Set the daily folder path in Settings → 📁 Paths to your own daily notes folder. On first launch it is seeded from the core "Daily notes" plugin; if that is unset, the field is empty. |
| XP counter not increasing | Settings → ⚡ XP Sources → "XP from checkboxes" must be on. Check logs via Settings → 🛠 Advanced → Log level: debug → open console (`Cmd+Opt+I`) |
| Loot drop not appearing | Check your level — loot only starts from Level 2 (200 XP). |
| Lore fragment missing | Settings → 📜 Lore → "Lore reveal active" must be on |
| Plugin fails to load | Open devtools console (`Cmd+Opt+I`), look for `[kuro]` errors |
