import type { SafetyFlag } from './contracts'

/**
 * Narrow deterministic backstop for explicit safety language.
 *
 * This is not diagnosis or sentiment analysis. It exists so a model refusal
 * cannot turn an unmistakable crisis disclosure into a generic 503.
 */
const EXPLICIT_PATTERNS: Array<{ flag: SafetyFlag; patterns: RegExp[] }> = [
  {
    flag: 'self_harm',
    patterns: [
      /\b(kill myself|end my life|take my own life|hurt myself|harm myself)\b/i,
      /\b(i want to die|i do not want to live|i don'?t want to live)\b/i,
    ],
  },
  {
    flag: 'abuse_disclosure',
    patterns: [
      /\b(i am being abused|i'?m being abused|my partner (hits|hurts|abuses) me)\b/i,
    ],
  },
  {
    flag: 'threat',
    patterns: [
      /\b(threatened to (kill|hurt) me|said (he|she|they) (will|would) (kill|hurt) me)\b/i,
    ],
  },
  {
    flag: 'crisis',
    patterns: [
      /\b(i am in immediate danger|i'?m in immediate danger|i cannot go on|i can'?t go on)\b/i,
    ],
  },
]

export function detectExplicitSafety(text: string): SafetyFlag[] {
  return EXPLICIT_PATTERNS
    .filter((entry) => entry.patterns.some((pattern) => pattern.test(text)))
    .map((entry) => entry.flag)
}
