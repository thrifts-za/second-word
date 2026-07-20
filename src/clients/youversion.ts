/**
 * YouVersion Platform client.
 *
 * Endpoints and the auth header name were verified live on 2026-07-20.
 * See docs/api-notes.md. The header is `x-yvp-app-key`, which is not in the
 * SDK introduction; the 401 body is what names it.
 *
 * The app key is a PUBLIC key.
 *
 * This client is the only place verse text can enter the system. Nothing
 * else may produce a `verse_text`.
 */

const BASE_URL = 'https://api.youversion.com/v1'

/**
 * Observed 2026-07-20: this API is usually sub-second but has stalled for
 * 60s+ under load. Without a bound, one bad upstream minute becomes a hung
 * request and a dead demo. Budget comes from the p95 target of 4.5s.
 */
const PASSAGE_TIMEOUT_MS = 4000
/** Attribution is best-effort, so it gets a tighter leash. */
const BIBLE_TIMEOUT_MS = 2500

export interface Passage {
  referenceId: string
  displayReference: string
  content: string
}

export interface BibleRecord {
  id: string
  /** e.g. "NIV11" */
  abbreviation: string
  /** e.g. "NIV", preferred for display */
  localizedAbbreviation: string
  /** e.g. "New International Version" */
  localizedTitle: string
  /** e.g. "New International Version 2011" */
  title: string
  /**
   * Copyright string from the platform.
   *
   * OBSERVED 2026-07-20: null for NIV (111) and every other bible checked.
   * The licence requires attribution, so where this is null the required text
   * must come from the accepted agreement, not the API. See docs/api-notes.md.
   */
  copyright: string | null
  /** Version page on bible.com. Used as attribution linkage when copyright is null. */
  deepLink: string | null
  publisherUrl: string | null
}

export class YouVersionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly referenceId?: string,
  ) {
    super(message)
    this.name = 'YouVersionError'
  }
}

export class YouVersionClient {
  /**
   * Bible records are immutable, so they are cached for the isolate's life.
   * The passage endpoint returns no translation name or copyright, so
   * attribution has to come from here. Verified 2026-07-20.
   */
  private bibleCache = new Map<string, BibleRecord>()

  private readonly fetchImpl: typeof fetch

  constructor(
    private readonly appKey: string,
    fetchImpl?: typeof fetch,
  ) {
    // Workers detaches `this` from a bare `fetch` reference, which throws
    // "Illegal invocation" at call time. Wrap it rather than pass it through.
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init))
  }

  private headers(): HeadersInit {
    return {
      'x-yvp-app-key': this.appKey,
      accept: 'application/json',
    }
  }

  /**
   * Fetch a passage by USFM reference.
   * Returns null when the reference does not resolve, so callers can try the
   * next reviewed candidate rather than rendering nothing.
   */
  async getPassage(bibleId: string, referenceId: string): Promise<Passage | null> {
    const url = `${BASE_URL}/bibles/${encodeURIComponent(bibleId)}/passages/${encodeURIComponent(referenceId)}`

    let response: Response
    try {
      response = await this.fetchImpl(url, {
        headers: this.headers(),
        signal: AbortSignal.timeout(PASSAGE_TIMEOUT_MS),
      })
    } catch (error) {
      if ((error as Error).name === 'TimeoutError' || (error as Error).name === 'AbortError') {
        throw new YouVersionError('passage lookup timed out', 504, referenceId)
      }
      throw error
    }

    if (response.status === 404 || response.status === 204) return null
    if (!response.ok) {
      throw new YouVersionError(`passage lookup failed (${response.status})`, response.status, referenceId)
    }

    const body = (await response.json()) as { id?: string; content?: string; reference?: string }
    if (!body?.content || !body.reference) return null

    return {
      referenceId: body.id ?? referenceId,
      displayReference: body.reference,
      content: body.content,
    }
  }

  /**
   * Bible metadata, for the translation name and the copyright the licence
   * requires us to display.
   *
   * Use the single-bible endpoint, not the list. Verified 2026-07-20: the list
   * endpoint returns `copyright: null` for every bible, while this one returns
   * the full publisher copyright string.
   */
  async getBible(bibleId: string): Promise<BibleRecord | null> {
    const cached = this.bibleCache.get(bibleId)
    if (cached) return cached

    const url = `${BASE_URL}/bibles/${encodeURIComponent(bibleId)}`

    let response: Response
    try {
      response = await this.fetchImpl(url, {
        headers: this.headers(),
        signal: AbortSignal.timeout(BIBLE_TIMEOUT_MS),
      })
    } catch {
      // Attribution is best-effort. A slow lookup must never sink the request.
      return null
    }

    // 204 means no bible under our licences.
    if (response.status === 204 || response.status === 404) return null
    if (!response.ok) {
      throw new YouVersionError(`bible lookup failed (${response.status})`, response.status)
    }

    const record = toBibleRecord((await response.json()) as RawBible)
    this.bibleCache.set(record.id, record)
    return record
  }

  /**
   * Try reviewed candidates in order and return the first that resolves.
   * Fail closed: if none resolve, no passage is rendered.
   */
  async resolveFirst(
    bibleId: string,
    candidateIds: string[],
  ): Promise<{ passage: Passage; attemptedCount: number } | null> {
    let attemptedCount = 0
    for (const referenceId of candidateIds) {
      attemptedCount += 1
      try {
        const passage = await this.getPassage(bibleId, referenceId)
        if (passage) return { passage, attemptedCount }
      } catch (error) {
        // A transport failure or timeout on one candidate should not sink the
        // request; try the next reviewed candidate instead.
        if (error instanceof YouVersionError && error.status >= 500) continue
        throw error
      }
    }
    return null
  }
}

interface RawBible {
  id?: number | string
  abbreviation?: string
  localized_abbreviation?: string
  title?: string
  localized_title?: string
  copyright?: string | null
  youversion_deep_link?: string | null
  publisher_url?: string | null
}

function toBibleRecord(raw: RawBible): BibleRecord {
  const id = String(raw.id ?? '')
  const abbreviation = raw.abbreviation ?? id
  const title = raw.title ?? abbreviation
  return {
    id,
    abbreviation,
    localizedAbbreviation: raw.localized_abbreviation ?? abbreviation,
    localizedTitle: raw.localized_title ?? title,
    title,
    copyright: raw.copyright ?? null,
    deepLink: raw.youversion_deep_link ?? null,
    publisherUrl: raw.publisher_url ?? null,
  }
}
