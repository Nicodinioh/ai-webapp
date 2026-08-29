# Ideensammlung

Arbeitsdokument. Hier landen Gedanken, bevor sie gebaut werden — mit einer kritischen
Einschätzung daneben. Nichts in dieser Datei ist eine Zusage, und nichts wird umgesetzt,
bevor es hier auf `angenommen` steht.

**Konvention.** Jede Idee bekommt eine Kennung (`I-01`, …) und einen Status:

| Status | Bedeutung |
|---|---|
| `offen` | erfasst, noch nicht entschieden |
| `angenommen` | wird gebaut, Zuschnitt steht |
| `umgebaut` | im Kern angenommen, aber anders geschnitten als ursprünglich gedacht |
| `zurückgestellt` | sinnvoll, aber nicht jetzt — mit Bedingung, wann wieder |
| `verworfen` | mit Begründung |

Wenn eine Idee gebaut ist, bleibt der Eintrag stehen und bekommt den Commit dazu. Diese Datei
ist zugleich die erste, sehr manuelle Fassung des Feedback-Speichers aus `I-03` — sobald der
in der Anwendung existiert, speist er hier hinein.

---

## Eintrag vom 29.08.2026 — Gedankensammlung Nicolas

### I-01 · Strukturierte Einstiegsfragen zur Masterthesis

> „Macht es Sinn, dass der erste Schritt für mich die Plattform zu nutzen ist, schon mal
> strukturierte Fragen zu beantworten, um meine Gedanken zu meiner Masterthesis zu teilen, sodass
> die Lösung optimales Projektmanagement mit mir durchführen kann?"

**Status:** `umgebaut`

**Was daran stimmt.** Ohne Projektkontext sind die Agenten schwach. Das Projektbriefing ist der
zweite Systemblock jedes Laufs — es ist der Grund, warum der Kapitel-Architekt überhaupt sagen
kann, wohin ein Gedanke gehört. Eine leere Plattform macht aus neun Spezialisten neun Generalisten.

**Vier Einwände.**

1. **Ein Fragebogen als erster Kontakt ist die klassische Onboarding-Falle.** Hoher Aufwand, null
   Gegenwert, Abbruch bei Frage sieben. Die Plattform muss etwas leisten, *bevor* sie etwas verlangt.

2. **Du weißt die Antworten am Anfang noch nicht.** Forschungsfrage, Kapitelschnitt und
   Beweislasten sind bei einer Masterthesis zu Beginn genau das, was *nicht* feststeht. Ein Formular
   erzwingt Antworten, die du noch nicht hast — und friert sie dann im Datenmodell ein, wo sie das
   Verhalten aller Agenten steuern. Verfrühte Festlegung, die teuer zu korrigieren ist.

3. **Ein Formular ist kein Denkwerkzeug.** Das Beste an deinem PSA-Skill ist, dass er im
   Sparring-Modus arbeitet, nicht im Abfrage-Modus. Ein Gespräch holt mehr und Besseres aus dir
   heraus als ein Feld — und ist ohnehin schon die Funktion, die du unter `I-03`-Nachbarschaft
   als Diskussionsprotokoll willst.

4. **Ein Formular bricht das Kernprinzip.** In KOMPASS wandert nichts ohne menschliches Urteil in
   den Datenbestand. Ein Fragebogen, der direkt in `projects` und `chapters` schreibt, umgeht genau
   diesen Übergang.

**Wie es stattdessen zugeschnitten gehört.**

Kein Fragebogen, sondern ein **geführtes Erstgespräch mit einem Ergebnis**. Ein eigener Agent
(Arbeitstitel *Projekt-Sparring*) stellt fünf bis acht Fragen adaptiv, eine nach der anderen, und
schlägt nach jeder Antwort Struktur vor. Am Ende steht ein **Entwurf des Projektsatzes** —
Forschungsfrage, Kapitelgerüst mit Beweislasten, Seitenbudget, Abgabe —, den du zeilenweise
übernimmst, änderst oder verwirfst. Gleiches Urteilsprinzip wie überall, gleicher Protokolleintrag.

