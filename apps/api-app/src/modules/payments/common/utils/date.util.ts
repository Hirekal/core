/**
 * @fileoverview DayJS-based date helpers for the payments module.
 */
import * as dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

export type DateInput = string | number | Date | Dayjs;

/*
 * Returns the current date as a dayjs instance.
 */
export function now(): Dayjs {
  return dayjs();
}

/*
 * Converts a dayjs-compatible value to a JavaScript Date.
 */
export function toDate(input?: DateInput): Date {
  return dayjs(input).toDate();
}

/*
 * Converts a Unix timestamp to a JavaScript Date.
 */
export function toDateFromUnix(value: number | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  return dayjs.unix(value).toDate();
}

/*
 * Formats a date value as an ISO 8601 string.
 */
export function toIsoString(input?: DateInput): string {
  return dayjs(input).toISOString();
}

/*
 * Is Before Now.
 */
export function isBeforeNow(input: DateInput): boolean {
  return dayjs(input).isBefore(dayjs());
}
