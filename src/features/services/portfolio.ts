import { z } from 'zod';
import { services, staffMembers, type ServiceId, type StaffId } from '../../content/salon';

const attribution = z.object({
  staff: z.enum(staffMembers.map(person => person.id)),
  service: z.enum(services.map(service => service.id)),
});
const price = z.number().int().min(1).max(999_999_999);
export const portfolioSchema = z.object({
  photos: z.array(attribution.extend({
    id: z.string().regex(/^[a-f0-9]{64}$/),
    width: z.number().int().min(1).max(1440),
    height: z.number().int().min(1).max(1440),
  })).max(12),
  tariffs: z.array(attribution.extend({ minimum: price, maximum: price.nullable() })
    .refine(rate => rate.maximum === null || rate.maximum >= rate.minimum)).max(4),
});
export type Portfolio = z.infer<typeof portfolioSchema>;
export const emptyPortfolio: Portfolio = { photos: [], tariffs: [] };
export const portfolioEndpoint = (process.env.NEXT_PUBLIC_BASE_PATH ?? '/tina-preview') + '/api/services.php';
export const photoUrl = (id: string) => portfolioEndpoint + '?photo=' + encodeURIComponent(id);

export async function readPortfolio(signal: AbortSignal): Promise<Portfolio> {
  const response = await fetch(portfolioEndpoint, {
    credentials: 'omit', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
  });
  if (!response.ok) throw new Error('PORTFOLIO_UNAVAILABLE');
  return portfolioSchema.parse(await response.json());
}

export function artistPortfolio(portfolio: Portfolio, staff: StaffId, service: ServiceId) {
  const matches = (item: { staff: StaffId; service: ServiceId }) => item.staff === staff && item.service === service;
  return { photos: portfolio.photos.filter(matches), tariff: portfolio.tariffs.find(matches) };
}
