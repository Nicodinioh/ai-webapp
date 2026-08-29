import * as z from 'zod/v4'
import { run } from '../claude.js'
import { agent, systemStable } from './registry.js'
import { briefing, chapters, chapterPath } from '../services/context.js'
import { fitToBudget, readExtract } from '../services/pdf.js'
import { db } from '../db.js'

const VOLLTEXT_BUDGET = 260_000 // Zeichen, grob 65k Token

function sys(agentId: string) {
  const def = agent(agentId)
  return {
    def,
    blocks: [
      { text: systemStable(def), cache: true },
      { text: briefing() },
    ],
  }
}

function sourceRow(id: number) {
  const s = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as any
  if (!s) throw new Error(`Quelle ${id} nicht gefunden`)
  return s
}

function sourceMaterial(id: number, budget = VOLLTEXT_BUDGET): string {
  const s = sourceRow(id)
  const full = readExtract(s.text_path)
  const head = [
    `Titel laut Erfassung: ${s.title}`,
    s.authors ? `Urheberschaft: ${s.authors}` : null,
    s.year ? `Jahr: ${s.year}` : null,
    s.venue ? `Erscheinungsort: ${s.venue}` : null,
    s.url ? `URL: ${s.url}` : null,
    s.kind ? `Typ: ${s.kind}` : null,
    s.page_count ? `Seiten: ${s.page_count}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  if (!full) {
    return `${head}\n\n[[ Kein Volltext hinterlegt. Es liegt nur die Erfassung oben vor. Aussagen ueber den Inhalt sind nicht gedeckt. ]]${s.abstract ? `\n\nVom Menschen erfasste Zusammenfassung:\n${s.abstract}` : ''}`
  }
  const fitted = fitToBudget(full, budget)
  return `${head}\n\n===== VOLLTEXT (Seitenmarken [[S. n]] sind verbindlich fuer Fundstellen) =====\n\n${fitted.text}`
}

function chapterList(): string {
  return chapters()
    .map((c) => `${c.number} ${c.title}${c.goal ? ` - Beweislast: ${c.goal}` : ''}`)
    .join('\n')
}

/* ---------------------------------------------------------------- Triage */

const TriageSchema = z.object({
  titel: z.string().describe('Titel laut Dokument; wenn nur die Erfassung vorliegt, diese uebernehmen'),
  urheber: z.string().describe('Autorinnen, Autoren oder herausgebende Institution; leer lassen wenn nicht im Material'),
  jahr: z.string(),
  erscheinungsort: z.string().describe('Journal, Verlag, Behoerde oder Reihe'),
  typ: z.enum(['artikel', 'rechtsakt', 'aufsichtsdokument', 'buch', 'studie', 'bericht', 'web']),
  evidenzstufe: z.enum(['peer_review', 'institutionell', 'praxis', 'presse', 'unbekannt']),
  kernthese: z.string().describe('Ein Satz, in den Begriffen des Textes selbst'),
  methode: z.string().describe('Untersuchungsdesign in einem Satz, oder "konzeptionell" bzw. "normativ"'),
  votum: z.enum(['bearbeiten', 'zurueckstellen', 'verwerfen']),
  begruendung: z.string(),
  lesezeit_minuten: z.number().describe('Realistische Zeit fuer eine gruendliche Bearbeitung'),
  kapitel: z.array(
    z.object({
      nummer: z.string(),
      rolle: z.enum(['kern', 'beleg', 'kontrast', 'kontext', 'methode']),
      relevanz: z.number().describe('1 bis 5'),
      begruendung: z.string(),
    }),
  ),
  schlagworte: z.array(
    z.object({
      name: z.string(),
      art: z.enum(['thema', 'konzept', 'regulatorik', 'methode', 'akteur']),
    }),
  ),
  offene_pruefpunkte: z.array(z.string()).describe('Was der Mensch am Original nachsehen muss'),
})

export function triageSource(id: number) {
  const { def, blocks } = sys('triage')
  return run({
    agentId: def.id,
    purpose: `Triage der Quelle #${id}`,
    entityType: 'source',
    entityId: id,
    automation: def.automation,
    effort: def.effort,
    system: blocks,
    schema: TriageSchema,
    user: `Triagiere diese Quelle fuer die oben beschriebene Arbeit.

Verfuegbare Kapitel:
${chapterList()}

===== MATERIAL =====
${sourceMaterial(id, 90_000)}`,
  })
}

