#!/bin/sh
# Re-vendor kit modules. Zwei Quellen, seit dem code-kit-Split (2026-09-02).
# Form uebernommen aus obsidian-kit/tools/sync-code-kit.sh (`git show` aus der Ref,
# `^{commit}`-Peel, Torso-Schutz per mv) + der Zwei-Quellen-Aufteilung aus
# mailstone/tools/sync-kit.sh. Registry: § Utils, "Vendoring per Sync-Skript".
#
# WARUM ZWEI QUELLEN. obsidian-kit hat seine domaenenfreie pure-Teilmenge nach `code-kit`
# abgegeben (obsidian-kit@2ab1bb5, "feat!: domaenenfreie pure-Teilmenge zieht nach
# code-kit 0.1.0"). Von den zehn Modulen unter src/vendor/kit/ liegen seither SECHS als
# Vendor-Kopie im Kit (src/vendor/code-kit/) und VIER — num, reasoning, sse,
# think-splitter — gar nicht mehr darin. Wer nur die Pfade im Kit nachzieht, laeuft bei
# diesen vier weiter ins Leere: die pure-Schicht kommt ab jetzt DIREKT aus code-kit,
# obsidian-kit bleibt Quelle nur noch fuer die obsidian-Schicht. Kuro ist damit
# Geschwister-Konsument des Kits, nicht Konsument zweiter Ordnung.
#
# GELESEN WIRD AUS DER REF, nicht aus dem Arbeitsstand des Nachbar-Repos — sonst behauptet
# VENDOR.json einen Stand, der nicht der kopierte ist (zwei Messungen unter einer Aussage).
# Damit entfaellt der frueher noetige Arbeitsstand-Guard ersatzlos: gegen eine feste Ref ist
# ein abweichender Arbeitsbaum egal.
#
# Nie von Hand editieren — Skript neu laufen lassen. Quellen und Staende festnagelbar per
# KIT_DIR/KIT_REF und CODEKIT_DIR/CODEKIT_REF.
set -e

KIT="${KIT_DIR:-../obsidian-kit}"
KIT_REF="${KIT_REF:-0.43.0}"
CODEKIT="${CODEKIT_DIR:-../../libs/code-kit}"
CODEKIT_REF="${CODEKIT_REF:-0.7.0}"
# Eigener Pin, Absicht: help-setting.ts (Hilfe-Zeile, UI-STANDARD 8) kam mit Kit 0.43.0 und haengt an
# keinem anderen Modul — die uebrigen Module bleiben auf KIT_REF (Vorlage epub-exporter 877eb2c).
KIT_HELP_REF="${KIT_HELP_REF:-0.43.0}"

# Nur die Module, die DIESES Repo wirklich konsumiert.
CK_PURE="endpoint endpoint_config endpoint_diagnostics error_body model-choice model-list-cache num reasoning sampling-profiles sse stream-blocks think-splitter"
# Aus obsidian-kit/src/pure/ (nicht code-kit), aber mit Querimport auf code-kit → relayer_pure.
KIT_PURE="endpoint-source"
CK_WEB="clipboard"
KIT_OBSIDIAN="chat-client chat-transport clipboard clock confirm endpoint-list endpoint-source model-picker stable-writer stream-area"

# --- Vorbedingungen. Alle Pruefungen VOR dem ersten Schreibvorgang: ein Fehlschlag darf
#     keine halb aktualisierte Vendor-Schicht hinterlassen.
for pair in "$KIT|$KIT_REF|KIT_DIR" "$CODEKIT|$CODEKIT_REF|CODEKIT_DIR"; do
  dir=$(printf '%s' "$pair" | cut -d'|' -f1)
  ref=$(printf '%s' "$pair" | cut -d'|' -f2)
  var=$(printf '%s' "$pair" | cut -d'|' -f3)
  test -d "$dir/.git" || { echo "sync-kit: kein git-Repo unter $dir — $var setzen. Nichts geschrieben." >&2; exit 1; }
  git -C "$dir" rev-parse --verify --quiet "$ref^{commit}" >/dev/null \
    || { echo "sync-kit: Ref '$ref' gibt es in $dir nicht. Nichts geschrieben." >&2; exit 1; }
done