Zusätzlich muss der Einstieg **stufig** sein, damit er nie blockiert:

| Stufe | Aufwand | Was sie freischaltet |
|---|---|---|
| 0 | 30 Sekunden | Titel, Abgabe, Seitenbudget → Cockpit rechnet, Quellen lassen sich ablegen |
| 1 | 10 Minuten | Kapitelgerüst → Zuordnung, Planer, Scout werden brauchbar |
| 2 | im Gespräch | Beweislasten je Kapitel → Architekt und Scout arbeiten gezielt statt thematisch |
| 3 | laufend | geschärfte Forschungsfrage → Synthese und Kritik bekommen einen Maßstab |

Jede Stufe muss in der Oberfläche zeigen, was sie dir konkret einbringt. Sonst ist es wieder ein
Formular, nur länger.

**Ein Wort zur Erwartung „optimales Projektmanagement".** Das ist die falsche Zielgröße. Ein
Thesis-Plan überlebt den ersten Kontakt mit dem Material nicht — Kapitel 3 zerfällt beim Schreiben
in zwei, eine Quelle kippt ein Argument. Der Wert eines Plans liegt in den nächsten zwei bis drei
Sitzungen, nicht im Balkendiagramm bis zur Abgabe. Der Arbeitsplaner ist deshalb bewusst so
gebaut, dass er aus dem *aktuellen* Zustand neu plant, statt einen großen Plan zu verwalten.
Diese Entscheidung sollte bleiben.

**Offene Fragen an dich.**
- Steht die Forschungsfrage der Masterthesis schon, oder ist sie noch in Bewegung?
- Gibt es eine Gliederungsvorgabe der ADG, an die wir uns halten müssen?

---

### I-02 · Feedbackschleifen in der Lösung

> „Ich möchte, dass du innerhalb der Lösung Feedbackschleifen einbaust."

**Status:** `offen` — Begriff muss zuerst getrennt werden

**Das Problem mit dem Wort.** Hier stecken drei verschiedene Schleifen drin, die
unterschiedliche Datenwege, Adressaten und Lebensdauern haben. Wenn sie zusammenfallen, wird
keine davon brauchbar:

| # | Schleife | Adressat | Stand |
|---|---|---|---|
| A | Urteil über einen Agentenlauf | der Nachweis | **existiert** (`agent_runs.verdict`) |
| B | Produktfeedback zur Plattform | ich, in der nächsten Sitzung | **fehlt** → `I-03` |
| C | Rückmeldung über deinen Arbeitsstand | du selbst | **halb** (Verinnerlichungsgrad) |

**Wichtigster Einwand: A und B dürfen nicht dasselbe Feld sein.** `verdict` ist ein
Compliance-Artefakt. Es beantwortet genau eine Frage — hast du dieses Ergebnis übernommen,
geändert oder verworfen — und geht so in den Hochschulnachweis. Sobald dort auch „Button war
schlecht platziert" landet, ist der Nachweis unbrauchbar. Getrennte Tabelle, immer.

**Zweiter Einwand: Feedback überall heißt Feedback nirgends.** Wenn du an jeder Stelle etwas
hinterlassen kannst, entsteht ein Sammelbecken ohne Priorität. Die Schleife muss dort sitzen, wo
du ohnehin urteilst — an der Agentenausgabe und am Lesesaal-Schritt —, nicht als globaler
Feedback-Knopf in der Ecke.

**Was Schleife C angeht:** Der Verinnerlichungsgrad misst pro Quelle. Was fehlt, ist die
Beobachtung über Quellen hinweg — „du brichst regelmäßig vor Stufe 4 ab" oder „deine Stufe-3-Werte
fallen bei Rechtstexten deutlich ab". Das ist die Rückmeldung, die dein Arbeiten wirklich ändern
würde, und sie ist billig zu bauen, weil die Daten schon da sind.