/* --------------------------------------------------------------- Analyse */

const AnalyseSchema = z.object({
  fragestellung: z.string(),
  design: z.string(),
  datengrundlage: z.string().describe('Stichprobe, Zeitraum, Herkunft der Daten; "keine" bei konzeptionellen Texten'),
  hauptbefund: z.string(),
  nebenbefunde: z.array(z.object({ befund: z.string(), fundstelle: z.string() })),
  schluesselbegriffe: z.array(z.object({ begriff: z.string(), bedeutung_im_text: z.string() })),
  reichweite: z.object({
    gilt_fuer: z.string(),
    gilt_nicht_fuer: z.string(),
  }),
  anschlussstellen: z.array(z.string()).describe('An welche Debatte oder Literatur der Text anschliesst'),
  belegstellen: z
    .array(
      z.object({
        fundstelle: z.string().describe('Seitenmarke aus dem Volltext, z. B. "S. 14"'),
        zitat: z.string().describe('Woertlich aus dem Volltext'),
        traegt_fuer: z.string().describe('Welchen Satz der eigenen Arbeit diese Stelle stuetzen koennte'),
      }),
    )
    .describe('Drei bis sechs Stellen, die fuer diese Arbeit tragen'),
  materiallage: z.string().describe('Welcher Teil des Dokuments vorlag und welcher nicht'),
})

export function analyzeSource(id: number) {
  const { def, blocks } = sys('analyst')
  return run({
    agentId: def.id,
    purpose: `Analyse der Quelle #${id}`,
    entityType: 'source',
    entityId: id,
    automation: def.automation,
    effort: def.effort,
    maxTokens: 20000,
    system: blocks,
    schema: AnalyseSchema,
    user: `Rekonstruiere die Argumentationsstruktur dieser Quelle.

===== MATERIAL =====
${sourceMaterial(id)}`,
  })
}

/* --------------------------------------------------------------- Kritik */

const KritikSchema = z.object({
  achsen: z.array(
    z.object({
      achse: z.enum([
        'autoritaet',
        'aktualitaet',
        'methode',
        'reichweite',
        'interessenlage',
        'belegkette',
        'gegenposition',
      ]),
      urteil: z.enum(['stark', 'tragfaehig', 'schwach', 'nicht_beurteilbar']),
      begruendung: z.string(),
    }),
  ),
  belegdehnung: z.array(
    z.object({
      stelle: z.string(),
      behauptung_im_text: z.string(),
      gedeckte_fassung: z.string(),
    }),
  ),
  evidenzstaerke: z.number().describe('0 bis 100'),
  traegt_fuer: z.string(),
  traegt_nicht_fuer: z.string(),
  nur_mit_einschraenkung: z.string(),
  offene_gegenrecherche: z.array(z.string()).describe('Gegenpositionen, die gesucht werden sollten - als Suchauftrag, nicht als Behauptung'),
})

export function critiqueSource(id: number) {
  const { def, blocks } = sys('critic')
  return run({
    agentId: def.id,
    purpose: `Methodenkritik der Quelle #${id}`,
    entityType: 'source',
    entityId: id,
    automation: def.automation,
    effort: def.effort,
    maxTokens: 20000,
    system: blocks,
    schema: KritikSchema,
    user: `Begutachte diese Quelle. Liefere am Ende die drei Zeilen der Zitierempfehlung.

===== MATERIAL =====
${sourceMaterial(id)}`,
  })
}

/* -------------------------------------------------------------- Lesesaal */

