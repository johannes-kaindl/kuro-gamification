/* ==========================================================
   KuroStatusRenderer — builds the <pre class="kuro-status">,
   <pre class="kuro-loot"> blocks and lore-callout DOM.
   Pure DOM operations, framework-agnostic.
   ========================================================== */
import { setIcon } from 'obsidian';
import type { KuroSnapshot, KuroSettings, StatusBlockMode } from '../types';
import { TIER_EMOJI } from '../data/default-levels';
import { progressBar, fmtNum } from '../utils/progressBar';
import { StreakEngine } from '../engine/StreakEngine';
import { t } from '../i18n';

const BOX_TOP    = '╔═══════════════════════════════════════════════════╗';
const BOX_BOTTOM = '╚═══════════════════════════════════════════════════╝';

export interface RenderOptions {
  mode: StatusBlockMode;
  showLoot: boolean;
  showLore: boolean;
  showBreakdown: boolean;
}

export class KuroStatusRenderer {
  static render(
    parent: HTMLElement,
    snap: KuroSnapshot,
    settings: KuroSettings,
    opts: RenderOptions,
  ): void {
    parent.empty();
    parent.addClass('kuro-sidebar-root');
    if (settings.reduceAnimations) parent.addClass('kuro-no-animation');

    parent.createEl('pre', {
      cls: 'kuro-status',
      text: KuroStatusRenderer.statusLines(snap, settings, opts.mode).join('\n'),
    });

    if (opts.showLoot && snap.lootOptions && snap.lootOptions.length > 0 && snap.lootTier) {
      parent.createEl('pre', {
        cls: 'kuro-loot',
        text: KuroStatusRenderer.lootLines(snap, settings).join('\n'),
      });
    }

    if (opts.showLore && snap.loreFragment) {
      const callout = parent.createDiv({ cls: 'callout', attr: { 'data-callout': 'spoiler' } });
      const titleEl = callout.createDiv({ cls: 'callout-title' });
      titleEl.createDiv({
        cls: 'callout-icon',
        attr: { 'aria-hidden': 'true' },
      });
      try { setIcon(titleEl.firstElementChild as HTMLElement, 'eye'); } catch { /* obsidian-only */ }
      titleEl.createDiv({
        cls: 'callout-title-inner',
        text: t('sidebar.lore.heading', settings.language, {
          n: String(snap.loreFragment.level).padStart(2, '0'),
          title: snap.loreFragment.title,
        }),
      });
      const content = callout.createDiv({ cls: 'callout-content' });
      for (const line of snap.loreFragment.text.split('\n')) {
        content.createEl('p', { text: line });
      }
    }

    if (opts.showBreakdown && settings.statusVerbose && snap.breakdown.length > 0) {
      const wrap = parent.createDiv({ cls: 'kuro-xp-breakdown' });
      wrap.createEl('h4', { text: t('sidebar.breakdown.heading', settings.language) });
      const table = wrap.createEl('table');
      const tbody = table.createEl('tbody');
      // Group by source-prefix and show top 50 rows for readability
      const rows = snap.breakdown.slice(-50);
      for (const row of rows) {
        const tr = tbody.createEl('tr');
        tr.createEl('td', { text: row.source });
        tr.createEl('td', {
          text: `${(row.amount >= 0 ? '+' : '') + row.amount} XP`,
          cls: row.amount >= 0 ? 'kuro-pos' : 'kuro-neg',
        });
        tr.createEl('td', { text: row.reason, cls: 'kuro-reason' });
      }
    }
  }

  static statusLines(snap: KuroSnapshot, s: KuroSettings, mode: StatusBlockMode): string[] {
    const lang = s.language;
    const lines: string[] = [];

    if (mode !== 'minimal') lines.push(BOX_TOP);

    lines.push('  >_ OPERATOR STATUS');
    lines.push(`  >_ ${t('status.designation', lang)} : ${snap.currentLevel.title}`);
    lines.push(`  >_ ${t('status.level', lang)}       : ${snap.currentLevel.level}   ·   ${t('status.totalXp', lang)}: ${fmtNum(snap.totalXp)}`);

    if (snap.nextLevel) {
      lines.push(`  >_ ${t('status.nextLvl', lang)}: ${snap.nextLevel.title}  (${t('status.toNext', lang, { xp: fmtNum(snap.xpToNext) })})`);
      if (mode !== 'minimal') {
        lines.push(`  >_ ${t('status.progress', lang)} : [${progressBar(snap.pctToNext)}] ${Math.round(snap.pctToNext * 100)}%`);
      }
    }

    if (s.enableStreaks) {
      const labelKey = StreakEngine.labelKey(snap.streak);
      lines.push(`  >_ ${t('status.streak', lang)}      : ${t('status.streakDays', lang, { n: snap.streak })}  [${t(labelKey, lang)}]`);
      if (mode !== 'minimal' && snap.streakBonus > 0) {
        lines.push(`  >_ ${t('status.streakBonus', lang, { xp: fmtNum(snap.streakBonus) })}`);
      }
      if (mode === 'full') {
        lines.push(`  >_ ${t('status.freezeTokens', lang)}: ${snap.freezeTokens}`);
      }
    }

    if (mode !== 'minimal' && snap.todayTotal > 0) {
      lines.push(`  >_ ${t('status.today', lang)}       : ${t('status.todayLine', lang, {
        xp: snap.todayXp,
        done: snap.todayDone,
        total: snap.todayTotal,
        pct: Math.round(snap.todayPct * 100),
      })}`);
    }

    if (mode !== 'minimal' && snap.availableDrops > 0) {
      lines.push(`  ⚡ ${t('status.lootDrops', lang)}  : ${t('status.lootWaiting', lang, { n: snap.availableDrops })} ⚡`);
    }

    if (mode !== 'minimal') lines.push(BOX_BOTTOM);
    return lines;
  }

  static lootLines(snap: KuroSnapshot, s: KuroSettings): string[] {
    if (!snap.lootOptions || !snap.lootTier) return [];
    const lang = s.language;
    const emoji = TIER_EMOJI[snap.lootTier];
    const tierName = snap.lootTier.toUpperCase();
    const out: string[] = [];
    out.push(`>_ ${t('loot.heading', lang, { emoji, tier: tierName })}`);
    out.push('');
    out.push(`   ${t('loot.intro', lang, { title: snap.currentLevel.title })}`);
    out.push(`   ${t('loot.intro2', lang)}`);
    out.push('');
    snap.lootOptions.forEach((opt, i) => {
      out.push(`   ${i + 1}. ${emoji} ${opt.name}`);
      out.push(`      [${opt.cat}]`);
      out.push('');
    });
    out.push(`   ► ${t('loot.outro1', lang)}`);
    out.push(`   ► ${t('loot.outro2', lang)}`);
    return out;
  }
}
