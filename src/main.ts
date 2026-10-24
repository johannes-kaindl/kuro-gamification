/* ==========================================================
   Kuro Gamification — main plugin entrypoint.
   ========================================================== */
import {
  Plugin, type WorkspaceLeaf, type TAbstractFile, TFile, debounce, Notice,
} from 'obsidian';

import {
  type KuroPluginData, type KuroSnapshot, DEFAULT_PLUGIN_DATA,
} from './types';
import { DataStore } from './persistence/DataStore';
import { VaultReader } from './persistence/VaultReader';
import { Logger } from './utils/logger';
import { XpEngine } from './engine/XpEngine';
import { StreakEngine } from './engine/StreakEngine';
import { LootEngine } from './engine/LootEngine';
import { LoreEngine } from './engine/LoreEngine';
import { KuroSidebarView, VIEW_TYPE_KURO } from './views/KuroSidebarView';
import { makeKuroCodeBlockProcessor } from './views/KuroStatusCodeBlockProcessor';
import { LootRedeemModal } from './modals/LootRedeemModal';
import { WelcomeModal } from './modals/WelcomeModal';
import { KuroSettingsTab } from './settings/SettingsTab';
import { registerCommands } from './commands/registerCommands';
import { isInFolder } from './vendor/kit/folder-scope';
import { readDailyNotesConfig } from './vendor/kit-obsidian/daily-notes';
import {
  readTaskNotesConfig, readPomodoroSessions, readCompletedTasks, taskRuleFromSettings,
  subscribeTaskNotes, markedDates,
} from './utils/taskNotesBridge';
import {
  pomodoroBonusSuppressed, shouldNotifyGain, type TaskNotesInput,
} from './engine/TaskNotesXp';
import { todayIso, isIsoDate, isIsoWeek } from './utils/dateUtils';
import { fmtNum } from './utils/progressBar';
import { t, detectLang } from './i18n';
import { defaultHabits } from './data/default-habits';
import { splitChatMessages } from './llm/chatRequest';
import { EMPTY_CHAT, type ChatHistory, type ChatModelMessage } from './vendor/kit/chat-history';
import type { ChatSendHandlers, ChatSendResult } from './vendor/kit-obsidian/chat-window';
import { kuroConnectionOptions } from './llm/kuroConnection';
import { createLlmConnection, type LlmConnection } from './vendor/kit-obsidian/llm-connection';
import { buildContext } from './llm/kuroContext';
import { buildMessages, resolvePersona } from './llm/kuroPrompt';
import { addNote, extractNoteFromMessage, MAX_NOTES } from './llm/kuroNotes';
import { findEndpointManager, onEndpointManagerChanged } from './vendor/kit-obsidian/endpoint-source';
import { activePersona } from './utils/packLibrary';

export default class KuroPlugin extends Plugin {
  // public so views/modals/settings can read/mutate
  public data: KuroPluginData = JSON.parse(JSON.stringify(DEFAULT_PLUGIN_DATA)) as KuroPluginData;
  public dataStore!: DataStore;
  public vaultReader!: VaultReader;
  public logger!: Logger;

  /** Companion-Chat: Verlauf einer Obsidian-Sitzung, bewusst nicht persistiert (ein wachsender Verlauf in data.json gefährdet die Datei mit
   *  den Schema-Migrationen und wäre trotz Token-Kosten kein verlässliches Gedächtnis; dafür gibt es den Merkzettel). Das Chat-Fenster
   *  der Sidebar hält ihn und meldet jede Änderung hierher, damit er ein Neuaufbauen der Ansicht überlebt. */
  public chatHistory: ChatHistory = EMPTY_CHAT;
  /** Rohtext der heutigen Daily — nur gefüllt, wenn der Chat aktiv ist. */
  public lastDailyText: string | null = null;
  /** Die ganze LLM-Anbindung: Endpunkt-Quelle (Manager oder lokale Liste mit Schlüsselbund), Modellliste,
   *  Anfrage-Parameter, Client, Prüfung der Antwort und die Settings-Abschnitte (obsidian-kit 0.51.2). */
  public llm!: LlmConnection;

