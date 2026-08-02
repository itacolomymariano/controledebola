import { PeladaEvent } from '../models/event.model';

export function resolveInviteResponseDeadline(event: PeladaEvent, now = new Date()): Date {
  const closesAt = event.registrationClosesAt ? new Date(event.registrationClosesAt) : null;
  if (closesAt && !Number.isNaN(closesAt.getTime()) && closesAt > now) {
    return closesAt;
  }

  const startTime = new Date(event.startTime);
  if (!Number.isNaN(startTime.getTime())) {
    const oneHourBeforeEvent = new Date(startTime.getTime() - 60 * 60 * 1000);
    if (oneHourBeforeEvent > now) {
      return oneHourBeforeEvent;
    }
  }

  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function combineDateAndTimeInputs(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function minDateInputValue(now = new Date()): string {
  return toDateInputValue(now);
}