git -C "$KIT" cat-file -e "$KIT_HELP_REF:src/obsidian/help-setting.ts" 2>/dev/null \
  || { echo "sync-kit: src/obsidian/help-setting.ts fehlt in Ref $KIT_HELP_REF (KIT_HELP_REF setzen). Nichts geschrieben." >&2; exit 1; }

# `^{commit}` ist NICHT optional: bei einem ANNOTIERTEN Tag (code-kit taggt annotiert) liefert
# `rev-parse` sonst die SHA des Tag-OBJEKTS — eine Zahl, die in `git log` der Quelle gar nicht
# vorkommt. obsidian-kits Tags sind leichtgewichtig, dort faellt es nicht auf; das ist Zufall,
# kein Schutz (REGISTRY § Utils, Fall obsidian-kit 0f936c9 → 7c04a48).
KIT_SHA=$(git -C "$KIT" rev-parse --short "$KIT_REF^{commit}")
CK_SHA=$(git -C "$CODEKIT" rev-parse --short "$CODEKIT_REF^{commit}")
HELP_SHA=$(git -C "$KIT" rev-parse --short "$KIT_HELP_REF^{commit}")
DATE=$(date +%F)

mkdir -p src/vendor/kit src/vendor/kit-obsidian

# Kopiert EINE Datei aus einer Ref an ihren Zielort: Herkunfts-Header plus Inhalt in einem Zug,
# geschrieben in .tmp und erst bei Erfolg per mv umgelegt. Ohne den Torso-Schutz bliebe bei
# einem Fehlschlag eine halbe Datei liegen, die den "do not hand-edit"-Stempel schon traegt und
# damit wie ein gueltiges Vendoring aussieht.
copy() { # copy <repo-dir> <ref> <quell-label> <quellpfad> <zielpfad>
  tmp="$5.tmp$$"
  { printf '%s\n' "// vendored from $3@$2, $4 — do not hand-edit; re-vendor via tools/sync-kit.sh"
    git -C "$1" show "$2:$4"; } > "$tmp" \
    || { rm -f "$tmp"; echo "sync-kit: $4 fehlt in $3@$2 — nichts geschrieben." >&2; exit 1; }
  mv "$tmp" "$5"
}

