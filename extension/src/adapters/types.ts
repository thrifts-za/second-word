/**
 * A composer adapter teaches Second Word how one site's reply box works.
 *
 * Hard rule: the draft, and the single message it answers. Nothing else. Never
 * author identity, never account data, never page history, never the rest of
 * the thread.
 *
 * The message being replied to was previously out of bounds too, on the
 * reasoning that a draft should be judged on its own. Proverbs 16:2 is the
 * argument against that: "all the ways of a man are clean in his own eyes, but
 * the LORD weigheth the spirits." A reply to a rejection is calm on its face,
 * and the weight lives entirely in what arrived. Judged alone, it cannot be
 * judged at all.
 */
export interface ComposerAdapter {
  id: string

  /** Every composer currently mounted under `root`. */
  findComposers(root: ParentNode): HTMLElement[]

  /** The text the person has typed. Only that. */
  getDraft(element: HTMLElement): string

  /**
   * The single message this draft answers, or null when there is none.
   *
   * One message, not the thread. Quoted history and signatures stripped, since
   * both would smuggle in far more than was asked for.
   */
  getReceivedMessage(element: HTMLElement): string | null

  /** Replace the draft, and make the host application notice. */
  setDraft(element: HTMLElement, value: string): void

  /** Inline mount point, beside the host's own controls. For the chip and the invitation. */
  attachAnchor(element: HTMLElement): HTMLElement | null

  /**
   * Block mount point, below the controls. For the panel.
   *
   * A panel sharing a flex row with Send crowds it and overflows sideways,
   * so the two cannot share an anchor.
   */
  panelAnchor(element: HTMLElement): HTMLElement | null

  /** False when replacement is unsafe here, so the UI offers Copy instead. */
  canReplace(element: HTMLElement): boolean
}

/** Marks a composer as already wired, so observers do not double-attach. */
export const MOUNTED_ATTRIBUTE = 'data-second-word-mounted'

export function isMounted(element: Element): boolean {
  return element.hasAttribute(MOUNTED_ATTRIBUTE)
}

export function markMounted(element: Element): void {
  element.setAttribute(MOUNTED_ATTRIBUTE, '')
}
