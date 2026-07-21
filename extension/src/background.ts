/**
 * One job: say what this does before it does it.
 *
 * Ambient noticing is on by default, so the draft and the message being
 * answered leave the browser without being asked each time. That is a
 * defensible default only if the first thing a new install does is show the
 * page that states it and switches it off in one click. Without this, "on by
 * default" is just silence, and the comment in config.ts promising disclosure
 * was describing something that did not exist.
 *
 * Only on a genuine install. An update or a browser restart is not a moment
 * to interrupt anyone.
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install') return
  chrome.runtime.openOptionsPage()
})