export const STAGES = [
  { stage: 0, name: 'Triage', minutes: 10, aim: 'Entscheiden, ob diese Quelle Lesezeit verdient.' },
  { stage: 1, name: 'Kartierung', minutes: 20, aim: 'Aufbau, Fragestellung, Datengrundlage und Hauptbefund erfassen.' },
  { stage: 2, name: 'Tiefenlesen', minutes: 75, aim: 'Den Begruendungsgang an den Stellen durchdringen, die fuer die eigene Arbeit tragen.' },
  { stage: 3, name: 'Rekonstruktion', minutes: 25, aim: 'Die Quelle ohne Text aus dem Gedaechtnis wiedergeben.' },
  { stage: 4, name: 'Kritische Wuerdigung', minutes: 35, aim: 'Die Grenzen der Quelle selbst benennen und die Gegenposition aushalten.' },
  { stage: 5, name: 'Verankerung', minutes: 25, aim: 'Kapitel, Rolle und Belegstellen festlegen.' },
] as const

const FragenSchema = z.object({
  einstieg: z.string().describe('Ein bis zwei Saetze, was in dieser Stufe zu tun ist. Keine Inhaltsangabe der Quelle.'),
  fragen: z.array(
    z.object({
      frage: z.string(),
      hinweis: z.string().describe('Wo im Text nachzusehen ist - die Stelle, nicht die Antwort'),
    }),
  ),
})

export function tutorQuestions(sourceId: number, stage: number, history: string) {
  const { def, blocks } = sys('tutor')
  const s = STAGES[Math.min(Math.max(stage, 0), 5)]
  return run({
    agentId: def.id,
    purpose: `Leitfragen Stufe ${stage} (${s.name}) fuer Quelle #${sourceId}`,
    entityType: 'source',
    entityId: sourceId,
    automation: def.automation,
    effort: def.effort,
    system: blocks,
    schema: FragenSchema,
    user: `Stufe ${s.stage} - ${s.name}. Ziel: ${s.aim}

Stelle ${stage === 2 ? '4 bis 6' : '2 bis 4'} Fragen fuer diese Stufe. ${
      stage === 3
        ? 'In dieser Stufe liegt dem Menschen der Text NICHT vor. Frage nach Kernthese, Begruendungsgang und Evidenzbasis aus dem Gedaechtnis. Gib in den Hinweisen nichts vom Inhalt preis.'
        : stage === 4
          ? 'In dieser Stufe vertrittst du die Gegenposition. Formuliere die Fragen als Angriffe auf die Quelle, die der Mensch abwehren oder anerkennen muss.'
          : 'Formuliere Textfragen, keine Feldfragen. Nur wer den Text gelesen hat, kann sie beantworten.'
    }

Bisheriger Verlauf dieser Lektuere:
${history || '(noch nichts beantwortet)'}

===== MATERIAL =====
${sourceMaterial(sourceId, stage === 3 ? 120_000 : VOLLTEXT_BUDGET)}`,
  })
}

const BewertungSchema = z.object({
  score: z.number().describe('0 bis 100 nach der Skala der Wissensbasis'),
  trifft_zu: z.string().describe('Was an der Antwort belegbar richtig ist'),
  fehlt: z.string().describe('Was fehlt oder verzerrt ist - konkret, mit Verweis auf die Textstelle, ohne die Antwort zu liefern'),
  luecken: z.array(z.string()),
  naechster_schritt: z.string(),
  stufe_abgeschlossen: z.boolean(),
})

export function tutorEvaluate(sourceId: number, stage: number, prompt: string, answer: string) {
  const { def, blocks } = sys('tutor')
  const s = STAGES[Math.min(Math.max(stage, 0), 5)]
  return run({
    agentId: def.id,
    purpose: `Bewertung Stufe ${stage} fuer Quelle #${sourceId}`,
    entityType: 'source',
    entityId: sourceId,
    automation: def.automation,
    effort: def.effort,
    system: blocks,
    schema: BewertungSchema,
    user: `Stufe ${s.stage} - ${s.name}.

Deine Frage war:
${prompt}

Die Antwort des Menschen:
${answer}

Bewerte gegen den Volltext. Sei streng und konkret. Wenn die Antwort duenn ist, nenne die Textstelle, an der nachzulesen ist - nicht den Inhalt dieser Stelle. Setze stufe_abgeschlossen nur auf true, wenn der Wert mindestens 70 betraegt.

===== MATERIAL =====
${sourceMaterial(sourceId)}`,
  })
}

