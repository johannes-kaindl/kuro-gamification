# Aesthetic CSS — gothic-cyberpunk CRT terminal look

The plugin works fine without this — it ships with sane structural CSS (see
`styles.css` in the repo root). This snippet is a **purely optional**,
separate visual layer: phosphor green, scanlines, subtle CRT flicker, a
custom `[!kuro]` callout, and glow effects for `[!levelup]`/`[!spoiler]`/`[!streak]`.

It's kept here as a markdown code block — not as a tracked `.css` file in the
repo — so it never gets swept up by CSS-file linting on the plugin's own
source tree; the plugin itself never loads or bundles it.

## Install

1. Copy the CSS below into a new file named `kuro-gamification.css` inside
   `<vault>/.obsidian/snippets/` (create the `snippets` folder if it doesn't
   exist yet).
2. Settings → Appearance → CSS Snippets → enable `kuro-gamification`.

## The CSS

```css
/* ==========================================================
   KURO GAMIFICATION — Terminal Aesthetic v1.0
   Gothic Cyberpunk · Phosphor Green · 80s CRT Vibe
   E.A. Poe meets William Gibson
   ==========================================================

   TABLE OF CONTENTS
   0  Design tokens
   1  Terminal pre-blocks (Kuro status + loot drop)
   2  [!kuro] — new callout type
   3  [!levelup] — Kuro enhancement with cursor blink
   4  [!spoiler] — green reveal on hover
   5  [!streak] — flame intensification
   6  Keyframe library (terminal-specific)
   7  Dark/light mode adjustments
   8  Mobile

   ========================================================== */


/* ----------------------------------------------------------
   0. DESIGN TOKENS
   ---------------------------------------------------------- */

:root {
  /* Phosphor green palette */
  --kuro-green:         #00ff41;
  --kuro-green-bright:  #39ff6e;
  --kuro-green-dim:     #00cc33;
  --kuro-green-ghost:   rgba(0, 255, 65, 0.12);
  --kuro-green-glow:    rgba(0, 255, 65, 0.45);
  --kuro-green-subtle:  rgba(0, 255, 65, 0.22);

  /* Background tones */
  --kuro-black:         #080808;
  --kuro-dark:          #0d0d0d;
  --kuro-dark-mid:      #111411;   /* slightly green-tinted */

  /* Amber accent (for loot drops, legendary) */
  --kuro-amber:         #ffb300;
  --kuro-amber-glow:    rgba(255, 179, 0, 0.35);

  /* Monospace font stack */
  --kuro-font: 'IBM Plex Mono', 'Fira Code', 'JetBrains Mono',
               'Cascadia Code', 'Courier New', Courier, monospace;
}


/* ----------------------------------------------------------
   1. TERMINAL PRE-BLOCKS
   The sidebar/code-block renders .kuro-status and .kuro-loot as <pre>
   ---------------------------------------------------------- */

pre.kuro-status,
pre.kuro-loot {
  /* Typography */
  font-family:    var(--kuro-font) !important;
  font-size:      0.82em !important;
  line-height:    1.58 !important;
  letter-spacing: 0.01em;
  white-space:    pre !important;
  word-break:     normal !important;

  /* Color & background */
  color:      var(--kuro-green) !important;
  background: var(--kuro-dark) !important;

  /* Border */
  border:        1px solid rgba(0, 255, 65, 0.3) !important;
  border-left:   3px solid var(--kuro-green) !important;
  border-radius: 6px !important;

  /* Spacing */
  padding: 14px 18px !important;
  margin:  0 0 0 0 !important;

  /* Phosphor glow effect */
  text-shadow:
    0 0 4px rgba(0, 255, 65, 0.55),
    0 0 8px rgba(0, 255, 65, 0.2);
  box-shadow:
    0 0 18px rgba(0, 255, 65, 0.07),
    0 2px 12px rgba(0, 0, 0, 0.5),
    inset 0 0 40px rgba(0, 0, 0, 0.25);

  /* CRT flicker (very subtle) */
  animation: phosphorFlicker 12s ease-in-out infinite;

  /* Scanline overlay via ::before */
  position: relative;
  overflow: hidden;
}

/* Scanlines — light touch, for the CRT feel */
pre.kuro-status::before,
pre.kuro-loot::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(0, 0, 0, 0.07) 3px,
    rgba(0, 0, 0, 0.07) 4px
  );
  pointer-events: none;
  z-index: 1;
  border-radius: 6px;
}

/* Lower phosphor shimmer */
pre.kuro-status::after,
pre.kuro-loot::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(
    transparent,
    rgba(0, 255, 65, 0.04)
  );
  pointer-events: none;
  z-index: 1;
}

/* Loot block: stronger glow + brighter-green border accent */
pre.kuro-loot {
  border-color:  rgba(0, 255, 65, 0.5) !important;
  border-left:   3px solid var(--kuro-green-bright) !important;
  margin-top:    10px !important;
  box-shadow:
    0 0 28px rgba(0, 255, 65, 0.13),
    0 2px 12px rgba(0, 0, 0, 0.5),
    inset 0 0 40px rgba(0, 20, 0, 0.3) !important;
}

/* Hover: terminal wakes up */
pre.kuro-status:hover,
pre.kuro-loot:hover {
  border-color:  rgba(0, 255, 65, 0.6) !important;
  box-shadow:
    0 0 30px rgba(0, 255, 65, 0.18),
    0 4px 16px rgba(0, 0, 0, 0.5),
    inset 0 0 40px rgba(0, 0, 0, 0.2) !important;
  text-shadow:
    0 0 5px rgba(0, 255, 65, 0.7),
    0 0 12px rgba(0, 255, 65, 0.3);
  transition: all 0.4s ease;
}


/* ----------------------------------------------------------
   2. [!kuro] — NEW CALLOUT TYPE
   For arbitrary Kuro lore and terminal content
   ---------------------------------------------------------- */

.callout[data-callout="kuro"] {
  --callout-color:   0, 255, 65;
  --callout-icon:    lucide-terminal;

  font-family:       var(--kuro-font);
  background:        rgba(0, 10, 2, 0.9) !important;
  border:            1px solid rgba(0, 255, 65, 0.22) !important;
  border-left:       3px solid var(--kuro-green) !important;
  border-radius:     6px !important;
  box-shadow:
    0 0 20px rgba(0, 255, 65, 0.07),
    inset 0 0 30px rgba(0, 0, 0, 0.2);
  animation: phosphorFlicker 10s ease-in-out infinite;
}

.callout[data-callout="kuro"] .callout-title {
  font-family:    var(--kuro-font) !important;
  font-size:      0.78em;
  font-weight:    600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color:          var(--kuro-green) !important;
  text-shadow:    0 0 6px rgba(0, 255, 65, 0.5);
}

.callout[data-callout="kuro"] .callout-content {
  font-family: var(--kuro-font);
  font-size:   0.84em;
  line-height: 1.65;
  color:       var(--kuro-green-dim) !important;
  text-shadow: 0 0 3px rgba(0, 255, 65, 0.25);
}

/* Neon pulse on icon hover */
.callout[data-callout="kuro"]:hover .callout-icon svg {
  animation: neonPulse 1.2s ease-in-out infinite;
  color:     var(--kuro-green) !important;
}


/* ----------------------------------------------------------
   3. [!levelup] — KURO ENHANCEMENT
   Cursor blink in the title, glow on hover
   ---------------------------------------------------------- */

/* Soft green glow always visible */
.callout[data-callout="levelup"] {
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.05),
    0 0 0 1px rgba(16, 185, 129, 0.1) !important;
  transition: box-shadow 0.35s ease, background-color 0.35s ease !important;
}

.callout[data-callout="levelup"]:hover {
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.1),
    0 0 24px rgba(16, 185, 129, 0.2),
    0 0 0 1px rgba(16, 185, 129, 0.25) !important;
}

/* Blinking cursor after the title text */
.callout[data-callout="levelup"] .callout-title-inner::after {
  content:   '_';
  font-family: var(--kuro-font);
  font-weight: 400;
  color:      rgb(16, 185, 129);  /* --co-emerald */
  animation:  cursorBlink 1.1s step-end infinite;
  margin-left: 1px;
  opacity:    1;
}

/* LevelUp icon: arrows with glow instead of just a bounce */
.callout[data-callout="levelup"]:hover .callout-icon svg {
  animation:  levelUpPop 0.7s ease-in-out infinite;
  filter:     drop-shadow(0 0 5px rgba(16, 185, 129, 0.85));
  color:      rgb(16, 185, 129) !important;
}


/* ----------------------------------------------------------
   4. [!spoiler] — GREEN REVEAL ON HOVER
   In the Kuro context, the spoiler glows green on reveal
   ---------------------------------------------------------- */

/* Softer blur (original: 5px) */
.callout[data-callout="spoiler"] .callout-content {
  filter:     blur(6px);
  transition: filter 0.45s ease;
}

/* On hover: blur gone + green glow border */
.callout[data-callout="spoiler"]:hover {
  border-left-color: var(--kuro-green) !important;
  box-shadow:
    0 0 16px rgba(0, 255, 65, 0.14),
    0 0 0 1px rgba(0, 255, 65, 0.18) !important;
  transition: border-left-color 0.3s ease, box-shadow 0.3s ease;
}

.callout[data-callout="spoiler"]:hover .callout-content {
  filter: blur(0);
}

.callout[data-callout="spoiler"]:hover .callout-title {
  color: var(--kuro-green-dim);
  transition: color 0.3s ease;
}

/* Spoiler icon: eye opens (blinks exactly once on hover) */
.callout[data-callout="spoiler"]:hover .callout-icon svg {
  animation: eyeReveal 0.5s ease-out forwards;
  color:     var(--kuro-green-dim) !important;
}


/* ----------------------------------------------------------
   5. [!streak] — FLAME INTENSIFICATION
   Stronger flicker effect, orange glow
   ---------------------------------------------------------- */

.callout[data-callout="streak"] {
  transition: box-shadow 0.3s ease !important;
}

.callout[data-callout="streak"]:hover {
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.07),
    0 0 20px rgba(249, 115, 22, 0.18) !important;
}

/* Stronger flicker on hover */
.callout[data-callout="streak"]:hover .callout-icon svg {
  animation: streakFlame 0.5s ease-in-out infinite;
  filter:    drop-shadow(0 0 8px rgba(249, 115, 22, 1));
  color:     rgb(249, 115, 22) !important;
}


/* ----------------------------------------------------------
   6. KEYFRAME LIBRARY (Kuro-specific)
   ---------------------------------------------------------- */

/* Phosphor flicker: rare, minimal opacity dip */
@keyframes phosphorFlicker {
  0%,   93%, 100% { opacity: 1; }
  94%              { opacity: 0.93; }
  95%              { opacity: 1; }
  97%              { opacity: 0.96; }
  98%              { opacity: 1; }
}

/* Classic cursor blink */
@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

/* Neon pulse (for the [!kuro] icon) */
@keyframes neonPulse {
  0%, 100% {
    filter: drop-shadow(0 0 3px rgba(0, 255, 65, 0.6));
  }
  50% {
    filter: drop-shadow(0 0 8px rgba(0, 255, 65, 1))
            drop-shadow(0 0 16px rgba(0, 255, 65, 0.4));
  }
}

/* Level-up pop: with a glow burst */
@keyframes levelUpPop {
  0%, 100% {
    transform: scale(1) translateY(0);
    filter:    drop-shadow(0 0 3px rgba(16, 185, 129, 0.6));
  }
  40% {
    transform: scale(1.25) translateY(-5px);
    filter:    drop-shadow(0 0 10px rgba(16, 185, 129, 1))
               drop-shadow(0 0 20px rgba(16, 185, 129, 0.5));
  }
  70% {
    transform: scale(1.1) translateY(-2px);
    filter:    drop-shadow(0 0 6px rgba(16, 185, 129, 0.8));
  }
}

/* Streak flame: intense and restless */
@keyframes streakFlame {
  0%, 100% {
    transform: scaleY(1) scaleX(1);
    filter:    drop-shadow(0 0 5px rgba(249, 115, 22, 0.8));
  }
  20% {
    transform: scaleY(1.1) scaleX(0.94);
    filter:    drop-shadow(0 0 10px rgba(249, 115, 22, 1));
  }
  50% {
    transform: scaleY(0.95) scaleX(1.06);
    filter:    drop-shadow(0 0 7px rgba(249, 115, 22, 0.9));
  }
  80% {
    transform: scaleY(1.08) scaleX(0.97);
    filter:    drop-shadow(0 0 12px rgba(249, 115, 22, 1));
  }
}

/* Eye opens (spoiler reveal) */
@keyframes eyeReveal {
  0%   { transform: scaleY(0.2); opacity: 0.4; }
  60%  { transform: scaleY(1.15); }
  100% { transform: scaleY(1);   opacity: 1; }
}

/* Glitch shift: brief horizontal offset with clip */
@keyframes glitchShift {
  0%,  90%, 100% { transform: translateX(0);  clip-path: none; }
  91%             { transform: translateX(-4px); }
  92%             {
    transform: translateX(3px);
    clip-path: polygon(0 20%, 100% 20%, 100% 45%, 0 45%);
  }
  93%             { transform: translateX(0);   clip-path: none; }
  96%             {
    transform: translateX(2px);
    clip-path: polygon(0 60%, 100% 60%, 100% 80%, 0 80%);
  }
  97%             { transform: translateX(0);   clip-path: none; }
}


/* ----------------------------------------------------------
   7. DARK / LIGHT MODE
   ---------------------------------------------------------- */

/* Light mode: keep terminal blocks dark (design decision) */
.theme-light pre.kuro-status,
.theme-light pre.kuro-loot {
  /* Intentional: terminal stays dark even in a light theme */
  background: #0f110f !important;
  color:      #00e83a !important;
  border-color: rgba(0, 232, 58, 0.4) !important;
  text-shadow:
    0 0 4px rgba(0, 232, 58, 0.5),
    0 0 8px rgba(0, 232, 58, 0.2);
}

/* Light mode [!kuro] */
.theme-light .callout[data-callout="kuro"] {
  background: rgba(5, 15, 7, 0.95) !important;
}


/* ----------------------------------------------------------
   8. MOBILE
   ---------------------------------------------------------- */

@media (max-width: 480px) {
  pre.kuro-status,
  pre.kuro-loot {
    font-size: 0.72em !important;
    padding:   10px 12px !important;
    line-height: 1.5 !important;
  }

  /* Disable scanlines on mobile (performance) */
  pre.kuro-status::before,
  pre.kuro-loot::before {
    display: none;
  }

  .callout[data-callout="kuro"] .callout-title {
    font-size:      0.72em;
    letter-spacing: 0.1em;
  }
}
```
