# Design Philosophy — Kuro Gamification

> [🇩🇪 Deutsche Version](philosophy.de.md)

This document gathers the reasoning behind every non-obvious design decision in Kuro Gamification. It is written for users who want to understand *why* the plugin works the way it does, and for contributors who need to evaluate whether a proposed change fits the spirit of the project.

---

## 1. Why this exists

Most productivity gamification tools are built for neurotypical brains. They assume you will show up every day, that missing one day is a moral failure, that notifications help, that exponential reward curves are motivating rather than exclusionary. For many people with ADHD or autism, these assumptions invert: a hard streak that breaks on day 12 is not motivating — it is a reason to stop entirely.

Kuro Gamification was built as a **friendly mirror** rather than a productivity enforcer. It reflects what you actually did, in a language that is a little fun, and occasionally hands you a small reward for being alive and doing your best. There is no judgment about days you did not open Obsidian. There is no score that decays when you step away.

The plugin is for people who want a bit of playfulness in their note-taking workflow without the anxiety that conventional gamification brings.

---

## 2. Off by default

Every feature that could feel like an obligation is **off by default** or can be disabled completely and independently:

| Feature | Default | Why |
|---|---|---|
| Status bar indicator | **off** | Permanent visibility creates ambient pressure |
| Toast notifications | off for passive events | Interruptions must be earned by explicit actions only |
| Streak tracking | on, but silenceable | Streaks are useful; pressure is not. Toggle in Settings → 🔥 Streaks |
| Loot drops | on, but silenceable | Some users do not want the reward framing at all |
| Lore fragments | on, but silenceable | Narrative may feel intrusive to some |
| Audio feedback | not implemented | Sensory interruption, never added |

The guiding rule: **you must opt in to anything that could escalate**. The plugin never nags, never sends push notifications, never auto-creates files, never touches your vault beyond reading the notes you point it at.

---

## 3. Freeze tokens — a slip is not a collapse

Streaks are genuinely useful: they create momentum and make progress visible. The problem is the cliff. One missed day in a conventional streak system destroys accumulated progress entirely, which is disproportionately punishing for anyone with variable energy, executive-function challenges, or a life that includes illness, travel, or emergencies.

Kuro's solution is **freeze tokens**: two free skip-days per month (configurable). When the streak engine encounters a gap day, it checks whether a token is available. If yes, the streak continues as if the day had not been skipped; the token is consumed. Tokens regenerate automatically on the 1st of each month.

The intent: a missed day is just a missed day. It does not undo the two weeks before it. This makes streaks a record of effort rather than a punishment mechanism.

If even that feels like pressure, turn streak tracking off entirely in **Settings → 🔥 Streaks**.

---

## 4. Deterministic loot — no slot-machine pressure

Variable-ratio reinforcement (the "slot machine" mechanic) is known to be psychologically compelling precisely because it is unpredictable. For some users that compulsive pull is entertaining; for others — especially those who experience anxiety or are prone to compulsive patterns — it is harmful.

Kuro's loot system is **deterministic**: the same three options appear every time you open the loot section at a given level. They do not change until you redeem one. There is no button to re-roll, no way to cycle through picks hoping for something better. The options are just there, waiting, with no pressure to engage with them immediately.

This also means you can ignore a loot drop entirely — indefinitely — without losing it. It will still be there the next time you look.

---

## 5. Transparent XP — you always know why

Hidden XP formulas create situations where the number goes up and you do not know why, or fails to go up and you do not know that either. Both are trust problems.

Every XP calculation in Kuro is explainable line-by-line:

- **Verbose breakdown** (Settings → 🎮 General → "Verbose breakdown") shows exactly which checkbox, habit, or bonus contributed which amount
- **Manual XP adjustment** (`Cmd+P` → "Adjust XP manually…") lets you correct mistakes or credit offline activities, with a mandatory reason field that becomes part of the audit trail
- **Export** dumps the complete state to JSON so you can inspect every decision the plugin has ever made

No black boxes. If the number looks wrong, you can find out why within two clicks.

---

## 6. Your themes, your tone

The bundled default lore is deliberately calm and plain-language — low-key, no fiction to opt out of. The plugin's gothic-cyberpunk voice — terminal aesthetics, fragmented transmissions, signal-loss metaphors — ships as an optional pack instead. That is one creative choice, not the only one. Some users will find it atmospheric; others will find it jarring or simply not to their taste.

You can replace the lore and loot entirely by importing a JSON "pack". The pack format is small and human-readable; you can also generate one by pasting a single prompt into any LLM and describing your preferred theme.

See [Customization — loot/lore packs & LLM prompts](customization.en.md) for the full guide.

The underlying mechanics — XP, levels, streaks, freeze tokens — are theme-neutral. Any voice, gothic-cyberpunk or otherwise, is a skin over those mechanics, not a load-bearing part of them.
