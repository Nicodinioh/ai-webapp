# KOMPASS

**Forschungs-Betriebssystem für HCAI-gestützte Thesisarbeit.**
Eine Plattform, auf der Quellenarbeit, Kapitelplanung und Lektüre zusammenlaufen — und auf der
nachweisbar bleibt, wo KI beteiligt war und wer entschieden hat.

Gebaut mit der Claude API (`claude-opus-5`), Node/Express, SQLite und React.

---

## Warum es das gibt

Wissenschaftliches Arbeiten scheitert selten am Schreiben. Es scheitert daran, den Überblick über
vierzig PDF-Dateien zu verlieren, Quellen gelesen zu haben, ohne sie zu beherrschen, und beim
Schreiben zu merken, dass die Beweislast eines Kapitels durch nichts gedeckt ist.

Gleichzeitig stehen Hochschulen vor der Frage, wie KI-Nutzung in Abschlussarbeiten zulässig und
prüfbar zugleich sein kann. Ein Verbot ist nicht durchsetzbar, eine pauschale Erlaubnis nicht
prüfbar. KOMPASS beantwortet beides mit derselben Architektur: **Die Agenten schlagen vor, der
Mensch entscheidet, und jede Entscheidung wird protokolliert.**

Das ist keine Metapher, sondern die Datenstruktur. Jeder Agentenlauf landet in `agent_runs` mit
Automatisierungsgrad und einem menschlichen Urteil (`übernommen` / `geändert` / `verworfen`). Ein
Lauf ohne Urteil zählt als ungeprüft und erscheint im Cockpit als offener Posten. Daraus entsteht
die **Übersteuerungsquote**: der Anteil der Agentenergebnisse, die geändert oder verworfen wurden.
Sie ist die Kennzahl, an der sich substanzielle Aufsicht von Aufsichtstheater unterscheiden lässt.

---

## Schnellstart