  private statusBarEl: HTMLElement | null = null;
  private debouncedRefresh!: () => void;
  private taskNotesUnsubscribe: (() => void) | null = null;
  private managerUnsubscribe: (() => void) | null = null;
  /** Ein TaskNotes-Ereignis lag an — von refreshStatus konsumiert und zurueckgesetzt. */
  private xpEventPending = false;
  private debouncedSave!: () => void;
  private midnightTimeout: number | null = null;

  async onload(): Promise<void> {
    this.dataStore = new DataStore(this);
    this.logger = new Logger(() => this.data.settings.logLevel);
    this.vaultReader = new VaultReader(this.app, this.logger);

    this.data = await this.dataStore.load();
    if (this.dataStore.lastRequestDropped.length > 0) {
      const lang = this.data.settings.language;
      new Notice(t('request.dropped', lang, { n: this.dataStore.lastRequestDropped.length }));
      console.warn('[kuro-gamification] ungültige request-Einstellungen verworfen:', this.dataStore.lastRequestDropped);
    }

    if (this.dataStore.lastLegacyModelMigrated) await this.dataStore.save(this.data);

    this.llm = createLlmConnection(kuroConnectionOptions({
      app: this.app,
      pluginId: this.manifest.id,
      settings: () => this.data.settings,
      // Jede Änderung an Endpunkten, Wahl, Modell oder Anfrage kommt hier vorbei: die Modellzeile des Chat-Fensters zieht nach.
      persist: async () => { await this.persist(); this.syncChat({ models: true }); },
    }));

    // Must precede regenFreezeTokensIfNeeded(): on a fresh vault the regen
    // branch fires (lastRegen '' → current month) and calls debouncedSave().
    this.debouncedRefresh = debounce(() => this.refreshStatus(false), 800, true);
    this.debouncedSave = debounce(() => { void this.persist(); }, 500, true);

    // Nach den debounced Fns: der Handler ruft debouncedRefresh (onload-Reihenfolge
    // ist load-bearing, s. AGENTS.md § Gotchas).
    this.taskNotesUnsubscribe = subscribeTaskNotes(this.app, () => {
      this.xpEventPending = true;
      this.debouncedRefresh();
    });

    this.regenFreezeTokensIfNeeded();
    await this.seedFreshInstallDefaults();

    this.registerView(VIEW_TYPE_KURO, (leaf) => new KuroSidebarView(leaf, this));
    this.registerMarkdownCodeBlockProcessor('kuro-status', makeKuroCodeBlockProcessor(this));
    this.registerEvent(this.app.vault.on('modify', (f) => this.onVaultChange(f)));
    this.registerEvent(this.app.vault.on('create', (f) => this.onVaultChange(f)));
    this.registerEvent(this.app.vault.on('delete', (f) => this.onVaultChange(f)));
    this.registerEvent(this.app.vault.on('rename', (f) => this.onVaultChange(f)));

    this.addRibbonIcon('terminal', t('plugin.name', this.data.settings.language), () => {
      void this.activateSidebar();
    });

    registerCommands(this);
    this.addSettingTab(new KuroSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      if (this.data.settings.openSidebarOnStartup) void this.activateSidebar();
      void this.refreshStatus(true);
      this.scheduleMidnightTick();
      // Das Kit hängt das Abo nach, wenn der Manager erst später erscheint (seit 0.61.0); der Rückruf kommt dann einmal.
      this.managerUnsubscribe = onEndpointManagerChanged(this.app, () => {
        this.llm.invalidate();
        this.syncChat({ models: true });
      });
      if (!this.data.onboardingShown) new WelcomeModal(this.app, this).open();
    });

