# TB-16 — Techno / Tech-House Groovebox

Ein 16-Step-Sequencer im Browser. Alle Sounds werden zur Laufzeit synthetisiert,
es gibt keine Audiodateien im Projekt.

## Stack

React 19 + Vite. Einzige Laufzeit-Abhängigkeit: `tone`.
Kein Tailwind, kein CSS-Framework — Styles stehen im String `CSS` und werden
über ein `<style>`-Element in der Komponente eingehängt.

```bash
npm run dev     # Dev-Server
npm run build   # Produktions-Build
```

## Aufbau von src/Groovebox.jsx

`src/App.jsx` rendert nur `<Groovebox />`. Der komplette Sequencer steht in
`src/Groovebox.jsx`.

| Bereich | Zweck |
| --- | --- |
| `TRACKS` | Spurdefinition: id, Label, Sound-Gruppe (`grp`), Farbe, bei Bass-Lanes das Intervall |
| `DEFAULT_PARAMS` | Startwerte je Sound-Gruppe |
| `EDIT` | Welche Regler der Sound-Editor je Gruppe zeigt: `[key, label, min, max, step, unit]` |
| `PRESETS` | Fertige Patterns inkl. BPM, Swing und optionalen Parameter-Overrides |
| `buildEngine()` | Baut den kompletten Tone-Graph einmalig auf und gibt alle Knoten zurück |
| `fire(id, time, vel)` | Löst genau eine Stimme aus |
| `tick(time)` | 16tel-Clock, per `scheduleRepeat` am Transport |
| `Ctl` | Ein Regler (Label, Wert, Range-Input) |

Signalweg: Stimme → Kanal-Gain → (Bass und Stab zusätzlich über `duck`) → `bus`
→ `drive` → `filter` → `master` → `comp` → `limiter` → Ausgang.
Delay und Reverb hängen als Sends an den Kanal-Gains und speisen zurück in den `bus`.

## Datenmodell

- `pattern` ist ein Objekt: Track-ID → Array mit 16 Zahlen.
- Werte: `0` aus, `1` an, `2` Akzent. Velocity dazu: `0.72` bzw. `1.0`.
- Bass-Lanes teilen sich eine MonoSynth-Stimme, Intervalle 0 / 7 / 12 Halbtöne,
  Grundton = MIDI `24 + root`. Stab-Akkord = MIDI `48 + root` plus `CHORDS[chord]`.
- `params` ist nach Sound-Gruppe geschlüsselt, nicht nach Track — `bass5` und
  `bass8` greifen auf `params.bass` zu.

## Regeln für Änderungen

1. **Audio-Parameter nie im Render setzen.** Nur in `useEffect`, das auf `params`
   oder `master` hört. Ein `.value =` im Render-Pfad erzeugt Knackser.
2. **Im Transport-Callback immer das übergebene `time` benutzen**, niemals
   `Tone.now()` oder `Date.now()`. Sonst eiert das Timing.
3. **`patRef`, `parRef`, `masRef`, `mutRef` spiegeln den State** für den
   Audio-Callback. Wer neuen State einführt, den der Clock braucht, legt eine
   Ref dazu — sonst liest der Callback veraltete Werte.
4. **Das `try/catch` in `fire()` bleibt.** Eine geworfene Exception würde sonst
   die Clock anhalten.
5. **Keine Sample-Dateien, keine Netzwerk-Requests.** Neue Sounds werden aus
   Oszillatoren und Rauschen gebaut.
6. `window.storage` existiert nur in der Claude-Artifact-Umgebung. Lokal muss
   das durch `localStorage` ersetzt werden — bitte einmal sauber wegabstrahieren
   statt an mehreren Stellen zu verzweigen. Erledigt: der `storage`-Wrapper am
   Kopf von `Groovebox.jsx` kapselt das. `window.storage` nicht wieder einführen.
7. `getT()` und `getD()` gleichen Tone v14 und v15 ab. Nicht durch direkte
   `Tone.Transport`-Zugriffe ersetzen.
8. Layout ist für 380 px Breite ausgelegt: Spurnamen 56 px, Steps 22 px hoch.
   Änderungen am Grid dort gegenprüfen.

## Sprache

Antworte auf Deutsch, auch wenn Code und Fehlermeldungen englisch sind.
Code, Bezeichner, Code-Kommentare und Commit-Messages bleiben englisch.

## Arbeitsweise

- Kleine Diffs, ein Thema pro Durchgang. Nicht ungefragt umbauen oder „aufräumen".
- Du kannst das Ergebnis nicht hören. Nach Änderungen am Klang: sagen, worauf ich
  beim Hören achten soll, statt zu behaupten, es klinge jetzt besser.
- Neue Sounds oder Presets, die auf `REFERENCES.md` beruhen: dazuschreiben,
  welcher Eintrag als Vorlage diente.

## Offene Ideen

- Pattern-Ketten A/B/C/D mit Song-Mode
- Acid-Modus für den Bass: Slide und Accent pro Step
- WAV-Export über `Tone.Offline`
- Wahrscheinlichkeit pro Step
- MIDI-Export der Patterns
