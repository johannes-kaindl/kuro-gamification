# Changelog

All notable changes to this plugin are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org).

## [Unreleased]

## [1.17.0] — 2026-10-25

### Added

- **The names are back in the chat.** Each question carries the name "You" ("Du" in German) and each answer "Kuro", above the text, as in the old chat (obsidian-kit 0.70.0).
- **Two switches for links and images in answers**, under Settings → Kuro chat: "Allow obsidian:// links" and "Show local images from the vault". Both are off.

### Changed

- **Links in answers are checked.** A link that could run a script or open a file (`javascript:`, `data:`, `vbscript:`, `file:`, `app:`) never works. An `obsidian://` link loses its target until you turn on the switch; it still looks like a link, but a click does nothing.
- **The question looks like the answer.** It has the same type size as the answer (it was larger) and a thin border, so it stands out in a narrow sidebar (obsidian-kit 0.70.0).
- **A network error names its technical reason.** The error line adds the message in brackets, with keys and tokens masked and cut to one line; a time-out names the seconds as a whole number.

### Fixed

- **Two side panels no longer swap their chats.** With two Kuro panels open (the tab's "Split right"), switching the chat on or off in the settings rebuilt both panels from the history of the panel that spoke last, and the other panel lost its own round. Each panel now keeps its own conversation through that rebuild; a panel opened later still starts from the latest history.

## [1.16.0] — 2026-10-24

### Added

- **A model row above the chat.** One line shows which model the chat uses and switches it: a dropdown with the models of the active endpoint, "Automatic (default model)", a reload button, and "Other endpoint …" as the last entry (it opens the LLM Endpoint Manager settings; without the manager the entry is not there). A model you chose that the endpoint no longer lists stays chosen and is marked "saved". The row is locked while an answer is running, and it follows every change of endpoint or model in the settings. Kuro still shows no thinking, so the row has no thinking control.
- **Claude as an endpoint of the LLM Endpoint Manager.** An endpoint of the manager that uses the Claude API now works in the chat; before, the plugin reported that connection type as unsupported.

### Changed

- **The companion chat is the shared chat window of the plugin family.** The input is a multi-line field: Enter sends, Shift+Enter starts a new line. A "New" button replaces the eraser (it also stops a running answer); Escape stops an answer; every question and answer has a copy button; a failed answer can be retried with "Send again"; a status line and a timer show "thinking", "writing" and "done". Your question stands out as a block. Everything that was in the chat before (the note line "Kuro currently sees …", the setup hint, "remember: …", the Markdown rendering) works as before.
- **The name labels "You" and "Kuro" and the blinking cursor in front of the answer are gone** with the old chat; the window shows who speaks by the block, not by a name.
- **Error lines are worded by the window, not by the plugin.** The server's own reason is shown only for HTTP errors; for network errors and time-outs there is no technical second line any more (the details stay in the plugin log), and a time-out names the seconds as measured (for example "1.5 s" instead of a rounded whole number). An answer cut off at the token limit carries the hint under the answer; a partial answer stays when the request fails.
- **Failed and stopped answers no longer go to the model with the next question** (before, only the error lines stayed out of the prompt).
- **Claude models are recognized as models that read images and always think.** A model whose id starts with `claude-` (`claude-sonnet-5-5`, `anthropic/claude-…`) now counts as image-capable and as a thinking model that cannot be switched off; a local model that merely carries the word in its name (`qwen3.6-claude-opus-distill`) does not. This comes with the shared-code update (obsidian-kit 0.67.1, code-kit 0.36.0); nothing else in the plugin's behavior changes with it.

## [1.15.0] — 2026-10-23

### Added

- **Number fields in the note header (new setting "Number fields in the note header").** A daily note with `tasks: 10` in its header used to show "(nothing)" in "This is what goes to Kuro", because only checkbox lines and habit fields counted. Enter the field names in the settings (`field` or `field=Display name`, several separated by commas) and Kuro sees them under "Tasks and habits" as "Display name: 10"; the chat's context line counts them ("… 1 number fields"). **The value also counts as a number of completed tasks for XP**, like that many ticked checkboxes (XP per checkbox applies, a row "Number field" shows in the XP breakdown). The daily completion bonus (50/75/90 %) still comes only from the checkbox lines, and "Today: x of y done" in the status is unchanged. The list is empty by default, so nothing changes until you enter a field; text, `true` and lists in a field are ignored, only numbers count (also `"3"` and `2,5`); for XP a fraction is rounded down and a negative number gives nothing. A single comma is always a decimal comma: `1,000` reads as 1, and `1,000.5` is not a number.

## [1.14.0] — 2026-10-18

### Changed

- **The thinking block in the companion chat has a copy button.** It copies the model's thinking as plain text; it appears once the block has text, stays usable after the answer ends, and clicking it does not fold the block. Long unbroken lines in the streaming answer now wrap instead of being cut off at the right edge.
- **With LM Studio, whether a model thinks or reads images now comes from the model's own metadata instead of only its name.** A model whose name gave no hint is no longer treated as text-only.
- **The request section of the settings warns before a request would load another model in LM Studio.** If the model you send is not loaded but others are, a line names the loaded ones: the request loads it on demand and can unload a running one ("Model unloaded.").
- **At the note "Model family recognized", a button "Set family in the manager" opens the LLM Endpoint Manager settings.**
- **With Gemma 4 on LM Studio, moving the model's thinking into the thinking block leaves the chat history as it is** instead of redrawing the whole chat (the answer area now takes back only its own stream).
- **The daily and weekly folder settings are matched by whole folder names.** A setting with a slash at the end (`Daily/`) now counts as `Daily` (before, changes in it did not refresh the status), and `..` or an empty setting matches nothing.
- **A connection type the plugin does not support (for example the manager's Claude API endpoint) is now reported as such**, instead of as a general configuration error.

## [1.13.1] — 2026-10-16

### Fixed

- The date-format code from 1.13.0 is typed so that the community store review passes again (1.13.0 was rated "Satisfactory" for four unsafe-typing warnings in the note-name parser). Nothing changes in how daily and weekly notes are read.

## [1.13.0] — 2026-10-16

### Changed

- **Gemma 4 no longer shows its thinking in the companion chat.** With Gemma 4 in LM Studio the thinking used to appear as part of Kuro's reply (until the reply ended); the reply now shows only the answer.
- **Gemma 4 on LM Studio cannot be switched off completely.** "Thinking: off" sends the lowest level there, because LM Studio ignores "none" for this model; the model still thinks a little (a few tokens, a little time).
- **The "no endpoint" message in the chat** now comes from the shared endpoint component. With a local endpoint list it reads "No endpoint reachable. Check the endpoint list in the settings — the test button says which one answers." (before: "No endpoint from the list is reachable — check the settings."); with the LLM Endpoint Manager every reason, also a configuration message, names where to fix it.
- **The LLM Endpoint Manager switched on after the plugin** is noticed: the chat picks up its endpoints when it appears, instead of staying silent for the session.
- **A model backend or family this version does not know yet** no longer breaks the request; it is sent as unknown.

### Fixed

- **The date formats in the settings now work.** "Daily date format" and "Weekly date format" decide which file names count as daily and weekly notes (before, only `YYYY-MM-DD` and `YYYY-Www` names were ever read). Notes named e.g. `14-10-2026` now count for XP and streaks, so a streak you could not see before may grow retroactively. Names that do not match the format (or are no real date, like `13-14-2026`) are still ignored.

## [1.12.2] — 2026-10-14

### Fixed

- **XP sources panel:** a source whose XP rate is 0 and that cannot be read anyway (work sessions and breaks without TaskNotes, tasks with an incomplete detection rule) is now a grey note ("XP rate is 0, so this source gives nothing — …") instead of a red error row. With a rate above 0 the red row stays, because then the source really cannot count.
- **Settings, day qualification:** the description no longer shows a decimal number ("0.5") next to a field that shows your system's decimal mark ("0,5"); it speaks of a ratio between 0 and 1 and says the field follows your system.
- **Docs:** `troubleshooting` and `getting-started` no longer promise that the **Date format** fields change which notes are read. Today only notes named `YYYY-MM-DD` (daily) and `YYYY-Www` (weekly) are read; the fields have no effect yet.

### Changed

- **Companion chat, no endpoint:** when the LLM Endpoint Manager is the source, the error line now says what is missing and where to fix it (no usable endpoint, endpoint removed, endpoint switched off, API key not stored yet, manager not answering) instead of the general "no endpoint from the list is reachable". A local endpoint list keeps the old sentence.
- Behaviour of the shared kit pins taken with the update: obsidian-kit 0.60.1 and code-kit 0.27.1 (from 0.59.1 and 0.24.0). The other changes in 0.60.0, 0.60.1, 0.25.0, 0.26.0, 0.27.0 and 0.27.1 (tool-provider contract, share export, plugin-id check, data URLs, sizes, slugs, secret value, byte tokens, Lua-port exports) do not change what this plugin shows; the list of dropped request settings (`sanitizeRequestSettings`) is now sorted, which only changes the order of that hint. Local dates (`YYYY-MM-DD`, `YYYY-MM`) come from the kit now with the same result; an invalid date throws instead of printing `NaN`.

## [1.12.1] — 2026-10-14

### Changed

- **The model ID in the endpoint list stays visible.** At normal window width the model ID in an endpoint row is no longer cut off (a cut-off value reads like a different model); a very long ID gets its own line. In a narrow window, the block of model field and buttons moves to a second row as a whole (obsidian-kit 0.59.1).

## [1.12.0] — 2026-10-12

### Changed

- **The endpoint list keeps "move up" and "remove endpoint" together.** In a narrow settings window the two buttons stay in one row instead of the trash can standing alone on a second line; the key and model fields are a little narrower, the address stays fully visible (obsidian-kit 0.59.0).
- **The chat answer follows large blocks to the end.** While Kuro's answer streams in, a whole paragraph, table or code block arriving in one piece no longer stops the follow-along: the view stays at the end as long as you are at the end. If you scroll up yourself, it does not pull you back (obsidian-kit 0.59.0).
- **Settings, section "Request": an unknown model family reads as pending.** For a freshly added endpoint the header says "Family: not detected yet · Backend: not detected yet" with a hint that this is normal and that the LLM Endpoint Manager records family and backend per model; the field lines read "Not sent yet — waits for the model family" (obsidian-kit 0.59.0).
- Kit pins raised to obsidian-kit 0.59.0 and code-kit 0.24.0 (from 0.56.0 / 0.23.0). The releases in between (0.56.1 `fetchEndpointContext`, 0.56.2 embedding rows without "server picks", 0.57.0 build and mock helpers, 0.58.0 linearity fuzz probe, code-kit 0.24.0 `busy-guard`/`sanitizeBase`) change nothing you can see in Kuro.
- **The Status/Chat tab bar is the shared hub tab bar.** The tabs now carry an icon and a label, mark the active tab with an underline, wrap onto a second row in a narrow sidebar instead of being squeezed, and can be reached with the arrow keys (Left/Right/Home/End). Without the chat enabled there is still no tab bar. Toggling the chat in the settings now also tears down the old chat panel before building the new one.

## [1.11.0] — 2026-10-12

### Changed

- **The context length sits on the endpoint row.** Under an endpoint that is reachable and has a model, the settings show "Context: loaded N · max M tokens" (only "max M" when the model is not loaded; nothing when the server names no number). Each lookup gives up after 5 seconds.
- **A model chosen on an endpoint row can be set back to "— (server picks)".** Picking it removes the row's model, and the server answers with whatever it has loaded. The global-model option is gone from the dropdown; a stored global value is no longer read by the connection (the one-time move of the old `chatModel` onto your rows stays as it was).
- **Without the LLM Endpoint Manager the model choice counts for the active row only.**
- **More precise endpoint hints.** A timeout and a server that does not speak an LLM API get a longer hint ("wrong network / VPN off?", "wrong path/service?"), and "Not reachable" no longer ends in a stray dash.
- **Chat answers: a safety net against remote content.** Anything in Kuro's reply that would load by itself from the internet (images, frames, stylesheets) is removed from the chat view, in addition to the existing markdown filter. A ```mermaid block is shown as plain text instead of a diagram, because a diagram can pull in remote content; the source stays readable.
- **Secrets in your questions are caught more widely.** The `Bearer <token>` rule matches from 8 characters and ignores case, so prose such as "Bearer authentication" is replaced too; the reply shows your original text.
- A long reply with tens of thousands of open `<think>` tags no longer stalls the check for seconds; long streamed answers render faster.

### Fixed

- **Closing the sidebar releases the chat's watcher** (the new remote-content net is detached with the view).

### Internal

- Kit pins raised to obsidian-kit 0.56.0 / code-kit 0.23.0 (new vendored modules: `dom-guard`, `embedding-connection`, `endpoint-plumbing`, `endpoint-status-text`, `embeddings-client`, `model-context`, `timeout`, `remote-resources`); `styles.css` carries the endpoint list's context-line rule.
- `loadRequestSettings` comes from the kit; the `chatSuppressThinking` migration is the exported `REQUEST_MIGRATIONS` with `foldLegacyThinking`. The chat panel takes an `{ domGuard }` option so tests with the fake DOM can switch the net off (production keeps it on).

## [1.10.0] — 2026-10-10

### Fixed

- **Streak: the running day no longer counts as a gap.** Until midnight today is neutral, so yesterday's streak no longer reads 0 when today's note is still empty.
- **Streak: freeze tokens are actually spent.** Each gap now costs exactly one token (tokens reset to the monthly allowance on the 1st; unused ones do not carry over). **FREEZE-TOKENS now shows what is left this month.**
- **Streak bonus is credited per streak day and kept when the streak ends.** Until now the bonus was recomputed from the current streak only, so it vanished with the streak. The bonus of an unbroken streak is unchanged (7 days = 70 XP, 30 days = 600 XP).
- **Source panel: the daily-note pomodoro bonus shows its real rule** ("counts · 5 XP when "pomodoros" reaches 4 in a day") instead of raw `{rate}` and `{count}` placeholders. With TaskNotes storing sessions in the daily note and the per-session rate at 0, work sessions and breaks show a hint instead of an error row.

### Added

- **Working days for streaks.** Choose the weekdays you work (Settings → Streaks, all seven by default). A day off without a qualifying note is neutral: it does not count, does not break the streak and costs no token. A daily-note property (**Day-off property**, off by default) with a list of values (`Wochenende, Feiertag, Frei`) marks single days the same way. A qualifying note always counts.

### Changed

- **The global "Model" setting is gone.** The model now lives only on each endpoint row (the kit's `code-kit` 0.17.0). On the first start after the update your old global model is copied onto every row that has no model of its own; rows that already name a model stay as they are. Consequences: a new row no longer inherits a model, a row's model picker has no empty "use the global model" entry any more, and an old global model without any endpoint row (a setup that only used the LLM Endpoint Manager) is dropped. Rows you clear on purpose stay empty.
- **Total XP rises once** by the streak bonus of streaks that have already ended; streaks longer than 365 days now count in full.
- **In rare cases the bonus can drop:** if a calendar month has more gaps than freeze tokens, the tokens now cover the oldest gaps first (they used to cover the newest), which can end an old streak earlier than before.

## [1.9.0] — 2026-10-09

### Changed

- **Companion chat: the kit's shared LLM connection instead of Kuro's own endpoint code** (`obsidian-kit` 0.51.2, `code-kit` 0.15.0). Visible consequences:
  - **Deadlines:** the wait for the first data is now **10 minutes** (was 2 minutes), so a model that is still loading no longer aborts the first question. Once data flows, 2 minutes of silence still end the answer; the message names the real number of seconds.
  - **Endpoint and request settings look like in the other plugins that use the kit.** The endpoint list and the **Request** section are drawn by the kit with its own wording (for example **Test connection**, **Try this endpoint first**, status **Timed out**). The **Level picker in chat** switch in the Request section is gone: Kuro has no chat button for it, so it never did anything.
  - **A saved manager choice only counts while the LLM Endpoint Manager is installed.** Without the manager, the local list's model (the row's model, then the global **Model**) is used; an old manager choice can no longer override it.
  - **If the chat has no endpoint at all** the error line now also names the reason the manager or the list gave.
  - **Choosing the global Model** takes effect for the next question immediately (the connection is resolved again).
  - The kit's wording replaces Kuro's own endpoint and request texts, so a few labels in the settings changed.
- **API keys of local endpoints now live in Obsidian's keychain**, not in `data.json`. Existing keys move over the first time the chat resolves an endpoint (or when you open the settings); nothing to do.
- **Secrets are masked before a question leaves your machine** (API keys and tokens, `Bearer …` headers, private-key blocks). The model sees a placeholder such as `[redacted-token]`; Kuro's answer shows your original again. E-mail addresses are not masked.
- **Model answers can no longer pull in pictures, run code blocks or insert HTML.** An image in an answer is shown as plain text (so a prompt-injected answer cannot send your text to an address by loading an image), a ```` ```dataviewjs ```` block is displayed as text instead of running, and `<` is escaped. Ordinary Markdown (bold, lists, links) renders as before. Links stay clickable.
- Kit pin on `obsidian-kit` 0.51.2 / `code-kit` 0.15.0; the endpoint, request and streaming-area styles in `styles.css` are the kit's current text again, and a test now fails when they drift apart.

## [1.8.1] — 2026-10-03

### Changed

- The author shown in Obsidian's plugin list is now "Johannes Kaindl".
- The changelog is now written entirely in English.
- Internal design notes moved out of the repository; the user documentation is unchanged.

## [1.8.0] — 2026-09-30

### Added

- **Request section in the companion chat settings** (sampling profiles, `obsidian-kit` 0.45.1 `request-section`, `code-kit` 0.8.0 `capabilities`). It shows which model family and backend Kuro talks to, which sampling values are sent (temperature, top_p, top_k, min_p, presence penalty, thinking effort) and whether they are known to work on that backend. You can override any value per model family, reset it, see the last request sent this session (copyable) and any deviation the server answered with.
- The GitHub release now also carries a ready-to-unpack `kuro-gamification.zip` (the plugin folder with `main.js`, `manifest.json` and `styles.css`) and a `checksums.sha256` file. For a manual install, download the zip and unpack it into `.obsidian/plugins/` instead of creating the folder and saving three files by hand.

### Changed

- **The companion chat now sends its sampling values from the shared profile table** for the mode "companion" instead of fixed code values. Temperature stays 0.7; with a known model family it adds the family's recommended top_p/top_k and a thinking effort (default: off). With an unknown family it still sends only the temperature and the token budget (1024). When you turn thinking on, a family with a known reserve raises the budget so thinking cannot use it all.
- The **Suppress thinking** switch is replaced by the **Thinking level** dropdown in the new section (off / low / medium / high). Your old choice moves over once: suppress on becomes "off", suppress off becomes "low". The "Level picker in chat" switch in that section has no effect in this plugin (there is no chat button for it).
- The model is sent under the spelling the endpoint knows (alias resolved by the LLM Endpoint Manager), not always under the name shown in the list. Without the manager the model family is now also recognised from the model name, so local endpoints get the family's values too.
- Kit chat client 0.44.0 (no user-visible change)

## [1.7.0] — 2026-09-26

### Changed

- **Companion chat: kit chat client instead of its own client** (`obsidian-kit` 0.43.0, `chat-client` + `chat-transport`). Visible consequences: (1) The deadline now measures **silence**, not duration — a long, healthy answer no longer aborts after 120 s; a silent server aborts after 120 s without data (message: "Nothing has come from the endpoint for 120 seconds"). (2) On an HTTP error the detail line shows the server's message instead of "HTTP 500: …". (3) If a server refuses the stream (origin/CORS check), the client retries the request once without streaming instead of reporting "no connection". (4) Reasoning now comes from the client but is still not displayed, as before. (5) New error texts for a conversation that is too long and for an answer that ends at the token limit before the first word; an answer cut off at the limit that has text carries a note below it.
- Kit pin on `obsidian-kit` 0.43.0; the endpoint row in the settings gets the kit's child selectors (`.okit-ep-row > …`), so a setting inside the row does not lose its label.

## [1.6.0] — 2026-09-26

### Added

- **Help row at the very top of the settings** with links to the documentation and the issue tracker (German and English, kit 0.43.0 `help-setting.ts`, vendored individually).

## [1.5.0] — 2026-09-25

### Added

- **Companion chat: endpoints from the LLM Endpoint Manager.** If the `llm-endpoint-manager` plugin is installed, the chat endpoints including the model come from there (kit `endpoint-source`, capability `chat`); the settings show the manager section with endpoint and model choice instead of the endpoint list. Visible consequence: with the manager, the local list is no longer queried (it stays saved); without the manager everything works as before. The global model ("Global model") now applies only without the manager.

### Fixed

- **Companion chat: Markdown in answers is rendered.** Bold, lists, code and quotes appear as such instead of asterisks and dashes. Finished answers are rendered; during the stream, completed paragraphs are rendered and only the running one stays raw text. Your own question and error texts stay raw text.
- **Companion chat: the "Kuro sees right now …" line was stale.** It and the preview below it now follow the daily note even when the chat tab stays open; before, they showed the state of the last chat action of your own.
- **Companion chat (mobile): the input row is no longer covered by the system bar at the bottom** (`env(safe-area-inset-bottom)`).

### Changed

- Settings: the descriptions of "Own voice", "Notepad" and "From the daily note" are understandable without prior knowledge (with an example; for the daily note it says that only checkbox lines and habit fields count, not a bare number in the note header).
- **Companion chat: the streaming answer area now comes from the kit** (`buildStreamArea`,
  `obsidian-kit@0.35.0`, UI-STANDARD §8) instead of a home-grown one. Visible consequence: the
  running paragraph only scrolls along while you are at the bottom edge yourself (`atBottom`,
  40 px tolerance) — if you scroll up during the stream, you now stay where you are instead of
  being pulled down on every token. No thinking block affected: Kuro does not stream
  reasoning.
- **Kit pin: `obsidian-kit` 0.29.0 → 0.41.1, `code-kit` 0.5.0 → 0.7.0** (`tools/sync-kit.sh`, fixed refs, not the kit working tree). Newly vendored: `stable-writer`, `endpoint-source`, `stream-blocks`, `sampling-profiles`. `tools/sync-kit.sh` points to `../../libs/code-kit`; the old path `../../code-kit` did not exist.

## [1.4.1] — 2026-09-03

### Fixed

- **Companion chat: answers from servers that send full message objects despite
  `stream: true` now arrive.** The SSE parser only read `choices[0].delta`; if the field was
  missing, the text was missing — without an error message. It now falls back to
  `choices[0].message` (from code-kit 0.5.0).

### Changed

- **Vendoring switched to two sources** (internal, no behaviour change): the
  platform-neutral layer has come directly from `code-kit@0.5.0` since the code-kit split, the
  Obsidian layer still from `obsidian-kit@0.29.0`. Four modules (`num`, `reasoning`, `sse`,
  `think-splitter`) no longer exist in the kit at all.

## [1.4.0] — 2026-09-01

### Added

- **XP aus TaskNotes**: completed tasks, finished pomodoro work sessions and **breaks**.
  Rewarding breaks is deliberate — they are the counterweight to hyperfocus. All three rates
  default to 0, so every source stays off until you turn it on.
- **Source panel in the settings tab**: for each source it shows whether it counts — and if not,
  why. Always visible, no toggle in front of it. Four states rather than two: a source can be
  readable but sitting at rate 0, which now says so instead of looking broken.
- **Task detection is yours**: which frontmatter field marks a task, which value, which status
  field and which values mean "done" are Kuro's own settings. If TaskNotes is installed and
  configured differently, the panel offers to adopt its configuration with one click.
- A short notice the moment XP is gained (throttled, can be switched off).

### Fixed

- The pomodoro bonus could silently never fire when TaskNotes keeps its sessions in its own
  plugin storage (`pomodoroStorageLocation: "plugin"`) instead of the daily note. The previous
  hint explicitly did not cover that case. Kuro now reads those sessions directly — and says so
  when it cannot.

## [1.3.0] — 2026-08-18

### Changed

- **Requires Obsidian 1.13.0 or newer.** The settings tab is now rendered declaratively by
  Obsidian itself from `getSettingDefinitions()`, which is the only render path left. If you
  are on an older Obsidian, stay on 1.2.0 — it keeps working; you just will not receive
  further updates until you upgrade the app.

### Removed

- The imperative `display()` fallback for Obsidian < 1.13, along with the collapsible,
  collapsed-by-default settings sections it drew. The declarative settings API has no
  equivalent for collapsing a group, so those sections are gone. On Obsidian 1.13 they were
  already gone in practice: the framework stops calling `display()` as soon as
  `getSettingDefinitions()` returns anything, so nothing that was still visible was removed.
  In exchange the settings are now indexed by Obsidian's global settings search.
- The `uiCollapsed` setting (it only stored which sections were collapsed) and the vendored
  `collapsible.ts` / `folder-suggest.ts` modules, which lost their only caller. Folder fields
  keep their suggestions — Obsidian's own `folder` control provides them.

## [1.2.0] — 2026-08-18

### Added

- **Companion chat (off by default).** Kuro can now talk to you — asking what to start with,
  saying you're stuck, thinking the day through out loud. It adds a body-doubling layer on top
  of the existing scaffolding. Streams from an OpenAI-compatible endpoint you configure
  yourself (built for local servers like LM Studio or Ollama); no preset provider, no cloud
  default. While `Enable chat` is off, the plugin makes no network connection at all and the
  sidebar looks exactly as before.
- The sidebar gained **tabs** (Status · Chat) when the chat is enabled. Both bodies stay in the
  DOM; the 800 ms snapshot refresh only redraws the status one, so an in-flight conversation
  and a half-typed question survive editing any note.
- **Notes (📌)** — a short, persistent list of sentences Kuro keeps in context ("Don't remind
  me about streaks unprompted"). Added via `remember: …` in the chat, a pin button next to
  your own messages, or the settings; editable and deletable there at any time. Capped at 20
  entries, and when full the add button is disabled rather than silently dropping the oldest.
  The conversation history itself is deliberately **not** persisted.
- **Transparency about what is sent.** `From today's note` chooses between nothing, the
  checkbox and habit lines (default), or the whole note; journal prose stays out unless you
  ask for it. Both the settings and the chat tab show a live preview of exactly what would go
  out, rendered by the same function that builds the prompt.
- **`persona` field for packs** — the chat's voice follows the active lore pack (warm for
  Cozy, dark for Gothic) and can be overridden with your own text in the settings. Optional
  and length-capped; the pack format stays at `kuroPack: 1`.
- **Endpoint fallback list.** The single endpoint field is now an ordered list — mix local
  servers (LM Studio, Ollama) and hosted providers, each with its own optional API key and
  model override; the first reachable one wins, and it re-resolves after any edit. Every row
  shows a live status icon, a "in use / reachable, position N / not reachable" line, and a
  connection warning (bad scheme, missing port, placeholder address) as you type — no more
  guessing whether an address was even accepted. One-click presets for LM Studio and Ollama.
  A saved endpoint migrates into the list automatically, key included.

- **The README now shows the plugin.** Five screenshots — the sidebar panel next to a note,
  the companion chat, the loot dialog, the `kuro-status` code block, and the full settings tab
  — taken reproducibly against a real Obsidian (`npm run shots`, recording contract in
  `docs/images/README.md`). The numbers in them are computed by the plugin from a generated
  demo vault, not written by hand.

### Fixed

- **Endpoint setup gave no feedback when it failed.** The old model field was a text box plus
  a refresh button that silently picked the first model on success and showed one generic
  "unreachable" message on failure — no way to tell a refused connection from a wrong path
  from a missing API key. The model list fetch also never sent the configured API key, so any
  endpoint that requires one always failed there even though chat itself worked. Fixed by the
  endpoint fallback list above: every row probes with its own key and reports a specific,
  localized reason: refused / timed out / wrong host / unauthorized / not an OpenAI-compatible
  API. The model field is a real dropdown once a list loads, with a manual-entry fallback for a
  model the endpoint doesn't list.
- **"Enable chat" didn't save.** The toggle looked switched on but never actually wrote the
  setting — no case for it existed in the settings-control switch, so the click was silently
  dropped. The chat tab never appeared, and after restarting Obsidian the toggle was back off
  even though the endpoint you'd configured was still there. Present since the very first
  version of the chat feature; only surfaced now because settings rendering can't be
  unit-tested and this was the first real run against Obsidian.
- **The chat panel's input row could scroll off-screen.** A long conversation grew the message
  log without bound instead of scrolling inside its own space, eventually pushing the input
  field and the abort button past the visible area — mid-stream, the abort button became
  unreachable right as you needed it. The message log now scrolls in place; the input row and
  context toggle stay fixed at top/bottom of the chat panel.

### Removed

- **The 📌 pin button on your own chat messages.** It saved the raw message text verbatim into
  the notes list, which made sense for a statement but not for a question — pinning "what
  should I start with?" doesn't give Kuro anything useful to remember, and the tooltip ("Note
  this") read like it would save the question as a reusable prompt, which it didn't. Type
  `remember: …` in the chat, or add a note directly in settings — both make clear what's being
  kept, unlike a button next to an arbitrary line.

## [1.1.0] — 2026-08-11

### Added

- **TaskNotes pomodoro field-mismatch hint.** If the [TaskNotes](https://github.com/callumalpass/tasknotes)
  community plugin is installed and stores pomodoro sessions in daily notes
  (`pomodoroStorageLocation: "daily-notes"`) under a frontmatter key that differs from Kuro's
  `pomodoroFrontmatterKey`, the settings tab now shows a hint with a one-click fix instead of the
  bonus silently never firing. No warning if TaskNotes isn't installed, uses its own plugin
  storage, or the keys already match.

### Changed

- Destructive buttons no longer call the deprecated `setWarning()`. They go through the kit's
  `applyDestructive()`, which uses `setDestructive()` on Obsidian 1.13+ and falls back to the
  native `mod-warning` class below it — so the store review stops flagging it without raising
  `minAppVersion` above 1.8.7. Vendored `confirm.ts` re-copied from obsidian-kit@0.25.0.
- README (EN + DE) restructured to the workspace README gold standard
  (`_docs/templates/README-obsidian-plugin.md`): features first, context paragraph under the
  badge row, install in three ways (Community · Manual · From source), a Contributing section,
  and the `src/`-layout details moved out of the README into `AGENTS.md` (PROF-OBS-05).
- README command references now match the actual command names ("Adjust XP manually…" /
  "XP manuell anpassen…"), and the palette is referenced without a hardcoded hotkey.
- README.de.md brought to parity with the English version — it was still missing the
  Community-Plugins install path, the aesthetic-CSS section and the contributing pointer,
  and described the XP curve as linear rather than linear-quadratic.

### Fixed

- Nested `kuro-status` example in both READMEs was written with a three-backtick outer fence,
  which terminated the block early; it now uses a four-backtick fence.
- **Pomodoro bonus XP was never awarded when [TaskNotes](https://github.com/callumalpass/tasknotes)
  writes its session history to daily notes** (`pomodoroStorageLocation: "daily-notes"`). That
  mode stores an array of session objects in the frontmatter field, but the XP engine only
  understood a plain number there and silently treated the array as "no pomodoros". It now
  counts completed work sessions from that array (breaks and interrupted sessions excluded);
  a plain numeric field still works exactly as before. The two Pomodoro settings that had no
  description at all now explain both accepted formats.

## [1.0.6] — 2026-07-25

### Fixed

- Last remaining CSS-lint warning ("Avoid !important") on the reduce-animations a11y override
  removed — the selectors already carry one extra class (`.kuro-no-animation`, added to an
  ancestor) over the rules they override, so they win on specificity alone without `!important`.

## [1.0.5] — 2026-07-25

### Fixed

- Real Developer Dashboard review findings (from the actual submission scan, beyond what the
  local `eslint-plugin-obsidianmd@0.3.0` could catch): replaced the `builtin-modules` npm
  dependency with Node's built-in `node:module` `builtinModules`; `document.createElement` /
  `el.createEl('div', …)` replaced with `doc.body.createEl(...)` / `el.createDiv(...)` in
  `fileIo.ts` and the codeblock processor; removed the `ui-monospace` CSS value (unsupported by
  Obsidian's baseline).
- The CRT/phosphor aesthetic CSS is no longer a tracked `.css` file in the repo (was
  `assets/kuro-gamification.css`, never bundled with the plugin) — it's now a markdown doc
  (`docs/aesthetic-css.{en,de}.md`) with the same CSS as a code block, so it no longer gets
  swept into the store's CSS lint (`!important`/`clip-path` warnings) despite never shipping.

- Settings tab now implements `getSettingDefinitions()` (Obsidian ≥ 1.13's declarative settings
  API, required for entries to appear in Obsidian's global settings search) alongside the
  existing `display()`, which now walks the same declarative definitions for Obsidian < 1.13 —
  a single source of truth, no behavior change on the pre-1.13 path. `minAppVersion` stays 1.8.7
  (no bump needed; only the TypeScript types moved to a newer `obsidian` devDependency). Known
  trade-off: the native ≥ 1.13 renderer shows all sections flat and expanded — it has no concept
  of the collapsible, collapsed-by-default sections used below 1.13 for overload reduction.

### Internal

- `eslint-plugin-obsidianmd` upgraded 0.3.0 → 0.4.1 — the older version doesn't even implement
  several rules the real scanner enforces (`prefer-create-el`, `settings-tab/prefer-setting-definitions`).
- `tsconfig.json` gained `skipLibCheck: true` — the newer `obsidian` type definitions (1.13.x)
  have an internal inconsistency (`Menu`/`Modal`/`PopoverSuggest` vs. `HistoryHandler`) that only
  surfaces without it; irrelevant to our own source, which is still fully checked.

## [1.0.4] — 2026-07-25

### Fixed

- `minAppVersion` raised from 1.5.0 to 1.8.7 — the actually-lowest floor that covers every API
  the plugin calls (`Workspace.revealLeaf`, `Vault.getAllFolders`, `getLanguage`).
- Every command's display name no longer duplicates the plugin name — Obsidian already prefixes
  command-palette entries with it, so commands used to show up doubled ("Kuro Gamification: Kuro: ...").
- UI language detection now uses Obsidian's `getLanguage()` instead of reading `localStorage`
  directly.
- The "no data yet" message inside an embedded `kuro-status` code block was a hardcoded German
  string, shown regardless of the user's language — now properly localized.
- Popout-window-safe globals: `window`/injected `Document` instead of `globalThis`/global
  `document.createElement`/`element.style.display` in a few remaining spots.
- `console.info` (disallowed by the store guideline) replaced with `console.debug` in the logger.

### Internal

- Added `eslint-plugin-obsidianmd` as an additive guideline gate (`npm run lint:obsidian`) next to
  biome — mirrors the real Community Plugin review scanner locally.

## [1.0.3] — 2026-07-25

## [1.0.2] — 2026-07-25

## [1.0.1] — 2026-07-25

### Documentation

- README (EN+DE) now covers all workspace-required sections: Requirements, Usage, Configuration, How it works.
- Release badge switched from static to a dynamic Codeberg release badge.

### Internal

- Release tooling now delegates to the workspace-central `../tools/release/` (`release`/`version-bump`/`preflight`) instead of a vendored, stale copy in `scripts/`.

## [1.0.0] — 2026-07-25

First public release. Neurodivergence-friendly gamification for your notes —
off-by-default for everything that could escalate.

### Core engines

- **XP engine:** per-checkbox + completion bonuses (50/75/90 %), habit toggles, pomodoro bonus, weekly review/planning bonus, manual adjustments.
- **Streak engine** with monthly-regenerated **freeze tokens** (default 2/month). Streak-bonus tiers at 3/7/14/30 days.
- **10 levels** `SIGNAL LOST` → `K U R O` on a linear-quadratic XP curve (200 … 18000).
- **Deterministic loot:** 5 tiers (Common/Rare/Epic/Legendary/Mythic), seeded shuffle, 50+ default rewards, custom-pool override.
- **Lore reveal:** narrative fragment per level, custom-lore override.
- Pure-function engines with no Obsidian-API coupling.

### Adoptable for others

- **Pack library (`📚 Packs` hub):** install / activate / delete / reset / import loot-, lore- and habit-content packs from one place; activating a pack is a single, progress-safe operation.
- **LLM-assisted pack import:** users generate their own loot/lore `KuroPack` with a documented prompt and their own LLM, then import validated, progress-safe JSON — no form editors. Bundled themes: **Gothic / Plain / Cozy**.
- **Validated import:** `PackValidator` rejects malformed packs with stable, localized issue codes.
- **Guided onboarding:** welcome modal + empty-state guidance; existing users are exempted via a migrate guard.
- **Bilingual:** German (default) + English, all user-facing strings via the i18n module.

### Surfaces

- Sidebar status view, `kuro-status` Markdown code-block processor, 10+ commands in the Command Palette, status-bar item (off-by-default), reduce-animations toggle (a11y).
- Forward-compatible data store (deep-merge against defaults, schemaVersion-tagged), export/import via clipboard JSON.

### Quality & release readiness

- **Submission gate** (`SubmissionGate`): pure `manifest.json` / `LICENSE` validation runs in the test suite, so a store-incompatible manifest fails `npm test` — the biome-only equivalent of the community `eslint-plugin-obsidianmd` manifest/license rules.
- 209 unit tests across engines, data store, i18n, pack library and the submission gate.
- **License:** AGPL-3.0-or-later for code (`LICENSE`), CC BY-SA 4.0 for docs (`LICENSE-DOCS`); dual-licensing documented in `LICENSING.md`, contributions under `CLA.md`.
- TypeScript strict mode, ES2018 target, **zero runtime dependencies**, esbuild bundling, biome linter, `tsc` build gate.

### Notes

- The `assets/kuro-gamification.css` snippet (CRT/phosphor aesthetic) is **not bundled** in the plugin — install it separately as a Vault CSS snippet.
- TaskNotes integration is soft (transparent via `vault.modify`); no hard dependency.
