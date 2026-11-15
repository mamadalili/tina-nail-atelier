export function isAllowedOrigin(origin: string | null, host: string | null, configuredSite: string | undefined, protocol = 'http:') {
  if (!origin) return false;
  try {
    if (configuredSite) return origin === new URL(configuredSite).origin;
    if (!host) return false;
    const local = new URL(`${protocol}//${host}`);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(local.hostname)) return false;
    return origin === local.origin;
  } catch { return false; }
}
