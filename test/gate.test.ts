import { describe, expect, it } from 'vitest'
import { gate } from '../src/lib/detector'

/**
 * The gate decides one thing: is this draft worth a single server call.
 *
 * It is not the classifier. It errs open, because the model behind it is the
 * strict one, and a gate tuned to catch wrongdoing is the failure the old
 * detector encoded. A person on the other end is the whole test.
 */
describe('gate', () => {
  it('passes real gratitude', () => {
    const result = gate('Thank you for covering for me last week. I know it cost you your own deadlines and I noticed.')
    expect(result.pass).toBe(true)
  })

  it('passes a congratulation', () => {
    const result = gate('Congratulations on the launch. It looked like a lot of work and it came together well.')
    expect(result.pass).toBe(true)
  })

  it('passes a gracious reply that has nothing wrong with it', () => {
    // wgt-02. Calm on its face. The old detector could not see this at all.
    const result = gate('Thank you for the update. I understand the decision. If you are open to it I would value any feedback from the panel.')
    expect(result.pass).toBe(true)
  })

  it('passes someone reporting hostility they received', () => {
    // quo-05. The old detector discounted quoted material as a false positive.
    // This person is in the moment the product exists for.
    const result = gate('The review said my work was amateur hour. I want to respond well rather than react.')
    expect(result.pass).toBe(true)
  })

  it('passes a hostile draft and surfaces what it saw', () => {
    const result = gate('You clearly have no idea what you are talking about. Did you even read it? This is idiotic.')
    expect(result.pass).toBe(true)
    expect(result.evidence.length).toBeGreaterThan(0)
  })

  it('passes a bland draft once the message being answered is supplied', () => {
    // Nothing in the draft. The weight is entirely in what arrived.
    const draft = 'Thanks for letting me know.'
    expect(gate(draft).pass).toBe(false)
    expect(gate(draft, 'We have decided to move forward with another candidate.').pass).toBe(true)
  })

  it('stops scheduling logistics', () => {
    expect(gate('Sounds good, I will pick this up in the morning and send the draft across before lunch.').reason).toBe('logistics')
    expect(gate('Can you confirm whether the invoice went out on Friday? I cannot see it in the shared folder.').reason).toBe('logistics')
    expect(gate('I have attached the updated figures. The variance is mostly the currency move in June.').reason).toBe('logistics')
  })

  it('stops a draft too short to act on', () => {
    expect(gate('ok thanks').reason).toBe('too_short')
  })

  it('does not treat perfunctory thanks as gratitude', () => {
    expect(gate('Thanks, that works for me. Tuesday at ten is fine and I will send an invite.').pass).toBe(false)
  })

  it('does not mistake good news for an acknowledgement', () => {
    // "We got it" is the news, not "got it" the acknowledgement. Bare
    // acknowledgements open the message; this one is answering something.
    const result = gate('We got it. After everything this year I did not think we would, and I want to sit with that for a minute before I reply to everyone.')
    expect(result.pass).toBe(true)
  })

  it('reports evidence short enough to show, and never the whole draft', () => {
    const result = gate('You never listen and it is pathetic!! Every single time.')
    for (const item of result.evidence) {
      expect(item.length).toBeLessThan(60)
    }
  })
})
