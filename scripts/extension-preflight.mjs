/**
 * Verify the unpacked Chrome artifact after build.
 *
 * Source tests cannot catch a stale or incomplete dist directory. This check
 * intentionally validates the small number of promises a person makes when
 * loading `extension/dist` at chrome://extensions.
 */

import { readFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'

const dist = resolve('extension/dist')
const requiredFiles = ['content.js', 'options.js', 'options.html', 'manifest.json', 'icons/icon-16.png', 'icons/icon-128.png']
const requiredMatches = [
  'https://mail.google.com/*',
  'https://app.slack.com/*',
  'https://teams.microsoft.com/*',
  'https://web.whatsapp.com/*',
  'https://chatgpt.com/*',
  'https://claude.ai/*',
  'https://www.linkedin.com/*',
  'https://x.com/*',
  'https://www.reddit.com/*',
]
const failures = []

for (const file of requiredFiles) {
  try {
    await access(resolve(dist, file), constants.R_OK)
  } catch {
    failures.push(`missing extension/dist/${file}`)
  }
}

if (failures.length === 0) {
  const manifest = JSON.parse(await readFile(resolve(dist, 'manifest.json'), 'utf8'))
  const content = await readFile(resolve(dist, 'content.js'), 'utf8')
  const options = await readFile(resolve(dist, 'options.html'), 'utf8')

  if (manifest.manifest_version !== 3) failures.push('manifest is not MV3')
  if (JSON.stringify(manifest.permissions ?? []) !== JSON.stringify(['storage'])) {
    failures.push('manifest has permissions beyond local settings storage')
  }
  if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length !== 1) {
    failures.push('manifest does not have exactly one content script declaration')
  }
  const declaredMatches = manifest.content_scripts?.[0]?.matches ?? []
  for (const match of requiredMatches) {
    if (!declaredMatches.includes(match)) failures.push(`manifest does not inject on ${match}`)
  }
  if (!content.includes('A word for this')) failures.push('content bundle lacks the reflection invitation')
  if (!content.includes('/v1/verse-of-the-day')) failures.push('content bundle lacks Verse of the Day Presence')
  if (!content.includes('second-word-moment')) failures.push('content bundle lacks Living Margin')
  if (content.includes('localhost')) failures.push('content bundle points at localhost')
  if (!content.includes('https://second-word.nkosithrifts.workers.dev')) {
    failures.push('content bundle lacks the production reflection endpoint')
  }
  if (!options.includes('Gmail has reply-aware context')) {
    failures.push('options artifact lacks the current consent explanation')
  }
  if (!options.includes('Verse of the Day in empty text boxes')) {
    failures.push('options artifact lacks the Presence setting')
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exitCode = 1
} else {
  console.log('PASS extension artifact is complete, MV3-scoped, covers nine surfaces, and points at production.')
}