/* ------------------------------------------------------------- Architekt */

const VerortungSchema = z.object({
  zuordnungen: z.array(
    z.object({
      kapitel_nummer: z.string(),
      rolle: z.enum(['kern', 'beleg', 'kontrast', 'kontext', 'methode']),
      relevanz: z.number().describe('1 bis 5'),
      begruendung: z.string().describe('Aus der Beweislast des Kapitels heraus'),
    }),
  ),
  redundanz: z.string().describe('Ueberschneidungen mit bereits zugeordnetem Material, oder "keine erkennbar"'),
  gehoert_nicht_hinein: z.string().describe('Was an dieser Quelle fuer diese Arbeit nicht gebraucht wird'),
  offene_beweislast: z.array(
    z.object({ kapitel_nummer: z.string(), luecke: z.string() }),
  ).describe('Kapitel, deren Beweislast durch keine Quelle gedeckt ist'),
})

export function placeSource(id: number) {
  const { def, blocks } = sys('architect')
  const assigned = db
    .prepare(
      `SELECT c.number, c.title, s.title AS quelle, sc.role
       FROM source_chapters sc
       JOIN chapters c ON c.id = sc.chapter_id
       JOIN sources s ON s.id = sc.source_id
       WHERE s.id != ? ORDER BY c.sort LIMIT 60`,
    )
    .all(id) as { number: string; quelle: string; role: string }[]

  return run({
    agentId: def.id,
    purpose: `Verortung der Quelle #${id}`,
    entityType: 'source',
    entityId: id,
    automation: def.automation,
    effort: def.effort,
    system: blocks,
    schema: VerortungSchema,
    user: `Verorte diese Quelle in der Kapitelstruktur.

Kapitel:
${chapterList()}

Bereits zugeordnete Quellen (fuer die Redundanzpruefung):
${assigned.map((a) => `${a.number}: ${a.quelle} (${a.role})`).join('\n') || '(noch keine)'}

===== MATERIAL =====
${sourceMaterial(id, 140_000)}`,
  })
}

/* ----------------------------------------------------------------- Scout */

const ScoutSchema = z.object({
  suchanfragen: z.array(z.string()),
  vorschlaege: z.array(
    z.object({
      titel: z.string(),
      urheber: z.string(),
      jahr: z.string(),
      erscheinungsort: z.string(),
      url: z.string().describe('Muss aus den Suchergebnissen stammen'),
      evidenzstufe: z.enum(['peer_review', 'institutionell', 'praxis', 'presse', 'unbekannt']),
      schliesst_luecke: z.string(),
      begruendung: z.string(),
      vertrauen: z.number().describe('0 bis 100 - wie sicher die bibliografischen Angaben belegt sind'),
    }),
  ),
  nicht_gefunden: z.string().describe('Wozu nichts Belastbares gefunden wurde und wo manuell weiterzusuchen ist'),
})

