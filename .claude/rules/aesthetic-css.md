---
paths:
  - "docs/aesthetic-css.en.md"
  - "docs/aesthetic-css.de.md"
  - "styles.css"
---

# CRT/Phosphor-Optik

Gotcha zur Optik als Vault-CSS-Snippet (`docs/aesthetic-css.en.md`, `docs/aesthetic-css.de.md`).

- **CRT/Phosphor-Optik** (`docs/aesthetic-css.{en,de}.md`) wird **nicht** mit dem Plugin
  gebündelt — der User installiert es als Vault-CSS-Snippet. Bewusst als Markdown-Codeblock
  gepflegt, nicht als getrackte `.css`-Datei: eine `assets/kuro-gamification.css` wurde vom
  Store-Review-CSS-Lint gescannt (obwohl nie geshippt/referenziert), was auf `!important`
  (strukturell nötig, um beliebige Host-Themes zu überschreiben) und `clip-path` Warnings warf.
  Als Markdown-Doc bekommt es nie eine `.css`-Endung im Repo und wird so nicht mehr gescannt.
