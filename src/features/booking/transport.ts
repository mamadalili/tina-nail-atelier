export function bookingEndpoints(adapter?: string, basePath = '') {
  const prefix = basePath.replace(/\/$/, '');
  const php = `${prefix}/api/booking.php`;
  return adapter === 'shared-host'
    ? { appointment: php, availability: (date: string) => `${php}?date=${encodeURIComponent(date)}` }
    : { appointment: `${prefix}/api/appointment-requests`, availability: (date: string) => `${prefix}/api/availability?date=${encodeURIComponent(date)}` };
}

export const bookingApi = bookingEndpoints(process.env.NEXT_PUBLIC_BOOKING_ADAPTER, process.env.NEXT_PUBLIC_BASE_PATH);

export function bookingFailureErrors(body: { errors?: unknown; message?: unknown }): Record<string, string> {
  if (body.errors && typeof body.errors === 'object' && !Array.isArray(body.errors)) {
    const fields = Object.entries(body.errors).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0);
    if (fields.length) return Object.fromEntries(fields);
  }
  return { form: typeof body.message === 'string' && body.message ? body.message : 'ثبت نوبت انجام نشد. دوباره تلاش کن.' };
}
