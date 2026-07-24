# Design-Philosophie — Kuro Gamification

> [🇬🇧 English version](philosophy.en.md)

Dieses Dokument sammelt die Begründungen hinter jeder nicht-offensichtlichen Design-Entscheidung in Kuro Gamification. Es richtet sich an Benutzer, die verstehen wollen, *warum* das Plugin so funktioniert wie es tut, und an Beitragende, die einschätzen möchten, ob eine vorgeschlagene Änderung zum Geist des Projekts passt.

---

## 1. Warum dieses Plugin existiert

Die meisten Produktivitäts-Gamification-Tools sind für neurotypische Gehirne gebaut. Sie gehen davon aus, dass du jeden Tag erscheinst, dass ein verpasster Tag ein moralisches Versagen ist, dass Benachrichtigungen helfen, dass exponentielle Belohnungskurven motivierend statt ausschließend sind. Für viele Menschen mit ADHS oder Autismus kehren sich diese Annahmen um: Ein harter Streak, der an Tag 12 bricht, ist nicht motivierend — es ist ein Grund, ganz aufzuhören.

Kuro Gamification wurde als **freundlicher Spiegel** gebaut, nicht als Produktivitätszwang. Es spiegelt wider, was du tatsächlich gemacht hast, in einer Sprache, die ein bisschen Spaß macht, und gibt dir gelegentlich eine kleine Belohnung dafür, dass du am Leben bist und dein Bestes gibst. Es gibt kein Urteil über Tage, an denen du Obsidian nicht geöffnet hast. Es gibt keinen Score, der verfällt, wenn du eine Pause einlegst.

Das Plugin ist für Menschen, die ein bisschen Verspieltheit in ihrem Notizen-Workflow wollen, ohne die Angst, die konventionelle Gamification mit sich bringt.

---

## 2. Off by Default

Jedes Feature, das sich wie eine Verpflichtung anfühlen könnte, ist **standardmäßig ausgeschaltet** oder kann vollständig und unabhängig deaktiviert werden:

| Feature | Standard | Warum |
|---|---|---|
| Status-Bar-Indikator | **aus** | Permanente Sichtbarkeit erzeugt Hintergrunddruck |
| Toast-Benachrichtigungen | aus für passive Events | Unterbrechungen dürfen nur durch explizite Aktionen ausgelöst werden |
| Streak-Tracking | an, aber abschaltbar | Streaks sind nützlich; Druck ist es nicht. Toggle in Settings → 🔥 Streaks |
| Loot-Drops | an, aber abschaltbar | Manche Benutzer wollen den Belohnungsrahmen überhaupt nicht |
| Lore-Fragmente | an, aber abschaltbar | Narrative kann für manche störend sein |
| Audio-Feedback | nicht implementiert | Sensorische Unterbrechung, nie hinzugefügt |

Die Leitlinie: **Du musst aktiv zustimmen für alles, was eskalieren könnte**. Das Plugin nervt nicht, sendet keine Push-Benachrichtigungen, erstellt keine Dateien automatisch, berührt deinen Vault nie außer dem Lesen der Notizen, auf die du es zeigst.

---

## 3. Freeze-Tokens — ein Ausrutscher ist kein Zusammenbruch

Streaks sind wirklich nützlich: Sie erzeugen Schwung und machen Fortschritt sichtbar. Das Problem ist die Klippe. Ein verpasster Tag in einem konventionellen Streak-System zerstört angesammelten Fortschritt vollständig — was unverhältnismäßig bestrafend ist für jeden mit variabler Energie, Exekutivfunktions-Herausforderungen oder einem Leben, das Krankheit, Reisen oder Notfälle einschließt.

Kuros Lösung sind **Freeze-Tokens**: zwei freie Skip-Tage pro Monat (konfigurierbar). Wenn die Streak-Engine auf einen Lücken-Tag stößt, prüft sie, ob ein Token verfügbar ist. Falls ja, läuft der Streak weiter, als ob der Tag nicht übersprungen worden wäre; der Token wird verbraucht. Tokens regenerieren sich automatisch am 1. jedes Monats.

