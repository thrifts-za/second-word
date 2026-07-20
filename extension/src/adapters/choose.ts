/**
 * Which adapter this page gets.
 *
 * Hostname is the honest signal in production. The capability probe exists
 * because it caught a real defect: the dev harness reproduces Gmail's compose
 * DOM but is served from a file:// URL, so hostname alone selected the generic
 * adapter and the entire thread-reading path went unexercised while appearing
 * to work. A harness that quietly tests the wrong code path is worse than no
 * harness.
 *
 * `g_editable` is Gmail's own attribute and nothing else uses it. If some
 * other page did, the Gmail adapter would simply find no thread and behave
 * exactly like the generic one.
 */

import { genericAdapter } from './generic'
import { gmailAdapter } from './gmail'
import type { ComposerAdapter } from './types'

const GMAIL_MARKER = 'div[g_editable="true"][role="textbox"]'

export function chooseAdapter(host: string, doc: Document): ComposerAdapter {
  if (host.endsWith('mail.google.com')) return gmailAdapter
  if (doc.querySelector(GMAIL_MARKER)) return gmailAdapter
  return genericAdapter
}
