/* ==========================================================
   ConfirmModal — destructive-action confirmation with a
   Promise facade. Pattern adopted from finance-ledger's
   `src/ui/promptModal.ts` (REGISTRY §93 Bestätigungs-Modal,
   Kit-Kandidat, Regel-der-Drei erfüllt — this is the 4th
   exemplar). Two load-bearing details kept from the reference:
   `finish()` nulls the callback so a button click followed by
   onClose can't resolve twice, and `onClose()` resolves false
   so dismissing via Esc/click-outside never dangles.
   ========================================================== */
import { Modal, type App, Setting } from 'obsidian';

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmText: string;
  cancelText: string;
}

class ConfirmModal extends Modal {
  private done: ((confirmed: boolean) => void) | null;

  constructor(app: App, private readonly opts: ConfirmOptions, done: (confirmed: boolean) => void) {
    super(app);
    this.done = done;
  }

  onOpen(): void {
    this.titleEl.setText(this.opts.title);
    this.contentEl.createEl('p', { text: this.opts.body });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(this.opts.confirmText).setWarning().onClick(() => this.finish(true)))
      .addButton((b) => b.setButtonText(this.opts.cancelText).onClick(() => this.finish(false)));
  }

  onClose(): void {
    this.finish(false);
    this.contentEl.empty();
  }

  private finish(confirmed: boolean): void {
    if (!this.done) return;
    const cb = this.done;
    this.done = null;
    cb(confirmed);
    this.close();
  }
}

/** Opens a confirmation dialog; resolves true only if the user confirmed. */
export function confirmModal(app: App, opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmModal(app, opts, resolve).open();
  });
}