    this.refreshStatusBar();
    this.logger.info('plugin loaded');
  }

  /**
   * First-run only: adapt defaults to the host vault so a new user
   * doesn't inherit the author's setup. Adopts the Obsidian UI
   * language, and the folder/format from the core "Daily notes"
   * plugin (only while no daily folder is configured yet). Never
   * touches settings an existing install already has.
   */
  private async seedFreshInstallDefaults(): Promise<void> {
    if (this.data.onboardingShown) return; // existing installs keep their settings
    const s = this.data.settings;
    s.language = detectLang();
    if (s.habits.length === 0) s.habits = defaultHabits(s.language);
    if (s.dailyFolder === '') {
      const core = readDailyNotesConfig(this.app);
      if (core?.folder) s.dailyFolder = core.folder;
      if (core?.format) s.dailyDateFormat = core.format;
    }
    await this.persist();
  }

  onunload(): void {
    this.taskNotesUnsubscribe?.();
    this.taskNotesUnsubscribe = null;
    this.managerUnsubscribe?.();
    this.managerUnsubscribe = null;
    if (this.midnightTimeout !== null) window.clearTimeout(this.midnightTimeout);
    if (this.statusBarEl) this.statusBarEl.detach();
    this.statusBarEl = null;
    this.logger.info('plugin unloaded');
  }

  /* ── Vault reactivity ─────────────────────────────────── */
  private onVaultChange(file: TAbstractFile): void {
    if (!(file instanceof TFile)) return;
    if (file.extension !== 'md') return;
    const s = this.data.settings;
    // Segmentregeln aus dem Kit (`folder-scope`): ein leerer Ordner haelt nichts, `Daily/` ist `Daily`, `Daily` haelt nicht `Daily-Archiv/x.md`.
    // Die Einstellung wird vor dem Aufruf getrimmt (das Kit trimmt nie).
    const inDaily = isInFolder(file.path, s.dailyFolder.trim());
    const inWeekly = isInFolder(file.path, s.weeklyFolder.trim());
    if (!inDaily && !inWeekly) return;
    if (inDaily && !isIsoDate(file.basename)) return;
    if (inWeekly && !isIsoWeek(file.basename)) return;
    this.debouncedRefresh();
  }

  /* ── Status compute ───────────────────────────────────── */
  async refreshStatus(force: boolean): Promise<void> {
    try {
      const today = new Date();
      const todayStr = todayIso(today);
      this.regenFreezeTokensIfNeeded();

      const opts = {
        dailyFolder: this.data.settings.dailyFolder,
        weeklyFolder: this.data.settings.weeklyFolder,
        dailyFormat: this.data.settings.dailyDateFormat,
        weeklyFormat: this.data.settings.weeklyDateFormat,
      };
      const dailies = await this.vaultReader.readDailies(opts);
      const weeklies = await this.vaultReader.readWeeklies(opts);

      // qualifying-day set for streak
      const qualifying = new Set<string>();
      for (const d of dailies) {
        if (d.stats.total > 0 && d.stats.pct >= this.data.settings.streakQualifyThreshold) {
          qualifying.add(d.date);
        }
      }
      const streakRes = StreakEngine.compute({
        qualifyingDates: qualifying,
        neutralDates: markedDates(
          dailies, this.data.settings.streakSkipKey, this.data.settings.streakSkipValues,
        ),
        today,
        settings: this.data.settings,
      });

      const taskNotes = await this.collectTaskNotesInput();

      const agg = XpEngine.aggregate({
        dailies,
        weeklies,
        manualXp: this.data.manualXpAdjustments,
        streakBonus: streakRes.bonus,
        settings: this.data.settings,
        taskNotes,
      });

      const lvl = XpEngine.levelForXp(agg.totalXp, this.data.settings.levels);
      const todayDaily = dailies.find((d) => d.date === todayStr) ?? null;

      // Rohtext nur lesen, wenn der Chat ihn überhaupt brauchen kann —
      // ein ausgeschalteter Chat kostet keinen zusätzlichen Lesevorgang.
      this.lastDailyText = this.data.settings.enableChat
        ? await this.vaultReader.readDailyRaw(opts, todayStr)
        : null;

      const todayCalc = todayDaily
        ? XpEngine.computeDaily(todayDaily, this.data.settings, {
          suppressPomodoroBonus: pomodoroBonusSuppressed(taskNotes),
        })
        : { date: todayStr, xp: 0, rows: [] };

      const lootPick = LootEngine.pickOptions(
        lvl.current.level,
        this.data.redeemedDrops.length,
        this.data.settings,
      );
      const fragment = LoreEngine.fragmentForLevel(lvl.current.level, this.data.settings);

      const snap: KuroSnapshot = {
        computedAt: new Date().toISOString(),
        totalXp: agg.totalXp,
        currentLevel: lvl.current,
        nextLevel: lvl.next,
        xpToNext: lvl.xpToNext,
        pctToNext: lvl.pctToNext,
        streak: streakRes.streak,
        streakBonus: streakRes.bonus,
        freezeTokens: streakRes.tokensLeft,
        todayXp: todayCalc.xp,
        todayDone: todayDaily?.stats.done ?? 0,
        todayTotal: todayDaily?.stats.total ?? 0,
        todayPct: todayDaily?.stats.pct ?? 0,
        availableDrops: LootEngine.availableDrops(lvl.current.level, this.data.redeemedDrops.length),
        redeemedDrops: this.data.redeemedDrops.length,
        lootOptions: lootPick?.options ?? null,
        lootTier: lootPick?.tier ?? null,
        loreFragment: fragment,
        breakdown: agg.rows,
      };

      // unlock lore tracking — saved synchronously to avoid debounce coalescing loss
      if (fragment && !this.data.unlockedLore.includes(fragment.level)) {
        this.data.unlockedLore.push(fragment.level);
        await this.persist();
      }

      const previousXp = this.data.lastSnapshot?.totalXp ?? snap.totalXp;
      const pending = this.xpEventPending;
      this.xpEventPending = false;
      const delta = snap.totalXp - previousXp;
      if (shouldNotifyGain({
        eventPending: pending, delta, enabled: this.data.settings.notifyXpGain,
      })) {
        new Notice(t('notice.xpGain', this.data.settings.language, { amount: delta }));
      }

      this.data.lastSnapshot = snap;
      this.debouncedSave();
      this.syncSidebarSnapshot();
      this.syncChatContext();
      this.refreshStatusBar();

      if (force) this.logger.info('status recomputed', {
        totalXp: agg.totalXp, level: lvl.current.level, streak: streakRes.streak,
      });
    } catch (err) {
      this.logger.error('refreshStatus failed', err);
    }
  }

  /**
   * Liest die TaskNotes-Quellen frisch. Bewusst KEIN Cache: das Nachbarplugin kann
   * mitten in der Sitzung deaktiviert werden, und der Zugriff ist billig. Rechnung
   * (refreshStatus) und Anzeige (Herkunfts-Panel) rufen dieselbe Methode — zwei
   * Lesungen koennten auseinanderlaufen.
   */
  async collectTaskNotesInput(): Promise<TaskNotesInput> {
    const config = readTaskNotesConfig(this.app);
    const rule = taskRuleFromSettings(this.data.settings);
    const sessions = await readPomodoroSessions(this.app);
    const tasks = readCompletedTasks(this.app, rule);
    return { config, rule, sessions, tasks, settings: this.data.settings };
  }

  private syncSidebarSnapshot(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_KURO)) {
      if (leaf.view instanceof KuroSidebarView) leaf.view.renderSnapshot();
    }
  }

  /* ── Companion-Chat ───────────────────────────────────── */

  /** Baut die Tab-Leiste jeder offenen Sidebar-View neu auf — onOpen() liest
   *  enableChat nur EINMAL beim ersten Aufbau; ohne diesen Aufruf bliebe eine
   *  schon offene Seitenleiste stumm, bis sie geschlossen und neu geöffnet wird. */
  syncChatUI(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_KURO)) {
      if (leaf.view instanceof KuroSidebarView) void leaf.view.onOpen();
    }
  }

  /** Offene Sidebar-Views, deren Chat-Tab neu gezeichnet werden soll. */
  private chatViews(): KuroSidebarView[] {
    const out: KuroSidebarView[] = [];
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_KURO)) {
      if (leaf.view instanceof KuroSidebarView) out.push(leaf.view);
    }
    return out;
  }

  /** Kontextzeile jedes offenen Chat-Tabs an den frisch gelesenen Tagesnotiz-Stand anpassen.
   *  Bewusst nicht `syncChat()`: `refreshStatus` läuft bei jeder Änderung in irgendeiner Notiz. */
  syncChatContext(): void {
    for (const view of this.chatViews()) view.refreshChatContext();
  }

  /** Chat-Fenster jeder offenen Ansicht an den Stand von Endpunkt und Modell anpassen: wechselt der Endpunkt-Zustand, zeichnet das
   *  Fenster neu (Einrichtungs-Hinweis ↔ Chat), sonst zieht die Modellzeile nach. `models`: auch die Modell-Liste neu laden. */
  syncChat(opts: { models?: boolean } = {}): void {
    for (const view of this.chatViews()) view.refreshChat(opts);
  }

  /**
   * Die Anfrage des Chat-Fensters an Kuro. Baut den Kontext aus Snapshot + heutiger Notiz, löst die Stimme auf
   * (Settings → Pack → Default) und streamt die Antwort. Verlauf, Abbruch und Fehlerzeile trägt das Fenster.
   */
  async sendChat(messages: readonly ChatModelMessage[], h: ChatSendHandlers): Promise<ChatSendResult> {
    const s = this.data.settings;
    const lang = s.language;
    const { history, question } = splitChatMessages(messages);
    const request = buildMessages({
      lang,
      persona: resolvePersona({
        override: s.chatPersonaOverride,
        packPersona: activePersona(s),
        lang,
      }),
      context: buildContext(this.data.lastSnapshot, this.lastDailyText, s),
      notes: this.data.kuroNotes,
      history,
      question,
    });
    try {
      const result = await this.llm.complete(
        { messages: request },
        {
          // Reasoning wird bewusst nicht angezeigt: kein `onReasoning`.
          onToken: (token) => { h.onToken(token); },
          // Gemma 4 schreibt sein Denken ohne Öffner in den Inhalt (Kit meldet es am Kanalende): den bisherigen Text verwerfen.
          onContentReset: () => { h.onContentReset(); },
          signal: h.signal,
        },
      );
      if (!result.ok) this.logger.error('chat failed', result.kind, result.detail);
      return result;
    } catch (err) {
      // Die Verbindung wirft nur bei einem Fehler VOR dem Senden (Auflösung, Manager-API); das Fenster zeigt die Fehlerzeile.
      this.logger.error('chat failed before sending', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  /** „merk dir: …“ ist ein Merkzettel-Eintrag, keine Frage ans Modell: `true`, wenn die Nachricht damit erledigt ist. */
  handleChatCommand(text: string): boolean {
    const note = extractNoteFromMessage(text.trim());
    if (note === null) return false;
    this.rememberNote(note);
    return true;
  }

  /** Gibt es überhaupt eine Quelle für Chat-Endpunkte — den Manager oder mindestens eine
   *  lokale Zeile? Ohne beides zeigt der Chat-Tab den Einrichtungs-Hinweis. */
  hasChatEndpointSource(): boolean {
    return findEndpointManager(this.app) !== null || this.data.settings.chatEndpoints.length > 0;
  }

  /** Merkzettel-Eintrag anlegen. Kappt hart, statt still zu vergessen. */
  rememberNote(text: string): void {
    const lang = this.data.settings.language;
    const before = this.data.kuroNotes.length;
    this.data.kuroNotes = addNote(this.data.kuroNotes, text);

    if (this.data.kuroNotes.length === before) {
      new Notice(t('chat.notesFull', lang, { max: MAX_NOTES }));
      return;
    }
    void this.persist();
    new Notice(t('chat.remembered', lang, {
      note: this.data.kuroNotes[this.data.kuroNotes.length - 1],
    }));
  }

  /* ── Sidebar lifecycle ────────────────────────────────── */
  async activateSidebar(): Promise<void> {
    if (!this.data.settings.enableSidebar) return;
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_KURO)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (leaf) await leaf.setViewState({ type: VIEW_TYPE_KURO, active: true });
    }
    if (leaf) await workspace.revealLeaf(leaf);
  }

  syncSidebar(): void {
    if (this.data.settings.enableSidebar) {
      void this.activateSidebar();
    } else {
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_KURO)) leaf.detach();
    }
  }

  /* ── Modals ───────────────────────────────────────────── */
  openRedeemModal(): void {
    new LootRedeemModal(this.app, this).open();
  }

  /** Open this plugin's own settings tab. */
  openOwnSettings(): void {
    const setting = (this.app as unknown as {
      setting?: { open(): void; openTabById(id: string): void };
    }).setting;
    setting?.open();
    setting?.openTabById(this.manifest.id);
  }

  /* ── Persistence ──────────────────────────────────────── */
  async persist(): Promise<void> {
    try {
      await this.dataStore.save(this.data);
    } catch (err) {
      this.logger.error('persist failed', err);
      if (this.data.settings.enableNotices) {
        new Notice(t('notice.saveFailed', this.data.settings.language));
      }
    }
  }

  /* ── Status-bar element ───────────────────────────────── */
  refreshStatusBar(): void {
    if (!this.data.settings.enableStatusBar) {
      if (this.statusBarEl) {
        this.statusBarEl.detach();
        this.statusBarEl = null;
      }
      return;
    }
    if (!this.statusBarEl) {
      this.statusBarEl = this.addStatusBarItem();
      this.statusBarEl.addClass('kuro-status-bar-item');
      // registerDomEvent auto-cleans on plugin unload — no listener leak on toggle
      this.registerDomEvent(this.statusBarEl, 'click', () => this.activateSidebar());
    }
    const snap = this.data.lastSnapshot;
    if (snap) {
      this.statusBarEl.setText(`Lvl ${snap.currentLevel.level} · ${fmtNum(snap.totalXp)} XP`);
    } else {
      this.statusBarEl.setText('Kuro: …');
    }
  }

  /* ── Mid-night refresh ────────────────────────────────── */
  private scheduleMidnightTick(): void {
    if (this.midnightTimeout !== null) window.clearTimeout(this.midnightTimeout);
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 5, 0); // 5 sec past midnight, next day
    const ms = next.getTime() - now.getTime();
    this.midnightTimeout = window.setTimeout(() => {
      this.regenFreezeTokensIfNeeded();
      void this.refreshStatus(true);
      this.scheduleMidnightTick();
    }, ms);
  }

  private regenFreezeTokensIfNeeded(): void {
    const r = StreakEngine.regenFreezeTokens(
      this.data.freezeTokens,
      this.data.freezeTokensLastRegen,
      new Date(),
      this.data.settings,
    );
    if (r.tokens !== this.data.freezeTokens || r.lastRegen !== this.data.freezeTokensLastRegen) {
      this.data.freezeTokens = r.tokens;
      this.data.freezeTokensLastRegen = r.lastRegen;
      this.debouncedSave();
    }
  }
}
