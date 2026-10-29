export function getApiRoot(configuredUrl) {
  const origin = (configuredUrl ?? '').trim().replace(/\/+$/, '');
  if (!origin) return '/api';
  return origin.endsWith('/api') ? origin : `${origin}/api`;
}
