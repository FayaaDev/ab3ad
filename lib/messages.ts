import ar from '@/locales/ar.json';

export const messages = ar;

export function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/%\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}
