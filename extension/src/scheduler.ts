/**
 * Keeps automatic analysis from becoming a flood.
 *
 * The moment Second Word stopped waiting to be pressed, every one of these
 * became load-bearing rather than nice to have. See RESEARCH-PRIOR-ART.md D12,
 * taken from GemType's background worker:
 *
 *   - single flight, so a fast typist cannot open ten requests at once
 *   - a cache keyed on the draft, so retyping the same sentence is free
 *   - a sequence counter, so an answer about a draft that no longer exists is
 *     dropped instead of shown
 *
 * The last one is the subtle one. Without it, a slow response can arrive after
 * the person has rewritten their message, and Second Word speaks about
 * something they already deleted.
 *
 * Debouncing lives in the caller. This handles what survives the debounce.
 */

const DEFAULT_CACHE_SIZE = 32

export interface Scheduler<T> {
  /**
   * Run `work` for `key`, unless the answer is cached or the request has
   * already been overtaken. Resolves null when the result is no longer wanted.
   */
  submit(key: string, work: () => Promise<T>): Promise<T | null>
  cached(key: string): T | undefined
}

export function createScheduler<T>(options: { cacheSize?: number } = {}): Scheduler<T> {
  const cacheSize = options.cacheSize ?? DEFAULT_CACHE_SIZE
  const cache = new Map<string, T>()

  let latest = 0
  let queue: Promise<unknown> = Promise.resolve()

  function remember(key: string, value: T): void {
    cache.set(key, value)
    // Map preserves insertion order, so the oldest key is the first one out.
    while (cache.size > cacheSize) {
      const oldest = cache.keys().next().value
      if (oldest === undefined) break
      cache.delete(oldest)
    }
  }

  return {
    cached(key) {
      return cache.get(key)
    },

    async submit(key, work) {
      const hit = cache.get(key)
      if (hit !== undefined) return hit

      const seq = ++latest

      const run = queue.then(async () => {
        // Overtaken while waiting for the slot. Never send it.
        if (seq !== latest) return null

        const value = await work()
        remember(key, value)

        // Overtaken while the request was open. The draft it describes is gone.
        if (seq !== latest) return null
        return value
      })

      // Keep the chain alive even when a link rejects, or one failure would
      // wedge every later request behind it.
      queue = run.catch(() => undefined)
      return run
    },
  }
}
