/**
 * @fileoverview DayJS-based date helpers.
 * Centralizes all date creation, comparison, and formatting for the auth module.
 *
 * Use `import dayjs = require('dayjs')` so Nest's CommonJS emit does not look for
 * a non-existent `dayjs.default` (which caused signup to fail at runtime).
 */
import dayjs = require('dayjs');
import type { Dayjs } from 'dayjs';

export type DateInput = string | number | Date | Dayjs;

export function now(): Dayjs {
  return dayjs();
}

export function toDate(input?: DateInput): Date {
  return dayjs(input).toDate();
}

export function nowMs(): number {
  return dayjs().valueOf();
}

export function addMs(ms: number, from?: DateInput): Date {
  return dayjs(from).add(ms, 'millisecond').toDate();
}

export function addMinutes(minutes: number, from?: DateInput): Date {
  return dayjs(from).add(minutes, 'minute').toDate();
}

export function isBeforeNow(input: DateInput): boolean {
  return dayjs(input).isBefore(dayjs());
}

export function isSameOrAfterNow(input: DateInput): boolean {
  return !dayjs(input).isBefore(dayjs());
}

export function toIsoString(input?: DateInput): string {
  return dayjs(input).toISOString();
}