**Offene Frage an dich.** Welche der drei meinst du zuerst? Mein Vorschlag: B bauen (siehe
`I-03`), C danach, A nicht anfassen.

---

### I-03 · Feedback während der Nutzung strukturiert speichern

> „Ich möchte während der Nutzung mein Feedback strukturiert speichern, damit du es später nach
> und nach umsetzen kannst."

**Status:** `angenommen` — mit drei Bedingungen

**Warum das die stärkste Idee der Sammlung ist.** Sie löst das eigentliche Problem unserer
Zusammenarbeit: Du arbeitest allein mit der Plattform, ich bin nicht dabei. Ohne diesen Speicher
geht jede Beobachtung verloren, die du beim Arbeiten machst — und das sind die wertvollsten, weil
sie im echten Gebrauch entstehen und nicht im Gespräch über den Gebrauch.

**Bedingung 1: Es muss in unter fünf Sekunden gehen.** Ein Klick plus ein Satz. Sobald ein
Formular mit Kategorie, Schweregrad und Beschreibung aufgeht, schreibst du es beim Arbeiten nicht
mehr auf. Kategorien vergebe ich beim Sichten, nicht du beim Erfassen.

**Bedingung 2: Der Kontext muss automatisch mitkommen.** „Der Tutor war komisch" ist unbrauchbar.
Brauchbar wird es durch das, was das System von selbst dazulegt: Ansicht, Agentenlauf-Nummer,
Quelle, Stufe, der ausgelöste Prompt, der Zeitpunkt. Feedback ohne Kontext kann ich nicht umsetzen,
und ich werde dich in der nächsten Sitzung nach genau diesem Kontext fragen müssen.

**Bedingung 3 — die, die du wahrscheinlich nicht auf dem Schirm hast:** Das Feedback muss den
Container verlassen können. `data/` ist nicht versioniert und lebt nur so lange wie deine lokale
Installation. Wenn dein Feedback nur in SQLite steht, sehe ich es nie. Es braucht einen Export,
der als Datei im Repository landet und den ich zu Beginn jeder Sitzung lese — sonst ist der ganze
Mechanismus eine Sackgasse.

**Was noch fehlt: die Triage.** Roher Feedback-Strom ist kein Rückstand. Es braucht drei Zustände
— erfasst, gesichtet, umgesetzt — und die Sichtung machen wir gemeinsam, nicht ich still. Sonst
verschwindet dein Einwand in einer Liste und du weißt nie, ob er angekommen ist.

**Nebenbemerkung.** Ein Teil dessen, was du ändern willst, wirst du selbst ändern können, ohne auf
mich zu warten: Die Wissensbasen sind Markdown-Dateien. „Der Gutachter soll strenger auf
Stichprobengrößen achten" ist ein Absatz in `quellenkritik.md`, kein Auftrag an mich. Das sollten
wir bewusst ausbauen, damit ich nicht zum Flaschenhals werde.

---

### I-04 · Wissensbasis mit effizienten Verbindungen und rekursivem Lernen

> „Du musst safe eine ordentliche Knowledge Base bauen mit Verbindungen, die effizient sind und
> rekursives Lernen beinhalten."

**Status:** `offen` — der Begriff trägt drei verschiedene Bauvorhaben, zwei davon gehören
auseinandergenommen

**Was heute stimmt und was nicht skaliert.** Sechs kuratierte Markdown-Dateien werden vollständig
in jeden Lauf des jeweiligen Agenten geladen, rund 25.000 Token, aus dem Cache bedient. Das
funktioniert bei sechs Dateien gut. Bei dreißig trägt jeder Lauf Ballast, den er nicht braucht,
und die Antwortqualität sinkt, weil Relevantes untergeht. Der Punkt, an dem das kippt, liegt
grob bei zehn bis zwölf Wissensbasen — noch nicht erreicht, aber absehbar.

