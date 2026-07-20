import { describe, expect, it } from 'vitest'
import { createScheduler } from '../extension/src/scheduler'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('scheduler', () => {
  it('runs the work and returns the result', async () => {
    const scheduler = createScheduler<string>()
    expect(await scheduler.submit('draft one', async () => 'passage')).toBe('passage')
  })

  it('serves an unchanged draft from cache without calling again', async () => {
    // Typing, deleting, retyping the same thing must not cost a request.
    let calls = 0
    const scheduler = createScheduler<string>()
    const run = async () => {
      calls += 1
      return 'passage'
    }

    await scheduler.submit('same draft', run)
    const second = await scheduler.submit('same draft', run)

    expect(second).toBe('passage')
    expect(calls).toBe(1)
  })

  it('never has more than one request in flight', async () => {
    let inFlight = 0
    let peak = 0
    const scheduler = createScheduler<string>()
    const run = async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight -= 1
      return 'passage'
    }

    await Promise.all([
      scheduler.submit('a', run),
      scheduler.submit('b', run),
      scheduler.submit('c', run),
    ])

    expect(peak).toBe(1)
  })

  it('collapses a burst of drafts into one request for the newest', async () => {
    // Someone typing quickly produces several settled drafts in a row. Only the
    // last one is still true, so only the last one is worth asking about.
    const started: string[] = []
    const scheduler = createScheduler<string>()
    const run = (id: string) => async () => {
      started.push(id)
      return `${id} result`
    }

    const [a, b, c] = await Promise.all([
      scheduler.submit('a', run('a')),
      scheduler.submit('b', run('b')),
      scheduler.submit('c', run('c')),
    ])

    expect(started).toEqual(['c'])
    expect(a).toBeNull()
    expect(b).toBeNull()
    expect(c).toBe('c result')
  })

  it('discards a stale answer that arrives after a newer draft', async () => {
    // The reply we are about to show is about a draft that no longer exists.
    const slow = deferred<string>()
    const scheduler = createScheduler<string>()

    const stale = scheduler.submit('old draft', async () => slow.promise)
    const fresh = scheduler.submit('new draft', async () => 'fresh passage')

    slow.resolve('stale passage')

    expect(await stale).toBeNull()
    expect(await fresh).toBe('fresh passage')
  })

  it('bounds the cache so a long session cannot grow without limit', async () => {
    const scheduler = createScheduler<string>({ cacheSize: 2 })
    await scheduler.submit('one', async () => '1')
    await scheduler.submit('two', async () => '2')
    await scheduler.submit('three', async () => '3')

    expect(scheduler.cached('one')).toBeUndefined()
    expect(scheduler.cached('three')).toBe('3')
  })
})
