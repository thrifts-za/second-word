/**
 * Extension configuration and per-site enablement.
 *
 * Two switches, both the person's: one for this site, one for everything.
 * There is no remote kill switch and no telemetry.
 */

export const DEFAULT_API_BASE = 'https://second-word.nkosithrifts.workers.dev'

const KEYS = {
  apiBase: 'apiBase',
  globalOff: 'globalOff',
  disabledSites: 'disabledSites',
  ambient: 'ambient',
  translationId: 'translationId',
  recentReferenceIds: 'recentReferenceIds',
} as const

interface Stored {
  [KEYS.apiBase]?: string
  [KEYS.globalOff]?: boolean
  [KEYS.disabledSites]?: string[]
  /**
   * Whether Second Word may look without being asked.
   *
   * Ambient means the draft, and the message being replied to, leave the
   * browser on their own. That cannot be consented to per message the way the
   * old flow did, because by the time there is anything to show, the request
   * has already happened. So it is consented to once, deliberately, and can be
   * withdrawn at any time.
   *
   * Off by default. Until it is on, Second Word only speaks when pressed.
   */
  [KEYS.ambient]?: boolean
  /** A YouVersion version ID selected from the Worker-provided entitlement list. */
  [KEYS.translationId]?: string
  [KEYS.recentReferenceIds]?: string[]
}

/** chrome.storage is absent in tests and in the sandbox build. */
function storage(): chrome.storage.LocalStorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null
}

async function read(): Promise<Stored> {
  const area = storage()
  if (!area) return {}
  return (await area.get([KEYS.apiBase, KEYS.globalOff, KEYS.disabledSites, KEYS.ambient, KEYS.translationId, KEYS.recentReferenceIds])) as Stored
}

export async function apiBase(): Promise<string> {
  return (await read())[KEYS.apiBase] ?? DEFAULT_API_BASE
}

export async function isEnabledFor(host: string): Promise<boolean> {
  const stored = await read()
  if (stored[KEYS.globalOff]) return false
  return !(stored[KEYS.disabledSites] ?? []).includes(host)
}

/** Whether Second Word may look without being asked. Off until chosen. */
export async function isAmbient(): Promise<boolean> {
  return (await read())[KEYS.ambient] ?? false
}

export async function setAmbient(on: boolean): Promise<void> {
  await storage()?.set({ [KEYS.ambient]: on })
}

export async function setGlobalOff(off: boolean): Promise<void> {
  await storage()?.set({ [KEYS.globalOff]: off })
}

export async function setSiteEnabled(host: string, enabled: boolean): Promise<void> {
  const stored = await read()
  const disabled = new Set(stored[KEYS.disabledSites] ?? [])
  if (enabled) disabled.delete(host)
  else disabled.add(host)
  await storage()?.set({ [KEYS.disabledSites]: [...disabled] })
}

export async function setApiBase(value: string): Promise<void> {
  await storage()?.set({ [KEYS.apiBase]: value.replace(/\/$/, '') })
}

export async function setTranslationId(value: string): Promise<void> {
  await storage()?.set({ [KEYS.translationId]: value })
}

export async function rememberReference(referenceId: string): Promise<void> {
  const area = storage()
  if (!area) return
  const recent = (await read())[KEYS.recentReferenceIds] ?? []
  await area.set({ [KEYS.recentReferenceIds]: [referenceId, ...recent.filter((id) => id !== referenceId)].slice(0, 5) })
}

export async function settings(): Promise<Required<Stored>> {
  const stored = await read()
  return {
    apiBase: stored[KEYS.apiBase] ?? DEFAULT_API_BASE,
    globalOff: stored[KEYS.globalOff] ?? false,
    disabledSites: stored[KEYS.disabledSites] ?? [],
    ambient: stored[KEYS.ambient] ?? false,
    translationId: stored[KEYS.translationId] ?? '',
    recentReferenceIds: stored[KEYS.recentReferenceIds] ?? [],
  }
}
