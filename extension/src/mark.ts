/**
 * The Second Word mark.
 *
 * Two quotation marks: the first faded, the second solid and set lower. The
 * product's name as a picture. Not the first word, the second.
 *
 * It replaces a four-pointed sparkle, which was the wrong flag to fly. The
 * sparkle is the industry sign for generative AI, and the strongest claim
 * this product makes is that the model never writes Scripture. Wearing the
 * generate icon argued the opposite before anyone read a word.
 *
 * One drawing, used in every place the product appears: the resting mark, the
 * collapsed dot, the extension icons, the favicon, the cover. Nothing about a
 * mark makes it memorable except meeting it in the same shape every time.
 *
 * Drawn rather than typed. A glyph inherits the host page's font stack, which
 * on a site with a missing serif becomes whatever the browser substitutes.
 */

const FIRST = 'M2 4.4C2 2.5 3.3 1.2 5 1.2c1.5 0 2.6 1 2.6 2.5 0 2.6-2.3 4.4-4.4 5.6L2.4 8.2c1-.6 1.8-1.3 2.2-2-1.5-.1-2.6-.8-2.6-1.8z'
const SECOND = 'M10.4 8.4c0-1.9 1.3-3.2 3-3.2 1.5 0 2.6 1 2.6 2.5 0 2.6-2.3 4.4-4.4 5.6l-.8-1.1c1-.6 1.8-1.3 2.2-2-1.5-.1-2.6-.8-2.6-1.8z'

const NS = 'http://www.w3.org/2000/svg'

/** Inline SVG source, for the places that take markup rather than a node. */
export function markSvg(colour: string, size = 18): string {
  return (
    `<svg xmlns="${NS}" width="${size}" height="${(size * 16) / 18}" viewBox="0 0 18 16" aria-hidden="true">` +
    `<path fill="${colour}" opacity=".38" d="${FIRST}"/>` +
    `<path fill="${colour}" d="${SECOND}"/>` +
    '</svg>'
  )
}

/** The mark as a node, for a shadow root that builds its own DOM. */
export function markElement(colour: string, size = 18): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String((size * 16) / 18))
  svg.setAttribute('viewBox', '0 0 18 16')
  svg.setAttribute('aria-hidden', 'true')

  const first = document.createElementNS(NS, 'path')
  first.setAttribute('fill', colour)
  first.setAttribute('opacity', '.38')
  first.setAttribute('d', FIRST)

  const second = document.createElementNS(NS, 'path')
  second.setAttribute('fill', colour)
  second.setAttribute('d', SECOND)

  svg.append(first, second)
  return svg
}