Voraussetzung ist **Node 20 oder neuer** (`node --version`). Fehlt es, zuerst
[nodejs.org](https://nodejs.org) → LTS installieren → neues Terminal öffnen.

```
npm install
cp .env.example .env
npm run doctor
npm run seed
npm run dev
```

Danach http://localhost:5173. `.env` braucht den `ANTHROPIC_API_KEY`; `npm run doctor` prüft
Node-Version, Schlüssel und Ports; `npm run seed` legt die Beispielarbeit an.

Ausführliche Anleitung mit Fehlerbildern und einem ersten Rundgang: **[SCHNELLSTART.md](SCHNELLSTART.md)**

Produktion:

```
npm run build
npm start
```

Danach http://localhost:5177.

**Ohne API-Schlüssel** läuft alles außer den Agenten: Quellen erfassen, PDF-Volltext extrahieren,
Kapitel und Aufgaben pflegen, Belegstellen sammeln. Die Agenten antworten dann mit einem klar
markierten Hinweis statt mit erfundenem Inhalt.

---

## Die sieben Bereiche

| Bereich | Wofür |
|---|---|
| **Cockpit** | Seitenbudget, Quellenbestand, offener Aufwand, Übersteuerungsquote, ungedeckte Beweislast |
| **Kapitel** | Beweislast je Kapitel, zugeordnete Quellen, Aufgaben mit Zeitbedarf, Planer und Scout |
| **Quellen** | PDF-Ablage mit seitenweiser Textextraktion, Verschlagwortung, Kapitelzuordnung, Belegstellen |
| **Lesesaal** | Geführte Lektüre in sechs Stufen mit gemessenem Verinnerlichungsgrad |
| **Feed** | RSS-Aggregation, vom Kurator gegen die eigene Kapitelstruktur bewertet |
| **Agenten** | Was jeder Agent kann, was er ausdrücklich nicht tut, womit er arbeitet |
| **HCAI-Nachweis** | Vollständiges Protokoll, Export als Markdown für die Hochschule |

---

## Der Lesesaal: Wissen erlebbar machen

Der Kern der Plattform. Eine Quelle gilt erst als durchdrungen, wenn sie **ohne Vorlage**
rekonstruiert werden konnte — nicht, wenn sie gelesen wurde.

| Stufe | Was passiert | Gewicht |
|---|---|---|
| 0 Triage | Verdient diese Quelle Lesezeit? | – |
| 1 Kartierung | Aufbau, Fragestellung, Datengrundlage, Hauptbefund | 10 % |
| 2 Tiefenlesen | 4–6 Leitfragen zu den Stellen, die für die eigene Arbeit tragen | 25 % |
| 3 Rekonstruktion | Text weglegen. Kernthese und Begründungsgang aus dem Gedächtnis | 30 % |
| 4 Kritische Würdigung | Der Tutor vertritt die Gegenposition | 25 % |
| 5 Verankerung | Kapitel, Rolle, Belegstellen mit Seitenangabe | 10 % |

Die entscheidende Eigenschaft des Tutors ist eine **Unterlassung**: Er fasst nichts vorweg
zusammen. Bei einer dünnen Antwort nennt er die Textstelle, an der nachzulesen ist — nicht deren
Inhalt. Eine vorweggenommene Zusammenfassung zerstört genau die Leistung, die gemessen werden soll
(Retrieval Practice, Desirable Difficulty; siehe `server/agents/knowledge/lesedidaktik.md`).

Die Bewertung erfolgt gegen den extrahierten Volltext. Liegt keiner vor, sagt der Tutor das und die
Bewertung wird entsprechend eingeschränkt.

---

## Die neun Agenten

Spezialisierung entsteht hier nicht aus einer Rollenzuschreibung, sondern aus drei Dingen: einem
eng geschnittenen Auftrag, einer **expliziten Wissensbasis** als festem Systemkontext, und einer
**benannten Grenze** — was ein Agent nicht tut, macht ein anderer.

| Agent | Auftrag | Grenze |
|---|---|---|
| **Triage** | Eckdaten, Kernthese, Votum, vorläufige Kapitelzuordnung | Liest nicht in die Tiefe |
| **Quellen-Analyst** | Fragestellung, Design, Befunde, Reichweite, Belegstellen | Bewertet nicht |
| **Methodengutachter** | Sieben Prüfachsen, Belegdehnung, Zitierempfehlung | Erfindet keine Gegenliteratur |
| **Lesetutor** | Leitfragen, Bewertung, Gegenposition | Nimmt die Antwort nie vorweg |
| **Kapitel-Architekt** | Verortung mit Rolle und Begründung, Redundanz, Lücken | Schreibt keinen Fließtext |
| **Quellen-Scout** | Websuche zu einer benannten Beweislast | Gibt nur belegte Suchtreffer aus |
| **Arbeitsplaner** | Teilaufgaben mit Zeitbedarf, Reihenfolge, Abbruchkriterium | Erfindet keine Inhalte |
| **Feed-Kurator** | Relevanz für den eigenen Beweisgang, nicht fürs Thema | Erklärt keine Meldung zur Quelle |
| **Integritäts-Wächter** | Deckung, Paraphrasenqualität, Kennzeichnung, KI-Nachweis | Ersetzt keine Prüfung am Original |

### Die Wissensbasen

Unter `server/agents/knowledge/` liegen sechs Fachtexte, die als stabiler Systemkontext geladen
werden — nicht als Beispiele, sondern als Arbeitsgrundlage:

- `quellenkritik.md` — Evidenzhierarchie, sieben Prüfachsen, typische Fehlschlüsse in KI-Literatur
- `hcai.md` — Shneidermans zwei Achsen, RST-Trias, substanzielle Aufsicht vs. Aufsichtstheater
- `lesedidaktik.md` — Retrieval Practice, sechs Stufen, Bewertungsskala
- `zitierpraxis.md` — Zitat/Paraphrase/Eigenleistung, Belegdehnung, KI-Ausweisungspflicht
- `arbeitsarchitektur.md` — Kapitelfunktionen, Schreibreihenfolge, Zeitschätzwerte
- `regulatorik-finanzsektor.md` — EU AI Act, DORA, MaRisk, BAIT, Aufsichtspraxis

Die Wissensbasen wachsen mit: eine neue Datei anlegen und in `server/agents/registry.ts` beim
passenden Agenten in `knowledge` eintragen — mehr braucht es nicht.

Jeder Lauf hat außerdem ein **Projektbriefing** als zweiten Systemblock (`server/services/context.ts`):
Titel, Forschungsfrage, Seitenbudget und die vollständige Kapitelstruktur mit Beweislasten. Deshalb
kann der Architekt sagen, in welches Kapitel etwas gehört, und der Kurator, welches Argument eine
Meldung betrifft.

Beide Blöcke tragen einen Cache-Breakpoint. Der Wissensblock ändert sich zwischen Läufen nicht und
wird aus dem Prompt-Cache bedient; die Trefferquote steht im Bereich Agenten.

---

## Fachliche Grundregeln im Code

Vier Regeln gelten für jede Agentenausgabe und stehen als Hausregel in jedem Systemprompt:

1. **Nichts erfinden.** Keine Quelle, kein Jahr, keine Seitenzahl ohne Beleg im Material. Fehlt
   etwas, steht dort „nicht im Material“.
2. **Beleg und Ableitung trennen.** Sichtbar, in jeder Ausgabe.
3. **Der Mensch verantwortet.** Der Agent liefert Material zur Prüfung, keine fertige Wahrheit.
4. **Materiallage benennen.** Reicht das Material nicht, wird gesagt, was fehlt.

Zwei technische Konsequenzen:

- Der extrahierte Volltext trägt **Seitenmarken** (`[[S. 14]]`). Nur so kann ein Agent eine
  Fundstelle angeben, statt eine Seitenzahl zu raten.
- Wird ein Dokument für das Kontextbudget gekürzt, geschieht das **sichtbar**: Anfang und Ende
  bleiben, die Auslassung wird markiert, und der Agent weiß, dass er über diesen Bereich nichts
  aussagen darf.

---

## Architektur

```
server/
  claude.ts              Streaming-Wrapper, Prompt-Caching, strukturierte Ausgabe, Lauf-Protokoll
  db.ts                  SQLite-Schema (Projekt, Kapitel, Quellen, Lektüre, Aufgaben, Läufe)
  agents/
    registry.ts          Die neun Agentendefinitionen
    knowledge/*.md       Explizites Wissen als Systemkontext
    tasks.ts             Aufgabenfunktionen mit Zod-Schemata für strukturierte Ausgabe
  services/
    context.ts           Projektbriefing aus dem Datenbestand
    pdf.ts               Seitenweise Textextraktion, sichtbares Kürzen
    reading.ts           Stufenlogik und Verinnerlichungsgrad
    news.ts              RSS-Aggregation
  routes/                core · sources · reading · misc
client/src/
  views/                 Cockpit · Chapters · Sources · ReadingRoom · Feed · Agents · Ledger
```

Daten liegen unter `data/` (SQLite, hochgeladene PDF, extrahierter Text) und sind nicht
versioniert.

---

## Der Hochschul-Case

Für eine Hochschule ist die interessante Eigenschaft nicht der Funktionsumfang, sondern der
**Nachweis**. `GET /api/hcai/export` erzeugt ein Markdown-Dokument mit:

- allen Agentenläufen mit Zeitpunkt, Zweck und Automatisierungsgrad
- dem menschlichen Urteil je Lauf
- der Übersteuerungsquote als Kennzahl tatsächlicher Kontrolle
- der Wissensbasis und der benannten Grenze jedes eingesetzten Agenten

Damit lässt sich belegen, was eine pauschale KI-Erklärung nicht belegen kann: **wo**, **wofür** und
**mit welcher menschlichen Prüfung** ein System beteiligt war.

Der Automatisierungsgrad folgt Shneidermans Unterscheidung von Automatisierung und menschlicher
Kontrolle: 1 Werkzeug, 2 Vorschlag, 3 Entwurf, 4 Delegation. Alle Agenten in KOMPASS arbeiten auf
Stufe 2 — sie schlagen vor, übernommen wird per Klick.

Für einen Mehrbenutzerbetrieb fehlen Authentifizierung, Mandantentrennung und eine serverseitige
Schlüsselverwaltung. Das Datenmodell ist über `projects` bereits darauf vorbereitet.

---

## Stand

Die Datenhaltung, die PDF-Extraktion, die Oberfläche und alle Abläufe sind lokal geprüft. Die
Agentenläufe folgen der aktuellen SDK-Dokumentation und sind typgeprüft, aber mangels
API-Schlüssel in dieser Umgebung nicht gegen die Live-API ausgeführt worden — der erste Lauf mit
echtem Schlüssel ist der eigentliche Test.
