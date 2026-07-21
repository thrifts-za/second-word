/** Day 1-366 in the viewer's local calendar, without daylight-saving drift. */
export function localDayOfYear(date: Date): number {
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const start = Date.UTC(date.getFullYear(), 0, 0)
  return Math.floor((today - start) / 86_400_000)
}
