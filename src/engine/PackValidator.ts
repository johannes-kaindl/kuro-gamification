/* ==========================================================
   PackValidator — pure validation for KuroPack.
   No Obsidian imports. Node-testable. Issues carry stable
   `code`s; the UI layer localizes them via i18n.
   ========================================================== */
import type { KuroLootTier, KuroPack } from '../types';
import { MAX_PERSONA_LEN } from '../llm/kuroPrompt';

export interface PackIssue {
  /** Dotted path into the pack, e.g. "loot.epc" or "lore[2].title". */
  path: string;
  /** Stable code; UI maps to i18n key `pack.issue.<code>`. */
  code: string;
  vars?: Record<string, string | number>;
}

export type PackValidation =
  | { ok: true; pack: KuroPack; warnings: PackIssue[] }
  | { ok: false; errors: PackIssue[] };

export interface ValidateOpts {
  /** Configured level numbers; enables the lore-coverage warning when provided. */
  loreLevels?: number[];
}

const TIERS: KuroLootTier[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isStr(v: unknown): v is string { return typeof v === 'string'; }

export function validatePack(raw: unknown, opts: ValidateOpts = {}): PackValidation {
  const errors: PackIssue[] = [];
  const warnings: PackIssue[] = [];

  if (!isObj(raw)) {
    return { ok: false, errors: [{ path: '', code: 'notObject' }] };
  }
  if (typeof raw.kuroPack !== 'number') {
    errors.push({ path: 'kuroPack', code: 'missingVersion' });
  }

  const hasLoot = raw.loot !== undefined;
  const hasLore = raw.lore !== undefined;
  const hasHabits = raw.habits !== undefined;
  if (!hasLoot && !hasLore && !hasHabits) {
    errors.push({ path: '', code: 'emptyPack' });
  }

  // ── loot ──
  if (hasLoot) {
    if (!isObj(raw.loot)) {
      errors.push({ path: 'loot', code: 'lootNotObject' });
    } else {
      for (const [tier, items] of Object.entries(raw.loot)) {
        if (!TIERS.includes(tier as KuroLootTier)) {
          errors.push({ path: `loot.${tier}`, code: 'unknownTier', vars: { tier, allowed: TIERS.join(', ') } });
          continue;
        }
        if (!Array.isArray(items)) {
          errors.push({ path: `loot.${tier}`, code: 'tierNotArray', vars: { tier } });
          continue;
        }
        items.forEach((it, i) => {
          if (!isObj(it) || !isStr(it.name) || !isStr(it.cat)) {
            errors.push({ path: `loot.${tier}[${i}]`, code: 'lootItemInvalid', vars: { tier, index: i } });
          }
        });
      }
      const present = Object.keys(raw.loot).filter((t) => TIERS.includes(t as KuroLootTier));
      const missing = TIERS.filter((t) => !present.includes(t));
      if (missing.length > 0 && missing.length < TIERS.length) {
        warnings.push({ path: 'loot', code: 'lootTierUsesDefault', vars: { tiers: missing.join(', ') } });
      }
    }
  }

  // ── lore ──
  if (hasLore) {
    if (!Array.isArray(raw.lore)) {
      errors.push({ path: 'lore', code: 'loreNotArray' });
    } else {
      const seen = new Set<number>();
      raw.lore.forEach((f, i) => {
        if (!isObj(f) || typeof f.level !== 'number' || !isStr(f.title) || !isStr(f.text)) {
          errors.push({ path: `lore[${i}]`, code: 'loreItemInvalid', vars: { index: i } });
          return;
        }
        if (seen.has(f.level)) {
          errors.push({ path: `lore[${i}].level`, code: 'loreLevelDup', vars: { level: f.level } });
        }
        seen.add(f.level);
      });
      if (opts.loreLevels && opts.loreLevels.length > 0) {
        const missing = opts.loreLevels.filter((lv) => !seen.has(lv));
        if (missing.length > 0) {
          warnings.push({ path: 'lore', code: 'loreIncompleteCoverage', vars: { levels: missing.join(', ') } });
        }
      }
    }
  }

  // ── habits ──
  if (hasHabits) {
    if (!Array.isArray(raw.habits)) {
      errors.push({ path: 'habits', code: 'habitsNotArray' });
    } else {
      raw.habits.forEach((h, i) => {
        if (!isObj(h) || !isStr(h.key) || !isStr(h.label) || typeof h.xp !== 'number') {
          errors.push({ path: `habits[${i}]`, code: 'habitItemInvalid', vars: { index: i } });
        }
      });
    }
  }

  // ── persona (optionale Stimme für den Companion-Chat) ──
  // Fremder Persona-Text landet im System-Prompt; die Länge wird deshalb
  // hart begrenzt, damit ein Pack den Kontext nicht fluten kann. Die
  // inhaltliche Absicherung leistet die Blockreihenfolge in kuroPrompt.ts
  // (Regeln stehen zuletzt und sind unaufhebbar).
  if (raw.persona !== undefined) {
    if (!isStr(raw.persona)) {
      errors.push({ path: 'persona', code: 'personaNotString' });
    } else if (raw.persona.length > MAX_PERSONA_LEN) {
      errors.push({
        path: 'persona',
        code: 'personaTooLong',
        vars: { len: raw.persona.length, max: MAX_PERSONA_LEN },
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  // Runtime-validated above; the double cast is required because `raw` is an index-signature object, not KuroPack.
  return { ok: true, pack: raw as unknown as KuroPack, warnings };
}
