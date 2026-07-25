/* ==========================================================
   registerCommands — wires up Plugin.addCommand for everything
   surfaced via the command palette.
   ========================================================== */
import { Notice } from 'obsidian';
import type KuroPlugin from '../main';
import { LoreRevealModal } from '../modals/LoreRevealModal';
import { AdjustXpModal } from '../modals/AdjustXpModal';
import { ExportDataModal, ImportDataModal } from '../modals/DataIoModal';
import { ImportPackModal, ExportPackModal } from '../modals/PackIoModal';
import { ResetDataModal } from '../modals/ResetDataModal';
import { LoreEngine } from '../engine/LoreEngine';
import { t } from '../i18n';

export function registerCommands(plugin: KuroPlugin): void {
  const lang = () => plugin.data.settings.language;

  plugin.addCommand({
    id: 'open-status',
    name: t('cmd.openStatus', lang()),
    callback: () => plugin.activateSidebar(),
  });

  plugin.addCommand({
    id: 'refresh',
    name: t('cmd.refresh', lang()),
    callback: () => plugin.refreshStatus(true),
  });

  plugin.addCommand({
    id: 'redeem-loot',
    name: t('cmd.redeem', lang()),
    callback: () => plugin.openRedeemModal(),
  });

  plugin.addCommand({
    id: 'show-lore',
    name: t('cmd.showLore', lang()),
    callback: () => {
      const snap = plugin.data.lastSnapshot;
      if (!snap) {
        new Notice(t('notice.noData', lang()));
        return;
      }
      const frag = LoreEngine.fragmentForLevel(snap.currentLevel.level, plugin.data.settings);
      if (!frag) {
        new Notice(t('notice.noLore', lang()));
        return;
      }
      new LoreRevealModal(plugin.app, plugin, frag).open();
    },
  });

  plugin.addCommand({
    id: 'adjust-xp',
    name: t('cmd.adjustXp', lang()),
    callback: () => new AdjustXpModal(plugin.app, plugin).open(),
  });

  plugin.addCommand({
    id: 'insert-status-codeblock',
    name: t('cmd.insertCodeblock', lang()),
    editorCallback: (editor) => {
      editor.replaceSelection('```kuro-status\nmode: full\nloot: show\nlore: show\n```\n');
    },
  });

  plugin.addCommand({
    id: 'export-data',
    name: t('cmd.exportData', lang()),
    callback: () => new ExportDataModal(plugin.app, plugin).open(),
  });

  plugin.addCommand({
    id: 'import-data',
    name: t('cmd.importData', lang()),
    callback: () => new ImportDataModal(plugin.app, plugin).open(),
  });

  plugin.addCommand({
    id: 'import-pack',
    name: t('cmd.importPack', lang()),
    callback: () => new ImportPackModal(plugin.app, plugin).open(),
  });

  plugin.addCommand({
    id: 'export-pack',
    name: t('cmd.exportPack', lang()),
    callback: () => new ExportPackModal(plugin.app, plugin).open(),
  });

  plugin.addCommand({
    id: 'reset-data',
    name: t('cmd.resetData', lang()),
    callback: () => new ResetDataModal(plugin.app, plugin).open(),
  });
}
