import { z } from 'zod';

export const maxJourneyMs = 24 * 60 * 60 * 1000;
export const journeyId = z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
export const elapsedMs = z.number().int().min(0).max(maxJourneyMs);
export const metricEvent = z.discriminatedUnion('event', [
  z.strictObject({ id: journeyId, event: z.literal('start') }),
  z.strictObject({ id: journeyId, event: z.literal('selected'), elapsedMs }),
  z.strictObject({ id: journeyId, event: z.literal('receipt') }),
]);
export type MetricEvent = z.infer<typeof metricEvent>;
