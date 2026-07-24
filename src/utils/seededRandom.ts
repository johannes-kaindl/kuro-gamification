/* ==========================================================
   Deterministic Seeded RNG — sin-based PRNG from Kuro spec.
   Same seed → same sequence. Used for stable loot options.
   ========================================================== */

export function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
