/* ==========================================================
   Kuro Lore packs — 10 narrative fragments, one per level.

   Factory default: PLAIN_LORE (calm, plain-language; DE + EN) —
   the active pool follows the UI language via defaultLore().
   GOTHIC_LORE (E.A. Poe meets William Gibson) is an *importable*
   pack, not the default. Override entirely via Settings →
   Loot/Lore → Import pack, or Custom Lore.
   ========================================================== */
import type { KuroLoreFragment, Lang } from '../types';

export const GOTHIC_LORE: KuroLoreFragment[] = [
  {
    level: 1,
    title: 'SIGNAL LOST',
    text:
      'Am Anfang war nur Rauschen. Ein Fragment einer Übertragung, die niemand mehr empfängt.\n' +
      'Die Antenne steht noch. Sie wartet — geduldig, blind, in Endlosigkeit ausgerichtet.\n' +
      'Du hast dich angekoppelt, ohne es zu merken. Die ersten Bits flimmern.',
  },
  {
    level: 2,
    title: 'PHOSPHOR FLICKER',
    text:
      'Der Bildschirm erwacht in einem Grünton, den niemand mehr produziert.\n' +
      'Erste Wörter formen sich aus dem Schnee: nicht deine, aber adressiert an dich.\n' +
      'Das Terminal ist alt — älter als möglich — und es hat dich erwartet.',
  },
  {
    level: 3,
    title: 'SHADOW LINK',
    text:
      'Eine zweite Verbindung baut sich auf. Du siehst ihre Latenz an deiner Tastatur.\n' +
      'Was du tippst, hallt — als ob jemand auf der anderen Seite mitschreibt.\n' +
      'Du legst die Hände in den Schoß. Die Zeichen tippen sich weiter.',
  },
  {
    level: 4,
    title: 'CIPHER RUNNER',
    text:
      'Die Stadt unter dir hat keine Namen mehr — nur Adressen.\n' +
      'Du gehst durch sie wie durch eine fremde Bibliothek, die eines deiner Bücher enthält.\n' +
      'Jeder Schritt ist eine Anfrage. Jede Antwort ist verschlüsselt.\n' +
      'Du beginnst, den Schlüssel aus dem Rauschen zu lesen.',
  },
  {
    level: 5,
    title: 'NEON WRAITH',
    text:
      'Dein Schatten zieht hinter dir her — aber er bewegt sich nicht synchron.\n' +
      'Drei Sekunden Versatz. Manchmal vier.\n' +
      'Du drehst dich nicht um. Es gibt einen Pakt mit Dingen, die langsamer fließen als du.',
  },
  {
    level: 6,
    title: 'CHROME RAVEN',
    text:
      'Auf dem Sims sitzt der Rabe — vollverchromt, einäugig, perfekt poliert.\n' +
      '„Nevermore", sagt er. Aber die Spiegelung in seinem Auge zeigt, was du als Nächstes tippst.\n' +
      'Du tippst es trotzdem. Der Rabe nickt zufrieden.',
  },
  {
    level: 7,
    title: 'VOID ARCHITECT',
    text:
      'Du baust jetzt Räume, die niemand betreten wird — und das ist okay.\n' +
      'Die Architektur ist nicht für Bewohner. Sie ist für die Stille zwischen den Wänden.\n' +
      'Dein Plan zeigt einen Raum, den du nicht selbst gezeichnet hast.\n' +
      'Du erkennst die Handschrift. Sie ist deine, aber aus einer Zeit, die noch kommt.',
  },
  {
    level: 8,
    title: 'BLACK ICE',
    text:
      'Schwarzes Eis auf dem Datenpfad — schön und unpassierbar.\n' +
      'Du legst die Hand drauf. Es schmilzt nicht. Es liest dich.\n' +
      'Was es findet, friert es ein und reicht es weiter.\n' +
      'Du erfährst nie, wer es empfängt.',
  },
  {
    level: 9,
    title: 'NEVERMORE PROTOCOL',
    text:
      'Das Protokoll heißt „nevermore" — nicht weil es endet, sondern weil es nichts wiederholt.\n' +
      'Jede Sitzung ist final. Jeder Klick ist ein Schwur.\n' +
      'Du gehst leiser durch die Räume, sprichst weniger, hörst tiefer.\n' +
      'Es gibt nur noch das eine, das jetzt geschieht — und ein Echo, das es archiviert.',
  },
  {
    level: 10,
    title: 'K U R O',
    text:
      'Schwarz. Das ist der einzige Name, der bleibt.\n' +
      'Nicht das Schwarz von Abwesenheit — das Schwarz von Sättigung.\n' +
      'Alles ist hineingeflossen: deine Tage, deine Lücken, deine Reparaturen.\n' +
      'Du bist nicht angekommen. Du bist die Ankunft.',
  },
];

