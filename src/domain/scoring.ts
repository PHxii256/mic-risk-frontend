/**
 * Mirror of the backend's `Domain/RiskScoring.cs`. These two files define the same rules and
 * must change together — the server computes the scores, this file only has to agree with it so
 * the UI can band, colour and sort without a round trip.
 */

export const MIN_RATING = 1
export const MAX_RATING = 5

/** The 1-5 scale every rating uses, for rendering pickers. */
export const RATINGS = [1, 2, 3, 4, 5] as const
export type Rating = (typeof RATINGS)[number]

export const RISK_BANDS = ['Low', 'Moderate', 'High', 'Critical'] as const
export type RiskBand = (typeof RISK_BANDS)[number]

export function isRating(value: number): value is Rating {
  return Number.isInteger(value) && value >= MIN_RATING && value <= MAX_RATING
}

/** Severity x Frequency, so 1 through 25. */
export function inherentRisk(severity: number, frequency: number): number {
  return severity * frequency
}

/**
 * Inherent risk carried through the control rating, so 1 through 125.
 *
 * Control effectiveness runs 1 = very strong to 5 = very weak, which makes the rating a
 * multiplier on exposure rather than a discount. Strong controls (1) leave residual equal to
 * inherent; weak controls (5) multiply it fivefold. Residual is therefore always greater than or
 * equal to inherent — the reverse of the usual convention, so the UI must label the two
 * explicitly rather than implying one is a reduction of the other.
 */
export function residualRisk(
  severity: number,
  frequency: number,
  controlEffectiveness: number,
): number {
  return inherentRisk(severity, frequency) * controlEffectiveness
}

/** A control rating at or above this counts as weak. */
export const WEAK_CONTROL_THRESHOLD = 4

export function isWeakControl(controlEffectiveness: number): boolean {
  return controlEffectiveness >= WEAK_CONTROL_THRESHOLD
}

/**
 * Bands apply to both scores on the same thresholds. That holds cleanly for inherent (1-25) and
 * for well-controlled risks, where residual equals inherent and lands in the same band.
 *
 * Known limitation, tracked in the design spec: against residual's 1-125 range these thresholds
 * saturate, putting 58% of the possible combinations in Critical.
 */
export function riskBand(score: number): RiskBand {
  if (score <= 5) return 'Low'
  if (score <= 10) return 'Moderate'
  if (score <= 15) return 'High'
  return 'Critical'
}

/** Ordering for sorting and for choosing the more severe of two bands. */
export const BAND_SEVERITY: Record<RiskBand, number> = {
  Low: 0,
  Moderate: 1,
  High: 2,
  Critical: 3,
}

/** Labels for the control rating, whose numbering is the opposite of what readers expect. */
export const CONTROL_EFFECTIVENESS_KEYS: Record<Rating, string> = {
  1: 'control.veryStrong',
  2: 'control.strong',
  3: 'control.moderate',
  4: 'control.weak',
  5: 'control.veryWeak',
}

export const SEVERITY_KEYS: Record<Rating, string> = {
  1: 'severity.veryLow',
  2: 'severity.low',
  3: 'severity.moderate',
  4: 'severity.high',
  5: 'severity.veryHigh',
}

export const FREQUENCY_KEYS: Record<Rating, string> = {
  1: 'frequency.rare',
  2: 'frequency.unlikely',
  3: 'frequency.possible',
  4: 'frequency.likely',
  5: 'frequency.almostCertain',
}

export const PRIORITY_KEYS: Record<Rating, string> = {
  1: 'priority.veryLow',
  2: 'priority.low',
  3: 'priority.moderate',
  4: 'priority.high',
  5: 'priority.veryHigh',
}