export function scoutChapter(chapterId: number, gap: string) {
  const { def, blocks } = sys('scout')
  const c = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId) as any
  const have = db
    .prepare(
      `SELECT s.title, s.authors, s.year FROM source_chapters sc
       JOIN sources s ON s.id = sc.source_id WHERE sc.chapter_id = ?`,
    )
    .all(chapterId) as { title: string; authors: string; year: number }[]

  return run({
    agentId: def.id,
    purpose: `Quellensuche fuer Kapitel ${c?.number ?? chapterId}`,
    entityType: 'chapter',
    entityId: chapterId,
    automation: def.automation,
    effort: def.effort,
    webSearch: def.webSearch,
    maxTokens: 20000,
    system: blocks,
    schema: ScoutSchema,
    user: `Suche Quellen fuer dieses Kapitel.

Kapitel: ${chapterPath(chapterId)}
Beweislast: ${c?.goal || '(nicht hinterlegt - leite sie aus Titel und Projektbriefing ab und sage, dass du das getan hast)'}

Konkrete Luecke, die geschlossen werden soll:
${gap || '(nicht praezisiert - bestimme selbst die groesste ungedeckte Beweislast dieses Kapitels)'}

Bereits vorhanden (nicht erneut vorschlagen):
${have.map((h) => `- ${h.authors ?? '?'} (${h.year ?? '?'}): ${h.title}`).join('\n') || '(nichts)'}

Nutze die Websuche. Gib ausschliesslich Quellen aus, die du in den Suchergebnissen gesehen hast. Antworte am Ende mit einem einzigen JSON-Objekt in einem \`\`\`json-Block, das exakt diese Felder hat:
{"suchanfragen": [...], "vorschlaege": [{"titel","urheber","jahr","erscheinungsort","url","evidenzstufe","schliesst_luecke","begruendung","vertrauen"}], "nicht_gefunden": "..."}`,
  })
}

/* ---------------------------------------------------------------- Planer */

const PlanSchema = z.object({
  lagebild: z.string().describe('Zwei bis drei Saetze zum Stand dieses Kapitels'),
  aufgaben: z.array(
    z.object({
      titel: z.string(),
      ergebnis: z.string().describe('Was am Ende vorliegt - das Abbruchkriterium'),
      art: z.enum(['lesen', 'schreiben', 'recherche', 'pruefung', 'formatierung']),
      minuten: z.number(),
      prioritaet: z.number().describe('1 hoch, 2 mittel, 3 niedrig'),
      voraussetzung: z.string().describe('Was vorher fertig sein muss, oder "keine"'),
    }),
  ),
  vorher_entscheiden: z.array(z.string()).describe('Strukturelle Entscheidungen, die vor dem Schreiben fallen muessen'),
  gesamtaufwand_minuten: z.number(),
})

export function planChapter(chapterId: number) {
  const { def, blocks } = sys('planner')
  const c = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId) as any
  const srcs = db
    .prepare(
      `SELECT s.title, s.authors, s.year, s.status, s.internalization, sc.role
       FROM source_chapters sc JOIN sources s ON s.id = sc.source_id WHERE sc.chapter_id = ?`,
    )
    .all(chapterId) as any[]
  const open = db
    .prepare("SELECT title, kind, estimate_min FROM tasks WHERE chapter_id = ? AND status IN ('offen','laeuft')")
    .all(chapterId) as any[]

  return run({
    agentId: def.id,
    purpose: `Aufgabenplanung fuer Kapitel ${c?.number ?? chapterId}`,
    entityType: 'chapter',
    entityId: chapterId,
    automation: def.automation,
    effort: def.effort,
    system: blocks,
    schema: PlanSchema,
    user: `Zerlege dieses Kapitel in Teilaufgaben.

Kapitel: ${chapterPath(chapterId)}
Beweislast: ${c?.goal || '(nicht hinterlegt)'}
Status: ${c?.status}, Ziel ${c?.target_pages ?? 0} Seiten, geschrieben ${c?.written_pages ?? 0} Seiten

Zugeordnete Quellen mit Verinnerlichungsgrad:
${srcs.map((s) => `- ${s.authors ?? '?'} (${s.year ?? '?'}): ${s.title} [${s.role}, Status ${s.status}, verinnerlicht ${s.internalization}%]`).join('\n') || '(keine)'}

Bereits geplante offene Aufgaben (nicht doppeln):
${open.map((t) => `- ${t.title} (${t.kind}, ${t.estimate_min} min)`).join('\n') || '(keine)'}

Plane die naechsten sechs bis zehn Aufgaben in Bearbeitungsreihenfolge.`,
  })
}

/* --------------------------------------------------------------- Kurator */