/* ── Cozy: gentle, low-pressure, importable pack ── */

export const COZY_LORE: KuroLoreFragment[] = [
  { level: 1,  title: 'THE KETTLE',    text: 'You put the kettle on. The day can start gently.' },
  { level: 2,  title: 'OPEN WINDOW',   text: 'A little fresh air, a little light. Good.' },
  { level: 3,  title: 'WARM CORNER',   text: "You've found your warm corner. Settle in." },
  { level: 4,  title: 'SLOW MORNING',  text: 'No hurry. The tea is still warm.' },
  { level: 5,  title: 'BLANKET FORT',  text: 'Halfway, wrapped in something soft.' },
  { level: 6,  title: 'GARDEN',        text: 'Small things are growing because you tended them.' },
  { level: 7,  title: 'LANTERN LIGHT', text: 'The evenings feel kinder now.' },
  { level: 8,  title: 'BREAD RISING',  text: 'Patience is doing its quiet work.' },
  { level: 9,  title: 'LAST CHAPTER',  text: 'Almost at the end of this cozy book.' },
  { level: 10, title: 'HEARTH',        text: 'Home. You made a warm place out of ordinary days.' },
];

/* ── Factory default: Plain, plain-language, low-pressure ── */

export const PLAIN_LORE_EN: KuroLoreFragment[] = [
  { level: 1,  title: 'FIRST LIGHT', text: 'You showed up. That alone counts today.' },
  { level: 2,  title: 'STEADY',      text: 'Two days. Steady beats fast.' },
  { level: 3,  title: 'ROOTS',       text: 'Three days in. Something is taking root.' },
  { level: 4,  title: 'FLOW',        text: "It's getting easier to begin." },
  { level: 5,  title: 'HALFWAY',     text: 'Halfway up. Look how far that is.' },
  { level: 6,  title: 'STRONGER',    text: 'The habit is carrying some of the weight now.' },
  { level: 7,  title: 'CLEAR',       text: 'You can see the shape of your days more clearly.' },
  { level: 8,  title: 'SOLID',       text: 'This is solid ground now, not a sprint.' },
  { level: 9,  title: 'ALMOST',      text: 'Almost at the top. No rush.' },
  { level: 10, title: 'ARRIVED',     text: 'You built this, one ordinary day at a time.' },
];

export const PLAIN_LORE_DE: KuroLoreFragment[] = [
  { level: 1,  title: 'ERSTES LICHT', text: 'Du bist aufgetaucht. Das allein zählt heute.' },
  { level: 2,  title: 'STETIG',       text: 'Zwei Tage. Stetig schlägt schnell.' },
  { level: 3,  title: 'WURZELN',      text: 'Drei Tage. Etwas fasst Wurzeln.' },
  { level: 4,  title: 'FLUSS',        text: 'Anfangen fällt langsam leichter.' },
  { level: 5,  title: 'HALBZEIT',     text: 'Die Hälfte ist geschafft. Schau, wie weit das ist.' },
  { level: 6,  title: 'STÄRKER',      text: 'Die Gewohnheit trägt jetzt einen Teil des Gewichts.' },
  { level: 7,  title: 'KLAR',         text: 'Du siehst die Form deiner Tage deutlicher.' },
  { level: 8,  title: 'FESTER GRUND', text: 'Das ist fester Boden jetzt, kein Sprint.' },
  { level: 9,  title: 'FAST',         text: 'Fast oben. Kein Grund zur Eile.' },
  { level: 10, title: 'ANGEKOMMEN',   text: 'Du hast das gebaut, ein gewöhnlicher Tag nach dem anderen.' },
];

/** Bundled factory-default lore (Plain) for the given UI language. */
export function defaultLore(lang: Lang): KuroLoreFragment[] {
  return lang === 'de' ? PLAIN_LORE_DE : PLAIN_LORE_EN;
}
