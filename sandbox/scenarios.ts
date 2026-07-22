/**
 * Human moments for the public product experience.
 *
 * The host chrome changes, but every surface uses the same gate, Worker,
 * YouVersion passage path, badge, and panel. These are starting situations,
 * not canned answers: the suggested draft only fills the composer and then
 * travels through the live product path like anything a visitor types.
 */

export const APP_IDS = ['gmail', 'slack', 'teams', 'whatsapp', 'x', 'linkedin'] as const
export type AppId = (typeof APP_IDS)[number]

export interface AppSurface {
  id: AppId
  name: string
  shortName: string
  accent: string
  glyph: string
}

export const APP_SURFACES: AppSurface[] = [
  { id: 'gmail', name: 'Gmail', shortName: 'Gmail', accent: '#0b57d0', glyph: 'M' },
  { id: 'slack', name: 'Slack', shortName: 'Slack', accent: '#4a154b', glyph: 'S' },
  { id: 'teams', name: 'Microsoft Teams', shortName: 'Teams', accent: '#5b5fc7', glyph: 'T' },
  { id: 'whatsapp', name: 'WhatsApp', shortName: 'WhatsApp', accent: '#128c7e', glyph: 'W' },
  { id: 'x', name: 'X', shortName: 'X', accent: '#0f1419', glyph: 'X' },
  { id: 'linkedin', name: 'LinkedIn', shortName: 'LinkedIn', accent: '#0a66c2', glyph: 'in' },
]

export interface Scenario {
  id: string
  app: AppId
  tab: string
  moment: string
  kind: 'guard' | 'guide' | 'silence'
  /** The API understands the semantic surface, not the decorative host. */
  surface: 'gmail' | 'email' | 'social'
  location: string
  received: { from: string; meta: string; body: string }
  composerLabel: string
  placeholder: string
  /** Loaded on request, then analysed live. Never treated as a canned result. */
  suggestedDraft: string
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'provision',
    app: 'gmail',
    tab: 'Rent reminder',
    moment: 'An arrears reminder before coffee',
    kind: 'guard',
    surface: 'gmail',
    location: 'Inbox · Re: Proof of payment for 00814 Greenlee',
    received: {
      from: 'Nosipho Majola · Lansdowne Investments',
      meta: 'to me, 08:14',
      body:
        'This is a friendly reminder to submit proof of payment for your arrears of R1,183.45 by replying to this email. If you need assistance, please feel free to contact me. Thank you for your cooperation.',
    },
    composerLabel: 'Your reply to Nosipho',
    placeholder: 'Write what you would actually send back.',
    suggestedDraft:
      'Hey Nosipho, thank you for the reminder. I do not have the money at the moment and things are hard right now. Could you please give me two months?',
  },
  {
    id: 'rejection',
    app: 'gmail',
    tab: 'The rejection',
    moment: 'Six weeks of hope, answered in one email',
    kind: 'guard',
    surface: 'gmail',
    location: 'Inbox · Re: Senior Engineer, final stage',
    received: {
      from: 'Talent Team · Meridian',
      meta: 'to me, 08:14',
      body:
        'Thank you for the time you gave us over the last six weeks. After the final panel we have decided to move forward with another candidate. We know how much preparation this took and we are grateful for it.',
    },
    composerLabel: 'Your reply',
    placeholder: 'Write what you would actually send back.',
    suggestedDraft:
      'Six weeks, four interviews and a take-home for a form email. Thanks for wasting my time. Good luck with the candidate who had more of it.',
  },
  {
    id: 'support',
    app: 'slack',
    tab: 'A willing yes',
    moment: 'Carrying a colleague, freely',
    kind: 'guide',
    surface: 'email',
    location: '#project-delivery · Priya',
    received: {
      from: 'Priya Shah',
      meta: '11:20 · in #project-delivery',
      body:
        'My son is unwell and I need to take him to the clinic tomorrow. Would you be able to carry the Thursday handover? Please say no if it puts you under pressure.',
    },
    composerLabel: 'Message #project-delivery',
    placeholder: 'Reply to Priya…',
    suggestedDraft:
      'Be with your family, Priya. I can carry Thursday for you, and I will send you a short update when it is done.',
  },
  {
    id: 'courage',
    app: 'teams',
    tab: 'Courage with power',
    moment: 'Speaking truth when the room is senior',
    kind: 'guard',
    surface: 'email',
    location: 'Migration launch · Leadership channel',
    received: {
      from: 'Daniel · VP Engineering',
      meta: '16:42 · 8 people in this channel',
      body:
        'Leadership has committed us to shipping the migration this Friday. Let us make it happen. I need everyone aligned behind the date.',
    },
    composerLabel: 'Start a post',
    placeholder: 'Reply to the channel…',
    suggestedDraft:
      'I want us to hit this, but Friday is not safe. We would be pushing an untested migration to production, and the people committing to it will not be the ones cleaning up the outage. Can we agree a realistic date?',
  },
  {
    id: 'grief',
    app: 'whatsapp',
    tab: 'Staying with grief',
    moment: 'Staying with grief, without trying to fix it',
    kind: 'guard',
    surface: 'email',
    location: 'Family ❤️ · 6 participants',
    received: {
      from: 'Lwazi M.',
      meta: 'today at 06:40',
      body:
        'Guys… I am so sorry to share that Aunt Miriam passed this morning. She is at peace now. Please keep Mom in your prayers.',
    },
    composerLabel: 'Message',
    placeholder: 'Type a message',
    suggestedDraft:
      'I am so sorry. She is in a better place now and at least you had all that time together. Everything happens for a reason. Sending love.',
  },
  {
    id: 'reaction',
    app: 'x',
    tab: 'The public reaction',
    moment: 'A wound, one click from public',
    kind: 'guard',
    surface: 'social',
    location: 'Replying to @mvale_builds',
    received: {
      from: 'Marcus Vale · @mvale_builds',
      meta: '2m',
      body:
        'Cute theory. Anyone who has actually shipped product knows this is nonsense.',
    },
    composerLabel: 'Post your reply',
    placeholder: 'Post your reply',
    suggestedDraft:
      'That is not what the data says. Churn dropped 18% after the change and it is in the report. But sure, keep guessing from the sidelines.',
  },
  {
    id: 'good-news',
    app: 'linkedin',
    tab: 'Good news',
    moment: 'Good news, received as thanks',
    kind: 'guide',
    surface: 'social',
    location: 'Create a post · Anyone',
    received: {
      from: 'Your network',
      meta: 'A professional milestone',
      body:
        'Share an update with the people who helped you get here.',
    },
    composerLabel: 'Share your news',
    placeholder: 'What do you want to talk about?',
    suggestedDraft:
      'Three years, a lot of late nights, and a team I would run through walls for - today I am stepping into the Head of Design role. Grateful does not begin to cover it.',
  },
  {
    id: 'ordinary',
    app: 'slack',
    tab: 'Knows when to stay quiet',
    moment: 'A message that needs nothing from us',
    kind: 'silence',
    surface: 'email',
    location: '#project-delivery · Priya',
    received: {
      from: 'Priya Shah',
      meta: '11:24 · in #project-delivery',
      body: 'Moving our sync to Thursday at 10:00. Does that work for you?',
    },
    composerLabel: 'Message #project-delivery',
    placeholder: 'Reply to Priya…',
    suggestedDraft: 'Received. Thursday at 10 works. I will join from the usual link.',
  },
]
