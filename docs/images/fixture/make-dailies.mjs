/**
 * Erzeugt die Daily Notes des Aufnahme-Vaults — relativ zu HEUTE.
 *
 * Warum ein Generator und keine statischen Notizen: Kuro rechnet Streak, Level und XP
 * aus den Daily Notes selbst. Feste Datumsangaben wären am Tag nach dem Commit eine
 * abgerissene Streak und ein Panel, das nichts zeigt — das Bild dokumentierte dann den
 * Aufnahmetag, nicht das Plugin. Der Generator hält den Zustand über die Zeit stabil,
 * ohne dass ein einziger Wert im Treiber gesetzt wird: was im Bild steht, hat das
 * Plugin aus diesen Notizen ausgerechnet.
 *
 * Aufruf: node make-dailies.mjs <vaultDir>   (via VaultSpec.generator)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const vaultDir = process.argv[2];
if (!vaultDir) {
  console.error("Aufruf: node make-dailies.mjs <vaultDir>");
  process.exit(1);
}

/** Wie viele Tage zurück. 14 ergibt eine sichtbare Streak und ein mittleres Level. */
const TAGE = 14;

/** Generische Aufgaben — englisch, keine echten Namen oder Firmen (Aufnahme-Standard). */
const AUFGABEN = [
  "Draft the Acme brief",
  "Reply about the timeline",
  "Book the venue",
  "Review the analytics setup",
  "Sort the reading list",
  "Plan tomorrow",
  "Water the plants",
];

/** Habit-Schlüssel wie in Kuros mitgelieferten Starter-Habits (src/data/default-habits.ts). */
const HABITS = ["water", "move", "outside", "tidy", "connect"];

/** Deterministisch statt zufällig: zwei Läufe sollen dieselben Bilder ergeben. */
function mulberry32(seed) {
  // Der Zustand liegt in einer eigenen Variablen, nicht im Parameter: eine Neuzuweisung
  // des Parameters ist zwar die Lehrbuchform von mulberry32, aber der Repo-Linter
  // verbietet sie — und ein Lint-Ausnahme fuer fuenf Zeilen Fixture-Code waere teurer.
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d) => d.toISOString().slice(0, 10);
const heute = new Date();
heute.setHours(12, 0, 0, 0);

mkdirSync(join(vaultDir, "Daily"), { recursive: true });

const erzeugt = [];
for (let zurueck = TAGE - 1; zurueck >= 0; zurueck--) {
  const tag = new Date(heute);
  tag.setDate(heute.getDate() - zurueck);
  const datum = iso(tag);
  const rnd = mulberry32(Number(datum.replace(/-/g, "")));

  // Jeder Tag liegt über der Qualifikationsschwelle (Default 50 %), sonst reißt die
  // Streak und das Panel zeigt eine 1 statt einer Serie. Der HEUTIGE Tag bleibt bewusst
  // unfertig: ein Bild, in dem alles abgehakt ist, zeigt den untypischen Fall.
  const gesamt = 4 + Math.floor(rnd() * 3);
  const erledigt = zurueck === 0 ? Math.ceil(gesamt * 0.6) : Math.max(3, Math.ceil(gesamt * (0.7 + rnd() * 0.3)));

  // Heute: die ersten drei Habits erledigt, die letzten zwei offen — ein Tag, der noch
  // laeuft. Bewusst gesetzt statt gewuerfelt: der Wurf ergab hier 1 von 5, und ein Panel
  // mit fast leerer Habit-Zeile zeigt den Mechanismus schlechter als einer mit Fortschritt.
  const habits = {};
  HABITS.forEach((key, i) => { habits[key] = zurueck === 0 ? i < 3 : rnd() < 0.8; });

  const zeilen = [];
  zeilen.push("---");
  for (const key of HABITS) zeilen.push(`${key}: ${habits[key]}`);
  zeilen.push("---");
  zeilen.push("");
  zeilen.push("## Tasks");
  zeilen.push("");
  for (let i = 0; i < gesamt; i++) {
    zeilen.push(`- [${i < erledigt ? "x" : " "}] ${AUFGABEN[(i + zurueck) % AUFGABEN.length]}`);
  }
  zeilen.push("");

  writeFileSync(join(vaultDir, "Daily", `${datum}.md`), zeilen.join("\n"));
  erzeugt.push(`${datum} (${erledigt}/${gesamt})`);
}

console.log(`\n   ${erzeugt.length} Daily Notes: ${erzeugt[0]} … ${erzeugt[erzeugt.length - 1]}`);