**„Verbindungen" — drei mögliche Lesarten, nur eine davon lohnt sich jetzt.**

- **(a) Verbindungen zwischen deinen Forschungsobjekten.** Quelle ↔ Kapitel ↔ Belegstelle ↔
  Gespräch. **Das ist der wertvolle Graph, und er existiert bereits im Schema.** Was fehlt, ist
  seine Nutzung: dass ein Agentenlauf automatisch mitbekommt, was du zu diesem Kapitel schon
  entschieden, gelesen und belegt hast. Hier liegt der Hebel.
- **(b) Ein Graph über die Agenten-Wissensbasen.** Bei sechs kuratierten Fachtexten Überbau ohne
  Gegenwert. Frühestens relevant, wenn (a) läuft.
- **(c) Vektorsuche über die Volltexte.** Verlockend, aber hier vermutlich das schlechtere
  Werkzeug. Du hast Größenordnung vierzig Quellen, und die relevanten Stellen pro Kapitel sind
  wenige und bereits ausgezeichnet — über Rolle, Relevanz und Belegstellen. **Entscheidend: Ein
  Vektortreffer ist nicht begründbar, eine Kapitelzuordnung mit Rolle schon.** Für eine Arbeit, die
  Nachvollziehbarkeit zum Thema hat, ist eine erklärbare Abfrage mehr wert als ein ähnlicher
  Vektor. Vektorsuche wird interessant, wenn du eine Stelle suchst, von der du nicht mehr weißt,
  in welcher Quelle sie stand — also für `I-06`, nicht für die Agenten.

**„Rekursives Lernen" — hier muss ich am deutlichsten widersprechen.**

Wenn das heißt: *ein System, das aus deiner Nutzung besser wird* — ja, und zwar in drei Formen,
von denen zwei unproblematisch sind und eine gefährlich:

1. **Der Bestand füttert den Kontext.** Jeder Lauf sieht, was schon entschieden ist. Teilweise
   vorhanden, ausbaufähig, unproblematisch.
2. **Dein Lernstand steuert die Didaktik.** Der Tutor passt Tiefe und Fragetyp an deinen Stand an.
   Legitim und sicher.
3. **Die Urteile stimmen die Prompts nach.** Hier liegt der Konflikt. Ein System, das seine eigenen
   Prompts aus deinem Feedback automatisch nachzieht, ist genau das, was der HCAI-Nachweis
   ausschließt: undokumentierte Drift. Zwei Läufe im Abstand von drei Wochen wären nicht mehr
   vergleichbar, und niemand könnte sagen, warum.

