/**
 * Verify every reviewed reference resolves against the live platform.
 *
 * Run before filming and before submission. A reference that does not resolve
 * is a passage the product can never show, which means a principle that can
 * silently fall back on camera.
 *
 *   YOUVERSION_APP_KEY=... npm run verify:refs
 */

import { PRINCIPLE_LIBRARY } from '../src/lib/scripture-library.ts'

const APP_KEY = process.env.YOUVERSION_APP_KEY
const BIBLE_ID = process.env.DEFAULT_BIBLE_ID ?? '111'

if (!APP_KEY) {
  console.error('YOUVERSION_APP_KEY is not set')
  process.exit(1)
}

let failures = 0

for (const [principle, entry] of Object.entries(PRINCIPLE_LIBRARY)) {
  console.log(`\n${principle}`)
  for (const referenceId of entry.candidates) {
    const url = `https://api.youversion.com/v1/bibles/${BIBLE_ID}/passages/${referenceId}`
    try {
      const response = await fetch(url, {
        headers: { 'x-yvp-app-key': APP_KEY, accept: 'application/json' },
      })

      if (!response.ok) {
        console.log(`  FAIL  ${referenceId.padEnd(12)} HTTP ${response.status}`)
        failures += 1
        continue
      }

      const body = (await response.json()) as { content?: string; reference?: string }
      if (!body.content) {
        console.log(`  FAIL  ${referenceId.padEnd(12)} no content`)
        failures += 1
        continue
      }

      const preview = body.content.length > 68 ? `${body.content.slice(0, 68)}...` : body.content
      console.log(`  ok    ${referenceId.padEnd(12)} ${(body.reference ?? '').padEnd(18)} ${preview}`)
    } catch (error) {
      console.log(`  ERROR ${referenceId.padEnd(12)} ${(error as Error).message}`)
      failures += 1
    }
  }
}

console.log(failures === 0 ? '\nAll reviewed references resolve.' : `\n${failures} reference(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
