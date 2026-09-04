export function requestObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value));
}

export function requestParam(value: unknown, name: string): string | undefined {
  const params = requestObject(value);
  return typeof params[name] === 'string' ? params[name] : undefined;
}
