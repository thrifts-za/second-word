import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { APP_SURFACES } from '../sandbox/scenarios'

const root = process.cwd()
const page = readFileSync(`${root}/sandbox/index.html`, 'utf8')

describe('public launch experience', () => {
  it('opens with the product thesis and the live experience contract', () => {
    expect(page).toContain('The Word,<br />where your words happen.')
    expect(page).toContain('Live experience · no login · nothing is stored or sent for you')
    expect(page).toContain('id="experience"')
    expect(page).toContain('id="surface-tabs"')
  })

  it('ships an authentic local vector asset for every demonstrated application', () => {
    for (const app of APP_SURFACES) {
      const svg = readFileSync(`${root}/sandbox/assets/${app.id}.svg`, 'utf8')
      expect(svg).toMatch(/^<svg/)
      expect(svg.length).toBeGreaterThan(100)
    }
  })

  it('does not present invented production telemetry as proof', () => {
    expect(page).not.toContain('conversations redirected today')
    expect(page).not.toContain('prayers completed')
    expect(page).toContain('committed evaluation cases')
    expect(page).toContain('Recorded evaluation evidence, not production usage telemetry')
  })

  it('keeps the public page self-contained and locked to the live Worker', () => {
    expect(page).toContain('Content-Security-Policy')
    expect(page).toContain('connect-src https://second-word.nkosithrifts.workers.dev')
    expect(page).not.toMatch(/https:\/\/cdn\./)
  })
})