Die Absicht: Ein verpasster Tag ist nur ein verpasster Tag. Er macht die zwei Wochen davor nicht rückgängig. Das macht Streaks zu einem Aufzeichnung von Anstrengung statt einem Bestrafungsmechanismus.

Wenn sich selbst das wie Druck anfühlt, schalte das Streak-Tracking komplett aus: **Settings → 🔥 Streaks**.

---

## 4. Deterministischer Loot — kein Spielautomat-Druck

Variable-Ratio-Verstärkung (der „Spielautomat"-Mechanismus) ist bekannt dafür, psychologisch überzeugend zu sein, gerade weil sie unvorhersehbar ist. Für manche Benutzer ist dieser zwanghafte Sog unterhaltsam; für andere — besonders jene, die Angst erleben oder zu zwanghaften Mustern neigen — ist er schädlich.

Kuros Loot-System ist **deterministisch**: Dieselben drei Optionen erscheinen jedes Mal, wenn du den Loot-Bereich bei einem bestimmten Level öffnest. Sie ändern sich nicht, bis du eine einlöst. Es gibt keinen Knopf zum Neu-Rollen, keine Möglichkeit, durch Picks zu blättern in der Hoffnung auf etwas Besseres. Die Optionen sind einfach da, wartend, ohne Druck, sofort damit zu interagieren.

Das bedeutet auch, dass du einen Loot-Drop vollständig ignorieren kannst — auf unbestimmte Zeit — ohne ihn zu verlieren. Er wird noch da sein, wenn du das nächste Mal schaust.

---

## 5. Transparente XP — du weißt immer warum

Versteckte XP-Formeln erzeugen Situationen, in denen die Zahl steigt und du nicht weißt warum, oder nicht steigt und du das auch nicht weißt. Beides ist ein Vertrauensproblem.

Jede XP-Berechnung in Kuro ist Zeile für Zeile erklärbar:

- **Verbose-Aufschlüsselung** (Settings → 🎮 Allgemein → „Verbose-Status") zeigt genau, welche Checkbox, welcher Habit oder welcher Bonus welchen Betrag beigetragen hat
- **Manuelle XP-Anpassung** (`Cmd+P` → „Kuro: XP manuell anpassen…") lässt dich Fehler korrigieren oder Offline-Aktivitäten gutschreiben, mit einem Pflichtfeld für den Grund, das Teil des Prüfpfads wird
- **Export** gibt den vollständigen State als JSON aus, damit du jede Entscheidung inspizieren kannst, die das Plugin je getroffen hat

Keine schwarzen Boxen. Wenn die Zahl falsch aussieht, kannst du innerhalb von zwei Klicks herausfinden warum.

---

## 6. Deine Themen, dein Ton

Die eingebaute Standard-Lore ist bewusst ruhig und in Klartext — zurückhaltend, keine Fiktion, die man erst abwählen müsste. Die Gothic-Cyberpunk-Stimme des Plugins — Terminal-Ästhetik, fragmentierte Übertragungen, Signal-Verlust-Metaphern — kommt stattdessen als optionales Pack. Das ist eine kreative Entscheidung, nicht die einzige. Manche Benutzer werden sie atmosphärisch finden; andere werden sie störend finden oder einfach nicht ihrem Geschmack entsprechend.

Du kannst die Lore und den Loot vollständig ersetzen, indem du ein JSON-„Pack" importierst. Das Pack-Format ist klein und menschenlesbar; du kannst auch eines generieren, indem du einen einzelnen Prompt in ein LLM einfügst und dein bevorzugtes Thema beschreibst.

Siehe [Anpassung — Loot/Lore-Packs & LLM-Prompts](customization.de.md) für die vollständige Anleitung.

Die zugrundeliegenden Mechaniken — XP, Level, Streaks, Freeze-Tokens — sind themenunabhängig. Jede Stimme, ob Gothic-Cyberpunk oder eine andere, ist eine Oberfläche über diesen Mechaniken, kein tragender Teil davon.
