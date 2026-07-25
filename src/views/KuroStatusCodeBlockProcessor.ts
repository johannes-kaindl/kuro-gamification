/* ==========================================================
   ```kuro-status``` MarkdownCodeBlockProcessor — embeds the
   status snapshot into any note. Optional YAML config inside
   the block tweaks visibility per embed.
   ========================================================== */
import type { MarkdownPostProcessorContext } from 'obsidian';
import type KuroPlugin from '../main';
import { KuroStatusRenderer } from './KuroStatusRenderer';
import type { StatusBlockMode } from '../types';
import { t } from '../i18n';

interface BlockConfig {
  mode: StatusBlockMode;
  loot: boolean;
  lore: boolean;
  breakdown: boolean;
}

const DEFAULT_BLOCK_CONFIG: BlockConfig = {
  mode: 'full',
  loot: true,
  lore: true,
  breakdown: false,
};

export function makeKuroCodeBlockProcessor(plugin: KuroPlugin) {
  return (source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext) => {
    let cfg: BlockConfig = { ...DEFAULT_BLOCK_CONFIG };
    try {
      cfg = parseBlockConfig(source);
    } catch (err) {
      el.createDiv({
        cls: 'kuro-codeblock-error',
        text: t('codeblock.error.invalidConfig', plugin.data.settings.language, {
          err: (err instanceof Error ? err.message : String(err)),
        }),
      });
      return;
    }

    const snap = plugin.data.lastSnapshot;
    if (!snap) {
      el.createEl('pre', {
        cls: 'kuro-status',
        text: t('codeblock.noData', plugin.data.settings.language),
      });
      return;
    }

    KuroStatusRenderer.render(el, snap, plugin.data.settings, {
      mode: cfg.mode,
      showLoot: cfg.loot,
      showLore: cfg.lore,
      showBreakdown: cfg.breakdown,
    });
  };
}

function parseBlockConfig(source: string): BlockConfig {
  const cfg: BlockConfig = { ...DEFAULT_BLOCK_CONFIG };
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([a-zA-Z_]+)\s*:\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim().toLowerCase();
    switch (key) {
      case 'mode':
        if (val === 'full' || val === 'compact' || val === 'minimal') cfg.mode = val;
        break;
      case 'loot':
        cfg.loot = parseBool(val);
        break;
      case 'lore':
        cfg.lore = parseBool(val);
        break;
      case 'breakdown':
        cfg.breakdown = parseBool(val);
        break;
      default:
        // ignore unknown keys silently
        break;
    }
  }
  return cfg;
}

function parseBool(s: string): boolean {
  if (s === 'show' || s === 'true' || s === 'yes' || s === 'on' || s === '1') return true;
  if (s === 'hide' || s === 'false' || s === 'no' || s === 'off' || s === '0') return false;
  throw new Error(`expected boolean, got "${s}"`);
}
