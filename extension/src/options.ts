/**
 * Options page.
 *
 * Two off switches and a backend URL. No accounts, no sync, no telemetry,
 * and nothing that could be read as a nudge to keep it on.
 */

import { setApiBase, setAmbient, setGlobalOff, setSiteEnabled, settings } from './config'

const GMAIL_HOST = 'mail.google.com'

const globalOff = document.querySelector<HTMLInputElement>('#global-off')!
const ambient = document.querySelector<HTMLInputElement>('#ambient')!
const gmailOff = document.querySelector<HTMLInputElement>('#gmail-off')!
const apiBaseField = document.querySelector<HTMLInputElement>('#api-base')!
const saveButton = document.querySelector<HTMLButtonElement>('#save')!
const savedNote = document.querySelector<HTMLElement>('#saved')!

async function load(): Promise<void> {
  const current = await settings()
  globalOff.checked = current.globalOff
  ambient.checked = current.ambient
  gmailOff.checked = current.disabledSites.includes(GMAIL_HOST)
  apiBaseField.value = current.apiBase
}

globalOff.addEventListener('change', () => void setGlobalOff(globalOff.checked))
ambient.addEventListener('change', () => void setAmbient(ambient.checked))
gmailOff.addEventListener('change', () => void setSiteEnabled(GMAIL_HOST, !gmailOff.checked))

saveButton.addEventListener('click', () => {
  void setApiBase(apiBaseField.value.trim())
  savedNote.hidden = false
  window.setTimeout(() => {
    savedNote.hidden = true
  }, 1800)
})

void load()
