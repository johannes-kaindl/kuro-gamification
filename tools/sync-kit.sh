#!/bin/sh
# Re-vendor kit modules from ../obsidian-kit. Run after kit updates.
# Vorlage: koda-agent/tools/sync-kit.sh (die Form, die fuenf Repos teilen).
set -e

KIT="${KIT_DIR:-../obsidian-kit}"
[ -d "$KIT/src/pure" ] || { echo "sync-kit: Kit nicht gefunden unter $KIT (KIT_DIR setzen)" >&2; exit 1; }

VER=$(node -p "require('$KIT/package.json').version")

# SHA aus dem TAG, nicht aus HEAD. Grund, gemessen 2026-08-20: obsidian-kit HEAD stand auf
# fbb42d4 (ein docs(readme)-Commit NACH 0.27.0), der Tag-Commit ist 548041b. Ein HEAD-Pin
# schriebe "version": "0.27.0" neben eine Nicht-Tag-SHA — der Pin behauptete dann etwas,
# das tools/pin_find.py so nie bestaetigen kann.
SHA=$(git -C "$KIT" rev-parse --short "$VER") || {
  echo "sync-kit: kein Tag '$VER' in $KIT — release-Tag fehlt, Pin waere geraten" >&2; exit 1; }

# Und der Arbeitsbaum des Kits muss diesem Tag entsprechen, sonst kopieren wir etwas
# anderes, als der Stempel behauptet.
git -C "$KIT" diff --quiet "$VER" -- src || {
  echo "sync-kit: $KIT/src weicht von Tag $VER ab — die Kopie waere nicht der Tag-Stand" >&2; exit 1; }

stamp() { # stamp <vendored-file> <kit-relative-path>
  header="// vendored from obsidian-kit@$VER, $2 — do not hand-edit; re-vendor via tools/sync-kit.sh"
  printf '%s\n' "$header" | cat - "$1" > "$1.tmp"
  mv "$1.tmp" "$1"
}

# Kit-interne Querimporte aufs Vendor-Layout umschreiben. Im Kit liegen die Schichten als
# src/obsidian + src/pure nebeneinander, hier als src/vendor/kit-obsidian + src/vendor/kit —
# `../pure/` zeigt hier also ins Leere. Das ist die EINZIGE zulaessige Abweichung von verbatim;
# bei jedem Re-Vendor reproduzieren, sonst darf nichts abweichen.
# Praezedenz: kuro-gamification, markdown-presentation, vault-crews, vim-dojo (seit 0.26.0).
relayer() { # relayer <vendored-file>
  f=$1

  # (0) VORBEDINGUNG. Der Umschrieb setzt die Zwei-Ordner-Form der Kit-README voraus. Ohne sie
  #     zeigt `../kit/` von src/vendor/kit/ aus auf DIE DATEI SELBST — und weil obsidian/clipboard.ts
  #     und pure/clipboard.ts denselben Basenamen tragen, faellt das erst im Typecheck auf (TS2305).
  case "$f" in
    src/vendor/kit-obsidian/*) ;;
    *) echo "sync-kit: $f liegt nicht in src/vendor/kit-obsidian/ — der Querimport-Umschrieb setzt die Zwei-Ordner-Form voraus (obsidian-kit/README.md)" >&2; exit 1 ;;
  esac
  [ -d src/vendor/kit ] || { echo "sync-kit: src/vendor/kit/ fehlt — pure-Schicht anlegen, bevor gekoppelte Module mit Querimport vendoriert werden" >&2; exit 1; }

  # (1) Umschreiben, und feststellen OB umgeschrieben wurde. `cmp` statt md5: portabel,
  #     macOS (md5) und GitHub-CI (md5sum) heissen verschieden.
  sed 's|\(["'"'"']\)\.\./pure/|\1../kit/|g' "$f" > "$f.tmp"
  if cmp -s "$f" "$f.tmp"; then rm -f "$f.tmp"; return 0; fi   # nichts zu tun, KEINE Notiz
  mv "$f.tmp" "$f"

  # (2) Gegenprobe: bleibt ein ../pure/ stehen, bricht der Build spaeter und woanders.
  if grep -q '\.\./pure/' "$f"; then
    echo "sync-kit: '../pure/' in $f nicht umgeschrieben — Muster pruefen" >&2; exit 1
  fi

  # (3) Mitvendorier-Gegenprobe: jedes umgeschriebene Ziel muss auch wirklich da sein.
  for dep in $(sed -n 's|.*from ["'"'"']\.\./kit/\([A-Za-z0-9_/-]*\)["'"'"'].*|\1|p' "$f" | sort -u); do
    [ -f "src/vendor/kit/$dep.ts" ] || {
      echo "sync-kit: $f importiert ../kit/$dep, aber src/vendor/kit/$dep.ts fehlt — mitvendorieren" >&2; exit 1
    }
  done

  note="// ONE mechanical deviation from verbatim: kit-internal imports ../pure/ → ../kit/ (vendor layout); reproduce on every re-vendor, nothing else may differ."
  printf '%s\n' "$note" | cat - "$f" > "$f.tmp"
  mv "$f.tmp" "$f"
}

mkdir -p src/vendor/kit src/vendor/kit-obsidian

# Nur die Module, die DIESES Repo wirklich konsumiert. Die pure-Schicht zuerst — Guard (3)
# des relayers prueft gegen sie.
for m in clipboard endpoint endpoint_config endpoint_diagnostics model-choice model-list-cache num reasoning sse think-splitter; do
  cp "$KIT/src/pure/$m.ts" "src/vendor/kit/$m.ts"
  stamp "src/vendor/kit/$m.ts" "src/pure/$m.ts"
  echo "vendored obsidian-kit@$VER/pure/$m.ts"
done

for m in clipboard clock confirm endpoint-list model-picker; do
  cp "$KIT/src/obsidian/$m.ts" "src/vendor/kit-obsidian/$m.ts"
  relayer "src/vendor/kit-obsidian/$m.ts"
  stamp "src/vendor/kit-obsidian/$m.ts" "src/obsidian/$m.ts"
  echo "vendored obsidian-kit@$VER/obsidian/$m.ts"
done

cat > src/vendor/kit/VENDOR.json <<JSON
{
  "source": "obsidian-kit",
  "version": "$VER",
  "sha": "$SHA",
  "vendored": "clipboard.ts, endpoint.ts, endpoint_config.ts, endpoint_diagnostics.ts, model-choice.ts, model-list-cache.ts, num.ts, reasoning.ts, sse.ts, think-splitter.ts",
  "note": "Verbatim snapshot. Never hand-edit. Re-vendor via tools/sync-kit.sh. kit-obsidian/ siehe dortige VENDOR.json."
}
JSON
cat > src/vendor/kit-obsidian/VENDOR.json <<JSON
{
  "source": "obsidian-kit",
  "version": "$VER",
  "sha": "$SHA",
  "vendored": "clipboard.ts, clock.ts, confirm.ts, endpoint-list.ts, model-picker.ts",
  "note": "Verbatim snapshot. Never hand-edit. Re-vendor via tools/sync-kit.sh. clipboard.ts, endpoint-list.ts und model-picker.ts tragen EINE mechanische Abweichung: Importpfade ../pure/ -> ../kit/ angepasst (Vendor-Layout). Bei jedem Re-Vendoring reproduzieren; sonst darf nichts abweichen. Praezedenz: vim-dojo, markdown-presentation, vault-crews."
}
JSON
echo "VENDOR.json → $VER ($SHA)"
