import { z } from 'zod'

/**
 * Priority is the risk department's call, not the reporter's. The API still requires the field,
 * and 1 is the value the database column itself defaults to, so that is what "not yet assessed"
 * looks like on the wire.
 */
export const UNSET_PRIORITY = 1

// Mirrors the server, which enforces 1-5 on all four ratings with both a validator and a
// database check constraint.
const rating = z.coerce.number().int().min(1).max(5)

export const evaluationSchema = z.object({
  severity: rating,
  frequency: rating,
  controlEffectiveness: rating,
  priority: rating,
  existingMeasures: z.string().trim().optional(),
  proposedMeasures: z.string().trim().optional(),
})

/** The form's own shape. `z.coerce` makes the parsed output differ, so parse on submit. */
export type EvaluationValues = z.input<typeof evaluationSchema>
