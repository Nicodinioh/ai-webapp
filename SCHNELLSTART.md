# KOMPASS starten

Fünf Schritte. Wenn einer klemmt, steht die Antwort unter *Wenn etwas nicht geht*.

---

## Voraussetzung

**Node 20 oder neuer.** Prüfen mit:

```bash
node --version
```

Kommt eine Fehlermeldung oder eine Zahl kleiner als 20: [nodejs.org](https://nodejs.org) →
LTS-Version installieren → Terminal neu öffnen.

---

## 1 · Projekt holen

```bash
git clone https://github.com/Nicodinioh/ai-webapp.git
cd ai-webapp
git checkout claude/research-organization-platform-p159u8
```

Wenn du das Projekt schon hast:

```bash
cd ai-webapp
git checkout claude/research-organization-platform-p159u8
git pull
```

## 2 · Abhängigkeiten installieren

```bash
npm install
```

Dauert beim ersten Mal ein bis zwei Minuten. Warnungen sind normal, Fehler nicht.

## 3 · Zugangsdaten anlegen

**macOS / Linux**
```bash
cp .env.example .env
```

**Windows (Eingabeaufforderung)**
```
copy .env.example .env
```

Dann `.env` in einem Editor öffnen und den Schlüssel eintragen:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Den Schlüssel bekommst du auf [console.anthropic.com](https://console.anthropic.com) unter
**API Keys → Create Key**. Er wird nur einmal angezeigt — direkt kopieren.

> **Ohne Schlüssel läuft die App trotzdem.** Quellen ablegen, Kapitel und Aufgaben pflegen,
> Belegstellen sammeln — alles funktioniert. Nur die neun Agenten antworten dann mit einem
> Hinweis statt mit Inhalt. Zum ersten Umsehen reicht das völlig.

## 4 · Prüfen, ob alles bereitsteht

```bash
npm run doctor
```

Geht jede Zeile durch: Node-Version, Abhängigkeiten, Schlüssel, Schreibrechte, freie Ports.
Beim ersten Problem steht dort, was zu tun ist.

## 5 · Beispieldaten und Start

```bash
npm run seed
npm run dev
```

`npm run seed` legt eine Beispielarbeit an — Kapitelstruktur, Beweislasten, Schlagwortvokabular,
fünf Aufgaben. Du kannst diesen Schritt überspringen und leer anfangen; dann ist das Cockpit
zunächst leer.

Dann im Browser: **http://localhost:5173**

Beenden mit `Strg + C` im Terminal.

---

## Der erste Rundgang

Eine Reihenfolge, die in etwa 20 Minuten alles Wichtige zeigt:

| # | Wo | Was tun | Worauf achten |
|---|---|---|---|
| 1 | **Cockpit** | nur ansehen | Seitenbudget, offener Aufwand, ungedeckte Beweislast |
| 2 | **Quellen** | eine echte PDF hineinziehen | Seitenzahl und Zeichenzahl erscheinen → der Volltext wurde gelesen |
| 3 | **Quellen** → Quelle anklicken → *Agenten* | **Triage** starten | Eckdaten, Kernthese, Votum, Kapitelvorschlag — dann *übernehmen* |
| 4 | derselbe Reiter | **Methodenkritik** starten | die drei Zeilen am Ende: trägt für / trägt nicht für / nur mit Einschränkung |
| 5 | **Lesesaal** | Quelle öffnen, *Leitfragen anfordern* | Stellt er Textfragen — oder Fragen, die man auch ohne den Text beantworten könnte? |
| 6 | Lesesaal, Stufe 2 | eine Frage ehrlich beantworten | Ist die Bewertung fair? Schickt er dich an die richtige Stelle? |
| 7 | **Kapitel** | ein Kapitel öffnen → *Aufgaben planen* | Sind die Zeitschätzungen realistisch? Sind es echte Aufgaben oder Überschriften? |
| 8 | **HCAI-Nachweis** | ansehen und exportieren | Jeder Lauf von eben steht dort — mit oder ohne dein Urteil |

**Das interessiert mich am meisten:** Schritt 5 und 6. Der Lesetutor ist bewusst so gebaut, dass
er nichts vorwegnimmt und streng bewertet. Ob das die richtige Härte ist, weiß ich nicht — das
weißt nur du, nachdem du es einmal gemacht hast.

---

## Wenn etwas nicht geht

**`npm install` bricht bei better-sqlite3 ab**
Auf Windows fehlen dann meist die Build-Tools. Erst versuchen:
`npm cache clean --force` und `npm install` erneut. Hilft das nicht, Node über den offiziellen
Installer von nodejs.org neu installieren (die Option *Tools for Native Modules* mit anhaken).

**„Port 5173 is already in use"**
Ein anderes Programm belegt den Port. Entweder beenden, oder in `vite.config.ts` die Zeile
`port: 5173` auf einen freien Wert ändern.

**Der API-Port 5177 ist belegt**
```bash
PORT=5200 npm run dev
```
Windows PowerShell: `$env:PORT=5200; npm run dev`

**Die Seite lädt, aber alles ist leer**
`npm run seed` vergessen — oder du hast bewusst leer angefangen. Beides in Ordnung; Kapitel
lassen sich unter *Kapitel* auch von Hand anlegen.

**Ein Agent meldet „Offline-Modus"**
Der Schlüssel fehlt oder steht nicht in `.env`. `npm run doctor` sagt, welches von beidem.
Nach dem Eintragen den Server neu starten — `.env` wird nur beim Start gelesen.

**Ein Agent meldet „API-Schlüssel ungültig"**
Schlüssel neu kopieren (er beginnt mit `sk-ant-`, keine Leerzeichen, keine Anführungszeichen)
und prüfen, ob im Anthropic-Konto Guthaben hinterlegt ist.

**Eine PDF wird abgelegt, aber Seitenzahl bleibt leer**
Dann ist es ein Scan ohne Textebene. Die Notiz an der Quelle sagt das. Die Agenten können den
Inhalt nicht lesen — hier hilft nur eine Textversion oder eine OCR-Fassung.

---

## Was danach passiert

Deine Daten liegen unter `data/` — Datenbank, hochgeladene PDF, extrahierte Volltexte. Der Ordner
ist bewusst **nicht** im Repository: dort liegen urheberrechtlich geschützte Quellen. Das heißt
auch: Ein `git pull` überschreibt deine Arbeit nicht, aber ein neuer Rechner fängt leer an.

Was dir beim Ausprobieren auffällt, gehört in `docs/ideen.md` — oder du schreibst es mir direkt.
