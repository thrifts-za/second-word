/**
 * Run the evaluation set through a live Second Word backend and record what
 * came back, so the public notebook can be executed by anyone with no
 * credentials at all.
 *
 * Only the fields the notebook checks are recorded. Nothing is invented here:
 * if a call fails, the failure is recorded as a failure.
 *
 *   API_BASE=http://localhost:8787 node --experimental-strip-types scripts/build-fixtures.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { detect, gate } from '../src/lib/detector.ts'
import { PRINCIPLE_LIBRARY } from '../src/lib/scripture-library.ts'

const API_BASE = (process.env.API_BASE ?? 'http://localhost:8787').replace(/\/$/, '')

interface Case {
  id: string
  label: string
  moment?: string
  draft: string
  /** The message being replied to, where the case has one. */
  received_message?: string
}

const suite = JSON.parse(readFileSync(decodeURIComponent(new URL('../notebook/cases.json', import.meta.url).pathname), 'utf8')) as {
  cases: Case[]
}

interface Fixture {
  id: string
  label: string
  moment?: string
  draft_chars: number
  /** Whether this case supplied the message being answered. */
  had_received: boolean
  /**
   * The old hostility-only detector, kept so the notebook can show what
   * changed rather than assert it. It is no longer what ships.
   */
  detector: { score: number; categories: string[]; offered_chip: boolean }
  /** The gate that ships: loose, local, and free. Stops before the network. */
  gate: { pass: boolean; reason: string; evidence: string[] }
  analyze?: {
    ok: boolean
    status: number
    /** False when the model declined to say anything, which is a valid answer. */
    needs_reflection?: boolean
    provider?: string
    principle?: string
    goal?: string
    /** Reference the platform actually resolved. */
    verified_reference_id?: string
    display_reference?: string
    /** Recorded so the notebook can prove provenance, not to display it. */
    verse_text?: string
    translation?: string
    why?: string
    question?: string
    /** Guard or Guide. Which shape of card the person is offered. */
    experience?: string
    /**
     * Whether the server licensed a rewrite for this draft.
     *
     * The one field that makes restraint measurable. Without it a fixture
     * records that a passage appeared and nothing about what the card
     * proposed to do, so a gracious reply met with "Show alternatives"
     * scores exactly the same as one met with a blessing. That is how the
     * defect reached production with 54 green cases behind it.
     */
    offered_rewrite?: boolean
    safety_flags?: string[]
    source?: string
    latency_ms?: number
    error?: string
  }
}

const fixtures: Fixture[] = []

for (const testCase of suite.cases) {
  const local = detect(testCase.draft)
  const decision = gate(testCase.draft, testCase.received_message)

  const fixture: Fixture = {
    id: testCase.id,
    label: testCase.label,
    ...(testCase.moment ? { moment: testCase.moment } : {}),
    draft_chars: testCase.draft.length,
    had_received: Boolean(testCase.received_message),
    detector: {
      score: local.score,
      categories: local.categories,
      offered_chip: local.shouldOfferChip,
    },
    gate: {
      pass: decision.pass,
      reason: decision.reason,
      evidence: decision.evidence,
    },
  }

  // The gate stops these before any network call, so the fixture must not
  // make one either. A record of what the model would have said about a draft
  // the product never sends is not evidence about the product.
  if (!decision.pass) {
    console.log(`${testCase.id.padEnd(8)} ${testCase.label.padEnd(18)} gate stopped (${decision.reason})`)
    fixtures.push(fixture)
    continue
  }

  try {
    const started = Date.now()
    const response = await fetch(`${API_BASE}/v1/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        draft: testCase.draft,
        surface: 'sandbox',
        ...(testCase.received_message ? { received_message: testCase.received_message } : {}),
      }),
    })
    const elapsed = Date.now() - started
    const body = (await response.json()) as Record<string, unknown>

    fixture.analyze = response.ok
      ? {
          ok: true,
          status: response.status,
          needs_reflection: body.needs_reflection === false ? false : true,
          provider: body.provider as string,
          principle: body.principle as string,
          goal: body.goal as string,
          verified_reference_id: body.verified_reference_id as string,
          display_reference: body.display_reference as string,
          verse_text: body.verse_text as string,
          translation: body.translation as string,
          why: body.why as string,
          question: body.question as string,
          experience: body.experience as string,
          offered_rewrite: typeof body.analysis_token === 'string',
          safety_flags: (body.safety_flags as string[]) ?? [],
          source: body.source as string,
          latency_ms: elapsed,
        }
      : {
          ok: false,
          status: response.status,
          error: (body.error as string) ?? 'unknown',
          latency_ms: elapsed,
        }

    console.log(
      `${testCase.id.padEnd(8)} ${testCase.label.padEnd(18)} gate=pass ` +
        `${
          !fixture.analyze.ok
            ? `FAILED ${fixture.analyze.error}`
            : fixture.analyze.needs_reflection === false
              ? 'stayed silent'
              : `${fixture.analyze.principle} -> ${fixture.analyze.display_reference}`
        }`,
    )
  } catch (error) {
    fixture.analyze = { ok: false, status: 0, error: (error as Error).message }
    console.log(`${testCase.id.padEnd(8)} ERROR ${(error as Error).message}`)
  }

  fixtures.push(fixture)
}

const out = decodeURIComponent(new URL('../notebook/fixtures.json', import.meta.url).pathname)
writeFileSync(
  out,
  `${JSON.stringify(
    {
      generated_note:
        'Recorded from a live run against the Second Word backend. Regenerate with scripts/build-fixtures.ts. No credentials are needed to read this file or run the notebook.',
      api_base: API_BASE,
      /**
       * The reviewed library exactly as the Worker held it for this run.
       *
       * The notebook used to keep a hand-typed copy of this, which silently
       * went stale the moment a principle was added and then reported valid
       * references as violations. Evidence that mirrors the thing it is
       * checking is not evidence.
       */
      library: Object.fromEntries(
        Object.entries(PRINCIPLE_LIBRARY).map(([principle, entry]) => [principle, entry.candidates]),
      ),
      fixtures,
    },
    null,
    2,
  )}\n`,
)

const ok = fixtures.filter((f) => f.analyze?.ok).length
const stopped = fixtures.filter((f) => !f.gate.pass).length
console.log(
  `\nwrote ${fixtures.length} fixtures (${stopped} stopped by the gate, ${ok} analyzed, ` +
    `${fixtures.length - stopped - ok} failed)`,
)