# Kit-interne Querimporte aufs Vendor-Layout umschreiben. Im Kit liegt die pure-Schicht seit dem
# code-kit-Split unter src/vendor/code-kit/{pure,web}/, hier flach unter src/vendor/kit/ —
# der Kit-Pfad zeigt hier also ins Leere. Das ist die EINZIGE zulaessige Abweichung von verbatim;
# bei jedem Re-Vendor reproduzieren, sonst darf nichts abweichen.
relayer() { # relayer <vendored-file>
  f=$1

  # (0) VORBEDINGUNG. Der Umschrieb setzt die Zwei-Ordner-Form voraus. Ohne sie zeigt `../kit/`
  #     von src/vendor/kit/ aus auf DIE DATEI SELBST — und weil obsidian/clipboard.ts und
  #     web/clipboard.ts denselben Basenamen tragen, faellt das erst im Typecheck auf (TS2305).
  case "$f" in
    src/vendor/kit-obsidian/*) ;;
    *) echo "sync-kit: $f liegt nicht in src/vendor/kit-obsidian/ — der Querimport-Umschrieb setzt die Zwei-Ordner-Form voraus" >&2; exit 1 ;;
  esac
  [ -d src/vendor/kit ] || { echo "sync-kit: src/vendor/kit/ fehlt — pure-Schicht anlegen, bevor gekoppelte Module mit Querimport vendoriert werden" >&2; exit 1; }

  # (1) Umschreiben, und feststellen OB umgeschrieben wurde. `cmp` statt md5: portabel,
  #     macOS (md5) und GitHub-CI (md5sum) heissen verschieden. `../pure/` bleibt im Muster,
  #     damit auch ein Rueckschritt auf eine Vor-Split-Ref sauber umgeschrieben wird.
  # Getrennte Ausdruecke statt einer Alternation: BSD-sed (macOS) kennt `\|` im BRE NICHT und
  #     schreibt dann gar nichts um — lautlos, mit Exit 0. Gemessen 2026-09-02.
  sed -e 's|\(["'"'"']\)\.\./vendor/code-kit/pure/|\1../kit/|g' \
      -e 's|\(["'"'"']\)\.\./vendor/code-kit/web/|\1../kit/|g' \
      -e 's|\(["'"'"']\)\.\./pure/|\1../kit/|g' "$f" > "$f.tmp"
  if cmp -s "$f" "$f.tmp"; then rm -f "$f.tmp"; return 0; fi   # nichts zu tun, KEINE Notiz
  mv "$f.tmp" "$f"

  # (2) Gegenprobe: bleibt ein Kit-interner Pfad stehen, bricht der Build spaeter und woanders.
  if grep -qE '\.\./(vendor/code-kit/(pure|web)|pure)/' "$f"; then
    echo "sync-kit: Kit-interner Importpfad in $f nicht umgeschrieben — Muster pruefen" >&2; exit 1
  fi

  # (3) Mitvendorier-Gegenprobe: jedes umgeschriebene Ziel muss auch wirklich da sein.
  for dep in $(sed -n 's|.*from ["'"'"']\.\./kit/\([A-Za-z0-9_/-]*\)["'"'"'].*|\1|p' "$f" | sort -u); do
    [ -f "src/vendor/kit/$dep.ts" ] || {
      echo "sync-kit: $f importiert ../kit/$dep, aber src/vendor/kit/$dep.ts fehlt — mitvendorieren" >&2; exit 1
    }
  done

  note="// ONE mechanical deviation from verbatim: kit-internal imports of the code-kit layer → ../kit/ (vendor layout); reproduce on every re-vendor, nothing else may differ."
  printf '%s\n' "$note" | cat - "$f" > "$f.tmp"
  mv "$f.tmp" "$f"
}

# Zweite Fallgruppe: ein Modul aus obsidian-kit/src/pure/ mit Querimport auf code-kit. Beide Seiten
# liegen hier flach in src/vendor/kit/, der Zielpfad ist also ./ (Geschwisterdatei) statt ../kit/.
# Praezedenz: lingotuner/tools/sync-kit.sh (relayer_pure).
relayer_pure() { # relayer_pure <vendored-file>
  f=$1
  case "$f" in
    src/vendor/kit/*) ;;
    *) echo "sync-kit: $f liegt nicht in src/vendor/kit/ — relayer_pure gilt nur fuer die pure-Schicht" >&2; exit 1 ;;
  esac
  sed -e 's|\(["'"'"']\)\.\./vendor/code-kit/pure/|\1./|g' \
      -e 's|\(["'"'"']\)\.\./vendor/code-kit/web/|\1./|g' "$f" > "$f.tmp"
  if cmp -s "$f" "$f.tmp"; then rm -f "$f.tmp"; return 0; fi
  mv "$f.tmp" "$f"
  if grep -qE '\.\./vendor/code-kit/' "$f"; then
    echo "sync-kit: unaufgeloester Kit-Querimport in $f — Muster pruefen" >&2; exit 1
  fi
  for dep in $(sed -n 's|.*from ["'"'"']\./\([A-Za-z0-9_/-]*\)["'"'"'].*|\1|p' "$f" | sort -u); do
    [ -f "src/vendor/kit/$dep.ts" ] || {
      echo "sync-kit: $f importiert ./$dep, aber src/vendor/kit/$dep.ts fehlt — mitvendorieren" >&2; exit 1
    }
  done
  note="// ONE mechanical deviation from verbatim: kit-internal import (../vendor/code-kit/{pure,web}/) → ./ (flat vendor layout, sibling module in src/vendor/kit/); reproduce on every re-vendor, nothing else may differ."
  printf '%s\n' "$note" | cat - "$f" > "$f.tmp"
  mv "$f.tmp" "$f"
}

# Die pure-Schicht zuerst — Guard (3) des relayers prueft gegen sie.
for m in $CK_PURE; do
  copy "$CODEKIT" "$CODEKIT_REF" code-kit "src/ts/pure/$m.ts" "src/vendor/kit/$m.ts"
  echo "vendored code-kit@$CODEKIT_REF/pure/$m.ts"
done
for m in $CK_WEB; do
  copy "$CODEKIT" "$CODEKIT_REF" code-kit "src/ts/web/$m.ts" "src/vendor/kit/$m.ts"
  echo "vendored code-kit@$CODEKIT_REF/web/$m.ts"
done

for m in $KIT_PURE; do
  copy "$KIT" "$KIT_REF" obsidian-kit "src/pure/$m.ts" "src/vendor/kit/$m.ts"
  relayer_pure "src/vendor/kit/$m.ts"
  echo "vendored obsidian-kit@$KIT_REF/pure/$m.ts"
done

for m in $KIT_OBSIDIAN; do
  copy "$KIT" "$KIT_REF" obsidian-kit "src/obsidian/$m.ts" "src/vendor/kit-obsidian/$m.ts"
  relayer "src/vendor/kit-obsidian/$m.ts"
  echo "vendored obsidian-kit@$KIT_REF/obsidian/$m.ts"
done

# help-setting.ts aus dem eigenen Pin, nicht aus KIT_REF.
copy "$KIT" "$KIT_HELP_REF" obsidian-kit "src/obsidian/help-setting.ts" "src/vendor/kit-obsidian/help-setting.ts"
echo "vendored obsidian-kit@$KIT_HELP_REF/obsidian/help-setting.ts"

# Dateiliste der obsidian-Schicht fuer VENDOR.json — als Schleife statt als sed-Kaskade,
# damit die Form nicht an einem Zeichenklassen-Detail haengt.
KIT_OBSIDIAN_LIST=""
for m in $KIT_OBSIDIAN; do
  [ -z "$KIT_OBSIDIAN_LIST" ] && KIT_OBSIDIAN_LIST="$m.ts" || KIT_OBSIDIAN_LIST="$KIT_OBSIDIAN_LIST, $m.ts"
done

cat > src/vendor/kit/VENDOR.json <<JSON
{
  "source": "code-kit",
  "tag": "$CODEKIT_REF",
  "version": "$CODEKIT_REF",
  "sha": "$CK_SHA",
  "date": "$DATE",
  "vendored": "pure: $(echo $CK_PURE | tr ' ' ',' | sed 's/,/, /g'); web: $(echo $CK_WEB | tr ' ' ',' | sed 's/,/, /g')",
  "note": "Verbatim snapshot von code-kit/src/ts (plus Herkunfts-Header in Zeile 1). Der Ordner heisst historisch 'kit'; die Quelle ist seit dem code-kit-Split (obsidian-kit@2ab1bb5) code-kit, nicht obsidian-kit. Never hand-edit. Re-vendor via tools/sync-kit.sh. kit-obsidian/ siehe dortige VENDOR.json."
}
JSON
cat > src/vendor/kit-obsidian/VENDOR.json <<JSON
{
  "source": "obsidian-kit",
  "tag": "$KIT_REF",
  "version": "$KIT_REF",
  "sha": "$KIT_SHA",
  "date": "$DATE",
  "vendored": "$KIT_OBSIDIAN_LIST",
  "note": "Verbatim snapshot von obsidian-kit/src/obsidian (plus Herkunfts-Header in Zeile 1). clipboard.ts, endpoint-list.ts und model-picker.ts tragen EINE mechanische Abweichung: die Kit-internen Importe der code-kit-Schicht zeigen auf ../kit/ (Vendor-Layout). Bei jedem Re-Vendoring reproduzieren; sonst darf nichts abweichen. Never hand-edit. Re-vendor via tools/sync-kit.sh.",
  "vendored_mixed_version": [
    {
      "file": "help-setting.ts",
      "version": "$KIT_HELP_REF",
      "sha": "$HELP_SHA",
      "note": "Eigener Pin KIT_HELP_REF in tools/sync-kit.sh (git show $KIT_HELP_REF:src/obsidian/help-setting.ts), NICHT KIT_REF. Re-vendor mit KIT_HELP_REF=<neuer-tag> sh tools/sync-kit.sh; Kopf-Stempel und dieser Eintrag ziehen automatisch nach."
    }
  ]
}
JSON
echo "VENDOR.json → code-kit@$CODEKIT_REF ($CK_SHA) · obsidian-kit@$KIT_REF ($KIT_SHA)"