**Die Auflösung** — und sie ist zugleich ein Argument für deine Arbeit: Rekursion **über den
Menschen**, nicht am Menschen vorbei. Das System erkennt das Muster und *zeigt* es dir („du hast
acht von zehn Tutorbewertungen als zu streng markiert"). Die Änderung entscheidest du, und sie
wird ein versionierter Commit an einer Wissensbasis. Damit ist die Schleife geschlossen,
nachvollziehbar und im Nachweis sichtbar. Ein selbstoptimierendes System wäre schneller und
für diese Arbeit wertlos.

**Offene Frage an dich.** Meinst du mit „rekursivem Lernen" das System, das dazulernt — oder dich,
der über die wiederholte Auseinandersetzung mit denselben Quellen lernt? Die zweite Lesart wäre
ein anderes, ebenfalls interessantes Bauvorhaben: gezieltes Wiedervorlegen von Quellen, deren
Verinnerlichung nachlässt.

---

### I-05 · Ziel: ein nutzenstiftendes Produkt

> „Mein Ziel ist es, ein nutzenstiftendes Produkt zu bauen."

**Status:** `offen` — Richtungsentscheidung, aber noch nicht fällig

**Die Gabelung.** „Produkt" heißt: Nutzer außer dir. Im Moment ist jede Entscheidung auf einen
Nutzer mit einer Arbeit optimiert — das ist gut so, aber es zieht in eine andere Richtung als ein
ADG-Produkt:

| | Dein Werkzeug | ADG-Plattform |
|---|---|---|
| Einstieg | Seed mit deiner Arbeit | `I-01` wird zur Kernoberfläche |
| Wissensbasen | auf dein Fachgebiet zugeschnitten | fachübergreifend, je Studiengang ergänzbar |
| Anmeldung | keine | zwingend, mit Mandantentrennung |
| Nachweis | dein Anhang | Prüfungsordnungs-Artefakt mit festem Format |

**Warum die Entscheidung noch nicht fällig ist.** Das einzige, was teuer nachzurüsten wäre, sind
Anmeldung und Mandantentrennung — und die sind billig zu verschieben, weil `projects` als Tabelle
bereits existiert und alles daran hängt. Alles andere (Wissensbasen, Seed-Daten, Kapitelstruktur)
liegt schon in der Datenbank statt im Code. **Für einen Nutzer bauen, für mehrere offenhalten**
ist hier keine Floskel, sondern ein Zustand, den das Schema bereits herstellt.

**Der ehrliche Nutzenmaßstab.** Nicht Funktionsumfang, sondern: Wird deine Thesis dadurch besser
und schneller? Zwei Größen, an denen wir das nach sechs Wochen messen können — und die die
Plattform selbst erhebt:

- Erreichst du bei Quellen, die du sonst quergelesen hättest, tatsächlich 75 % Verinnerlichung?
- Bewegt sich die Seitenzahl, oder nur das Cockpit?

Eine Plattform, die schöne Kennzahlen produziert und keine Seiten, ist gescheitert. Das sollte der
Maßstab bleiben, an dem wir jede weitere Idee messen.

---

## Was ich dazu von mir aus anmerke

**Das Werkzeug darf nicht die Arbeit ersetzen.** Du baust ein Werkzeug zum Schreiben einer Thesis,
während die Thesis läuft. Werkzeugbau fühlt sich produktiver an als Schreiben und ist es fast nie.
Vorschlag als Regel, nicht als Ermahnung: Jedes Inkrement, das wir bauen, muss innerhalb der
nächsten zwei Arbeitssitzungen an deiner echten Arbeit Nutzen zeigen — sonst wandert es hierher
zurück auf `zurückgestellt`.

**Die Reihenfolge, die ich vorschlagen würde.** Zuerst der erste echte Agentenlauf mit Schlüssel
(steht noch aus und entscheidet über alles andere), dann `I-03` (weil ohne den Speicher jede
weitere Sitzung mit Erinnerungsarbeit beginnt), dann `I-01` im umgebauten Zuschnitt, dann die
Diskussionsprotokolle. `I-06` sobald genug Nutzung da ist, dass eine Auswertung nicht leer
aussieht. `I-04` zuletzt — Verbindungen brauchen Material, das sie verbinden.

---

## Eintrag vom 29.08.2026 — Nachtrag

### I-06 · Insights und Zeiterfassung

> „Mir wäre es wichtig, dass Insights getrackt werden. Man sollte sehen, wie viel Zeit man in der
> App verbracht hat."

**Status:** `umgebaut` — Kern angenommen, Zielgröße ausgetauscht

**Zuerst eine Rückfrage, weil das Wort zwei Dinge bedeuten kann.**

- **(a) Erkenntnisse** — der Gedanke, der dir beim Lesen kommt: „das widerspricht dem Argument in
  3.1". Ein eigenes Objekt, verknüpft mit Quelle und Kapitel, jederzeit wiederfindbar. Das wäre
  fachlich das Wertvollere und ist die Schwester des Diskussionsprotokolls.
- **(b) Nutzungsstatistik** — Kennzahlen über dein Arbeiten. Darauf deutet die Zeitmessung im
  zweiten Satz hin.

Ich gehe im Folgenden von **(b)** aus, halte aber **(a)** für die stärkere Idee und würde sie
gern getrennt aufnehmen, falls du sie meintest.

**Der Einwand gegen „Zeit in der App".**

Die App kann messen, wie lange ein Tab offen war. Das ist kein Maß für Arbeit: Sechs Stunden
offener Tab und keine geschriebene Zeile ergeben eine hervorragende Kennzahl und ein schlechtes
Ergebnis. Schlimmer als ungenau ist sie **als Anreiz** — eine sichtbare Zahl, die Anwesenheit
belohnt, zieht das Verhalten in Richtung Anwesenheit. Für eine Arbeit mit Abgabetermin ist das
das falsche Signal, und es widerspricht dem Maßstab, auf den wir uns in `I-05` geeinigt haben:
nicht Aktivität, sondern Seiten und Durchdringung.

**Was stattdessen messbar und aussagekräftig ist — und größtenteils schon vorbereitet.**

| Größe | Aussage | Stand im Schema |
|---|---|---|
| Zeit je Lesestufe | Wo im Lesen die Zeit wirklich hingeht | `reading_sessions.minutes` existiert, Endpunkt existiert, Oberfläche fehlt |
| Ist gegen Schätzung je Aufgabe | Wie gut der Planer dich trifft | `estimate_min` **und** `actual_min` existieren, `actual_min` wird nie gefüllt |
| Verinnerlichung über Zeit | Ob Durchdringung mit dem Bestand mitwächst | vollständig vorhanden, nur nicht ausgewertet |
| Abbruchmuster | Vor welcher Stufe du regelmäßig aufhörst | vollständig vorhanden, nur nicht ausgewertet |

**Der eigentlich wertvolle Insight: die Schätzkalibrierung.** Nach zwanzig erledigten Aufgaben
lässt sich sagen „Schreibaufgaben dauern bei dir im Schnitt Faktor 1,8 länger als geschätzt" — und
diese Zahl kann direkt in die Wissensbasis des Arbeitsplaners zurückfließen. Das ist exakt die
Form von rekursivem Lernen, auf die `I-04` hinausläuft: sichtbares Muster, menschliche
Entscheidung, versionierte Änderung. Kein selbstoptimierendes System, sondern eine geschlossene
Schleife, die man im Nachweis zeigen kann.

**Eine Warnung zur Bauweise.** Passives Mitschreiben ist billig zu bauen und teuer zu bereuen. Ein
System, das jede Interaktion protokolliert, erzeugt einen Datenbestand über dich, den niemand
angefordert hat und der später schwer zu begrenzen ist. Zeitmessung deshalb nur **explizit**:
Aufgabe starten und beenden, Lesestufe starten und beenden. Sichtbar, abschaltbar, korrigierbar.

**Was ich bauen würde, wenn du zustimmst.**

1. Eine Uhr an der laufenden Aufgabe, die `actual_min` füllt — start, stop, nachträglich korrigierbar.
2. Dieselbe Uhr im Lesesaal je Stufe.
3. Eine Ansicht *Auswertung*: Schätzkalibrierung nach Aufgabenart, Zeit je Lesestufe,
   Verinnerlichung im Verlauf, Abbruchmuster. Drei Zahlen, die etwas ändern — kein Kennzahlenteppich.

Alles davon läuft **ohne API-Schlüssel** und ist damit sofort prüfbar.

**Warum ich es noch nicht gebaut habe.** Du hast die Plattform noch nicht benutzt. Eine
Auswertung ohne Nutzungsdaten zeigt leere Diagramme, und welche Zahl dir wirklich hilft, weißt du
nach zwei Arbeitssitzungen besser als ich jetzt. Sag Bescheid, wenn ich trotzdem sofort anfangen
soll — der Einwand oben ist ein Argument gegen die Kennzahl, nicht gegen die Reihenfolge.

**Offene Frage an dich.** Meintest du (a) Erkenntnisse oder (b) Nutzungsstatistik — oder beides?