const KuratorSchema = z.object({
  bewertungen: z.array(
    z.object({
      url: z.string(),
      relevanz: z.number().describe('0 bis 100'),
      anschlusspunkt: z.string().describe('Ein Satz: welches Argument in welchem Kapitel betroffen ist'),
      kapitel: z.array(z.string()),
      zitierfaehig: z.enum(['ja', 'nein', 'nur_als_hinweis']),
      primaerdokument: z.string().describe('Das eigentlich zu zitierende Dokument, falls die Meldung nur darauf verweist'),
    }),
  ),
})

export function curateNews(items: { url: string; title: string; summary: string; feed: string; date: string }[]) {
  const { def, blocks } = sys('curator')
  return run({
    agentId: def.id,
    purpose: `Feed-Kuratierung (${items.length} Meldungen)`,
    entityType: 'feed',
    automation: def.automation,
    effort: def.effort,
    maxTokens: 16000,
    system: blocks,
    schema: KuratorSchema,
    user: `Bewerte diese Meldungen fuer die oben beschriebene Arbeit. Gib fuer jede Meldung genau einen Eintrag mit der unveraenderten URL zurueck.

${items
  .map(
    (i, n) =>
      `--- ${n + 1} ---\nQuelle: ${i.feed}\nDatum: ${i.date}\nTitel: ${i.title}\nURL: ${i.url}\nAnriss: ${(i.summary || '').slice(0, 900)}`,
  )
  .join('\n\n')}`,
  })
}

/* ---------------------------------------------------------------- Wächter */

const WaechterSchema = z.object({
  deckung: z.enum(['gedeckt', 'zu_weit', 'nicht_gedeckt', 'nicht_pruefbar']),
  gedeckte_fassung: z.string().describe('Der engere Satz, der vom Beleg tatsaechlich getragen wird'),
  paraphrase_urteil: z.enum(['eigenstaendig', 'zu_nah_am_original', 'faktisch_zitat', 'nicht_pruefbar']),
  paraphrase_hinweis: z.string(),
  kennzeichnung: z.string().describe('Ob Beleg und Eigenleistung erkennbar getrennt sind'),
  am_original_pruefen: z.array(z.string()),
  formvorschlag: z.string().describe('Belegangabe in korrekter Form, soweit aus dem Material ableitbar'),
})

export function guardExcerpt(excerptId: number) {
  const { def, blocks } = sys('guardian')
  const e = db
    .prepare(
      `SELECT e.*, s.title AS quelle, s.authors, s.year, s.text_path, c.number AS kapitel
       FROM excerpts e JOIN sources s ON s.id = e.source_id
       LEFT JOIN chapters c ON c.id = e.chapter_id WHERE e.id = ?`,
    )
    .get(excerptId) as any
  if (!e) throw new Error('Belegstelle nicht gefunden')

  const full = readExtract(e.text_path)
  let context = ''
  if (full && e.quote) {
    const needle = e.quote.slice(0, 60)
    const at = full.indexOf(needle)
    context =
      at >= 0
        ? full.slice(Math.max(0, at - 1500), at + 2500)
        : '[[ Das Zitat wurde im extrahierten Volltext nicht woertlich gefunden. Das kann an der Extraktion liegen - es ist am Original zu pruefen. ]]'
  }

  return run({
    agentId: def.id,
    purpose: `Belegpruefung #${excerptId}`,
    entityType: 'excerpt',
    entityId: excerptId,
    automation: def.automation,
    effort: def.effort,
    system: blocks,
    schema: WaechterSchema,
    user: `Pruefe diese Belegstelle.

Quelle: ${e.authors ?? '?'} (${e.year ?? '?'}): ${e.quelle}
Kapitel: ${e.kapitel ?? '(nicht zugeordnet)'}
Art: ${e.kind}
Seitenangabe: ${e.page || '(fehlt)'}

Zitat laut Erfassung:
${e.quote || '(kein woertliches Zitat erfasst)'}

Paraphrase bzw. Satz in der Arbeit:
${e.paraphrase || '(noch nicht formuliert)'}

Umgebung der Stelle im Volltext:
${context || '(kein Volltext hinterlegt)'}`,
  })
}
