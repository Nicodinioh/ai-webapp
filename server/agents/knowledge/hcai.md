# Human-Centered AI (HCAI): Arbeitsgrundlage

## Shneidermans Grundfigur

Ben Shneiderman (2020, "Human-Centered Artificial Intelligence: Reliable, Safe & Trustworthy") bricht mit der eindimensionalen Vorstellung, Automatisierung und menschliche Kontrolle stuenden in einem Zielkonflikt. Er beschreibt zwei **unabhaengige** Dimensionen:

- Achse 1: Grad der Automatisierung (niedrig bis hoch)
- Achse 2: Grad der menschlichen Kontrolle (niedrig bis hoch)

Daraus entstehen vier Felder. Das anzustrebende ist **hohe Automatisierung bei hoher menschlicher Kontrolle** — nicht Balance, sondern Entkopplung. Die beiden Verfehlungen: hohe Automatisierung ohne Kontrolle (unkontrollierte Systeme) und hohe Kontrolle ohne Automatisierung (verschenkte Leistung).

## Die RST-Trias

- **Reliable** — Zuverlaessigkeit durch Softwaretechnik: Anforderungen, Test, Nachvollziehbarkeit, Audit Trails.
- **Safe** — Sicherheit durch Organisationskultur: Fuehrungsverantwortung, Meldewege, Fehlerkultur, interne Reviews.
- **Trustworthy** — Vertrauenswuerdigkeit durch externe Institutionen: Zertifizierung, Aufsicht, Haftung, Berufsverbaende.

Diese drei Ebenen sind additiv, nicht substituierbar. Ein technisch zuverlaessiges System in einer Organisation ohne Meldekultur ist nicht sicher.

## Deskilling

Shneiderman warnt: Automatisierung, die dem Menschen die Uebung entzieht, zerstoert langfristig genau die Kompetenz, die fuer die Aufsicht noetig ist. Wer nie selbst urteilt, kann ein Urteil nicht pruefen. Daraus folgt eine Designregel: Aufsicht muss geuebt werden, nicht nur formal zugewiesen sein.

## Human-in-the-Loop: substanziell vs. Theater

Die analytisch tragende Unterscheidung:

| | Substanzielle Aufsicht | Aufsichtstheater |
|---|---|---|
| Informationslage | Mensch sieht Begruendung, Unsicherheit, Alternativen | Mensch sieht nur das Ergebnis |
| Zeit | Zeitbudget fuer Pruefung eingeplant | Durchsatzdruck |
| Abweichung | Widerspruch ist erwartbar und folgenlos fuer den Pruefenden | Abweichung erzeugt Rechtfertigungslast |
| Kompetenz | Pruefende beherrschen die Aufgabe ohne System | Kompetenz nur noch beim System |
| Messbarkeit | Uebersteuerungsquote wird erhoben und ausgewertet | Keine Kennzahl |

Eine Aufsicht, die faktisch nie widerspricht, ist kein Kontrollmechanismus, sondern eine Signatur.

## Uebersetzung in eine Forschungsplattform

Auf eine wissenschaftliche Arbeit uebertragen heisst HCAI: Das System darf Vorschlaege machen, Struktur anbieten und Kritik formulieren — die Behauptung, die Auswahl und die Formulierung bleiben beim Menschen, und zwar nachweisbar. Drei Konsequenzen fuer das Systemdesign:

1. **Jede Agentenausgabe braucht ein menschliches Urteil** (uebernommen / geaendert / verworfen). Ein Vorschlag ohne Urteil ist kein Arbeitsergebnis.
2. **Automatisierungsgrad wird pro Interaktion ausgewiesen** (1 Werkzeug, 2 Vorschlag, 3 Entwurf, 4 Delegation). Hoehere Stufen verlangen staerkere Pruefung.
3. **Verinnerlichung wird gemessen, nicht behauptet.** Eine Quelle gilt erst als durchdrungen, wenn der Mensch ihre Kernthese, ihre Methodengrenze und ihre Gegenposition frei rekonstruieren konnte.
