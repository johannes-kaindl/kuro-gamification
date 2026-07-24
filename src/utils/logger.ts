/* ==========================================================
   Tiny logger with runtime-configurable level.
   Off-by-default for production noise; users opt-in via Settings.
   ========================================================== */
import type { LogLevel } from '../types';

const LEVEL_NUM: Record<LogLevel, number> = { off: 0, error: 1, info: 2, debug: 3 };

export class Logger {
  constructor(private readonly getLevel: () => LogLevel) {}

  error(...args: unknown[]): void {
    if (this.lvl() >= 1) console.error('[kuro]', ...args);
  }

  info(...args: unknown[]): void {
    if (this.lvl() >= 2) console.info('[kuro]', ...args);
  }

  debug(...args: unknown[]): void {
    if (this.lvl() >= 3) console.debug('[kuro]', ...args);
  }

  private lvl(): number {
    return LEVEL_NUM[this.getLevel()] ?? 0;
  }
}
