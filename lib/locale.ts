import { messages } from '@/lib/messages';

export const APP_LOCALE = 'ar-SA';

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString(APP_LOCALE);
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(APP_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatStatusLabel(status: string) {
  return messages.statusLabels[status as keyof typeof messages.statusLabels] ?? status.replaceAll('_', ' ');
}

export function formatEventLabel(eventType: string) {
  return messages.eventLabels[eventType as keyof typeof messages.eventLabels] ?? eventType.replaceAll('_', ' ');
}
