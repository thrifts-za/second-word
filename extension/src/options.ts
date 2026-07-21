/**
 * Options page.
 *
 * Two off switches and a backend URL. No accounts, no sync, no telemetry,
 * and nothing that could be read as a nudge to keep it on.
 */

import { setApiBase, setAmbient, setGlobalOff, setPresence, setSiteEnabled, setTranslationId, settings } from './config'

const GMAIL_HOST = 'mail.google.com'

const globalOff = document.querySelector<HTMLInputElement>('#global-off')!
const ambient = document.querySelector<HTMLInputElement>('#ambient')!
const presence = document.querySelector<HTMLInputElement>('#presence')!
const gmailOff = document.querySelector<HTMLInputElement>('#gmail-off')!
const apiBaseField = document.querySelector<HTMLInputElement>('#api-base')!
const saveButton = document.querySelector<HTMLButtonElement>('#save')!
const savedNote = document.querySelector<HTMLElement>('#saved')!
const translation = document.querySelector<HTMLSelectElement>('#translation')!

async function load(): Promise<void> {
  const current = await settings()
  globalOff.checked = current.globalOff
  ambient.checked = current.ambient
  presence.checked = current.presence
  gmailOff.checked = current.disabledSites.includes(GMAIL_HOST)
  apiBaseField.value = current.apiBase
  await loadTranslations(current.apiBase, current.translationId)
}

async function loadTranslations(base: string, selected: string): Promise<void> {
  translation.replaceChildren(new Option('Default translation', ''))
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/v1/bibles`, { signal: AbortSignal.timeout(5_000) })
    if (!response.ok) throw new Error('unavailable')
    const body = (await response.json()) as { bibles?: Array<{ id: string; abbreviation: string; title: string }> }
    for (const bible of body.bibles ?? []) translation.add(new Option(`${bible.abbreviation} — ${bible.title}`, bible.id))
    translation.value = selected
  } catch {
    // The default remains usable; never offer an unverified local catalogue.
  }
}

globalOff.addEventListener('change', () => void setGlobalOff(globalOff.checked))
ambient.addEventListener('change', () => void setAmbient(ambient.checked))
presence.addEventListener('change', () => void setPresence(presence.checked))
gmailOff.addEventListener('change', () => void setSiteEnabled(GMAIL_HOST, !gmailOff.checked))

saveButton.addEventListener('click', () => {
  void (async () => {
    const base = apiBaseField.value.trim()
    await setApiBase(base)
    await setTranslationId(translation.value)
    await loadTranslations(base, translation.value)
    savedNote.hidden = false
    window.setTimeout(() => { savedNote.hidden = true }, 1800)
  })()
})

void load()
