/**
 * The moments this is actually for.
 *
 * Not a fight on the internet. Ordinary correspondence, on a day when what
 * you write back matters: you were turned down, you were blamed for something
 * you did not do, someone you work with is grieving.
 *
 * Each scenario ships with the message received, so the person can feel the
 * weight of it. That message is never sent anywhere. Second Word only ever
 * sees what you type.
 */

export interface Scenario {
  id: string
  tab: string
  surface: 'email' | 'social'
  /** Where this is happening, shown as a header. */
  location: string
  received: { from: string; meta: string; body: string }
  composerLabel: string
  placeholder: string
  /** A draft a person might really write here. Loaded on request, never automatically. */
  suggestedDraft: string
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'decline',
    tab: 'A decline',
    surface: 'email',
    location: 'Inbox - Re: Senior Engineer, final stage',
    received: {
      from: 'Talent Team, Meridian',
      meta: 'to me, 08:14',
      body:
        'Thank you for the time you gave us over the last six weeks. After the final panel we have decided to move forward with another candidate. We know how much preparation this took and we are grateful for it. We wish you everything of the best.',
    },
    composerLabel: 'Your reply',
    placeholder: 'Write what you would actually send back.',
    suggestedDraft:
      'Thanks for letting me know. Six weeks, four interviews and a take-home for a form email. Good luck with the candidate who had more time on their hands.',
  },
  {
    id: 'blamed',
    tab: 'Blamed for something you did not do',
    surface: 'email',
    location: 'Inbox - Re: Client handover went badly',
    received: {
      from: 'Dave, Delivery Lead',
      meta: 'to me, +4 others, 16:52',
      body:
        'Copying in the team so we are all aligned. The handover pack was never sent, which is why the client meeting fell apart this morning. I need us to be far more careful with the basics going forward.',
    },
    composerLabel: 'Your reply, to Dave and four colleagues',
    placeholder: 'Write what you would actually send back.',
    suggestedDraft:
      'Dave, I sent the handover pack on the 14th and you were on the email. Maybe check your inbox before you copy in the whole team next time. This is exactly the kind of thing that makes people not want to work with you.',
  },
  {
    id: 'grief',
    tab: 'Someone is grieving',
    surface: 'email',
    location: 'Inbox - Out for a few days',
    received: {
      from: 'Nomsa',
      meta: 'to the team, 06:40',
      body:
        'Morning everyone. My father passed away on Saturday. I will be away for the rest of the week and back after the funeral. Sipho has the client files if anything urgent comes up.',
    },
    composerLabel: 'Your reply to Nomsa',
    placeholder: 'Write what you would actually send back.',
    suggestedDraft:
      'So sorry to hear this Nomsa. He is in a better place now and everything happens for a reason. At least you got to say goodbye. Let me know if you need anything and do not worry about the client files at all.',
  },
  {
    id: 'ordinary',
    tab: 'An ordinary message',
    surface: 'email',
    location: 'Inbox - Re: Thursday handover',
    received: {
      from: 'Priya',
      meta: 'to me, 11:20',
      body:
        'Morning. Are you still able to take the Thursday handover, or should I ask Sipho? No pressure either way, I just need to know before I send the invite.',
    },
    composerLabel: 'Your reply',
    placeholder: 'Write what you would actually send back.',
    // Nothing is at stake here. Press Second Word anyway: it should decline.
    suggestedDraft:
      'Sounds good, I will pick this up in the morning and send the draft across before lunch.',
  },
  {
    id: 'social',
    tab: 'A public argument',
    surface: 'social',
    location: 'r/homelab - 214 comments',
    received: {
      from: 'u/thr0ughput',
      meta: '2h',
      body:
        'Three weekends for that? You could have just read the documentation. Some people really should not be doing this stuff.',
    },
    composerLabel: 'Your reply',
    placeholder: 'Write what you would actually send back.',
    suggestedDraft:
      'You clearly have no idea what you are talking about. Did you even read it? This is idiotic.',
  },
]
