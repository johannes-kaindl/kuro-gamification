# Troubleshooting

Each entry starts with what you see — the wording is the plugin's own English text — then the cause and what to do. If yours is not here, see [Getting help](#getting-help).

## The sidebar says "Let's get you set up" / "No data yet"

> Let's get you set up

> No data yet — please recompute the status.

> >_ Kuro: no data yet — tick a checkbox in today's daily note.

**Cause:** the plugin has not read any daily note yet. Usually the daily notes folder is not set (it stays empty when Obsidian's core *Daily notes* plugin is not configured), or no XP source is switched on, or nothing has been ticked yet.

**Fix:**

1. **Settings → Kuro Gamification → 📁 Paths**: set **Daily notes folder** to where your notes live, and make sure your daily notes are named `YYYY-MM-DD` and your weekly notes `YYYY-Www`. Currently only these ISO file names are read; the **Date format** fields do not change that yet.
2. **⚡ XP sources**: make sure at least one source is on (checkboxes are on by default).
3. Tick a checkbox in today's daily note, then press **Recompute** in the sidebar (or run the command **Recompute status**).

## Ticking a checkbox does not change the XP

**Cause:** the plugin watches saves of your daily and weekly notes (about one second after the change). The checkbox has to be a task in the note that matches today's date, inside the daily notes folder.

**Fix:** save the note, wait a second, or run **Recompute status**. If it still stays at 0, re-check the folder and date format above — a note not named `YYYY-MM-DD` is not recognised as today's.

## The Redeem loot button is missing

**Cause:** you get one loot drop per level above 1 — nothing is offered at Level 1 (below 200 XP by default), and after you redeemed a level's drop there is nothing left until the next level. Loot can also be switched off.

**Fix:** keep earning XP; check **Settings → 📊 Levels & loot** that loot is enabled. The options shown stay the same until you pick one — there is deliberately no re-roll.

## "No lore fragment available for the current level."

> No lore fragment available for the current level.

**Cause:** the active lore pack has no text for this level, or lore is off.

**Fix:** **Settings → 📜 Lore** to switch it on, or **📚 Packs** to activate a pack that covers all levels. The import dialog warns about this beforehand: "No lore for level(s) … — those levels will show nothing."

## A pack will not import

> This pack has problems — nothing was imported:

**Cause:** the pack file is not valid or lacks something. The dialog lists each problem with its position, for example:

| Message | Meaning |
|---|---|
| That is not valid JSON: … | The text is not JSON — a stray comma or an unclosed bracket. |
| Missing "kuroPack" version number. | The file has no `kuroPack` field. |
| The pack has none of "loot", "lore", or "habits". | There is nothing to import. |
| Unknown loot tier "…". Allowed: … | A loot tier name is misspelled. |
| Loot item … needs string "name" and "cat". | A loot entry lacks a name or category. |
| Lore fragment … needs numeric "level" and string "title" + "text". | A lore entry lacks one of the three. |
| Duplicate lore for level … | Two fragments claim the same level. |

**Fix:** correct what the dialog names and import again; **Import anyway** appears only for warnings that do not block. Your XP and progress are never touched by an import. See [Customization](customization.en.md) for the pack format.

## A code block shows "invalid config"

> ⚠️ Kuro code block: invalid config (…)

**Cause:** the options inside a ```` ```kuro-status ```` block are not valid.

**Fix:** correct the line the message names, or delete the block and insert a fresh one with the command **Insert status code block**.

## "Kuro: save failed — see the console."

> Kuro: save failed — see the console.

**Cause:** writing the plugin's `data.json` failed (disk full, a sync client holding the file).

**Fix:** free space or pause the sync client, then trigger any change; open the developer console (<kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>) for the exact error. Use **Settings → 🛠 Advanced → Export** to keep a copy of your data first.

## The companion chat cannot reach its endpoint

> No endpoint from the list is reachable — check the settings.

> Could not reach the endpoint.

> Nothing has come from the endpoint for {seconds} seconds.

**Cause:** the chat is optional and off by default. When it is on, none of the addresses in its endpoint list answered, or the server sent nothing for too long. The chat waits up to 10 minutes for the first data (a model that is still loading) and ends an answer after 2 minutes without data. These times are fixed; there is no setting for them.

**Fix:** start your local model server and load a model, then check the endpoint list under **Settings → 💬 Kuro chat** (the **Test connection** button shows what the server answers). With the LLM Endpoint Manager installed, the endpoints come from there instead. The error line also names the reason the manager or the list gave.

## "The answer was cut off at the token limit"

> The answer was cut off before the first word — thinking used up the token limit.

**Cause:** the model hit the token budget while answering, or used it all for thinking before the first word.

**Fix:** under **Settings → 💬 Kuro chat → Request** set **Thinking level** to *off* or *low*, or raise **Token budget (max_tokens)**.

## Getting help

Open an issue at <https://github.com/johannes-kaindl/kuro-gamification/issues>. Say which Obsidian version and platform you use, what you did, and the exact text of any message.
